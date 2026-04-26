using System.Text.Json;
using Microsoft.Extensions.Options;
using Microsoft.Extensions.Logging;
using DigitalSocieties.Shared.Contracts;

namespace DigitalSocieties.Communication.Infrastructure.Channels;

public sealed class Msg91Settings
{
    public const string SectionName = "Notification:Sms";
    public string ApiKey   { get; init; } = default!;
    public string SenderId { get; init; } = "DGSOC";
    public bool   Enabled  { get; init; } = true;
}

/// <summary>
/// MSG91 SMS channel. India's primary OTP + transactional SMS provider.
/// OCP: new channel = new class implementing INotificationChannel.
/// Registered alongside WhatsApp, Push, Email channels — each independent.
/// </summary>
public sealed class Msg91SmsChannel : INotificationChannel
{
    public string ChannelName => "sms";
    public bool   IsEnabled   => _settings.Enabled;

    private readonly Msg91Settings _settings;
    private readonly HttpClient    _http;
    private readonly ILogger<Msg91SmsChannel> _log;

    public Msg91SmsChannel(IOptions<Msg91Settings> settings,
                           IHttpClientFactory factory,
                           ILogger<Msg91SmsChannel> log)
    {
        _settings = settings.Value;
        _http     = factory.CreateClient("msg91");
        _log      = log;
    }

    public async Task<bool> SendAsync(NotificationMessage message, CancellationToken ct)
    {
        if (!IsEnabled) return true;

        try
        {
            // MSG91 transactional SMS API
            var payload = new
            {
                template_id = message.TemplateId ?? "",
                sender      = _settings.SenderId,
                short_url   = "0",
                mobiles     = message.Recipient.Replace("+", ""),  // MSG91 wants no +
                var1        = message.Data?.GetValueOrDefault("var1") ?? message.Body,
                var2        = message.Data?.GetValueOrDefault("var2") ?? "",
                var3        = message.Data?.GetValueOrDefault("var3") ?? "",
            };

            var request = new HttpRequestMessage(HttpMethod.Post,
                "https://api.msg91.com/api/v5/flow/")
            {
                Content = new StringContent(
                    JsonSerializer.Serialize(payload),
                    System.Text.Encoding.UTF8, "application/json")
            };
            request.Headers.Add("authkey", _settings.ApiKey);

            var response = await _http.SendAsync(request, ct);
            if (!response.IsSuccessStatusCode)
            {
                var body = await response.Content.ReadAsStringAsync(ct);
                _log.LogWarning("[MSG91] SMS failed to {Phone}: {Error}", message.Recipient, body);
                return false;
            }
            return true;
        }
        catch (Exception ex)
        {
            _log.LogError(ex, "[MSG91] Exception sending SMS to {Phone}", message.Recipient);
            return false;
        }
    }
}
