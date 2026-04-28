using MediatR;
using FluentValidation;
using DigitalSocieties.Shared.Results;
using DigitalSocieties.Shared.Contracts;
using DigitalSocieties.Visitor.Domain.Entities;
using VisitorEntity = DigitalSocieties.Visitor.Domain.Entities.Visitor;
using DigitalSocieties.Visitor.Infrastructure.Persistence;
using DigitalSocieties.Visitor.Infrastructure.Hubs;

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
    string? HostPhone      = null   // flat owner phone for SMS fallback notification
) : IRequest<Result<AddVisitorResponse>>;

public sealed record AddVisitorResponse(Guid VisitorId, string Status, string Message);

public sealed class AddVisitorCommandValidator : AbstractValidator<AddVisitorCommand>
{
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
    }
}

public sealed class AddVisitorCommandHandler
    : IRequestHandler<AddVisitorCommand, Result<AddVisitorResponse>>
{
    private readonly VisitorDbContext        _db;
    private readonly ICurrentUser            _currentUser;
    private readonly ISocietyHubNotifier     _hub;
    private readonly INotificationDispatcher _dispatcher;

    public AddVisitorCommandHandler(
        VisitorDbContext        db,
        ICurrentUser            currentUser,
        ISocietyHubNotifier     hub,
        INotificationDispatcher dispatcher)
    {
        _db          = db;
        _currentUser = currentUser;
        _hub         = hub;
        _dispatcher  = dispatcher;
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
        if (cmd.PhotoUrl      is not null) visitor.AttachPhoto(cmd.PhotoUrl);

        _db.Visitors.Add(visitor);
        await _db.SaveChangesAsync(ct);

        var payload = new
        {
            visitorId = visitor.Id,
            name      = visitor.Name,
            purpose   = visitor.Purpose,
            phone     = visitor.Phone,
            entryTime = visitor.EntryTime,
        };

        // 1. Real-time push via SignalR (works when app is open / foreground)
        await _hub.NotifyFlatAsync(cmd.FlatId, "VisitorPendingApproval", payload, ct);

        // 2. Guard offline hardening: also dispatch push notification with SMS fallback.
        //    This reaches the resident even if the app is closed or the guard synced offline.
        //    Recipient = FlatId (resolved to user push tokens by ExpoPushChannel).
        //    recipientPhone used only if push fails — passed from the visitor's host phone
        //    (cmd.HostPhone is populated by the sync endpoint from Identity flat owner lookup).
        if (!string.IsNullOrEmpty(cmd.HostPhone))
        {
            var notifMessage = new NotificationMessage(
                Recipient:  cmd.FlatId.ToString(),
                Subject:    $"Visitor at gate: {visitor.Name}",
                Body:       $"{visitor.Name} is at the gate for {visitor.Purpose}. Please approve or deny.",
                TemplateId: null,
                Data:       new Dictionary<string, string>
                {
                    ["visitorId"] = visitor.Id.ToString(),
                    ["purpose"]   = visitor.Purpose,
                });

            // Fire-and-forget — don't block the gate operation on notification delivery
            _ = _dispatcher.DispatchAsync(notifMessage, cmd.HostPhone, ct);
        }

        return Result<AddVisitorResponse>.Ok(
            new AddVisitorResponse(visitor.Id, "pending",
                "Approval request sent to flat. Waiting for resident response."));
    }
}
