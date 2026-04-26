using MediatR;
using DigitalSocieties.Shared.Results;
using DigitalSocieties.Social.Infrastructure.Persistence;
using Microsoft.EntityFrameworkCore;

namespace DigitalSocieties.Social.Application.Commands;

public record VotePollCommand(Guid PollId, Guid UserId, List<Guid> OptionIds)
    : IRequest<Result<bool>>;

internal sealed class VotePollCommandHandler(SocialDbContext db)
    : IRequestHandler<VotePollCommand, Result<bool>>
{
    public async Task<Result<bool>> Handle(VotePollCommand request, CancellationToken ct)
    {
        var poll = await db.Polls
            .Include(p => p.Votes)
            .FirstOrDefaultAsync(p => p.Id == request.PollId, ct);

        if (poll is null)
            return Result<bool>.Fail(new Error("Poll.NotFound", "Poll not found."));

        // Remove existing vote first (upsert)
        var existing = poll.Votes.FirstOrDefault(v => v.UserId == request.UserId);
        if (existing is not null) db.PollVotes.Remove(existing);

        var result = poll.CastVote(request.UserId, request.OptionIds);
        if (!result.IsSuccess) return result;

        await db.SaveChangesAsync(ct);
        return Result<bool>.Ok(true);
    }
}
