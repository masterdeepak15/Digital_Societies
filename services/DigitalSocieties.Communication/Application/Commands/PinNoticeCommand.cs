using MediatR;
using DigitalSocieties.Shared.Results;
using DigitalSocieties.Communication.Infrastructure.Persistence;
using Microsoft.EntityFrameworkCore;

namespace DigitalSocieties.Communication.Application.Commands;

public record PinNoticeCommand(Guid NoticeId, bool IsPinned) : IRequest<Result<bool>>;

internal sealed class PinNoticeCommandHandler(CommunicationDbContext db)
    : IRequestHandler<PinNoticeCommand, Result<bool>>
{
    public async Task<Result<bool>> Handle(PinNoticeCommand request, CancellationToken ct)
    {
        var notice = await db.Notices
            .FirstOrDefaultAsync(n => n.Id == request.NoticeId, ct);

        if (notice is null)
            return Result<bool>.Fail(new Error("Notice.NotFound", "Notice not found."));

        if (request.IsPinned) notice.Pin(); else notice.Unpin();

        await db.SaveChangesAsync(ct);
        return Result<bool>.Ok(true);
    }
}
