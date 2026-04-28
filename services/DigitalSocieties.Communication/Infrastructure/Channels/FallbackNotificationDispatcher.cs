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
    private readonly Msg91SmsChannel    _sms;
    private readonly ILogger<FallbackNotificationDispatcher> _log;

    public FallbackNotificationDispatcher(
        ExpoPushChannel  push,
        Msg91SmsChannel  sms,
        ILogger<FallbackNotificationDispatcher> log)
    {
        _push = push;
        _sms  = sms;
        _log  = log;
    }

    public async Task<string?> DispatchAsync(
        NotificationMessage message,
        string              recipientPhone,
        CancellationToken   ct = default)
    {
        // ── 1. Try push first (free, instant, rich) ───────────────────────
        if (_push.IsEnabled)
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
        if (_sms.IsEnabled)
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
