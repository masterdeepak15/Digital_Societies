using MediatR;
using Microsoft.EntityFrameworkCore;
using DigitalSocieties.Shared.Contracts;
using DigitalSocieties.Shared.Results;
using DigitalSocieties.Shared.Domain.ValueObjects;
using DigitalSocieties.Marketplace.Domain.Entities;
using DigitalSocieties.Marketplace.Infrastructure.Persistence;

namespace DigitalSocieties.Marketplace.Application.Commands;

// ── Create listing (provider or admin) ────────────────────────────────────
public sealed record CreateListingCommand(
    string   ProviderName,
    string   Phone,
    string   Category,
    string   Title,
    string   Description,
    decimal  BaseRateRupees,
    string   RateUnit,
    decimal  CommissionPct) : IRequest<Result<Guid>>;

public sealed class CreateListingHandler
    : IRequestHandler<CreateListingCommand, Result<Guid>>
{
    private readonly MarketplaceDbContext _db;
    private readonly ICurrentUser         _cu;
    public CreateListingHandler(MarketplaceDbContext db, ICurrentUser cu) => (_db, _cu) = (db, cu);

    public async Task<Result<Guid>> Handle(CreateListingCommand cmd, CancellationToken ct)
    {
        if (_cu.SocietyId is null || _cu.UserId is null)
            return Result<Guid>.Fail("AUTH.REQUIRED", "Authentication context required.");

        var rateResult = Money.CreateInr(cmd.BaseRateRupees);
        if (rateResult.IsFailure) return Result<Guid>.Fail(rateResult.Error!);

        if (!Enum.TryParse<ServiceCategory>(cmd.Category, true, out var category))
            return Result<Guid>.Fail("LISTING.INVALID_CATEGORY", $"Unknown category: {cmd.Category}");

        if (!Enum.TryParse<RateUnit>(cmd.RateUnit, true, out var rateUnit))
            return Result<Guid>.Fail("LISTING.INVALID_RATE_UNIT", $"Unknown rate unit: {cmd.RateUnit}");

        var listing = ServiceListing.Create(
            _cu.SocietyId.Value, _cu.UserId.Value,
            cmd.ProviderName, cmd.Phone,
            category, cmd.Title, cmd.Description,
            rateResult.Value!, rateUnit,
            commissionPct: Math.Clamp(cmd.CommissionPct, 0m, 100m));

        _db.ServiceListings.Add(listing);
        await _db.SaveChangesAsync(ct);
        return Result<Guid>.Ok(listing.Id);
    }
}

// ── Book a service (resident) ──────────────────────────────────────────────
public sealed record BookServiceCommand(
    Guid           ListingId,
    DateTimeOffset ScheduledAt,
    decimal        QuotedAmountRupees,
    string?        Notes) : IRequest<Result<Guid>>;

public sealed class BookServiceHandler : IRequestHandler<BookServiceCommand, Result<Guid>>
{
    private readonly MarketplaceDbContext _db;
    private readonly ICurrentUser         _cu;
    public BookServiceHandler(MarketplaceDbContext db, ICurrentUser cu) => (_db, _cu) = (db, cu);

    public async Task<Result<Guid>> Handle(BookServiceCommand cmd, CancellationToken ct)
    {
        if (_cu.SocietyId is null || _cu.UserId is null || _cu.FlatId is null)
            return Result<Guid>.Fail("AUTH.REQUIRED", "Authentication context required.");

        var listing = await _db.ServiceListings
            .FirstOrDefaultAsync(l => l.Id == cmd.ListingId
                                   && l.SocietyId == _cu.SocietyId.Value
                                   && l.IsActive, ct);

        if (listing is null)
            return Result<Guid>.Fail("LISTING.NOT_FOUND", "Service listing not found or inactive.");

        var amtResult = Money.CreateInr(cmd.QuotedAmountRupees);
        if (amtResult.IsFailure) return Result<Guid>.Fail(amtResult.Error!);

        var booking = ServiceBooking.Create(
            _cu.SocietyId.Value, cmd.ListingId,
            _cu.UserId.Value, _cu.FlatId.Value,
            cmd.ScheduledAt, amtResult.Value!,
            cmd.Notes);

        _db.ServiceBookings.Add(booking);
        await _db.SaveChangesAsync(ct);
        return Result<Guid>.Ok(booking.Id);
    }
}

// ── Confirm booking (provider) ─────────────────────────────────────────────
public sealed record ConfirmBookingCommand(Guid BookingId) : IRequest<Result>;

public sealed class ConfirmBookingHandler : IRequestHandler<ConfirmBookingCommand, Result>
{
    private readonly MarketplaceDbContext _db;
    private readonly ICurrentUser         _cu;
    public ConfirmBookingHandler(MarketplaceDbContext db, ICurrentUser cu) => (_db, _cu) = (db, cu);

    public async Task<Result> Handle(ConfirmBookingCommand cmd, CancellationToken ct)
    {
        if (_cu.UserId is null)
            return Result.Fail("AUTH.REQUIRED", "Authentication context required.");

        var booking = await _db.ServiceBookings
            .Include(b => b.Listing)
            .FirstOrDefaultAsync(b => b.Id == cmd.BookingId, ct);

        if (booking is null)
            return Result.Fail("BOOKING.NOT_FOUND", "Booking not found.");

        // Only the listing's provider (or admin) can confirm
        if (booking.Listing?.ProviderId != _cu.UserId.Value && !_cu.IsInRole("admin"))
            return Result.Fail("AUTH.FORBIDDEN", "Only the service provider can confirm this booking.");

        var r = booking.Confirm();
        if (r.IsFailure) return r;

        await _db.SaveChangesAsync(ct);
        return Result.Ok();
    }
}

