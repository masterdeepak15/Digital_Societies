using MediatR;
using DigitalSocieties.Shared.Results;
using DigitalSocieties.Visitor.Infrastructure.Persistence;
using DigitalSocieties.Visitor.Infrastructure.Security;
using Microsoft.EntityFrameworkCore;

namespace DigitalSocieties.Visitor.Application.Commands;

/// <summary>
/// Guard scans resident's QR code at the physical gate.
/// Validates the signed JWT (2-min TTL, single-use nonce) then records entry.
/// </summary>
public record MarkVisitorEnteredCommand(string QrToken) : IRequest<Result<Guid>>;

internal sealed class MarkVisitorEnteredCommandHandler(
    VisitorDbContext db,
    IQrTokenService qrTokenService)
    : IRequestHandler<MarkVisitorEnteredCommand, Result<Guid>>
{
    public async Task<Result<Guid>> Handle(MarkVisitorEnteredCommand request, CancellationToken ct)
    {
        // 1. Validate token — checks TTL + single-use nonce (replay protection)
        var tokenResult = qrTokenService.Validate(request.QrToken);
        if (!tokenResult.IsSuccess) return Result<Guid>.Fail(tokenResult.Error!);

        var visitorId = tokenResult.Value.VisitorId;

        // 2. Load visitor
        var visitor = await db.Visitors
            .FirstOrDefaultAsync(v => v.Id == visitorId, ct);

        if (visitor is null)
            return Result<Guid>.Fail(new Error("Visitor.NotFound", "Visitor not found."));

        // 3. State machine: Approved → Entered
        var enterResult = visitor.MarkEntered();
        if (!enterResult.IsSuccess) return Result<Guid>.Fail(enterResult.Error!);

        await db.SaveChangesAsync(ct);
        return Result<Guid>.Ok(visitorId);
    }
}
