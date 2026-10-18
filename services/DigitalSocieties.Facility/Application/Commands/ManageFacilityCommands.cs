using MediatR;
using FluentValidation;
using Microsoft.EntityFrameworkCore;
using DigitalSocieties.Shared.Contracts;
using DigitalSocieties.Shared.Results;
using FacilityEntity = DigitalSocieties.Facility.Domain.Entities.Facility;
using DigitalSocieties.Facility.Infrastructure.Persistence;

namespace DigitalSocieties.Facility.Application.Commands;

/// <summary>The fields an admin fills in to describe a bookable amenity.</summary>
public sealed record FacilityDetails(
    string   Name,
    string   Description,
    int      CapacityPersons,
    int      SlotDurationMinutes,
    TimeOnly OpenTime,
    TimeOnly CloseTime,
    int      AdvanceBookingDays = 7,
    int      MaxBookingsPerFlat = 2);

public sealed class FacilityDetailsValidator : AbstractValidator<FacilityDetails>
{
    public FacilityDetailsValidator()
    {
        RuleFor(x => x.Name).NotEmpty().MaximumLength(100);
        RuleFor(x => x.Description).MaximumLength(500);
        RuleFor(x => x.CapacityPersons).InclusiveBetween(1, 1000);
        RuleFor(x => x.SlotDurationMinutes).InclusiveBetween(15, 480);
        RuleFor(x => x.CloseTime).Must((d, close) => close > d.OpenTime)
            .WithMessage("Closing time must be after opening time.");
        RuleFor(x => x).Must(d => (d.CloseTime - d.OpenTime).TotalMinutes >= d.SlotDurationMinutes)
            .WithMessage("Open hours must fit at least one booking slot.");
        RuleFor(x => x.AdvanceBookingDays).InclusiveBetween(1, 90);
        RuleFor(x => x.MaxBookingsPerFlat).InclusiveBetween(1, 20);
    }
}

// ── Create ─────────────────────────────────────────────────────────────────
public sealed record CreateFacilityCommand(FacilityDetails Details) : IRequest<Result<Guid>>;

public sealed class CreateFacilityValidator : AbstractValidator<CreateFacilityCommand>
{
    public CreateFacilityValidator() => RuleFor(x => x.Details).NotNull().SetValidator(new FacilityDetailsValidator());
}

public sealed class CreateFacilityHandler : IRequestHandler<CreateFacilityCommand, Result<Guid>>
{
    private readonly FacilityDbContext _db;
    private readonly ICurrentUser      _cu;
    public CreateFacilityHandler(FacilityDbContext db, ICurrentUser cu) => (_db, _cu) = (db, cu);

    public async Task<Result<Guid>> Handle(CreateFacilityCommand cmd, CancellationToken ct)
    {
        if (_cu.SocietyId is not { } societyId)
            return Result<Guid>.Fail("AUTH.REQUIRED", "Society context is required.");

        var d    = cmd.Details;
        var name = d.Name.Trim();
        if (await _db.Facilities.AnyAsync(f => f.SocietyId == societyId && f.Name == name, ct))
            return Result<Guid>.Fail("FACILITY.DUPLICATE", $"A facility named '{name}' already exists.");

        var facility = FacilityEntity.Create(societyId, name, d.Description.Trim(),
            d.CapacityPersons, d.SlotDurationMinutes, d.OpenTime, d.CloseTime);
        facility.Update(name, d.Description.Trim(), d.CapacityPersons, d.SlotDurationMinutes,
            d.OpenTime, d.CloseTime, d.AdvanceBookingDays, d.MaxBookingsPerFlat);

        _db.Facilities.Add(facility);
        await _db.SaveChangesAsync(ct);
        return Result<Guid>.Ok(facility.Id);
    }
}

// ── Update ─────────────────────────────────────────────────────────────────
public sealed record UpdateFacilityCommand(Guid FacilityId, FacilityDetails Details) : IRequest<Result>;

public sealed class UpdateFacilityValidator : AbstractValidator<UpdateFacilityCommand>
{
    public UpdateFacilityValidator()
    {
        RuleFor(x => x.FacilityId).NotEmpty();
        RuleFor(x => x.Details).NotNull().SetValidator(new FacilityDetailsValidator());
    }
}

public sealed class UpdateFacilityHandler : IRequestHandler<UpdateFacilityCommand, Result>
{
    private readonly FacilityDbContext _db;
    private readonly ICurrentUser      _cu;
    public UpdateFacilityHandler(FacilityDbContext db, ICurrentUser cu) => (_db, _cu) = (db, cu);

    public async Task<Result> Handle(UpdateFacilityCommand cmd, CancellationToken ct)
    {
        if (_cu.SocietyId is not { } societyId)
            return Result.Fail("AUTH.REQUIRED", "Society context is required.");

        var facility = await _db.Facilities.FirstOrDefaultAsync(f => f.Id == cmd.FacilityId && f.SocietyId == societyId, ct);
        if (facility is null) return Result.Fail("FACILITY.NOT_FOUND", "Facility not found.");

        var d    = cmd.Details;
        var name = d.Name.Trim();
        if (await _db.Facilities.AnyAsync(f => f.SocietyId == societyId && f.Id != facility.Id && f.Name == name, ct))
            return Result.Fail("FACILITY.DUPLICATE", $"A facility named '{name}' already exists.");

        facility.Update(name, d.Description.Trim(), d.CapacityPersons, d.SlotDurationMinutes,
            d.OpenTime, d.CloseTime, d.AdvanceBookingDays, d.MaxBookingsPerFlat);
        await _db.SaveChangesAsync(ct);
        return Result.Ok();
    }
}

// ── Switch on / off ────────────────────────────────────────────────────────
// Switching off hides the facility from residents but keeps its booking history.
public sealed record SetFacilityActiveCommand(Guid FacilityId, bool IsActive) : IRequest<Result>;

public sealed class SetFacilityActiveHandler : IRequestHandler<SetFacilityActiveCommand, Result>
{
    private readonly FacilityDbContext _db;
    private readonly ICurrentUser      _cu;
    public SetFacilityActiveHandler(FacilityDbContext db, ICurrentUser cu) => (_db, _cu) = (db, cu);

    public async Task<Result> Handle(SetFacilityActiveCommand cmd, CancellationToken ct)
    {
        if (_cu.SocietyId is not { } societyId)
            return Result.Fail("AUTH.REQUIRED", "Society context is required.");

        var facility = await _db.Facilities.FirstOrDefaultAsync(f => f.Id == cmd.FacilityId && f.SocietyId == societyId, ct);
        if (facility is null) return Result.Fail("FACILITY.NOT_FOUND", "Facility not found.");

        if (cmd.IsActive) facility.Activate(); else facility.Deactivate();
        await _db.SaveChangesAsync(ct);
        return Result.Ok();
    }
}
