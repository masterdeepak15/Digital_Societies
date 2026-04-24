using MediatR;
using FluentValidation;
using DigitalSocieties.Shared.Results;
using DigitalSocieties.Shared.Contracts;
using DigitalSocieties.Visitor.Infrastructure.Persistence;
using DigitalSocieties.Visitor.Infrastructure.Hubs;
using DigitalSocieties.Visitor.Infrastructure.Security;

namespace DigitalSocieties.Visitor.Application.Commands;

public sealed record ApproveVisitorCommand(Guid VisitorId) : IRequest<Result<ApproveVisitorResponse>>;
public sealed record ApproveVisitorResponse(Guid VisitorId, string QrToken);

public sealed class ApproveVisitorCommandHandler
    : IRequestHandler<ApproveVisitorCommand, Result<ApproveVisitorResponse>>
{
    private readonly VisitorDbContext    _db;
    private readonly ICurrentUser        _currentUser;
    private readonly ISocietyHubNotifier _hub;
    private readonly IQrTokenService     _qr;

    public ApproveVisitorCommandHandler(
        VisitorDbContext db, ICurrentUser currentUser,
        ISocietyHubNotifier hub, IQrTokenService qr)
    { _db = db; _currentUser = currentUser; _hub = hub; _qr = qr; }

    public async Task<Result<ApproveVisitorResponse>> Handle(
        ApproveVisitorCommand cmd, CancellationToken ct)
    {
        var visitor = await _db.Visitors.FindAsync([cmd.VisitorId], ct);
        if (visitor is null)
            return Result<ApproveVisitorResponse>.Fail(Error.NotFound("Visitor", cmd.VisitorId));

        // Authorization: only resident of the target flat can approve
        if (_currentUser.FlatId != visitor.FlatId)
            return Result<ApproveVisitorResponse>.Fail(
                Error.Unauthorized("You can only approve visitors for your own flat."));

        var approvedBy = _currentUser.UserId!.Value;
        // Generate QR token (signed JWT, 2-min TTL, single-use nonce)
        var qrToken = _qr.Generate(visitor.Id, visitor.SocietyId);
        visitor.Approve(approvedBy, qrToken);

        await _db.SaveChangesAsync(ct);

        // Notify guard: visitor approved
        await _hub.NotifySocietyGuardsAsync(visitor.SocietyId, "VisitorApproved", new
        {
            visitorId = visitor.Id,
            name      = visitor.Name,
            qrToken,
        }, ct);

        return Result<ApproveVisitorResponse>.Ok(new ApproveVisitorResponse(visitor.Id, qrToken));
    }
}

