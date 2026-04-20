using MediatR;
using DigitalSocieties.Shared.Results;
using DigitalSocieties.Social.Domain.Entities;
using DigitalSocieties.Social.Infrastructure.Persistence;
using Microsoft.EntityFrameworkCore;

namespace DigitalSocieties.Social.Application.Commands;

public record CommentOnPostCommand(
    Guid PostId,
    Guid AuthorUserId,
    Guid AuthorFlatId,
    string Body,
    Guid? ParentCommentId) : IRequest<Result<Guid>>;

internal sealed class CommentOnPostCommandHandler(SocialDbContext db)
    : IRequestHandler<CommentOnPostCommand, Result<Guid>>
{
    public async Task<Result<Guid>> Handle(CommentOnPostCommand request, CancellationToken ct)
    {
        var post = await db.Posts
            .FirstOrDefaultAsync(p => p.Id == request.PostId && !p.IsDeleted, ct);

        if (post is null)
            return Result<Guid>.Fail(new Error("Post.NotFound", "Post not found."));

        if (post.IsLocked)
            return Result<Guid>.Fail(new Error("Post.Locked",
                "Comments are disabled on this post."));

        if (post.IsExpired())
            return Result<Guid>.Fail(new Error("Post.Expired",
                "This post has expired and no longer accepts comments."));

        // Validate parentId is a top-level comment (no deeper nesting)
        if (request.ParentCommentId.HasValue)
        {
            var parent = await db.Comments
                .FirstOrDefaultAsync(c => c.Id == request.ParentCommentId.Value, ct);

            if (parent is null || parent.ParentId.HasValue)
                return Result<Guid>.Fail(new Error("Comment.InvalidParent",
                    "Replies can only be made to top-level comments."));
        }

        var result = PostComment.Create(
            request.PostId,
            request.AuthorUserId,
            request.AuthorFlatId,
            request.Body,
            request.ParentCommentId);

        if (!result.IsSuccess) return Result<Guid>.Fail(result.Error!);

        db.Comments.Add(result.Value);
        await db.SaveChangesAsync(ct);
        return Result<Guid>.Ok(result.Value.Id);
    }
}

public record DeleteCommentCommand(Guid CommentId, Guid RequestingUserId, bool IsAdmin)
    : IRequest<Result<bool>>;

internal sealed class DeleteCommentCommandHandler(SocialDbContext db)
    : IRequestHandler<DeleteCommentCommand, Result<bool>>
{
    public async Task<Result<bool>> Handle(DeleteCommentCommand request, CancellationToken ct)
    {
        var comment = await db.Comments
            .FirstOrDefaultAsync(c => c.Id == request.CommentId, ct);

        if (comment is null)
            return Result<bool>.Fail(new Error("Comment.NotFound", "Comment not found."));

        if (!request.IsAdmin && comment.AuthorUserId != request.RequestingUserId)
            return Result<bool>.Fail(new Error("Comment.Unauthorized",
                "You can only delete your own comments."));

        comment.SoftDelete();
        await db.SaveChangesAsync(ct);
        return Result<bool>.Ok(true);
    }
}
