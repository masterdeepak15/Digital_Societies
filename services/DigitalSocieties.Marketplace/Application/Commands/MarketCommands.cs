using MediatR;
using FluentValidation;
using Microsoft.EntityFrameworkCore;
using DigitalSocieties.Shared.Contracts;
using DigitalSocieties.Shared.Results;
using DigitalSocieties.Marketplace.Domain.Entities;
using DigitalSocieties.Marketplace.Infrastructure.Persistence;

namespace DigitalSocieties.Marketplace.Application.Commands;

// The society market: residents post what they sell, want to buy or want to borrow; neighbours reply;
// the author (or an admin) closes the deal. All rules for who may do what are here, not in the endpoints.

internal static class MarketRules
{
    public static bool IsKind(string? kind) => Enum.TryParse<MarketKind>(kind, true, out _);

    public static long? ToPaise(decimal? rupees) => rupees is null ? null : (long)Math.Round(rupees.Value * 100m, MidpointRounding.AwayFromZero);

    public static bool CanManage(ICurrentUser cu, Guid authorUserId) => cu.IsInRole("admin") || cu.UserId == authorUserId;
}

// ── Post ────────────────────────────────────────────────────────────────────
public sealed record CreateMarketPostCommand(
    string Kind, string Title, string Description, decimal? PriceRupees, string? Condition, List<string>? ImageIds)
    : IRequest<Result<Guid>>;

public sealed class CreateMarketPostValidator : AbstractValidator<CreateMarketPostCommand>
{
    public CreateMarketPostValidator()
    {
        RuleFor(x => x.Kind).Must(MarketRules.IsKind).WithMessage("Choose Sell, Wanted or Borrow.");
        RuleFor(x => x.Title).NotEmpty().MinimumLength(3).MaximumLength(120).WithMessage("Say what it is in a few words.");
        RuleFor(x => x.Description).MaximumLength(1000);
        RuleFor(x => x.PriceRupees).InclusiveBetween(0m, 10_000_000m).When(x => x.PriceRupees.HasValue)
            .WithMessage("Enter a price of zero or more.");
    }
}

public sealed class CreateMarketPostHandler : IRequestHandler<CreateMarketPostCommand, Result<Guid>>
{
    private readonly MarketplaceDbContext _db;
    private readonly ICurrentUser         _cu;
    public CreateMarketPostHandler(MarketplaceDbContext db, ICurrentUser cu) => (_db, _cu) = (db, cu);

    public async Task<Result<Guid>> Handle(CreateMarketPostCommand cmd, CancellationToken ct)
    {
        if (_cu.SocietyId is not { } societyId || _cu.UserId is not { } userId)
            return Result<Guid>.Fail("AUTH.REQUIRED", "Authentication context required.");

        var post = MarketPost.Create(societyId, userId, _cu.FlatId, Enum.Parse<MarketKind>(cmd.Kind, true),
            cmd.Title, cmd.Description, MarketRules.ToPaise(cmd.PriceRupees), cmd.Condition, cmd.ImageIds);
        _db.MarketPosts.Add(post);
        await _db.SaveChangesAsync(ct);
        return Result<Guid>.Ok(post.Id);
    }
}

public sealed record UpdateMarketPostCommand(
    Guid PostId, string Kind, string Title, string Description, decimal? PriceRupees, string? Condition, List<string>? ImageIds)
    : IRequest<Result>;

public sealed class UpdateMarketPostValidator : AbstractValidator<UpdateMarketPostCommand>
{
    public UpdateMarketPostValidator()
    {
        RuleFor(x => x.Kind).Must(MarketRules.IsKind).WithMessage("Choose Sell, Wanted or Borrow.");
        RuleFor(x => x.Title).NotEmpty().MinimumLength(3).MaximumLength(120).WithMessage("Say what it is in a few words.");
        RuleFor(x => x.Description).MaximumLength(1000);
        RuleFor(x => x.PriceRupees).InclusiveBetween(0m, 10_000_000m).When(x => x.PriceRupees.HasValue)
            .WithMessage("Enter a price of zero or more.");
    }
}

public sealed class UpdateMarketPostHandler : IRequestHandler<UpdateMarketPostCommand, Result>
{
    private readonly MarketplaceDbContext _db;
    private readonly ICurrentUser         _cu;
    public UpdateMarketPostHandler(MarketplaceDbContext db, ICurrentUser cu) => (_db, _cu) = (db, cu);

