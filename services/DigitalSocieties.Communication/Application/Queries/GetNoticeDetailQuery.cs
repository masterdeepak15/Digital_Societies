using MediatR;
using DigitalSocieties.Shared.Results;
using DigitalSocieties.Communication.Infrastructure.Persistence;
using Microsoft.EntityFrameworkCore;

namespace DigitalSocieties.Communication.Application.Queries;

public record GetNoticeDetailQuery(Guid NoticeId) : IRequest<Result<NoticeDetailDto>>;

public record NoticeDetailDto(
    Guid Id,
    string Title,
    string Body,
    string Type,
    bool IsPinned,
    Guid SocietyId,
    Guid PostedBy,
    DateTimeOffset CreatedAt,
    DateTimeOffset? ExpiresAt);

internal sealed class GetNoticeDetailQueryHandler(CommunicationDbContext db)
    : IRequestHandler<GetNoticeDetailQuery, Result<NoticeDetailDto>>
{
    public async Task<Result<NoticeDetailDto>> Handle(
        GetNoticeDetailQuery request, CancellationToken ct)
    {
        var notice = await db.Notices
            .FirstOrDefaultAsync(n => n.Id == request.NoticeId && !n.IsDeleted, ct);

        if (notice is null)
            return Result<NoticeDetailDto>.Fail(
                new Error("Notice.NotFound", "Notice not found."));

        return Result<NoticeDetailDto>.Ok(new NoticeDetailDto(
            notice.Id, notice.Title, notice.Body, notice.Type.ToString(),
            notice.IsPinned, notice.SocietyId, notice.PostedBy,
            notice.CreatedAt, notice.ExpiresAt));
    }
}
