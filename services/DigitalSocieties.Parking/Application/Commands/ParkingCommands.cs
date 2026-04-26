using MediatR;
using FluentValidation;
using Microsoft.EntityFrameworkCore;
using DigitalSocieties.Shared.Contracts;
using DigitalSocieties.Shared.Results;
using DigitalSocieties.Parking.Domain.Entities;
using DigitalSocieties.Parking.Infrastructure.Persistence;

namespace DigitalSocieties.Parking.Application.Commands;

// ── Create parking level (admin) ───────────────────────────────────────────
public sealed record CreateParkingLevelCommand(
    string Name,
    int    LevelNumber
) : IRequest<Result<Guid>>;

public sealed class CreateParkingLevelValidator : AbstractValidator<CreateParkingLevelCommand>
{
    public CreateParkingLevelValidator()
    {
        RuleFor(x => x.Name).NotEmpty().MaximumLength(100);
    }
}

public sealed class CreateParkingLevelHandler : IRequestHandler<CreateParkingLevelCommand, Result<Guid>>
{
    private readonly ParkingDbContext _db;
    private readonly ICurrentUser     _cu;
    public CreateParkingLevelHandler(ParkingDbContext db, ICurrentUser cu) => (_db, _cu) = (db, cu);

    public async Task<Result<Guid>> Handle(CreateParkingLevelCommand cmd, CancellationToken ct)
    {
        if (_cu.SocietyId is null) return Result<Guid>.Fail("AUTH.REQUIRED", "Society context required.");
        var level = ParkingLevel.Create(_cu.SocietyId.Value, cmd.Name, cmd.LevelNumber);
        _db.ParkingLevels.Add(level);
        await _db.SaveChangesAsync(ct);
        return Result<Guid>.Ok(level.Id);
    }
}

// ── Add parking slot to a level (admin) ───────────────────────────────────
public sealed record AddParkingSlotCommand(
    Guid   LevelId,
    string SlotNumber,
    string SlotType,       // "Car" | "Bike" | "Heavy"
    bool   IsEvCharger = false
) : IRequest<Result<Guid>>;

public sealed class AddParkingSlotValidator : AbstractValidator<AddParkingSlotCommand>
{
    public AddParkingSlotValidator()
    {
        RuleFor(x => x.LevelId).NotEmpty();
        RuleFor(x => x.SlotNumber).NotEmpty().MaximumLength(20);
        RuleFor(x => x.SlotType).Must(t => t is "Car" or "Bike" or "Heavy")
            .WithMessage("SlotType must be Car, Bike, or Heavy.");
    }
}

public sealed class AddParkingSlotHandler : IRequestHandler<AddParkingSlotCommand, Result<Guid>>
{
    private readonly ParkingDbContext _db;
    private readonly ICurrentUser     _cu;
    public AddParkingSlotHandler(ParkingDbContext db, ICurrentUser cu) => (_db, _cu) = (db, cu);

    public async Task<Result<Guid>> Handle(AddParkingSlotCommand cmd, CancellationToken ct)
    {
        if (_cu.SocietyId is null) return Result<Guid>.Fail("AUTH.REQUIRED", "Society context required.");

        var level = await _db.ParkingLevels
            .FirstOrDefaultAsync(l => l.Id == cmd.LevelId && l.SocietyId == _cu.SocietyId.Value, ct);
        if (level is null) return Result<Guid>.Fail("LEVEL.NOT_FOUND", "Parking level not found.");

        var slotType = Enum.Parse<SlotType>(cmd.SlotType);
        var slot = ParkingSlot.Create(_cu.SocietyId.Value, cmd.LevelId, cmd.SlotNumber, slotType, cmd.IsEvCharger);
        _db.ParkingSlots.Add(slot);
        await _db.SaveChangesAsync(ct);
        return Result<Guid>.Ok(slot.Id);
    }
}

// ── Assign slot to a flat (admin) ─────────────────────────────────────────
public sealed record AssignSlotCommand(
    Guid   SlotId,
    Guid   FlatId,
    string VehicleNumber,
    string VehicleType     // "Car" | "Bike" | "EV"
) : IRequest<Result>;

public sealed class AssignSlotValidator : AbstractValidator<AssignSlotCommand>
{
    public AssignSlotValidator()
    {
        RuleFor(x => x.SlotId).NotEmpty();
        RuleFor(x => x.FlatId).NotEmpty();
        RuleFor(x => x.VehicleNumber).NotEmpty().MaximumLength(20);
        RuleFor(x => x.VehicleType).Must(t => t is "Car" or "Bike" or "EV")
            .WithMessage("VehicleType must be Car, Bike, or EV.");
    }
}

public sealed class AssignSlotHandler : IRequestHandler<AssignSlotCommand, Result>
{
    private readonly ParkingDbContext _db;
    private readonly ICurrentUser     _cu;
    public AssignSlotHandler(ParkingDbContext db, ICurrentUser cu) => (_db, _cu) = (db, cu);