    public async Task<Result> Handle(UpdateMarketPostCommand cmd, CancellationToken ct)
    {
        if (_cu.SocietyId is not { } societyId) return Result.Fail("AUTH.REQUIRED", "Authentication context required.");

        var post = await _db.MarketPosts.FirstOrDefaultAsync(p => p.Id == cmd.PostId && p.SocietyId == societyId && !p.IsDeleted, ct);
        if (post is null) return Result.Fail("MARKET.NOT_FOUND", "Post not found.");
        if (!MarketRules.CanManage(_cu, post.AuthorUserId)) return Result.Fail("FORBIDDEN", "Only the person who posted this, or an admin, can change it.");
        if (post.Status == MarketStatus.Closed) return Result.Fail("MARKET.CLOSED", "This deal is closed. Reopen it to change it.");

        post.Edit(Enum.Parse<MarketKind>(cmd.Kind, true), cmd.Title, cmd.Description, MarketRules.ToPaise(cmd.PriceRupees), cmd.Condition, cmd.ImageIds);
        await _db.SaveChangesAsync(ct);
        return Result.Ok();
    }
}

// ── Close / reopen / delete ─────────────────────────────────────────────────
public sealed record CloseMarketPostCommand(Guid PostId, Guid? WithUserId) : IRequest<Result>;

public sealed class CloseMarketPostHandler : IRequestHandler<CloseMarketPostCommand, Result>
{
    private readonly MarketplaceDbContext _db;
    private readonly ICurrentUser         _cu;
    public CloseMarketPostHandler(MarketplaceDbContext db, ICurrentUser cu) => (_db, _cu) = (db, cu);

    public async Task<Result> Handle(CloseMarketPostCommand cmd, CancellationToken ct)
    {
        if (_cu.SocietyId is not { } societyId) return Result.Fail("AUTH.REQUIRED", "Authentication context required.");

        var post = await _db.MarketPosts.FirstOrDefaultAsync(p => p.Id == cmd.PostId && p.SocietyId == societyId && !p.IsDeleted, ct);
        if (post is null) return Result.Fail("MARKET.NOT_FOUND", "Post not found.");
        if (!MarketRules.CanManage(_cu, post.AuthorUserId)) return Result.Fail("FORBIDDEN", "Only the person who posted this, or an admin, can close it.");
        if (post.Status == MarketStatus.Closed) return Result.Ok();

        if (cmd.WithUserId is { } with &&
            !await _db.MarketReplies.AnyAsync(r => r.PostId == post.Id && r.AuthorUserId == with && !r.IsDeleted, ct))
            return Result.Fail("MARKET.NOT_A_REPLIER", "Choose someone who replied to this post.");

        post.Close(cmd.WithUserId);
        await _db.SaveChangesAsync(ct);
        return Result.Ok();
    }
}

public sealed record ReopenMarketPostCommand(Guid PostId) : IRequest<Result>;

public sealed class ReopenMarketPostHandler : IRequestHandler<ReopenMarketPostCommand, Result>
{
    private readonly MarketplaceDbContext _db;
    private readonly ICurrentUser         _cu;
    public ReopenMarketPostHandler(MarketplaceDbContext db, ICurrentUser cu) => (_db, _cu) = (db, cu);

    public async Task<Result> Handle(ReopenMarketPostCommand cmd, CancellationToken ct)
    {
        if (_cu.SocietyId is not { } societyId) return Result.Fail("AUTH.REQUIRED", "Authentication context required.");

        var post = await _db.MarketPosts.FirstOrDefaultAsync(p => p.Id == cmd.PostId && p.SocietyId == societyId && !p.IsDeleted, ct);
        if (post is null) return Result.Fail("MARKET.NOT_FOUND", "Post not found.");
        if (!MarketRules.CanManage(_cu, post.AuthorUserId)) return Result.Fail("FORBIDDEN", "Only the person who posted this, or an admin, can reopen it.");

        post.Reopen();
        await _db.SaveChangesAsync(ct);
        return Result.Ok();
    }
}

// The post and its replies stay in the database (marked deleted); they leave every list.
public sealed record DeleteMarketPostCommand(Guid PostId) : IRequest<Result>;

