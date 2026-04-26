namespace DigitalSocieties.Social.Domain.Enums;

/// <summary>
/// Every post belongs to exactly one category.
/// Drives the feed filter tabs and notification routing.
/// </summary>
public static class PostCategory
{
    public const string General          = "general";
    public const string LostFound        = "lost_found";
    public const string HelpWanted       = "help_wanted";    // auto-expires in 24h
    public const string ForSale          = "for_sale";       // becomes a MarketplaceListing
    public const string Recommendation   = "recommendation";
    public const string Warning          = "warning";
    public const string Event            = "event";          // has EventDetails
    public const string Poll             = "poll";           // has Poll child
    public const string Emergency        = "emergency";      // admin-only; triggers loud push

    public static readonly IReadOnlySet<string> All = new HashSet<string>
    {
        General, LostFound, HelpWanted, ForSale,
        Recommendation, Warning, Event, Poll, Emergency,
    };

    public static readonly IReadOnlySet<string> AdminOnly = new HashSet<string>
    {
        Emergency,
    };

    /// <summary>
    /// HelpWanted posts auto-expire after 24 hours if no manual expiry is set.
    /// </summary>
    public static readonly IReadOnlySet<string> AutoExpiring = new HashSet<string>
    {
        HelpWanted,
    };
}
