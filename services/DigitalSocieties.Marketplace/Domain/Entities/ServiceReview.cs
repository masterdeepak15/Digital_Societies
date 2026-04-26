using DigitalSocieties.Shared.Domain.Entities;

namespace DigitalSocieties.Marketplace.Domain.Entities;

/// <summary>One review per completed booking — 1:1 enforced at DB level.</summary>
public sealed class ServiceReview : AuditableEntity
{
    public Guid   Id         { get; private set; } = Guid.NewGuid();
    public Guid   SocietyId  { get; private set; }
    public Guid   BookingId  { get; private set; }
    public Guid   ListingId  { get; private set; }
    public Guid   ReviewerId { get; private set; }
    public int    Rating     { get; private set; }  // 1–5
    public string Comment    { get; private set; } = string.Empty;

    private ServiceReview() { }

    public static Result<ServiceReview> Create(
        Guid   societyId,
        Guid   bookingId,
        Guid   listingId,
        Guid   reviewerId,
        int    rating,
        string comment)
    {
        if (rating is < 1 or > 5)
            return Result<ServiceReview>.Fail("REVIEW.INVALID_RATING", "Rating must be between 1 and 5.");

        return Result<ServiceReview>.Ok(new ServiceReview
        {
            SocietyId  = societyId,
            BookingId  = bookingId,
            ListingId  = listingId,
            ReviewerId = reviewerId,
            Rating     = rating,
            Comment    = comment.Trim()[..Math.Min(comment.Length, 1000)],
        });
    }
}
