using MediatR;
using FluentValidation;
using Microsoft.EntityFrameworkCore;
using DigitalSocieties.Shared.Contracts;
using DigitalSocieties.Shared.Domain;
using DigitalSocieties.Shared.Results;
using DigitalSocieties.Identity.Domain.Entities;
using DigitalSocieties.Identity.Infrastructure.Persistence;

namespace DigitalSocieties.Identity.Application.Commands;

// ── Describe the buildings in one go (admin) ───────────────────────────────
// "Wings A and B, 8 floors, 8 flats on each floor" creates A-101 … A-808 and B-101 … B-808.
// Flats that already exist are kept as they are; running it again only fills in what is missing.
public sealed record ConfigureFlatLayoutCommand(
    IReadOnlyList<string> Wings,
    int  Floors,
    int  FlatsPerFloor,
    bool RemoveUnusedOthers = false   // also remove empty flats that are not part of this layout
) : IRequest<Result<FlatLayoutResult>>;

public sealed record FlatLayoutResult(int Created, int Kept, int Removed, int OutsideLayoutStillInUse, int Total);

public sealed class ConfigureFlatLayoutValidator : AbstractValidator<ConfigureFlatLayoutCommand>
{
    public ConfigureFlatLayoutValidator()
    {
        RuleFor(x => x.Wings).NotEmpty().WithMessage("Give at least one wing or building name.")
            .Must(w => w.Count <= 26).WithMessage("At most 26 wings.");
        RuleForEach(x => x.Wings).NotEmpty().MaximumLength(10);
        RuleFor(x => x.Floors).InclusiveBetween(1, 60);
        RuleFor(x => x.FlatsPerFloor).InclusiveBetween(1, 50);
    }
}

public sealed class ConfigureFlatLayoutHandler : IRequestHandler<ConfigureFlatLayoutCommand, Result<FlatLayoutResult>>
{
    private readonly IdentityDbContext _db;
    private readonly ICurrentUser      _cu;
    public ConfigureFlatLayoutHandler(IdentityDbContext db, ICurrentUser cu) => (_db, _cu) = (db, cu);

    public async Task<Result<FlatLayoutResult>> Handle(ConfigureFlatLayoutCommand cmd, CancellationToken ct)
    {
        if (_cu.SocietyId is not { } societyId)
            return Result<FlatLayoutResult>.Fail("SOCIETY.REQUIRED", "Society context is required.");
        if (!_cu.IsInRole("admin"))
            return Result<FlatLayoutResult>.Fail("FORBIDDEN", "Only the management can change the flats.");

        var wings = cmd.Wings.Select(w => w.Trim()).Where(w => w.Length > 0)
            .Distinct(StringComparer.OrdinalIgnoreCase).ToList();

        var society = await _db.Societies.FirstOrDefaultAsync(s => s.Id == societyId, ct);
        if (society is null)
            return Result<FlatLayoutResult>.Fail("SOCIETY.NOT_FOUND", "Society not found.");

        var existing = await _db.Flats.Where(f => f.SocietyId == societyId && !f.IsDeleted).ToListAsync(ct);
        var byLabel  = existing.ToDictionary(f => FlatLabel.Of(f.Wing, f.Number).ToUpperInvariant(), f => f, StringComparer.Ordinal);

        var wanted = new HashSet<string>(StringComparer.Ordinal);
        int created = 0, kept = 0;
        foreach (var wing in wings)
        for (int floor = 1; floor <= cmd.Floors; floor++)
        for (int n = 1; n <= cmd.FlatsPerFloor; n++)
        {
            var number = $"{floor}{n:D2}";
            var key    = FlatLabel.Of(wing, number).ToUpperInvariant();
            wanted.Add(key);
            if (byLabel.ContainsKey(key)) { kept++; continue; }

            var flat = Flat.Create(societyId, number, wing, floor);
            _db.Flats.Add(flat);
            byLabel[key] = flat;
            created++;
        }

        int removed = 0, stillInUse = 0;
        if (cmd.RemoveUnusedOthers)
        {
            var inUse = await OccupiedFlatIds(societyId, ct);
            foreach (var f in existing.Where(f => !wanted.Contains(FlatLabel.Of(f.Wing, f.Number).ToUpperInvariant())))
            {
                if (inUse.Contains(f.Id)) { stillInUse++; continue; }
                f.SoftDelete();
                removed++;
            }
        }

        society.SetTotalFlats(existing.Count(f => !f.IsDeleted) + created);
        await _db.SaveChangesAsync(ct);
        return Result<FlatLayoutResult>.Ok(new FlatLayoutResult(created, kept, removed, stillInUse,
            existing.Count(f => !f.IsDeleted) + created));
    }

    private async Task<HashSet<Guid>> OccupiedFlatIds(Guid societyId, CancellationToken ct)
        => (await _db.Memberships
                .Where(m => m.SocietyId == societyId && m.IsActive && !m.IsDeleted && m.FlatId != null)
                .Select(m => m.FlatId!.Value).Distinct().ToListAsync(ct)).ToHashSet();
}

// ── Add one flat (admin) ───────────────────────────────────────────────────
public sealed record AddFlatCommand(string Wing, string Number, int Floor) : IRequest<Result<Guid>>;

public sealed class AddFlatValidator : AbstractValidator<AddFlatCommand>
{
    public AddFlatValidator()
    {
        RuleFor(x => x.Wing).NotEmpty().MaximumLength(10);
        RuleFor(x => x.Number).NotEmpty().MaximumLength(10);
        RuleFor(x => x.Floor).InclusiveBetween(0, 100);
    }
}

