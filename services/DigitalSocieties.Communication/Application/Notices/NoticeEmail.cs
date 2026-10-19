using DigitalSocieties.Shared.Contracts;
using Microsoft.Extensions.Logging;

namespace DigitalSocieties.Communication.Application.Notices;

/// <summary>A notice that should also go out by email to every member who has an address.</summary>
public sealed record NoticeEmail(Guid SocietyId, string Title, string Body, string Type);

/// <summary>Takes a notice for emailing and returns at once; a background worker sends it.</summary>
public interface INoticeEmailQueue
{
    void Enqueue(NoticeEmail notice);
}

/// <summary>Emails one notice to every member of its society, one message each, and counts the ones that went.</summary>
public sealed class NoticeEmailer
{
    private readonly ISocietyDirectory _directory;
    private readonly INotificationChannel? _email;
    private readonly ILogger<NoticeEmailer> _log;

    public NoticeEmailer(ISocietyDirectory directory, IEnumerable<INotificationChannel> channels, ILogger<NoticeEmailer> log)
    {
        _directory = directory;
        _email = channels.FirstOrDefault(c => c.ChannelName == "email");
        _log = log;
    }

    public async Task<int> SendAsync(NoticeEmail notice, CancellationToken ct)
    {
        if (_email is not { IsEnabled: true }) return 0;

        var subject = notice.Type.Equals("Emergency", StringComparison.OrdinalIgnoreCase) ? $"Emergency: {notice.Title}" : $"Notice: {notice.Title}";
        var sent = 0;
        foreach (var address in await _directory.MemberEmailsAsync(notice.SocietyId, ct))
        {
            if (ct.IsCancellationRequested) break;
            try
            {
                if (await _email.SendAsync(new NotificationMessage(address, subject, notice.Body, null, null, notice.SocietyId), ct)) sent++;
            }
            catch (Exception e) { _log.LogWarning(e, "[NoticeEmail] could not send to one member"); }   // one bad address never stops the rest
        }
        return sent;
    }
}
