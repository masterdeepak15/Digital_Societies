using MediatR;
using Microsoft.EntityFrameworkCore;
using DigitalSocieties.Shared.Contracts;
using DigitalSocieties.Shared.Results;
using DigitalSocieties.Marketplace.Domain.Entities;
using DigitalSocieties.Marketplace.Infrastructure.Persistence;

namespace DigitalSocieties.Marketplace.Application.Queries;

// ── DTOs ───────────────────────────────────────────────────────────────────
public sealed record ListingDto(
    Guid    Id,
    string  ProviderName,
    string  Phone,
    string  Category,
    string  Title,
    string  Description,
    string? ProfilePhotoUrl,
    decimal BaseRateRupees,
    string  RateUnit,
    decimal CommissionPct,
    float   AverageRating,
    int     ReviewCount,
    bool    IsActive);

public sealed record BookingDto(
    Guid           Id,
    Guid           ListingId,
    string         ProviderName,
    string         Category,
    DateTimeOffset ScheduledAt,
    string         Status,
    decimal        QuotedAmount,
    decimal?       FinalAmount,
    string?        Notes,
    string?        CancelReason,
    bool           CanReview);

// ── Browse listings (resident) ─────────────────────────────────────────────
public sealed record GetListingsQuery(string? Category, int Page, int PageSize)
    : IRequest<Result<List<ListingDto>>>;

public sealed class GetListingsHandler
    : IRequestHandler<GetListingsQuery, Result<List<ListingDto>>>
{
    private readonly MarketplaceDbContext _db;
    private readonly ICurrentUser         _cu;
    public GetListingsHandler(MarketplaceDbContext db, ICurrentUser cu) => (_db, _cu) = (db, cu);

    public async Task<Result<List<ListingDto>>> Handle(GetListingsQuery q, CancellationToken ct)
    {
        if (_cu.SocietyId is null)
            return Result<List<ListingDto>>.Fail("AUTH.REQUIRED", "Society context required.");

        var query = _db.ServiceListings
            .Where(l => l.SocietyId == _cu.SocietyId.Value && l.IsActive && !l.IsDeleted);

        if (!string.IsNullOrWhiteSpace(q.Category) &&
            Enum.TryParse<ServiceCategory>(q.Category, true, out var cat))
            query = query.Where(l => l.Category == cat);

        var listings = await query
            .OrderByDescending(l => l.AverageRating)
            .ThenByDescending(l => l.ReviewCount)
            .Skip((q.Page - 1) * q.PageSize)
            .Take(q.PageSize)
            .Select(l => new ListingDto(
                l.Id, l.ProviderName, l.Phone,
                l.Category.ToString(), l.Title, l.Description,
                l.ProfilePhotoUrl,
                l.BaseRate.Amount, l.RateUnit.ToString(),
                l.CommissionPct, l.AverageRating, l.ReviewCount, l.IsActive))
            .ToListAsync(ct);

        return Result<List<ListingDto>>.Ok(listings);
    }
}

// ── My bookings (resident) ─────────────────────────────────────────────────
public sealed record GetMyBookingsQuery(string? Status) : IRequest<Result<List<BookingDto>>>;

public sealed class GetMyBookingsHandler
    : IRequestHandler<GetMyBookingsQuery, Result<List<BookingDto>>>
{
    private readonly MarketplaceDbContext _db;
    private readonly ICurrentUser         _cu;
    public GetMyBookingsHandler(MarketplaceDbContext db, ICurrentUser cu) => (_db, _cu) = (db, cu);

    public async Task<Result<List<BookingDto>>> Handle(GetMyBookingsQuery q, CancellationToken ct)
    {
        if (_cu.SocietyId is null || _cu.UserId is null)
            return Result<List<BookingDto>>.Fail("AUTH.REQUIRED", "Authentication context required.");

        var query = _db.ServiceBookings
            .Include(b => b.Listing)
            .Where(b => b.ResidentId == _cu.UserId.Value
                     && b.SocietyId  == _cu.SocietyId.Value
                     && !b.IsDeleted);

        if (!string.IsNullOrWhiteSpace(q.Status) &&
            Enum.TryParse<BookingStatus>(q.Status, true, out var status))
            query = query.Where(b => b.Status == status);

        // Pre-fetch reviewed booking IDs to avoid N+1
        var myBookingIds    = await query.Select(b => b.Id).ToListAsync(ct);
        var reviewedBookings = await _db.ServiceReviews
            .Where(r => myBookingIds.Contains(r.BookingId))
            .Select(r => r.BookingId)
            .ToHashSetAsync(ct);

        var bookings = await query
            .OrderByDescending(b => b.ScheduledAt)
            .Select(b => new BookingDto(
                b.Id, b.ListingId,
                b.Listing != null ? b.Listing.ProviderName : "—",
                b.Listing != null ? b.Listing.Category.ToString() : "—",
                b.ScheduledAt, b.Status.ToString(),
                b.QuotedAmount.Amount,
                b.FinalAmount != null ? b.FinalAmount.Amount : (decimal?)null,
                b.Notes, b.CancelReason,
                b.Status == BookingStatus.Completed && !reviewedBookings.Contains(b.Id)))
            .ToListAsync(ct);

        return Result<List<BookingDto>>.Ok(bookings);
    }
}

// ── Provider's bookings ────────────────────────────────────────────────────
public sealed record GetProviderBookingsQuery(string? Status)
    : IRequest<Result<List<BookingDto>>>;

public sealed class GetProviderBookingsHandler
    : IRequestHandler<GetProviderBookingsQuery, Result<List<BookingDto>>>
{
    private readonly MarketplaceDbContext _db;
    private readonly ICurrentUser         _cu;
    public GetProviderBookingsHandler(MarketplaceDbContext db, ICurrentUser cu) => (_db, _cu) = (db, cu);

    public async Task<Result<List<BookingDto>>> Handle(GetProviderBookingsQuery q, CancellationToken ct)
    {
        if (_cu.SocietyId is null || _cu.UserId is null)
            return Result<List<BookingDto>>.Fail("AUTH.REQUIRED", "Authentication context required.");

        var myListingIds = await _db.ServiceListings
            .Where(l => l.ProviderId == _cu.UserId.Value && l.SocietyId == _cu.SocietyId.Value)
            .Select(l => l.Id)
            .ToListAsync(ct);

        var query = _db.ServiceBookings
            .Include(b => b.Listing)
            .Where(b => myListingIds.Contains(b.ListingId) && !b.IsDeleted);

        if (!string.IsNullOrWhiteSpace(q.Status) &&
            Enum.TryParse<BookingStatus>(q.Status, true, out var status))
            query = query.Where(b => b.Status == status);

        var bookings = await query
            .OrderByDescending(b => b.ScheduledAt)
            .Select(b => new BookingDto(
                b.Id, b.ListingId,
                b.Listing != null ? b.Listing.ProviderName : "—",
                b.Listing != null ? b.Listing.Category.ToString() : "—",
                b.ScheduledAt, b.Status.ToString(),
                b.QuotedAmount.Amount,
                b.FinalAmount != null ? b.FinalAmount.Amount : (decimal?)null,
                b.Notes, b.CancelReason, false))
            .ToListAsync(ct);

        return Result<List<BookingDto>>.Ok(bookings);
    }
}
