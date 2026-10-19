using Microsoft.EntityFrameworkCore;
using DigitalSocieties.Shared.Contracts;
using DigitalSocieties.Identity.Infrastructure.Persistence;

namespace DigitalSocieties.Identity.Infrastructure.Settings;

/// <summary>Societies and their people, for the daily billing job, notices sent by email, and the "society office" card in the app.</summary>
public sealed class IdentitySocietyDirectory : ISocietyDirectory
{
    private readonly IdentityDbContext _db;
    public IdentitySocietyDirectory(IdentityDbContext db) => _db = db;

    public async Task<IReadOnlyList<Guid>> ActiveSocietyIdsAsync(CancellationToken ct)
        => await _db.Societies.AsNoTracking().Where(s => s.IsActive).Select(s => s.Id).ToListAsync(ct);

    public async Task<IReadOnlyList<string>> MemberEmailsAsync(Guid societyId, CancellationToken ct)
    {
        var now = DateTimeOffset.UtcNow;
        var emails = await (from m in _db.Memberships.AsNoTracking()
                            join u in _db.Users.AsNoTracking() on m.UserId equals u.Id
                            where m.SocietyId == societyId && m.IsActive && (m.ExpiresAt == null || m.ExpiresAt > now) && u.IsActive
                            select u.Email).ToListAsync(ct);
        return emails.Where(e => !string.IsNullOrWhiteSpace(e) && e.Contains('@')).Distinct(StringComparer.OrdinalIgnoreCase).ToList();
    }

    public async Task<SocietyProfile?> ProfileAsync(Guid societyId, CancellationToken ct)
    {
        var s = await _db.Societies.AsNoTracking().FirstOrDefaultAsync(x => x.Id == societyId, ct);
        if (s is null) return null;
        var r = s.Settings;
        return new SocietyProfile(s.Name, s.Address, r.City, r.Pincode, r.ContactEmail, r.ContactPhone);
    }
}
