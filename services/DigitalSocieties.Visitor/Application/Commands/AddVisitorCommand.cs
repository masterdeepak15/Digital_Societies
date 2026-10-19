using MediatR;
using FluentValidation;
using DigitalSocieties.Shared.Results;
using DigitalSocieties.Shared.Contracts;
using DigitalSocieties.Visitor.Domain.Entities;
using VisitorEntity = DigitalSocieties.Visitor.Domain.Entities.Visitor;
using DigitalSocieties.Visitor.Infrastructure.Persistence;
using DigitalSocieties.Visitor.Infrastructure.Hubs;
using DigitalSocieties.Shared.Media;
using System.Text.Json;

namespace DigitalSocieties.Visitor.Application.Commands;

/// <summary>
/// Guard adds a visitor at the gate. Works offline — guard creates locally,
/// sync sends to server. Server then pushes real-time approval request to resident.
/// </summary>
public sealed record AddVisitorCommand(
    Guid    SocietyId,
    Guid    FlatId,
    string  Name,
    string? Phone,
    string  Purpose,
    string? VehicleNumber,
    string? PhotoUrl,
    string? HostPhone      = null,  // flat owner phone for SMS fallback notification
    // Gate details (all optional except the visitor's own name, flat and purpose)
    string? PhotoMediaId   = null,  // picture of the visitor, uploaded through /media
    string? IdType         = null,  // aadhaar | driving_licence | voter_id | passport | pan | other
    string? IdNumber       = null,  // only the last 4 characters are stored
    string? IdPhotoMediaId = null,  // picture of the ID card, optional
    string? VehicleType    = null,
    List<VisitorCompanion>? Companions = null  // anyone arriving with the visitor
) : IRequest<Result<AddVisitorResponse>>;

public sealed record VisitorCompanion(string Name, string? Phone = null);

public sealed record AddVisitorResponse(Guid VisitorId, string Status, string Message);

public sealed class AddVisitorCommandValidator : AbstractValidator<AddVisitorCommand>
{
    private static readonly string[] ValidIdTypes = ["aadhaar", "driving_licence", "voter_id", "passport", "pan", "other"];

    private static readonly string[] ValidPurposes =
        ["Guest", "Delivery", "Service", "Cab", "Vendor", "Other"];

    public AddVisitorCommandValidator()
    {
        RuleFor(x => x.SocietyId).NotEmpty();
        RuleFor(x => x.FlatId).NotEmpty();
        RuleFor(x => x.Name).NotEmpty().MaximumLength(200);
        RuleFor(x => x.Phone).Matches(@"^(\+91)?[6-9]\d{9}$")
            .When(x => !string.IsNullOrEmpty(x.Phone))
            .WithMessage("Enter a valid Indian mobile number.");
        RuleFor(x => x.Purpose)
            .NotEmpty()
            .Must(p => ValidPurposes.Contains(p))
            .WithMessage($"Purpose must be one of: {string.Join(", ", ValidPurposes)}.");
        RuleFor(x => x.VehicleNumber).MaximumLength(20).When(x => x.VehicleNumber is not null);
        RuleFor(x => x.IdType).Must(t => ValidIdTypes.Contains(t!)).When(x => !string.IsNullOrEmpty(x.IdType))
            .WithMessage($"ID type must be one of: {string.Join(", ", ValidIdTypes)}.");
        RuleFor(x => x.IdNumber).Matches("^[A-Za-z0-9 -]{4,20}$").When(x => !string.IsNullOrEmpty(x.IdNumber))
            .WithMessage("Enter the ID number (4 to 20 letters or digits).");
        RuleFor(x => x.PhotoMediaId).Must(MediaRules.IsValidId).When(x => !string.IsNullOrEmpty(x.PhotoMediaId))
            .WithMessage("Visitor photo is not a valid picture id.");
        RuleFor(x => x.IdPhotoMediaId).Must(MediaRules.IsValidId).When(x => !string.IsNullOrEmpty(x.IdPhotoMediaId))
            .WithMessage("ID photo is not a valid picture id.");
        RuleFor(x => x.VehicleType).MaximumLength(20);
        RuleFor(x => x.Companions).Must(c => c is null || c.Count <= 10).WithMessage("At most 10 people can arrive together.");
        RuleForEach(x => x.Companions).ChildRules(c =>
        {
            c.RuleFor(p => p.Name).NotEmpty().MaximumLength(200);
            c.RuleFor(p => p.Phone).Matches(@"^(\+91)?[6-9]\d{9}$").When(p => !string.IsNullOrEmpty(p.Phone));
        });
    }
}

