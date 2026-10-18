using MailKit.Net.Smtp;
using MailKit.Security;
using Microsoft.Extensions.Hosting;
using Microsoft.Extensions.Logging;
using Microsoft.Extensions.Options;
using MimeKit;
using DigitalSocieties.Shared.Contracts;

namespace DigitalSocieties.Communication.Infrastructure.Channels;

/// <summary>Treats blank values and unexpanded "${VAR}" placeholders as "not set".</summary>
internal static class ConfigValue
{
    public static bool IsSet(string? v) => !string.IsNullOrWhiteSpace(v) && !v.TrimStart().StartsWith("${");
}

public sealed class EmailSettings
{
    public const string SectionName = "Notification:Email";

    public string? Host        { get; init; }
    public int     Port        { get; init; } = 587;
    /// <summary>"StartTls" (default), "SslOnConnect" or "None" (local catchers such as Mailpit).</summary>
    public string  Security    { get; init; } = "StartTls";
    public string? Username    { get; init; }
    public string? Password    { get; init; }
    public string? FromAddress { get; init; }
    public string  FromName    { get; init; } = "Digital Societies";

    public bool IsConfigured => ConfigValue.IsSet(Host) && ConfigValue.IsSet(FromAddress);
}

/// <summary>
/// SMTP email channel (MailKit). Works with any free SMTP relay: Gmail app password,
/// Brevo free tier, or Mailpit in development. OCP: just another INotificationChannel.
/// </summary>
public sealed class SmtpEmailChannel : INotificationChannel
{
    private readonly EmailSettings _settings;
    private readonly IHostEnvironment _env;
    private readonly ILogger<SmtpEmailChannel> _log;

    public SmtpEmailChannel(IOptions<EmailSettings> settings, IHostEnvironment env, ILogger<SmtpEmailChannel> log)
    {
        _settings = settings.Value;
        _env      = env;
        _log      = log;
    }

    public string ChannelName => "email";

    // In Development an unconfigured channel still "works" by logging the message,
    // so a fresh checkout can sign in without any SMTP account.
    public bool IsEnabled => _settings.IsConfigured || _env.IsDevelopment();

    public async Task<bool> SendAsync(NotificationMessage message, CancellationToken ct = default)
    {
        if (!_settings.IsConfigured)
        {
            if (_env.IsDevelopment())
            {
                _log.LogInformation("[Email:dev] SMTP not configured. To={To} Subject={Subject} Body={Body}",
                    message.Recipient, message.Subject, message.Body);
                return true;
            }
            _log.LogError("[Email] SMTP is not configured; cannot send to {To}", message.Recipient);
            return false;
        }

        try
        {
            var mime = new MimeMessage();
            mime.From.Add(new MailboxAddress(_settings.FromName, _settings.FromAddress));
            mime.To.Add(MailboxAddress.Parse(message.Recipient));
            mime.Subject = message.Subject;
            mime.Body    = new TextPart("plain") { Text = message.Body };

            using var client = new SmtpClient();
            await client.ConnectAsync(_settings.Host, _settings.Port, SocketOption(_settings.Security), ct);
            if (ConfigValue.IsSet(_settings.Username))
                await client.AuthenticateAsync(_settings.Username, _settings.Password ?? string.Empty, ct);
            await client.SendAsync(mime, ct);
            await client.DisconnectAsync(true, ct);
            return true;
        }
        catch (Exception ex)
        {
            // Never log the body: it contains the one-time code.
            _log.LogError(ex, "[Email] Failed to send to {To}", message.Recipient);
            return false;
        }
    }

    private static SecureSocketOptions SocketOption(string security) => security.ToLowerInvariant() switch
    {
        "none"         => SecureSocketOptions.None,
        "sslonconnect" => SecureSocketOptions.SslOnConnect,
        _              => SecureSocketOptions.StartTls,
    };
}
