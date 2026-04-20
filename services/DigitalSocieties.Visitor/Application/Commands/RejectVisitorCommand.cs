using MediatR;
using DigitalSocieties.Shared.Results;
using DigitalSocieties.Visitor.Infrastructure.Persistence;
using Microsoft.EntityFrameworkCore;

namespace DigitalSocieties.Visitor.Application.Commands;

public record RejectVisitorCommand(Guid VisitorId, Guid RejectedByUserId, string? Reason)
    : IRequest<Result<bool>>;

internal sealed class RejectVisitorCommandHandler(VisitorDbContext db)
    : IRequestHandler<RejectVisitorCommand, Result<bool>>
{
    public async Task<Result<bool>> Handle(RejectVisitorCommand request, CancellationToken ct)
    {
        var visitor = await db.Visitors
            .FirstOrDefaultAsync(v => v.Id == request.VisitorId, ct);

        if (visitor is null)
            return Result<bool>.Fail(new Error("Visitor.NotFound", "Visitor not found."));

        var rejectResult = visitor.Reject(request.RejectedByUserId, request.Reason);
        if (!rejectResult.IsSuccess) return rejectResult;

        await db.SaveChangesAsync(ct);
        return Result<bool>.Ok(true);
    }
}
