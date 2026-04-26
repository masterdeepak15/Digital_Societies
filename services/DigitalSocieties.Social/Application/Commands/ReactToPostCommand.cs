using MediatR;
using DigitalSocieties.Shared.Results;
using DigitalSocieties.Social.Domain.Entities;
using DigitalSocieties.Social.Infrastructure.Persistence;
using Microsoft.EntityFrameworkCore;

namespace DigitalSocieties.Social.Application.Commands;

/// <summary>
/// Upsert a reaction. If the user already reacted with a different type,
/// the type is updated. Removing a reaction is a separate command (RemoveReactionCommand).
/// </summary>
public record ReactToPostCommand(Guid PostId, Guid UserId, string ReactionType)
    : IRequest<Result<bool>>;

internal sealed class ReactToPostCommandHandler(SocialDbContext db)
    : IRequestHandler<ReactToPostCommand, Result<bool>>
{
    public async Task<Result<bool>> Handle(ReactToPostCommand request, CancellationToken ct)
    {
        if (!PostReaction.Valid.Contains(request.ReactionType))
            return Result<bool>.Fail(new Error("Reaction.Invalid",
                "Use: helpful, thanks, or thumbsup."));

        // Upsert: check existing reaction
        var existing = await db.Reactions
            .FirstOrDefaultAsync(r => r.PostId == request.PostId && r.UserId == request.UserId, ct);

        if (existing is not null)
        {
            existing.ChangeType(request.ReactionType);
        }
        else
        {
            var result = PostReaction.Create(request.PostId, request.UserId, request.ReactionType);
            if (!result.IsSuccess) return Result<bool>.Fail(result.Error!);
            db.Reactions.Add(result.Value);
        }

        await db.SaveChangesAsync(ct);
        return Result<bool>.Ok(true);
    }
}

public record RemoveReactionCommand(Guid PostId, Guid UserId) : IRequest<Result<bool>>;

internal sealed class RemoveReactionCommandHandler(SocialDbContext db)
    : IRequestHandler<RemoveReactionCommand, Result<bool>>
{
    public async Task<Result<bool>> Handle(RemoveReactionCommand request, CancellationToken ct)
    {
        var reaction = await db.Reactions
            .FirstOrDefaultAsync(r => r.PostId == request.PostId && r.UserId == request.UserId, ct);

        if (reaction is null) return Result<bool>.Ok(true); // idempotent

        db.Reactions.Remove(reaction);
        await db.SaveChangesAsync(ct);
        return Result<bool>.Ok(true);
    }
}
