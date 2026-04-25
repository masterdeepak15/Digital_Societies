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

        var tokens = await _tokenStore.GetTokensAsync(userId, ct);
        if (tokens.Count == 0) return true; // no tokens registered — not an error

        var payloads = tokens.Select(token => new
        {
            to      = token,
            title   = message.Subject,
            body    = message.Body,
            sound   = "default",
            data    = message.Data ?? new Dictionary<string, string>(),
        }).ToList();

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

/// <summary>Abstraction for storing and retrieving Expo push tokens per user.</summary>
public interface IPushTokenStore
{
    Task<List<string>> GetTokensAsync(Guid userId, CancellationToken ct);
    Task UpsertAsync(Guid userId, Guid societyId, string expoPushToken, CancellationToken ct);
    Task RemoveAsync(Guid userId, string expoPushToken, CancellationToken ct);
}
