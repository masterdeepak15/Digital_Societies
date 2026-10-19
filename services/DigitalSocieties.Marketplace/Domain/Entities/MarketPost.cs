using DigitalSocieties.Shared.Domain.Entities;

namespace DigitalSocieties.Marketplace.Domain.Entities;

/// <summary>What the person is asking for: sell something they own, look for something to buy, or borrow something.</summary>
public enum MarketKind { Sell, Wanted, Borrow }

public enum MarketStatus { Open, Closed }

/// <summary>
/// A resident's request in the society market: "I am selling this", "I want to buy this" or "can I borrow this".
/// Everyone in the society sees it and can reply; the author closes the deal when it is done
/// (sold, found, lent). Money is settled between the two people, not in the app.
/// </summary>
public sealed class MarketPost : AuditableEntity
{
    public const int MaxImages = 4;

    public new Guid   Id            { get; private set; } = Guid.NewGuid();
    public Guid       SocietyId     { get; private set; }
    public Guid       AuthorUserId  { get; private set; }
    /// <summary>The author's flat (null for management who live outside the society).</summary>
    public Guid?      AuthorFlatId  { get; private set; }

    public MarketKind Kind          { get; private set; }
    public string     Title         { get; private set; } = string.Empty;
    public string     Description   { get; private set; } = string.Empty;
    /// <summary>Asking price (Sell) or the most the person will pay (Wanted); null means free, or open to offers.</summary>
    public long?      PricePaise    { get; private set; }
    public string?    Condition     { get; private set; }
    /// <summary>Stored picture ids (see the media store).</summary>
    public List<string> ImageIds    { get; private set; } = [];

    public MarketStatus Status          { get; private set; } = MarketStatus.Open;
    /// <summary>The neighbour the deal was made with, when the author picked one.</summary>
    public Guid?        ClosedWithUserId { get; private set; }
    public DateTimeOffset? ClosedAt     { get; private set; }

    private MarketPost() { }

    public static MarketPost Create(Guid societyId, Guid authorUserId, Guid? authorFlatId, MarketKind kind,
        string title, string description, long? pricePaise, string? condition, IEnumerable<string>? imageIds)
    {
        var post = new MarketPost
        {
            SocietyId = societyId, AuthorUserId = authorUserId, AuthorFlatId = authorFlatId,
            CreatedAt = DateTimeOffset.UtcNow, UpdatedAt = DateTimeOffset.UtcNow,
        };
        post.Apply(kind, title, description, pricePaise, condition, imageIds);
        return post;
    }

    public void Edit(MarketKind kind, string title, string description, long? pricePaise, string? condition, IEnumerable<string>? imageIds)
    {
        Apply(kind, title, description, pricePaise, condition, imageIds);
        UpdatedAt = DateTimeOffset.UtcNow;
    }

    private void Apply(MarketKind kind, string title, string description, long? pricePaise, string? condition, IEnumerable<string>? imageIds)
    {
        Kind        = kind;
        Title       = title.Trim();
        Description = description.Trim();
        // Borrowing has no price.
        PricePaise  = kind == MarketKind.Borrow ? null : pricePaise;
        Condition   = kind == MarketKind.Sell && !string.IsNullOrWhiteSpace(condition) ? condition.Trim() : null;
        ImageIds    = (imageIds ?? []).Where(i => !string.IsNullOrWhiteSpace(i)).Distinct().Take(MaxImages).ToList();
    }

    public void Close(Guid? withUserId)
    {
        Status           = MarketStatus.Closed;
        ClosedWithUserId = withUserId;
        ClosedAt         = DateTimeOffset.UtcNow;
        UpdatedAt        = ClosedAt.Value;
    }

    public void Reopen()
    {
        Status           = MarketStatus.Open;
        ClosedWithUserId = null;
        ClosedAt         = null;
        UpdatedAt        = DateTimeOffset.UtcNow;
    }
}

/// <summary>A neighbour's reply on a market post. The discussion is public to the society, like comments.</summary>
public sealed class MarketReply : AuditableEntity
{
    public new Guid Id           { get; private set; } = Guid.NewGuid();
    public Guid     SocietyId    { get; private set; }
    public Guid     PostId       { get; private set; }
    public Guid     AuthorUserId { get; private set; }
    public Guid?    AuthorFlatId { get; private set; }
    public string   Body         { get; private set; } = string.Empty;

    private MarketReply() { }

    public static MarketReply Create(Guid societyId, Guid postId, Guid authorUserId, Guid? authorFlatId, string body) => new()
    {
        SocietyId = societyId, PostId = postId, AuthorUserId = authorUserId, AuthorFlatId = authorFlatId,
        Body = body.Trim(), CreatedAt = DateTimeOffset.UtcNow, UpdatedAt = DateTimeOffset.UtcNow,
    };
}