public sealed class AddFlatHandler : IRequestHandler<AddFlatCommand, Result<Guid>>
{
    private readonly IdentityDbContext _db;
    private readonly ICurrentUser      _cu;
    public AddFlatHandler(IdentityDbContext db, ICurrentUser cu) => (_db, _cu) = (db, cu);

    public async Task<Result<Guid>> Handle(AddFlatCommand cmd, CancellationToken ct)
    {
        if (_cu.SocietyId is not { } societyId)
            return Result<Guid>.Fail("SOCIETY.REQUIRED", "Society context is required.");
        if (!_cu.IsInRole("admin"))
            return Result<Guid>.Fail("FORBIDDEN", "Only the management can change the flats.");

        var wing   = cmd.Wing.Trim();
        var number = cmd.Number.Trim();
        var label  = FlatLabel.Of(wing, number).ToUpperInvariant();

        var sameWing = await _db.Flats.Where(f => f.SocietyId == societyId && !f.IsDeleted).ToListAsync(ct);
        if (sameWing.Any(f => FlatLabel.Of(f.Wing, f.Number).ToUpperInvariant() == label))
            return Result<Guid>.Fail("FLAT.EXISTS", $"Flat {FlatLabel.Of(wing, number)} already exists.");

        var society = await _db.Societies.FirstAsync(s => s.Id == societyId, ct);
        var flat = Flat.Create(societyId, number, wing, cmd.Floor);
        _db.Flats.Add(flat);
        society.SetTotalFlats(sameWing.Count + 1);
        await _db.SaveChangesAsync(ct);
        return Result<Guid>.Ok(flat.Id);
    }
}

// ── Remove one flat (admin) — only while nobody lives there ────────────────
public sealed record DeleteFlatCommand(Guid FlatId) : IRequest<Result>;

public sealed class DeleteFlatHandler : IRequestHandler<DeleteFlatCommand, Result>
{
    private readonly IdentityDbContext _db;
    private readonly ICurrentUser      _cu;
    public DeleteFlatHandler(IdentityDbContext db, ICurrentUser cu) => (_db, _cu) = (db, cu);

    public async Task<Result> Handle(DeleteFlatCommand cmd, CancellationToken ct)
    {
        if (_cu.SocietyId is not { } societyId)
            return Result.Fail("SOCIETY.REQUIRED", "Society context is required.");
        if (!_cu.IsInRole("admin"))
            return Result.Fail("FORBIDDEN", "Only the management can change the flats.");

        var flat = await _db.Flats.FirstOrDefaultAsync(f => f.Id == cmd.FlatId && f.SocietyId == societyId && !f.IsDeleted, ct);
        if (flat is null) return Result.Fail("FLAT.NOT_FOUND", "Flat not found.");

        if (await _db.Memberships.AnyAsync(m => m.FlatId == flat.Id && m.IsActive && !m.IsDeleted, ct))
            return Result.Fail("FLAT.IN_USE", "Someone lives in this flat. Remove them from it first.");

        flat.SoftDelete();
        var society = await _db.Societies.FirstAsync(s => s.Id == societyId, ct);
        society.SetTotalFlats(await _db.Flats.CountAsync(f => f.SocietyId == societyId && !f.IsDeleted && f.Id != flat.Id, ct));
        await _db.SaveChangesAsync(ct);
        return Result.Ok();
    }
}

// ── List flats (admin) ─────────────────────────────────────────────────────
public sealed record FlatDto(Guid Id, string Wing, string Number, string Label, int Floor, int Residents);

public sealed record GetFlatsQuery : IRequest<Result<List<FlatDto>>>;

public sealed class GetFlatsHandler : IRequestHandler<GetFlatsQuery, Result<List<FlatDto>>>
{
    private readonly IdentityDbContext _db;
    private readonly ICurrentUser      _cu;
    public GetFlatsHandler(IdentityDbContext db, ICurrentUser cu) => (_db, _cu) = (db, cu);

    public async Task<Result<List<FlatDto>>> Handle(GetFlatsQuery q, CancellationToken ct)
    {
        if (_cu.SocietyId is not { } societyId)
            return Result<List<FlatDto>>.Fail("SOCIETY.REQUIRED", "Society context is required.");

        var flats = await _db.Flats.AsNoTracking()
            .Where(f => f.SocietyId == societyId && !f.IsDeleted).ToListAsync(ct);
        var residents = await _db.Memberships.AsNoTracking()
            .Where(m => m.SocietyId == societyId && m.IsActive && !m.IsDeleted && m.FlatId != null)
            .GroupBy(m => m.FlatId!.Value).Select(g => new { Id = g.Key, N = g.Select(x => x.UserId).Distinct().Count() })
            .ToDictionaryAsync(x => x.Id, x => x.N, ct);

        return Result<List<FlatDto>>.Ok(flats
            .Select(f => new FlatDto(f.Id, f.Wing, f.Number, FlatLabel.Of(f.Wing, f.Number), f.Floor,
                residents.GetValueOrDefault(f.Id)))
            .OrderBy(f => f.Wing, StringComparer.OrdinalIgnoreCase)
            .ThenBy(f => f.Floor).ThenBy(f => f.Label, StringComparer.OrdinalIgnoreCase)
            .ToList());
    }
}
