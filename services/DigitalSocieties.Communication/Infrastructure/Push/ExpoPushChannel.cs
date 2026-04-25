using System.Net.Http.Json;
using System.Text.Json;
using Microsoft.Extensions.Logging;
using DigitalSocieties.Shared.Contracts;

namespace DigitalSocieties.Communication.Infrastructure.Push;

/// <summary>
/// Sends push notifications via the Expo Push API.
/// Implements INotificationChannel — OCP: swap to FCM direct or APNs without changing callers.
/// </summary>
public sealed class ExpoPushChannel : INotificationChannel
{
    private readonly IHttpClientFactory _httpFactory;
    private readonly IPushTokenStore    _tokenStore;
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

    public async Task SendAsync(string recipient, string message,
                                string? subject = null, CancellationToken ct = default)
    {
        // recipient is userId (Guid string) — resolve to push tokens
        if (!Guid.TryParse(recipient, out var userId)) return;

        var tokens = await _tokenStore.GetTokensAsync(userId, ct);
        if (tokens.Count == 0) return;

        var messages = tokens.Select(token => new
        {
            to      = token,
            title   = subject ?? "Digital Societies",
            body    = message,
            sound   = "default",
            data    = new { },
        }).ToList();

        using var client = _httpFactory.CreateClient("expo");
        try
        {
            var response = await client.PostAsJsonAsync(ExpoApiUrl, messages, ct);
            if (!response.IsSuccessStatusCode)
            {
                var body = await response.Content.ReadAsStringAsync(ct);
                _logger.LogWarning("Expo push failed {Status}: {Body}",
                    response.StatusCode, body);
            }
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Expo push exception for user {UserId}", userId);
        }
    }
}

/// <summary>Abstraction so ExpoPushChannel doesn't depend on a DB context directly.</summary>
public interface IPushTokenStore
{
    Task<List<string>> GetTokensAsync(Guid userId, CancellationToken ct);
    Task UpsertAsync(Guid userId, Guid societyId, string expoPushToken, CancellationToken ct);
    Task RemoveAsync(Guid userId, string expoPushToken, CancellationToken ct);
}
