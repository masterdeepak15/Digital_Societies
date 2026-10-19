using System.Net.Http.Json;
using Microsoft.Extensions.Logging;
using DigitalSocieties.Shared.Contracts;

namespace DigitalSocieties.Communication.Infrastructure.Push;

/// <summary>
/// Sends push notifications via the Expo Push API.
/// Implements INotificationChannel — OCP: swap to FCM direct or APNs without changing callers.
/// Recipient in NotificationMessage is the userId (Guid string); resolved to push tokens via IPushTokenStore.
/// </summary>
public sealed class ExpoPushChannel : INotificationChannel
{
    private readonly IHttpClientFactory      _httpFactory;
    private readonly IPushTokenStore         _tokenStore;
    private readonly ILogger<ExpoPushChannel> _logger;

    private const string ExpoApiUrl = "https://exp.host/--/api/v2/push/send";

    public ExpoPushChannel(IHttpClientFactory httpFactory,
                           IPushTokenStore tokenStore,
                           ILogger<ExpoPushChannel> logger)
    {
        _httpFactory = httpFactory;
        _tokenStore  = tokenStore;
        _logger      = logger;
    }

    // ── INotificationChannel ──────────────────────────────────────────────
    public string ChannelName => "push";
    public bool   IsEnabled   => true;

    public async Task<bool> SendAsync(NotificationMessage message, CancellationToken ct = default)
    {
        // Recipient is the userId as a Guid string
        if (!Guid.TryParse(message.Recipient, out var userId))
        {
            _logger.LogWarning("ExpoPushChannel: recipient '{Recipient}' is not a valid user ID.",
                message.Recipient);
            return false;
        }

        // A visitor alert is addressed to a flat: every resident of that flat gets it.
        var tokens = ExpoPushPayloads.IsFlatRecipient(message)    ? await _tokenStore.GetTokensForFlatAsync(userId, ct)
                   : ExpoPushPayloads.IsSocietyRecipient(message) ? await _tokenStore.GetTokensForSocietyAsync(userId, ct)
                   : await _tokenStore.GetTokensAsync(userId, ct);
        if (tokens.Count == 0) return true; // no tokens registered — not an error

        var payloads = ExpoPushPayloads.Build(message, tokens);

        using var client = _httpFactory.CreateClient("expo");
        try
        {
            var response = await client.PostAsJsonAsync(ExpoApiUrl, payloads, ct);
            if (!response.IsSuccessStatusCode)
            {
                var body = await response.Content.ReadAsStringAsync(ct);
                _logger.LogWarning("Expo push failed {Status}: {Body}",
                    response.StatusCode, body);
                return false;
            }
            return true;
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Expo push exception for user {UserId}", userId);
            return false;
        }
    }
}

/// <summary>
/// How a notification is shaped for the Expo push service. The channel decides the ring and the vibration on Android,
/// so a visitor at the gate uses the loud "visitors" channel and chat uses a softer one.
/// </summary>
public static class ExpoPushPayloads
{
    public const string ChannelKey = "channelId";
    public const string RecipientKindKey = "recipientKind";

    public static bool IsFlatRecipient(NotificationMessage m)
        => m.Data is not null && m.Data.TryGetValue(RecipientKindKey, out var k) && k == "flat";

    /// <summary>Addressed to a whole society: the recipient is the society id and every phone registered in it gets it.</summary>
    public static bool IsSocietyRecipient(NotificationMessage m)
        => m.Data is not null && m.Data.TryGetValue(RecipientKindKey, out var k) && k == "society";

    /// <summary>The channel named in the message, else one chosen from its type, else the default.</summary>
    public static string ChannelOf(NotificationMessage m)
    {
        if (m.Data is { } d)
        {
            if (d.TryGetValue(ChannelKey, out var c) && !string.IsNullOrWhiteSpace(c)) return c;
            if (d.TryGetValue("type", out var t))
                return t switch { "visitor" => "visitors", "emergency" => "emergency", "chat" => "chat", _ => "general" };
        }
        return "general";
    }

    public static List<object> Build(NotificationMessage m, IEnumerable<string> tokens)
    {
        var channel = ChannelOf(m);
        var loud = channel is "visitors" or "emergency";
        var data = new Dictionary<string, string>(m.Data ?? new Dictionary<string, string>());
        data.Remove(RecipientKindKey);
        return tokens.Select(token => (object)new
        {
            to        = token,
            title     = m.Subject,
            body      = m.Body,
            sound     = "default",
            priority  = "high",          // delivered at once, even when the phone is dozing
            channelId = channel,         // Android: decides the ring and the vibration
            ttl       = loud ? 120 : 3600, // a visitor alert that is two minutes old is no longer useful
            data,
        }).ToList();
    }
}

/// <summary>Abstraction for storing and retrieving Expo push tokens per user.</summary>
public interface IPushTokenStore
{
    Task<List<string>> GetTokensAsync(Guid userId, CancellationToken ct);
    /// <summary>Tokens of every resident of a flat (anyone with an active membership on that flat).</summary>
    Task<List<string>> GetTokensForFlatAsync(Guid flatId, CancellationToken ct);
    /// <summary>Tokens of every phone registered in a society.</summary>
    Task<List<string>> GetTokensForSocietyAsync(Guid societyId, CancellationToken ct);
    Task UpsertAsync(Guid userId, Guid societyId, string expoPushToken, CancellationToken ct);
    Task RemoveAsync(Guid userId, string expoPushToken, CancellationToken ct);
}
