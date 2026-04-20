namespace DigitalSocieties.Shared.Contracts;

/// <summary>
/// OCP: new channels (SMS, WhatsApp, Push, Email) added by implementing this interface.
/// The notification orchestrator never changes — only new concrete classes are added.
/// </summary>
public interface INotificationChannel
{
    string ChannelName { get; }
    bool   IsEnabled   { get; }
    Task<bool> SendAsync(NotificationMessage message, CancellationToken ct = default);
}

public sealed record NotificationMessage(
    string  Recipient,        // phone / email / device-token depending on channel
    string  Subject,
    string  Body,
    string? TemplateId = null,
    Dictionary<string, string>? Data = null);
