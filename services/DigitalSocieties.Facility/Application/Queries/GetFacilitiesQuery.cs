using MediatR;
using Microsoft.EntityFrameworkCore;
using DigitalSocieties.Shared.Contracts;
using DigitalSocieties.Shared.Results;
using DigitalSocieties.Facility.Domain.Entities;
using DigitalSocieties.Facility.Infrastructure.Persistence;

namespace DigitalSocieties.Facility.Application.Queries;

// ── DTOs ───────────────────────────────────────────────────────────────────
public sealed record FacilityDto(
    Guid    Id,
    string  Name,
    string  Description,
    string? ImageUrl,
    int     CapacityPersons,
    int     SlotDurationMinutes,
    string  OpenTime,
    string  CloseTime,
    bool    IsActive);

public sealed record BookingDto(
    Guid   Id,
    Guid   FacilityId,
    string FacilityName,
    string BookingDate,
    string StartTime,
    string EndTime,
    string Status,
    string? CancelReason);

public sealed record SlotDto(string StartTime, string EndTime, bool IsAvailable);

// ── List facilities ────────────────────────────────────────────────────────
public sealed record GetFacilitiesQuery(bool ActiveOnly = true)
    : IRequest<Result<List<FacilityDto>>>;

public sealed class GetFacilitiesHandler
    : IRequestHandler<GetFacilitiesQuery, Result<List<FacilityDto>>>
{
    private readonly FacilityDbContext _db;
    private readonly ICurrentUser      _currentUser;

    public GetFacilitiesHandler(FacilityDbContext db, ICurrentUser currentUser)
        => (_db, _currentUser) = (db, currentUser);

    public async Task<Result<List<FacilityDto>>> Handle(
        GetFacilitiesQuery q, CancellationToken ct)
    {
        var query = _db.Facilities
            .Where(f => f.SocietyId == _currentUser.SocietyId);
        if (q.ActiveOnly) query = query.Where(f => f.IsActive);

        var items = await query
            .OrderBy(f => f.Name)
            .Select(f => new FacilityDto(f.Id, f.Name, f.Description, f.ImageUrl,
                f.CapacityPersons, f.SlotDurationMinutes,
                f.OpenTime.ToString("HH:mm"), f.CloseTime.ToString("HH:mm"), f.IsActive))
            .ToListAsync(ct);

        return Result<List<FacilityDto>>.Ok(items);
    }
}

// ── Get available slots for a date ─────────────────────────────────────────
public sealed record GetAvailableSlotsQuery(Guid FacilityId, DateOnly Date)
    : IRequest<Result<List<SlotDto>>>;

public sealed class GetAvailableSlotsHandler
    : IRequestHandler<GetAvailableSlotsQuery, Result<List<SlotDto>>>
{
    private readonly FacilityDbContext _db;
    private readonly ICurrentUser      _currentUser;

    public GetAvailableSlotsHandler(FacilityDbContext db, ICurrentUser currentUser)
        => (_db, _currentUser) = (db, currentUser);

    public async Task<Result<List<SlotDto>>> Handle(
        GetAvailableSlotsQuery q, CancellationToken ct)
    {
        var facility = await _db.Facilities
            .FirstOrDefaultAsync(f => f.Id == q.FacilityId
                                   && f.SocietyId == _currentUser.SocietyId, ct);
        if (facility is null) return Result<List<SlotDto>>.Fail("Facility not found.");

        var booked = await _db.Bookings
            .Where(b => b.FacilityId == q.FacilityId
                     && b.BookingDate == q.Date
                     && b.Status == BookingStatus.Confirmed)
            .Select(b => new { b.StartTime, b.EndTime })
            .ToListAsync(ct);

        var slots = new List<SlotDto>();
        var current = facility.OpenTime;
        while (current.Add(TimeSpan.FromMinutes(facility.SlotDurationMinutes)) <= facility.CloseTime)
        {
            var next = current.Add(TimeSpan.FromMinutes(facility.SlotDurationMinutes));
            var isBooked = booked.Any(b => b.StartTime < next && b.EndTime > current);
            slots.Add(new SlotDto(current.ToString("HH:mm"), next.ToString("HH:mm"), !isBooked));
            current = next;
        }

        return Result<List<SlotDto>>.Ok(slots);
    }
}

// ── My bookings ────────────────────────────────────────────────────────────
public sealed record GetMyBookingsQuery(bool UpcomingOnly = true)
    : IRequest<Result<List<BookingDto>>>;

public sealed class GetMyBookingsHandler
    : IRequestHandler<GetMyBookingsQuery, Result<List<BookingDto>>>
{
    private readonly FacilityDbContext _db;
    private readonly ICurrentUser      _currentUser;

    public GetMyBookingsHandler(FacilityDbContext db, ICurrentUser currentUser)
        => (_db, _currentUser) = (db, currentUser);

    public async Task<Result<List<BookingDto>>> Handle(
        GetMyBookingsQuery q, CancellationToken ct)
    {
        var today = DateOnly.FromDateTime(DateTime.Today);
        var query = _db.Bookings
            .Include(b => b.Facility)
            .Where(b => b.FlatId == _currentUser.FlatId
                     && b.SocietyId == _currentUser.SocietyId);

        if (q.UpcomingOnly) query = query.Where(b => b.BookingDate >= today);

        var items = await query
            .OrderBy(b => b.BookingDate).ThenBy(b => b.StartTime)
            .Select(b => new BookingDto(b.Id, b.FacilityId, b.Facility!.Name,
                b.BookingDate.ToString("yyyy-MM-dd"),
                b.StartTime.ToString("HH:mm"), b.EndTime.ToString("HH:mm"),
                b.Status.ToString(), b.CancelReason))
            .ToListAsync(ct);

        return Result<List<BookingDto>>.Ok(items);
    }
}
