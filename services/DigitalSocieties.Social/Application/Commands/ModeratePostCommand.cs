using MediatR;
using DigitalSocieties.Shared.Results;
using DigitalSocieties.Social.Infrastructure.Persistence;
using Microsoft.EntityFrameworkCore;

namespace DigitalSocieties.Social.Application.Commands;

// ── Delete any post (admin) ────────────────────────────────────────────────────

public record DeletePostCommand(Guid PostId, Guid DeletedByUserId, bool IsAdmin)
    : IRequest<Result<bool>>;

internal sealed class DeletePostCommandHandler(SocialDbContext db)
    : IRequestHandler<DeletePostCommand, Result<bool>>
{
    public async Task<Result<bool>> Handle(DeletePostCommand request, CancellationToken ct)
    {
        var post = await db.Posts.FirstOrDefaultAsync(p => p.Id == request.PostId, ct);

        if (post is null)
            return Result<bool>.Fail(new Error("Post.NotFound", "Post not found."));

        if (!request.IsAdmin && post.AuthorUserId != request.DeletedByUserId)
            return Result<bool>.Fail(new Error("Post.Unauthorized",
                "You can only delete your own posts."));

        post.SoftDelete(request.DeletedByUserId);
        await db.SaveChangesAsync(ct);
        return Result<bool>.Ok(true);
    }
}

// ── Pin / Unpin (admin) ───────────────────────────────────────────────────────

public record PinPostCommand(Guid PostId, bool IsPinned) : IRequest<Result<bool>>;

internal sealed class PinPostCommandHandler(SocialDbContext db)
    : IRequestHandler<PinPostCommand, Result<bool>>
{
    public async Task<Result<bool>> Handle(PinPostCommand request, CancellationToken ct)
    {
        var post = await db.Posts.FirstOrDefaultAsync(p => p.Id == request.PostId, ct);
        if (post is null)
            return Result<bool>.Fail(new Error("Post.NotFound", "Post not found."));

        if (request.IsPinned) post.Pin(); else post.Unpin();
        await db.SaveChangesAsync(ct);
        return Result<bool>.Ok(true);
    }
}

// ── Lock / Unlock comments (admin) ────────────────────────────────────────────

public record LockPostCommentsCommand(Guid PostId, bool IsLocked) : IRequest<Result<bool>>;

internal sealed class LockPostCommentsCommandHandler(SocialDbContext db)
    : IRequestHandler<LockPostCommentsCommand, Result<bool>>
{
    public async Task<Result<bool>> Handle(LockPostCommentsCommand request, CancellationToken ct)
    {
        var post = await db.Posts.FirstOrDefaultAsync(p => p.Id == request.PostId, ct);
        if (post is null)
            return Result<bool>.Fail(new Error("Post.NotFound", "Post not found."));

        if (request.IsLocked) post.LockComments(); else post.UnlockComments();
        await db.SaveChangesAsync(ct);
        return Result<bool>.Ok(true);
    }
}

// ── Report post ───────────────────────────────────────────────────────────────

public record ReportPostCommand(Guid PostId, Guid ReportedByUserId, string? Reason)
    : IRequest<Result<Guid>>;

internal sealed class ReportPostCommandHandler(SocialDbContext db)
    : IRequestHandler<ReportPostCommand, Result<Guid>>
{
    public async Task<Result<Guid>> Handle(ReportPostCommand request, CancellationToken ct)
    {
        var post = await db.Posts.FirstOrDefaultAsync(p => p.Id == request.PostId, ct);
        if (post is null)
            return Result<Guid>.Fail(new Error("Post.NotFound", "Post not found."));

        var report = new Domain.Entities.PostReport
        {
            PostId          = request.PostId,
            ReportedByUserId = request.ReportedByUserId,
            Reason          = request.Reason ?? string.Empty,
            Status          = "pending",
            CreatedAt       = DateTimeOffset.UtcNow,
        };

        db.Reports.Add(report);
        await db.SaveChangesAsync(ct);
        return Result<Guid>.Ok(report.Id);
    }
}
