using MediatR;
using DigitalSocieties.Shared.Results;
using DigitalSocieties.Communication.Infrastructure.Persistence;
using Microsoft.EntityFrameworkCore;

namespace DigitalSocieties.Communication.Application.Commands;

public record ExpireNoticeCommand(Guid NoticeId) : IRequest<Result<bool>>;

internal sealed class ExpireNoticeCommandHandler(CommunicationDbContext db)
    : IRequestHandler<ExpireNoticeCommand, Result<bool>>
{
    public async Task<Result<bool>> Handle(ExpireNoticeCommand request, CancellationToken ct)
    {
        var notice = await db.Notices
            .FirstOrDefaultAsync(n => n.Id == request.NoticeId, ct);

        if (notice is null)
            return Result<bool>.Fail(new Error("Notice.NotFound", "Notice not found."));

        notice.Expire();
        await db.SaveChangesAsync(ct);
        return Result<bool>.Ok(true);
    }
}
