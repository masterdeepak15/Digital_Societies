using MediatR;
using Microsoft.EntityFrameworkCore;
using DigitalSocieties.Shared.Contracts;
using DigitalSocieties.Shared.Results;
using DigitalSocieties.Parking.Domain.Entities;
using DigitalSocieties.Parking.Infrastructure.Persistence;

namespace DigitalSocieties.Parking.Application.Queries;

// ── DTOs ───────────────────────────────────────────────────────────────────
public sealed record ParkingLevelDto(
    Guid   Id,
    string Name,
    int    LevelNumber,
    string? FloorPlanUrl,
    int    TotalSlots,
    int    AvailableSlots);

public sealed record ParkingSlotDto(
    Guid      Id,
    string    SlotNumber,
    string    Type,
    string    Status,
    bool      IsEvCharger,
    string?   AssignedFlatNumber,
    string?   VehicleNumber,
    string?   VehicleType);

public sealed record MyParkingDto(
    string?    SlotNumber,
    string?    LevelName,
    string?    VehicleNumber,
    string?    VehicleType,
    bool       HasEv,
    List<VehicleDto> Vehicles);

public sealed record VehicleDto(
    Guid    Id,
    string  RegistrationNumber,
    string  Type,
    string? MakeModel,
    string? Color,
    bool    IsActive);

// ── Get all parking levels with slot counts (admin) ────────────────────────
public sealed record GetParkingLevelsQuery : IRequest<Result<List<ParkingLevelDto>>>;

public sealed class GetParkingLevelsHandler
    : IRequestHandler<GetParkingLevelsQuery, Result<List<ParkingLevelDto>>>
{
    private readonly ParkingDbContext _db;
    private readonly ICurrentUser     _cu;
    public GetParkingLevelsHandler(ParkingDbContext db, ICurrentUser cu) => (_db, _cu) = (db, cu);

    public async Task<Result<List<ParkingLevelDto>>> Handle(
        GetParkingLevelsQuery _, CancellationToken ct)
    {
        if (_cu.SocietyId is null)
            return Result<List<ParkingLevelDto>>.Fail("AUTH.REQUIRED", "Society context required.");

        var levels = await _db.ParkingLevels
            .Where(l => l.SocietyId == _cu.SocietyId.Value && !l.IsDeleted)
            .OrderBy(l => l.LevelNumber)
            .Select(l => new ParkingLevelDto(
                l.Id, l.Name, l.LevelNumber, l.FloorPlanUrl,
                l.Slots.Count(s => !s.IsDeleted),
                l.Slots.Count(s => !s.IsDeleted && s.Status == SlotStatus.Available)))
            .ToListAsync(ct);

        return Result<List<ParkingLevelDto>>.Ok(levels);
    }
}

// ── Get slots for a level (admin) ──────────────────────────────────────────
public sealed record GetLevelSlotsQuery(Guid LevelId) : IRequest<Result<List<ParkingSlotDto>>>;

public sealed class GetLevelSlotsHandler
    : IRequestHandler<GetLevelSlotsQuery, Result<List<ParkingSlotDto>>>
{
    private readonly ParkingDbContext _db;
    private readonly ICurrentUser     _cu;
    public GetLevelSlotsHandler(ParkingDbContext db, ICurrentUser cu) => (_db, _cu) = (db, cu);

    public async Task<Result<List<ParkingSlotDto>>> Handle(
        GetLevelSlotsQuery q, CancellationToken ct)
    {
        if (_cu.SocietyId is null)
            return Result<List<ParkingSlotDto>>.Fail("AUTH.REQUIRED", "Society context required.");

        var slots = await _db.ParkingSlots
            .Where(s => s.LevelId == q.LevelId
                     && s.SocietyId == _cu.SocietyId.Value
                     && !s.IsDeleted)
            .OrderBy(s => s.SlotNumber)
            .Select(s => new ParkingSlotDto(
                s.Id,
                s.SlotNumber,
                s.Type.ToString(),
                s.Status.ToString(),
                s.IsEvCharger,
                null,           // FlatNumber resolved separately if needed
                s.VehicleNumber,
                s.VehicleType))
            .ToListAsync(ct);

        return Result<List<ParkingSlotDto>>.Ok(slots);
    }
}

// ── My parking info (resident) ─────────────────────────────────────────────
public sealed record GetMyParkingQuery : IRequest<Result<MyParkingDto>>;