public sealed class DeleteMarketPostHandler : IRequestHandler<DeleteMarketPostCommand, Result>
{
    private readonly MarketplaceDbContext _db;
    private readonly ICurrentUser         _cu;
    public DeleteMarketPostHandler(MarketplaceDbContext db, ICurrentUser cu) => (_db, _cu) = (db, cu);

    public async Task<Result> Handle(DeleteMarketPostCommand cmd, CancellationToken ct)
    {
        if (_cu.SocietyId is not { } societyId) return Result.Fail("AUTH.REQUIRED", "Authentication context required.");

        var post = await _db.MarketPosts.FirstOrDefaultAsync(p => p.Id == cmd.PostId && p.SocietyId == societyId && !p.IsDeleted, ct);
        if (post is null) return Result.Fail("MARKET.NOT_FOUND", "Post not found.");
        if (!MarketRules.CanManage(_cu, post.AuthorUserId)) return Result.Fail("FORBIDDEN", "Only the person who posted this, or an admin, can remove it.");

        post.SoftDelete();
        await _db.SaveChangesAsync(ct);
        return Result.Ok();
    }
}

// ── Replies ─────────────────────────────────────────────────────────────────
public sealed record AddMarketReplyCommand(Guid PostId, string Body) : IRequest<Result<Guid>>;

public sealed class AddMarketReplyValidator : AbstractValidator<AddMarketReplyCommand>
{
    public AddMarketReplyValidator() =>
        RuleFor(x => x.Body).Must(b => !string.IsNullOrWhiteSpace(b)).MaximumLength(1000).WithMessage("Write a message.");
}

public sealed class AddMarketReplyHandler : IRequestHandler<AddMarketReplyCommand, Result<Guid>>
{
    private readonly MarketplaceDbContext _db;
    private readonly ICurrentUser         _cu;
    public AddMarketReplyHandler(MarketplaceDbContext db, ICurrentUser cu) => (_db, _cu) = (db, cu);

    public async Task<Result<Guid>> Handle(AddMarketReplyCommand cmd, CancellationToken ct)
    {
        if (_cu.SocietyId is not { } societyId || _cu.UserId is not { } userId)
            return Result<Guid>.Fail("AUTH.REQUIRED", "Authentication context required.");

        var post = await _db.MarketPosts.AsNoTracking().FirstOrDefaultAsync(p => p.Id == cmd.PostId && p.SocietyId == societyId && !p.IsDeleted, ct);
        if (post is null) return Result<Guid>.Fail("MARKET.NOT_FOUND", "Post not found.");
        if (post.Status == MarketStatus.Closed) return Result<Guid>.Fail("MARKET.CLOSED", "This deal is closed.");

        var reply = MarketReply.Create(societyId, post.Id, userId, _cu.FlatId, cmd.Body);
        _db.MarketReplies.Add(reply);
        await _db.SaveChangesAsync(ct);
        return Result<Guid>.Ok(reply.Id);
    }
}

public sealed record DeleteMarketReplyCommand(Guid ReplyId) : IRequest<Result>;

public sealed class DeleteMarketReplyHandler : IRequestHandler<DeleteMarketReplyCommand, Result>
{
    private readonly MarketplaceDbContext _db;
    private readonly ICurrentUser         _cu;
    public DeleteMarketReplyHandler(MarketplaceDbContext db, ICurrentUser cu) => (_db, _cu) = (db, cu);

    public async Task<Result> Handle(DeleteMarketReplyCommand cmd, CancellationToken ct)
    {
        if (_cu.SocietyId is not { } societyId) return Result.Fail("AUTH.REQUIRED", "Authentication context required.");

        var reply = await _db.MarketReplies.FirstOrDefaultAsync(r => r.Id == cmd.ReplyId && r.SocietyId == societyId && !r.IsDeleted, ct);
        if (reply is null) return Result.Fail("MARKET.NOT_FOUND", "Reply not found.");

        var postAuthor = await _db.MarketPosts.AsNoTracking().Where(p => p.Id == reply.PostId).Select(p => (Guid?)p.AuthorUserId).FirstOrDefaultAsync(ct);
        if (!_cu.IsInRole("admin") && _cu.UserId != reply.AuthorUserId && _cu.UserId != postAuthor)
            return Result.Fail("FORBIDDEN", "Only the person who wrote this, the poster, or an admin can remove a reply.");

        reply.SoftDelete();
        await _db.SaveChangesAsync(ct);
        return Result.Ok();
    }
}
