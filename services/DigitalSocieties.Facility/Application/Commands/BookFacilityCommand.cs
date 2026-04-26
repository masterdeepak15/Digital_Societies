using MediatR;
using FluentValidation;
using Microsoft.EntityFrameworkCore;
using DigitalSocieties.Shared.Contracts;
using DigitalSocieties.Shared.Results;
using DigitalSocieties.Facility.Domain.Entities;
using DigitalSocieties.Facility.Infrastructure.Persistence;

namespace DigitalSocieties.Facility.Application.Commands;

// ── Book Facility ──────────────────────────────────────────────────────────
public sealed record BookFacilityCommand(
    Guid     FacilityId,
    DateOnly BookingDate,
    TimeOnly StartTime,
    TimeOnly EndTime
) : IRequest<Result<Guid>>;

public sealed class BookFacilityValidator : AbstractValidator<BookFacilityCommand>
{
    public BookFacilityValidator()
    {
        RuleFor(x => x.FacilityId).NotEmpty();
        RuleFor(x => x.BookingDate).Must(d => d >= DateOnly.FromDateTime(DateTime.Today))
            .WithMessage("Cannot book a past date.");
        RuleFor(x => x.EndTime).Must((cmd, end) => end > cmd.StartTime)
            .WithMessage("End time must be after start time.");
    }
}

public sealed class BookFacilityHandler : IRequestHandler<BookFacilityCommand, Result<Guid>>
{
    private readonly FacilityDbContext _db;
    private readonly ICurrentUser      _currentUser;

    public BookFacilityHandler(FacilityDbContext db, ICurrentUser currentUser)
        => (_db, _currentUser) = (db, currentUser);

    public async Task<Result<Guid>> Handle(BookFacilityCommand cmd, CancellationToken ct)
    {
        if (_currentUser.SocietyId is null || _currentUser.FlatId is null || _currentUser.UserId is null)
            return Result<Guid>.Fail("AUTH.REQUIRED", "Authentication context is required.");

        var facility = await _db.Facilities
            .FirstOrDefaultAsync(f => f.Id == cmd.FacilityId
                                   && f.SocietyId == _currentUser.SocietyId.Value
                                   && f.IsActive, ct);
        if (facility is null)
            return Result<Guid>.Fail("FACILITY.NOT_FOUND", "Facility not found or inactive.");

        // Conflict check — no overlapping confirmed bookings
        var conflict = await _db.Bookings.AnyAsync(b =>
            b.FacilityId  == cmd.FacilityId &&
            b.BookingDate == cmd.BookingDate &&
            b.Status      == BookingStatus.Confirmed &&
            b.StartTime   < cmd.EndTime &&
            b.EndTime     > cmd.StartTime, ct);

        if (conflict)
            return Result<Guid>.Fail("FACILITY.CONFLICT", "This time slot is already booked.");

        // Per-flat advance booking limit
        var flatBookings = await _db.Bookings.CountAsync(b =>
            b.FlatId      == _currentUser.FlatId.Value &&
            b.FacilityId  == cmd.FacilityId &&
            b.Status      == BookingStatus.Confirmed &&
            b.BookingDate >= DateOnly.FromDateTime(DateTime.Today), ct);

        if (flatBookings >= facility.MaxBookingsPerFlat)
            return Result<Guid>.Fail("FACILITY.LIMIT",
                $"Maximum {facility.MaxBookingsPerFlat} advance bookings per flat.");

        var booking = FacilityBooking.Create(
            cmd.FacilityId,
            _currentUser.SocietyId.Value,
            _currentUser.FlatId.Value,
            _currentUser.UserId.Value,
            cmd.BookingDate, cmd.StartTime, cmd.EndTime);

        _db.Bookings.Add(booking);
        await _db.SaveChangesAsync(ct);
        return Result<Guid>.Ok(booking.Id);
    }
}

// ── Cancel Booking ─────────────────────────────────────────────────────────
public sealed record CancelBookingCommand(Guid BookingId, string Reason) : IRequest<Result>;

public sealed class CancelBookingHandler : IRequestHandler<CancelBookingCommand, Result>
{
    private readonly FacilityDbContext _db;
    private readonly ICurrentUser      _currentUser;

    public CancelBookingHandler(FacilityDbContext db, ICurrentUser currentUser)
        => (_db, _currentUser) = (db, currentUser);

    public async Task<Result> Handle(CancelBookingCommand cmd, CancellationToken ct)
    {
        if (_currentUser.SocietyId is null)
            return Result.Fail("AUTH.REQUIRED", "Authentication context is required.");

        var booking = await _db.Bookings
            .FirstOrDefaultAsync(b => b.Id == cmd.BookingId
                                   && b.SocietyId == _currentUser.SocietyId.Value, ct);
        if (booking is null)
            return Result.Fail("BOOKING.NOT_FOUND", "Booking not found.");

        // Admin can cancel any; resident only their own
        if (booking.BookedBy != _currentUser.UserId && !_currentUser.IsInRole("admin"))
            return Result.Fail("UNAUTHORIZED", "Not authorized to cancel this booking.");

        booking.Cancel(cmd.Reason);
        await _db.SaveChangesAsync(ct);
        return Result.Ok();
    }
}
