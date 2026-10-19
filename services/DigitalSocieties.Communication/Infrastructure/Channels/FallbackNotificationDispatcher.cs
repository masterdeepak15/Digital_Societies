using Microsoft.Extensions.Logging;
using DigitalSocieties.Shared.Contracts;
using DigitalSocieties.Communication.Infrastructure.Push;

namespace DigitalSocieties.Communication.Infrastructure.Channels;

/// <summary>
/// Guard offline hardening — SMS fallback notification dispatcher.
///
/// Strategy pattern: try the preferred channel (push) first; on failure or
/// when the recipient has no push token, automatically fall back to SMS.
/// This ensures visitor approval notifications reach residents even when:
///   • The resident's app is not installed / no push token registered
///   • The push delivery fails transiently
///   • The guard was offline and synced later (no real-time push possible)
///
/// Implements INotificationDispatcher from DigitalSocieties.Shared.Contracts
/// so any module can inject it without circular dependencies.
/// OCP: add more fallback channels by inserting them in the priority list.
/// </summary>
public sealed class FallbackNotificationDispatcher : INotificationDispatcher
{
    private readonly ExpoPushChannel    _push;
    private readonly INotificationChannel? _sms;   // null when SMS is not configured
    private readonly ISocietySettingsReader? _settings;
    private readonly ILogger<FallbackNotificationDispatcher> _log;

    public FallbackNotificationDispatcher(
        ExpoPushChannel  push,
        IEnumerable<INotificationChannel> channels,
        ILogger<FallbackNotificationDispatcher> log,
        ISocietySettingsReader? settings = null)
    {
        _settings = settings;
        _push = push;
        _sms  = channels.FirstOrDefault(c => c.ChannelName == "sms");
        _log  = log;
    }

    public async Task<string?> DispatchAsync(
        NotificationMessage message,
        string?             recipientPhone,
        CancellationToken   ct = default)
    {
        // A message for a society follows that society's switches (Settings > Notifications): push on, SMS off by default.
        var rules = message.SocietyId is { } society && _settings is not null ? await _settings.GetAsync(society, ct) : null;
        var pushAllowed = rules?.PushEnabled ?? true;
        var smsAllowed  = rules?.SmsEnabled  ?? true;

        // ── 1. Try push first (free, instant, rich) ───────────────────────
        if (_push.IsEnabled && pushAllowed)
        {
            try
            {
                bool pushOk = await _push.SendAsync(message, ct);
                if (pushOk)
                {
                    _log.LogInformation(
                        "[Dispatch] Push delivered to {Recipient}", message.Recipient);
                    return "push";
                }
            }
            catch (Exception ex)
            {
                _log.LogWarning(ex,
                    "[Dispatch] Push failed for {Recipient} — falling back to SMS", message.Recipient);
            }
        }

        // ── 2. Fall back to SMS (always reaches the phone number) ─────────
        if (_sms is { IsEnabled: true } && smsAllowed && !string.IsNullOrWhiteSpace(recipientPhone))
        {
            // SMS recipient = phone number, not userId
            var smsMessage = message with { Recipient = recipientPhone };
            try
            {
                bool smsOk = await _sms.SendAsync(smsMessage, ct);
                if (smsOk)
                {
                    _log.LogInformation(
                        "[Dispatch] SMS fallback delivered to {Phone}", recipientPhone);
                    return "sms";
                }
            }
            catch (Exception ex)
            {
                _log.LogError(ex,
                    "[Dispatch] SMS fallback also failed for {Phone}", recipientPhone);
            }
        }

        _log.LogError(
            "[Dispatch] All channels failed for recipient {Recipient} / phone {Phone}",
            message.Recipient, recipientPhone);
        return null;
    }
}