    public async Task<Result> Handle(AssignSlotCommand cmd, CancellationToken ct)
    {
        if (_cu.SocietyId is null) return Result.Fail("AUTH.REQUIRED", "Society context required.");

        var slot = await _db.ParkingSlots
            .FirstOrDefaultAsync(s => s.Id == cmd.SlotId && s.SocietyId == _cu.SocietyId.Value, ct);
        if (slot is null) return Result.Fail("SLOT.NOT_FOUND", "Parking slot not found.");
        if (slot.Status == SlotStatus.AssignedResident)
            return Result.Fail("SLOT.OCCUPIED", "Slot is already assigned to another flat.");

        slot.AssignToFlat(cmd.FlatId, cmd.VehicleNumber, cmd.VehicleType);
        await _db.SaveChangesAsync(ct);
        return Result.Ok();
    }
}

// ── Unassign slot (admin) ─────────────────────────────────────────────────
public sealed record UnassignSlotCommand(Guid SlotId) : IRequest<Result>;

public sealed class UnassignSlotHandler : IRequestHandler<UnassignSlotCommand, Result>
{
    private readonly ParkingDbContext _db;
    private readonly ICurrentUser     _cu;
    public UnassignSlotHandler(ParkingDbContext db, ICurrentUser cu) => (_db, _cu) = (db, cu);

    public async Task<Result> Handle(UnassignSlotCommand cmd, CancellationToken ct)
    {
        if (_cu.SocietyId is null) return Result.Fail("AUTH.REQUIRED", "Society context required.");
        var slot = await _db.ParkingSlots
            .FirstOrDefaultAsync(s => s.Id == cmd.SlotId && s.SocietyId == _cu.SocietyId.Value, ct);
        if (slot is null) return Result.Fail("SLOT.NOT_FOUND", "Parking slot not found.");
        slot.Unassign();
        await _db.SaveChangesAsync(ct);
        return Result.Ok();
    }
}

// ── Register vehicle (resident) ────────────────────────────────────────────
public sealed record RegisterVehicleCommand(
    string  RegistrationNumber,
    string  Type,          // "Car" | "Bike" | "EV"
    string? MakeModel,
    string? Color
) : IRequest<Result<Guid>>;

public sealed class RegisterVehicleValidator : AbstractValidator<RegisterVehicleCommand>
{
    public RegisterVehicleValidator()
    {
        RuleFor(x => x.RegistrationNumber).NotEmpty().MaximumLength(20);
        RuleFor(x => x.Type).Must(t => t is "Car" or "Bike" or "EV")
            .WithMessage("Type must be Car, Bike, or EV.");
    }
}

public sealed class RegisterVehicleHandler : IRequestHandler<RegisterVehicleCommand, Result<Guid>>
{
    private readonly ParkingDbContext _db;
    private readonly ICurrentUser     _cu;
    public RegisterVehicleHandler(ParkingDbContext db, ICurrentUser cu) => (_db, _cu) = (db, cu);

    public async Task<Result<Guid>> Handle(RegisterVehicleCommand cmd, CancellationToken ct)
    {
        if (_cu.SocietyId is null || _cu.FlatId is null)
            return Result<Guid>.Fail("AUTH.REQUIRED", "Society and flat context required.");

        var vehicle = Vehicle.Register(
            _cu.SocietyId.Value, _cu.FlatId.Value,
            cmd.RegistrationNumber, cmd.Type, cmd.MakeModel, cmd.Color);
        _db.Vehicles.Add(vehicle);
        await _db.SaveChangesAsync(ct);
        return Result<Guid>.Ok(vehicle.Id);
    }
}

// ── Issue visitor parking pass ─────────────────────────────────────────────
public sealed record IssueVisitorPassCommand(
    Guid          SlotId,
    Guid          VisitorId,     // links to Visitor module
    DateTimeOffset ExpiresAt
) : IRequest<Result>;

public sealed class IssueVisitorPassHandler : IRequestHandler<IssueVisitorPassCommand, Result>
{
    private readonly ParkingDbContext _db;
    private readonly ICurrentUser     _cu;
    public IssueVisitorPassHandler(ParkingDbContext db, ICurrentUser cu) => (_db, _cu) = (db, cu);

    public async Task<Result> Handle(IssueVisitorPassCommand cmd, CancellationToken ct)
    {
        if (_cu.SocietyId is null) return Result.Fail("AUTH.REQUIRED", "Society context required.");
        var slot = await _db.ParkingSlots
            .FirstOrDefaultAsync(s => s.Id == cmd.SlotId && s.SocietyId == _cu.SocietyId.Value
                                   && s.Status == SlotStatus.Available, ct);
        if (slot is null)
            return Result.Fail("SLOT.UNAVAILABLE", "No available slot found for visitor pass.");
        slot.IssueVisitorPass(cmd.VisitorId, cmd.ExpiresAt);
        await _db.SaveChangesAsync(ct);
        return Result.Ok();
    }
}
