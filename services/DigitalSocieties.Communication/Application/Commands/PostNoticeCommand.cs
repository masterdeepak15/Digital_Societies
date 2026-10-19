using MediatR;
using FluentValidation;
using DigitalSocieties.Shared.Results;
using DigitalSocieties.Shared.Contracts;
using DigitalSocieties.Communication.Domain.Entities;
using DigitalSocieties.Communication.Infrastructure.Persistence;
using DigitalSocieties.Visitor.Infrastructure.Hubs;
using DigitalSocieties.Communication.Application.Notices;

namespace DigitalSocieties.Communication.Application.Commands;

public sealed record PostNoticeCommand(
    Guid           SocietyId,
    string         Title,
    string         Body,
    string         Type,
    DateTimeOffset? ExpiresAt
) : IRequest<Result<PostNoticeResponse>>;

public sealed record PostNoticeResponse(Guid NoticeId);

public sealed class PostNoticeCommandValidator : AbstractValidator<PostNoticeCommand>
{
    public PostNoticeCommandValidator()
    {
        RuleFor(x => x.SocietyId).NotEmpty();
        RuleFor(x => x.Title).NotEmpty().MaximumLength(300);
        RuleFor(x => x.Body).NotEmpty().MaximumLength(5000);
        RuleFor(x => x.Type)
            .Must(t => Enum.TryParse<NoticeType>(t, true, out _))
            .WithMessage("Type must be: Notice, Emergency, Event, or Circular.");
    }
}

public sealed class PostNoticeCommandHandler
    : IRequestHandler<PostNoticeCommand, Result<PostNoticeResponse>>
{
    private readonly CommunicationDbContext _db;
    private readonly ICurrentUser            _currentUser;
    private readonly ISocietyHubNotifier     _hub;
    private readonly IEnumerable<INotificationChannel> _channels;
    private readonly ISocietySettingsReader  _settings;
    private readonly INotificationDispatcher _dispatcher;
    private readonly INoticeEmailQueue       _email;

    public PostNoticeCommandHandler(
        CommunicationDbContext db, ICurrentUser cu,
        ISocietyHubNotifier hub, IEnumerable<INotificationChannel> channels,
        ISocietySettingsReader settings, INotificationDispatcher dispatcher, INoticeEmailQueue email)
    { _db = db; _currentUser = cu; _hub = hub; _channels = channels; _settings = settings; _dispatcher = dispatcher; _email = email; }

    public async Task<Result<PostNoticeResponse>> Handle(
        PostNoticeCommand cmd, CancellationToken ct)
    {
        if (_currentUser.UserId is null)
            return Result<PostNoticeResponse>.Fail(Error.Unauthorized());

        var type   = Enum.Parse<NoticeType>(cmd.Type, true);
        var notice = Notice.Create(cmd.SocietyId, _currentUser.UserId.Value,
                                   cmd.Title, cmd.Body, type, cmd.ExpiresAt);

        _db.Notices.Add(notice);
        await _db.SaveChangesAsync(ct);

        // Real-time push to all connected residents
        await _hub.NotifySocietyAsync(cmd.SocietyId, "NewNotice", new
        {
            noticeId  = notice.Id,
            title     = notice.Title,
            type      = notice.Type.ToString(),
            postedAt  = DateTimeOffset.UtcNow,
        }, ct);

        // How the society wants to be told (Settings > Notifications)
        var rules = await _settings.GetAsync(cmd.SocietyId, ct);
        var emergency = type == NoticeType.Emergency;

        // An emergency rings every phone that has the app open
        if (emergency)
            await _hub.NotifySocietyAsync(cmd.SocietyId, "EmergencyAlert", new { noticeId = notice.Id, title = notice.Title, message = notice.Body }, ct);

        // A push to every phone in the society, for the ones where the app is closed (an emergency uses the loud channel)
        if (rules.PushEnabled)
        {
            try
            {
                await _dispatcher.DispatchAsync(new NotificationMessage(
                    Recipient: cmd.SocietyId.ToString(),
                    Subject:   emergency ? $"🚨 {cmd.Title}" : cmd.Title,
                    Body:      cmd.Body.Length <= 140 ? cmd.Body : cmd.Body[..140] + "…",
                    TemplateId: null,
                    Data: new Dictionary<string, string>
                    {
                        ["type"] = emergency ? "emergency" : "notice", ["channelId"] = emergency ? "emergency" : "general",
                        ["recipientKind"] = "society", ["noticeId"] = notice.Id.ToString(),
                    },
                    SocietyId: cmd.SocietyId), null, ct);
            }
            catch (Exception) { /* the notice is saved and shown live; a failed push is not a failed post */ }
        }

        // Email the notice to every member, when the society turned that on
        if (rules.EmailEnabled)
            _email.Enqueue(new NoticeEmail(cmd.SocietyId, cmd.Title, cmd.Body, cmd.Type));

        // Emergency = also send SMS to all residents (only when the society switched SMS on)
        if (emergency && rules.SmsEnabled)
        {
            var sms = _channels.FirstOrDefault(c => c.ChannelName == "sms");
            if (sms?.IsEnabled == true)
            {
                _ = sms.SendAsync(new NotificationMessage(
                    Recipient:  "",   // broadcast — implementation sends to all phones in society
                    Subject:    $"🚨 {cmd.Title}",
                    Body:       cmd.Body[..Math.Min(cmd.Body.Length, 160)],
                    TemplateId: "emergency_alert"
                ), ct);
            }
        }

        return Result<PostNoticeResponse>.Ok(new PostNoticeResponse(notice.Id));
    }
}
