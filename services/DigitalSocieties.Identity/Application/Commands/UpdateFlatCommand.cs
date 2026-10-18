using MediatR;
using FluentValidation;
using Microsoft.EntityFrameworkCore;
using DigitalSocieties.Shared.Contracts;
using DigitalSocieties.Shared.Domain;
using DigitalSocieties.Shared.Results;
using DigitalSocieties.Identity.Infrastructure.Persistence;

namespace DigitalSocieties.Identity.Application.Commands;

// ── Rename or move a flat (admin) — for example fix a typo in the number ───
public sealed record UpdateFlatCommand(Guid FlatId, string Wing, string Number, int Floor) : IRequest<Result>;

public sealed class UpdateFlatValidator : AbstractValidator<UpdateFlatCommand>
{
    public UpdateFlatValidator()
    {
        RuleFor(x => x.Wing).NotEmpty().MaximumLength(10);
        RuleFor(x => x.Number).NotEmpty().MaximumLength(10);
        RuleFor(x => x.Floor).InclusiveBetween(0, 100);
    }
}

public sealed class UpdateFlatHandler : IRequestHandler<UpdateFlatCommand, Result>
{
    private readonly IdentityDbContext _db;
    private readonly ICurrentUser      _cu;
    public UpdateFlatHandler(IdentityDbContext db, ICurrentUser cu) => (_db, _cu) = (db, cu);

    public async Task<Result> Handle(UpdateFlatCommand cmd, CancellationToken ct)
    {
        if (_cu.SocietyId is not { } societyId)
            return Result.Fail("SOCIETY.REQUIRED", "Society context is required.");
        if (!_cu.IsInRole("admin"))
            return Result.Fail("FORBIDDEN", "Only the management can change the flats.");

        var flats = await _db.Flats.Where(f => f.SocietyId == societyId && !f.IsDeleted).ToListAsync(ct);
        var flat  = flats.FirstOrDefault(f => f.Id == cmd.FlatId);
        if (flat is null) return Result.Fail("FLAT.NOT_FOUND", "Flat not found.");

        var wing   = cmd.Wing.Trim();
        var number = cmd.Number.Trim();
        var label  = FlatLabel.Of(wing, number).ToUpperInvariant();
        if (flats.Any(f => f.Id != flat.Id && FlatLabel.Of(f.Wing, f.Number).ToUpperInvariant() == label))
            return Result.Fail("FLAT.EXISTS", $"Flat {FlatLabel.Of(wing, number)} already exists.");

        flat.Update(number, wing, cmd.Floor);
        await _db.SaveChangesAsync(ct);
        return Result.Ok();
    }
}
