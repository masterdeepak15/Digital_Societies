using MediatR;
using DigitalSocieties.Shared.Results;
using DigitalSocieties.Visitor.Infrastructure.Persistence;
using Microsoft.EntityFrameworkCore;

namespace DigitalSocieties.Visitor.Application.Commands;

public record MarkVisitorExitedCommand(Guid VisitorId) : IRequest<Result<bool>>;

internal sealed class MarkVisitorExitedCommandHandler(VisitorDbContext db)
    : IRequestHandler<MarkVisitorExitedCommand, Result<bool>>
{
    public async Task<Result<bool>> Handle(MarkVisitorExitedCommand request, CancellationToken ct)
    {
        var visitor = await db.Visitors
            .FirstOrDefaultAsync(v => v.Id == request.VisitorId, ct);

        if (visitor is null)
            return Result<bool>.Fail(new Error("Visitor.NotFound", "Visitor not found."));

        var result = visitor.MarkExited();
        if (!result.IsSuccess) return result;

        await db.SaveChangesAsync(ct);
        return Result<bool>.Ok(true);
    }
}
