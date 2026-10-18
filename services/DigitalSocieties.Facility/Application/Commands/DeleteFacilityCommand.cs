using MediatR;
using Microsoft.EntityFrameworkCore;
using DigitalSocieties.Shared.Contracts;
using DigitalSocieties.Shared.Results;
using DigitalSocieties.Facility.Domain.Entities;
using DigitalSocieties.Facility.Infrastructure.Persistence;

namespace DigitalSocieties.Facility.Application.Commands;

// ── Delete a facility (admin) ──────────────────────────────────────────────
// Refused while residents still hold upcoming bookings; switch it off instead, or cancel those first.
public sealed record DeleteFacilityCommand(Guid FacilityId) : IRequest<Result>;

public sealed class DeleteFacilityHandler : IRequestHandler<DeleteFacilityCommand, Result>
{
    private readonly FacilityDbContext _db;
    private readonly ICurrentUser      _cu;
    public DeleteFacilityHandler(FacilityDbContext db, ICurrentUser cu) => (_db, _cu) = (db, cu);

    public async Task<Result> Handle(DeleteFacilityCommand cmd, CancellationToken ct)
    {
        if (_cu.SocietyId is not { } societyId)
            return Result.Fail("AUTH.REQUIRED", "Society context is required.");

        var facility = await _db.Facilities.FirstOrDefaultAsync(f => f.Id == cmd.FacilityId && f.SocietyId == societyId, ct);
        if (facility is null) return Result.Fail("FACILITY.NOT_FOUND", "Facility not found.");

        var today = DateOnly.FromDateTime(DateTime.Today);
        if (await _db.Bookings.AnyAsync(b => b.FacilityId == facility.Id &&
                b.BookingDate >= today && b.Status == BookingStatus.Confirmed, ct))
            return Result.Fail("FACILITY.HAS_BOOKINGS", "Residents have upcoming bookings here. Cancel them first, or switch the facility off.");

        facility.SoftDelete();
        await _db.SaveChangesAsync(ct);
        return Result.Ok();
    }
}