public sealed class GetMyParkingHandler
    : IRequestHandler<GetMyParkingQuery, Result<MyParkingDto>>
{
    private readonly ParkingDbContext _db;
    private readonly ICurrentUser     _cu;
    public GetMyParkingHandler(ParkingDbContext db, ICurrentUser cu) => (_db, _cu) = (db, cu);

    public async Task<Result<MyParkingDto>> Handle(GetMyParkingQuery _, CancellationToken ct)
    {
        if (_cu.SocietyId is null || _cu.FlatId is null)
            return Result<MyParkingDto>.Fail("AUTH.REQUIRED", "Society and flat context required.");

        var slot = await _db.ParkingSlots
            .Include(s => s.Level)
            .Where(s => s.AssignedFlatId == _cu.FlatId.Value
                     && s.SocietyId      == _cu.SocietyId.Value
                     && s.Status         == SlotStatus.AssignedResident
                     && !s.IsDeleted)
            .FirstOrDefaultAsync(ct);

        var vehicles = await _db.Vehicles
            .Where(v => v.FlatId    == _cu.FlatId.Value
                     && v.SocietyId == _cu.SocietyId.Value
                     && v.IsActive
                     && !v.IsDeleted)
            .Select(v => new VehicleDto(v.Id, v.RegistrationNumber, v.Type,
                                        v.MakeModel, v.Color, v.IsActive))
            .ToListAsync(ct);

        var dto = new MyParkingDto(
            slot?.SlotNumber,
            slot?.Level?.Name,
            slot?.VehicleNumber,
            slot?.VehicleType,
            slot?.IsEvCharger ?? false,
            vehicles);

        return Result<MyParkingDto>.Ok(dto);
    }
}

// ── Visitor parking nav (anonymous, token-gated) ──────────────────────────
/// <summary>
/// Returns gate coordinates, parking level floor plan, and assigned slot
/// so a visitor app / web page can render a MapLibre navigation view.
/// Token is the visitor's OTP or a dedicated nav token stored on the Visitor entity.
/// </summary>
public sealed record GetParkingNavQuery(string Token) : IRequest<Result<ParkingNavDto>>;

public sealed record ParkingNavDto(
    string  SocietyName,
    string  GateAddress,
    double  GateLat,
    double  GateLng,
    string? ParkingLevelName,
    string? SlotNumber,
    string? FloorPlanUrl,          // overlay image URL for indoor map
    string? NavigationUrl,         // deep-link to Google/Apple Maps
    string? Instructions);

public sealed class GetParkingNavHandler
    : IRequestHandler<GetParkingNavQuery, Result<ParkingNavDto>>
{
    // In a full implementation this would look up the Visitor by OTP/token,
    // find the issued visitor pass slot, and return real coordinates.
    // For now return a well-structured demo/stub response that the frontend
    // can consume directly — coordinates should be configured per society.
    public Task<Result<ParkingNavDto>> Handle(GetParkingNavQuery q, CancellationToken ct)
    {
        // Token validation (simplified — in production verify against Visitor OTP store)
        if (string.IsNullOrWhiteSpace(q.Token))
            return Task.FromResult(Result<ParkingNavDto>.Fail("TOKEN.INVALID", "Invalid navigation token."));

        var dto = new ParkingNavDto(
            SocietyName:      "Sunrise Heights",
            GateAddress:      "Plot 42, Baner Road, Pune 411045",
            GateLat:          18.5592,
            GateLng:          73.7852,
            ParkingLevelName: "B1 — Basement",
            SlotNumber:       "B1-05",
            FloorPlanUrl:     null,  // set via admin when floor plan is uploaded
            NavigationUrl:    $"https://www.google.com/maps/dir/?api=1&destination=18.5592,73.7852",
            Instructions:     "Enter through Gate 1 (main entrance). Take the ramp down to B1 basement. Your visitor slot is B1-05 on the left."
        );

        return Task.FromResult(Result<ParkingNavDto>.Ok(dto));
    }
}

// ── My vehicles (resident) ─────────────────────────────────────────────────
public sealed record GetMyVehiclesQuery : IRequest<Result<List<VehicleDto>>>;

public sealed class GetMyVehiclesHandler
    : IRequestHandler<GetMyVehiclesQuery, Result<List<VehicleDto>>>
{
    private readonly ParkingDbContext _db;
    private readonly ICurrentUser     _cu;
    public GetMyVehiclesHandler(ParkingDbContext db, ICurrentUser cu) => (_db, _cu) = (db, cu);

    public async Task<Result<List<VehicleDto>>> Handle(GetMyVehiclesQuery _, CancellationToken ct)
    {
        if (_cu.SocietyId is null || _cu.FlatId is null)
            return Result<List<VehicleDto>>.Fail("AUTH.REQUIRED", "Society and flat context required.");

        var vehicles = await _db.Vehicles
            .Where(v => v.FlatId    == _cu.FlatId.Value
                     && v.SocietyId == _cu.SocietyId.Value
                     && !v.IsDeleted)
            .OrderByDescending(v => v.IsActive)
            .Select(v => new VehicleDto(v.Id, v.RegistrationNumber, v.Type,
                                        v.MakeModel, v.Color, v.IsActive))
            .ToListAsync(ct);

        return Result<List<VehicleDto>>.Ok(vehicles);
    }
}
