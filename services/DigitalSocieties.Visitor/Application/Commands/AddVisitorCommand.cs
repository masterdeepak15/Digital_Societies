using MediatR;
using FluentValidation;
using DigitalSocieties.Shared.Results;
using DigitalSocieties.Shared.Contracts;
using DigitalSocieties.Visitor.Domain.Entities;
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
    string? PhotoUrl
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
    private readonly VisitorDbContext    _db;
    private readonly ICurrentUser        _currentUser;
    private readonly ISocietyHubNotifier _hub;

    public AddVisitorCommandHandler(
        VisitorDbContext db, ICurrentUser currentUser, ISocietyHubNotifier hub)
    {
        _db          = db;
        _currentUser = currentUser;
        _hub         = hub;
    }

    public async Task<Result<AddVisitorResponse>> Handle(
        AddVisitorCommand cmd, CancellationToken ct)
    {
        var guardId = _currentUser.UserId
            ?? return Result<AddVisitorResponse>.Fail(Error.Unauthorized());

        var visitor = Visitor.Create(cmd.SocietyId, cmd.FlatId,
                                     cmd.Name, cmd.Phone, cmd.Purpose,
                                     guardId);

        if (cmd.VehicleNumber is not null) visitor.SetVehicle(cmd.VehicleNumber);
        if (cmd.PhotoUrl      is not null) visitor.AttachPhoto(cmd.PhotoUrl);

        _db.Visitors.Add(visitor);
        await _db.SaveChangesAsync(ct);

        // Push real-time approval request to the resident (via SignalR)
        await _hub.NotifyFlatAsync(cmd.FlatId, "VisitorPendingApproval", new
        {
            visitorId = visitor.Id,
            name      = visitor.Name,
            purpose   = visitor.Purpose,
            phone     = visitor.Phone,
            entryTime = visitor.EntryTime,
        }, ct);

        return Result<AddVisitorResponse>.Ok(
            new AddVisitorResponse(visitor.Id, "pending",
                $"Approval request sent to flat. Waiting for resident response."));
    }
}