// ── Complete booking (provider marks work done) ────────────────────────────
public sealed record CompleteBookingCommand(Guid BookingId, decimal FinalAmountRupees)
    : IRequest<Result>;

public sealed class CompleteBookingHandler : IRequestHandler<CompleteBookingCommand, Result>
{
    private readonly MarketplaceDbContext _db;
    private readonly ICurrentUser         _cu;
    public CompleteBookingHandler(MarketplaceDbContext db, ICurrentUser cu) => (_db, _cu) = (db, cu);

    public async Task<Result> Handle(CompleteBookingCommand cmd, CancellationToken ct)
    {
        if (_cu.UserId is null)
            return Result.Fail("AUTH.REQUIRED", "Authentication context required.");

        var booking = await _db.ServiceBookings
            .Include(b => b.Listing)
            .FirstOrDefaultAsync(b => b.Id == cmd.BookingId, ct);

        if (booking is null) return Result.Fail("BOOKING.NOT_FOUND", "Booking not found.");

        if (booking.Listing?.ProviderId != _cu.UserId.Value && !_cu.IsInRole("admin"))
            return Result.Fail("AUTH.FORBIDDEN", "Only the service provider can complete this booking.");

        var amtResult = Money.CreateInr(cmd.FinalAmountRupees);
        if (amtResult.IsFailure) return Result.Fail(amtResult.Error!);

        var r = booking.Complete(amtResult.Value!);
        if (r.IsFailure) return r;

        // Update listing average rating cache (done on review, not here)
        await _db.SaveChangesAsync(ct);
        return Result.Ok();
    }
}

// ── Cancel booking ─────────────────────────────────────────────────────────
public sealed record CancelBookingCommand(Guid BookingId, string Reason) : IRequest<Result>;

public sealed class CancelBookingHandler : IRequestHandler<CancelBookingCommand, Result>
{
    private readonly MarketplaceDbContext _db;
    private readonly ICurrentUser         _cu;
    public CancelBookingHandler(MarketplaceDbContext db, ICurrentUser cu) => (_db, _cu) = (db, cu);

    public async Task<Result> Handle(CancelBookingCommand cmd, CancellationToken ct)
    {
        if (_cu.UserId is null)
            return Result.Fail("AUTH.REQUIRED", "Authentication context required.");

        var booking = await _db.ServiceBookings
            .Include(b => b.Listing)
            .FirstOrDefaultAsync(b => b.Id == cmd.BookingId, ct);

        if (booking is null) return Result.Fail("BOOKING.NOT_FOUND", "Booking not found.");

        // Resident can cancel their own; provider/admin can cancel any
        bool isOwner    = booking.ResidentId == _cu.UserId.Value;
        bool isProvider = booking.Listing?.ProviderId == _cu.UserId.Value;
        if (!isOwner && !isProvider && !_cu.IsInRole("admin"))
            return Result.Fail("AUTH.FORBIDDEN", "Not authorised to cancel this booking.");

        var r = booking.Cancel(cmd.Reason);
        if (r.IsFailure) return r;

        await _db.SaveChangesAsync(ct);
        return Result.Ok();
    }
}

// ── Review service (resident after completion) ─────────────────────────────
public sealed record ReviewServiceCommand(Guid BookingId, int Rating, string Comment)
    : IRequest<Result<Guid>>;

public sealed class ReviewServiceHandler : IRequestHandler<ReviewServiceCommand, Result<Guid>>
{
    private readonly MarketplaceDbContext _db;
    private readonly ICurrentUser         _cu;
    public ReviewServiceHandler(MarketplaceDbContext db, ICurrentUser cu) => (_db, _cu) = (db, cu);

    public async Task<Result<Guid>> Handle(ReviewServiceCommand cmd, CancellationToken ct)
    {
        if (_cu.SocietyId is null || _cu.UserId is null)
            return Result<Guid>.Fail("AUTH.REQUIRED", "Authentication context required.");

        var booking = await _db.ServiceBookings
            .FirstOrDefaultAsync(b => b.Id     == cmd.BookingId
                                   && b.ResidentId == _cu.UserId.Value
                                   && b.Status     == BookingStatus.Completed, ct);

        if (booking is null)
            return Result<Guid>.Fail("BOOKING.NOT_FOUND",
                "Booking not found or not yet completed.");

        if (await _db.ServiceReviews.AnyAsync(r => r.BookingId == cmd.BookingId, ct))
            return Result<Guid>.Fail("REVIEW.DUPLICATE", "You have already reviewed this booking.");

        var reviewResult = ServiceReview.Create(
            _cu.SocietyId.Value, cmd.BookingId,
            booking.ListingId, _cu.UserId.Value,
            cmd.Rating, cmd.Comment);

        if (reviewResult.IsFailure) return Result<Guid>.Fail(reviewResult.Error!);

        _db.ServiceReviews.Add(reviewResult.Value!);

        // Recompute average rating for the listing
        var allRatings = await _db.ServiceReviews
            .Where(r => r.ListingId == booking.ListingId)
            .Select(r => r.Rating)
            .ToListAsync(ct);
        allRatings.Add(cmd.Rating);

        var listing = await _db.ServiceListings.FindAsync([booking.ListingId], ct);
        listing?.UpdateRating((float)allRatings.Average(), allRatings.Count);

        await _db.SaveChangesAsync(ct);
        return Result<Guid>.Ok(reviewResult.Value!.Id);
    }
}