public sealed class AddVisitorCommandHandler
    : IRequestHandler<AddVisitorCommand, Result<AddVisitorResponse>>
{
    private readonly VisitorDbContext        _db;
    private readonly ICurrentUser            _currentUser;
    private readonly ISocietyHubNotifier     _hub;
    private readonly INotificationDispatcher _dispatcher;
    private readonly IStorageProvider        _storage;
    private readonly ISocietySettingsReader  _settings;

    public AddVisitorCommandHandler(
        VisitorDbContext        db,
        ICurrentUser            currentUser,
        ISocietyHubNotifier     hub,
        INotificationDispatcher dispatcher,
        IStorageProvider        storage,
        ISocietySettingsReader  settings)
    {
        _settings    = settings;
        _db          = db;
        _currentUser = currentUser;
        _hub         = hub;
        _dispatcher  = dispatcher;
        _storage     = storage;
    }

    public async Task<Result<AddVisitorResponse>> Handle(
        AddVisitorCommand cmd, CancellationToken ct)
    {
        if (_currentUser.UserId is null)
            return Result<AddVisitorResponse>.Fail(Error.Unauthorized());
        var guardId = _currentUser.UserId.Value;

        var visitor = VisitorEntity.Create(cmd.SocietyId, cmd.FlatId,
                                     cmd.Name, cmd.Phone, cmd.Purpose,
                                     guardId);

        if (cmd.VehicleNumber is not null) visitor.SetVehicle(cmd.VehicleNumber);

        // Pictures must already be uploaded for this society (so an id can never point at someone else's file).
        foreach (var mediaId in new[] { cmd.PhotoMediaId, cmd.IdPhotoMediaId })
            if (!string.IsNullOrEmpty(mediaId) && _currentUser.SocietyId is { } society
                && !await _storage.ExistsAsync(MediaRules.KeyFor(society, mediaId), ct))
                return Result<AddVisitorResponse>.Fail("MEDIA.NOT_FOUND", "A picture was not uploaded. Upload it first and try again.");

        var idNumber = cmd.IdNumber?.Replace(" ", "").Replace("-", "");
        visitor.SetGateDetails(
            cmd.PhotoMediaId,
            string.IsNullOrEmpty(cmd.IdType) ? null : cmd.IdType,
            string.IsNullOrEmpty(idNumber) ? null : idNumber[^4..],
            cmd.IdPhotoMediaId,
            string.IsNullOrWhiteSpace(cmd.VehicleType) ? null : cmd.VehicleType,
            cmd.Companions is { Count: > 0 } ? JsonSerializer.Serialize(cmd.Companions) : null);
        if (cmd.PhotoUrl      is not null) visitor.AttachPhoto(cmd.PhotoUrl);

        _db.Visitors.Add(visitor);
        await _db.SaveChangesAsync(ct);

        // The society can switch visitor alerts off in Settings: the list still refreshes, but nothing rings.
        var rules = await _settings.GetAsync(cmd.SocietyId, ct);

        var payload = new
        {
            visitorId = visitor.Id,
            name      = visitor.Name,
            purpose   = visitor.Purpose,
            phone     = visitor.Phone,
            entryTime = visitor.EntryTime,
            alert     = rules.VisitorAlerts,
        };

        // 1. Real-time push via SignalR (works when app is open / foreground)
        await _hub.NotifyFlatAsync(cmd.FlatId, "VisitorPendingApproval", payload, ct);

        // 2. Guard offline hardening: also dispatch push notification with SMS fallback.
        //    This reaches the resident even if the app is closed or the guard synced offline.
        //    Recipient = FlatId (resolved to user push tokens by ExpoPushChannel).
        //    recipientPhone used only if push fails — passed from the visitor's host phone
        //    (cmd.HostPhone is populated by the sync endpoint from Identity flat owner lookup).
        // The push goes to every resident of the flat (their phones ring and vibrate). A phone number is only for the SMS fallback.
        if (rules.VisitorAlerts && rules.PushEnabled)
        {
            var notifMessage = new NotificationMessage(
                Recipient:  cmd.FlatId.ToString(),
                Subject:    $"Visitor at gate: {visitor.Name}",
                Body:       $"{visitor.Name} is at the gate for {visitor.Purpose}. Please approve or deny.",
                TemplateId: null,
                Data:       new Dictionary<string, string>
                {
                    ["type"]          = "visitor",
                    ["channelId"]     = "visitors",
                    ["recipientKind"] = "flat",
                    ["visitorId"]     = visitor.Id.ToString(),
                    ["purpose"]       = visitor.Purpose,
                });

            // Sent before the request ends (a request-scoped service cannot be used after it), but never allowed to hold up
            // the gate: a slow or failed push is given up on after a few seconds and the visitor is still recorded.
            try
            {
                using var limit = CancellationTokenSource.CreateLinkedTokenSource(ct);
                limit.CancelAfter(TimeSpan.FromSeconds(4));
                await _dispatcher.DispatchAsync(notifMessage, cmd.HostPhone, limit.Token);
            }
            catch (Exception) { /* the live (SignalR) alert above already went out */ }
        }

        return Result<AddVisitorResponse>.Ok(
            new AddVisitorResponse(visitor.Id, "pending",
                "Approval request sent to flat. Waiting for resident response."));
    }
}
