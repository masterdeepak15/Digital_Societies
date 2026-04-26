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
