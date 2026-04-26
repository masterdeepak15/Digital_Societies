using DigitalSocieties.Shared.Domain.Entities;
using DigitalSocieties.Shared.Domain.ValueObjects;
using DigitalSocieties.Shared.Results;

namespace DigitalSocieties.Marketplace.Domain.Entities;

/// <summary>
/// A resident's booking of a service listing.
/// State machine: Pending → Confirmed → Completed | Cancelled
/// </summary>
public sealed class ServiceBooking : AuditableEntity
{
    public Guid           Id          { get; private set; } = Guid.NewGuid();
    public Guid           SocietyId   { get; private set; }
    public Guid           ListingId   { get; private set; }
    public Guid           ResidentId  { get; private set; }
    public Guid           FlatId      { get; private set; }

    public DateTimeOffset ScheduledAt { get; private set; }
    public string?        Notes       { get; private set; }

    public BookingStatus  Status      { get; private set; } = BookingStatus.Pending;

    /// <summary>Amount quoted at booking time (locked in; rate changes don't affect live bookings).</summary>
    public Money          QuotedAmount { get; private set; } = null!;

    /// <summary>Final amount charged after completion (may differ if hours adjusted).</summary>
    public Money?         FinalAmount  { get; private set; }

    public DateTimeOffset? ConfirmedAt  { get; private set; }
    public DateTimeOffset? CompletedAt  { get; private set; }
    public DateTimeOffset? CancelledAt  { get; private set; }
    public string?         CancelReason { get; private set; }

    // EF navigation
    public ServiceListing?  Listing  { get; private set; }
    public ServiceReview?   Review   { get; private set; }

    private ServiceBooking() { }

    public static ServiceBooking Create(
        Guid           societyId,
        Guid           listingId,
        Guid           residentId,
        Guid           flatId,
        DateTimeOffset scheduledAt,
        Money          quotedAmount,
        string?        notes = null)
    {
        return new ServiceBooking
        {
            SocietyId    = societyId,
            ListingId    = listingId,
            ResidentId   = residentId,
            FlatId       = flatId,
            ScheduledAt  = scheduledAt,
            QuotedAmount = quotedAmount,
            Notes        = notes?.Trim(),
        };
    }

    public Result Confirm()
    {
        if (Status != BookingStatus.Pending)
            return Result.Fail("BOOKING.INVALID_STATE", $"Cannot confirm a {Status} booking.");
        Status      = BookingStatus.Confirmed;
        ConfirmedAt = DateTimeOffset.UtcNow;
        return Result.Ok();
    }

    public Result Complete(Money finalAmount)
    {
        if (Status != BookingStatus.Confirmed)
            return Result.Fail("BOOKING.INVALID_STATE", $"Cannot complete a {Status} booking.");
        Status      = BookingStatus.Completed;
        FinalAmount = finalAmount;
        CompletedAt = DateTimeOffset.UtcNow;
        return Result.Ok();
    }

    public Result Cancel(string reason)
    {
        if (Status is BookingStatus.Completed or BookingStatus.Cancelled)
            return Result.Fail("BOOKING.INVALID_STATE", $"Cannot cancel a {Status} booking.");
        Status       = BookingStatus.Cancelled;
        CancelReason = reason.Trim();
        CancelledAt  = DateTimeOffset.UtcNow;
        return Result.Ok();
    }
}

public enum BookingStatus { Pending, Confirmed, Completed, Cancelled }
