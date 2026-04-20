using DigitalSocieties.Shared.Domain.Entities;
using DigitalSocieties.Shared.Results;

namespace DigitalSocieties.Social.Domain.Entities;

/// <summary>
/// A buy/sell/give-away listing that lives alongside a SocialPost (category = "for_sale").
/// The post provides the body text and images; this entity adds price + condition metadata.
/// No commission at this stage — that's the full Local Services Marketplace in Phase 5.
/// </summary>
public sealed class MarketplaceListing : Entity
{
    public const string ConditionNew      = "new";
    public const string ConditionLikeNew  = "like_new";
    public const string ConditionGood     = "good";
    public const string ConditionFair     = "fair";

    public static readonly IReadOnlySet<string> ValidConditions =
        new HashSet<string> { ConditionNew, ConditionLikeNew, ConditionGood, ConditionFair };

    public Guid PostId            { get; private set; }
    public long? PricePaise       { get; private set; }   // null = free / give-away
    public string Condition       { get; private set; } = ConditionGood;
    public bool IsSold            { get; private set; }
    public Guid? SoldToUserId     { get; private set; }
    public DateTimeOffset CreatedAt { get; private set; }

    private MarketplaceListing() { }

    public static Result<MarketplaceListing> Create(
        Guid postId,
        long? pricePaise,
        string condition)
    {
        if (!ValidConditions.Contains(condition))
            return Result<MarketplaceListing>.Fail(new Error("Listing.InvalidCondition",
                $"Condition '{condition}' is not valid. Use: new, like_new, good, fair."));

        if (pricePaise.HasValue && pricePaise.Value < 0)
            return Result<MarketplaceListing>.Fail(new Error("Listing.NegativePrice",
                "Price cannot be negative."));

        return Result<MarketplaceListing>.Ok(new MarketplaceListing
        {
            Id         = Guid.NewGuid(),
            PostId     = postId,
            PricePaise = pricePaise,
            Condition  = condition,
            CreatedAt  = DateTimeOffset.UtcNow,
        });
    }

    public Result<bool> MarkSold(Guid buyerUserId)
    {
        if (IsSold)
            return Result<bool>.Fail(new Error("Listing.AlreadySold", "This item is already marked as sold."));

        IsSold        = true;
        SoldToUserId  = buyerUserId;
        return Result<bool>.Ok(true);
    }
}
