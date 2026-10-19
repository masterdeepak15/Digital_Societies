using Microsoft.EntityFrameworkCore;
using DigitalSocieties.Shared.Contracts;
using DigitalSocieties.Identity.Infrastructure.Persistence;

namespace DigitalSocieties.Identity.Infrastructure.Settings;

/// <summary>Reads a society's rules for any module that needs them (visitor QR lifetime, bill amounts, alerts).</summary>
public sealed class IdentitySocietySettingsReader : ISocietySettingsReader
{
    private readonly IdentityDbContext _db;
    public IdentitySocietySettingsReader(IdentityDbContext db) => _db = db;

    public async Task<SocietySettings> GetAsync(Guid societyId, CancellationToken ct)
    {
        var json = await _db.Societies.AsNoTracking().Where(s => s.Id == societyId).Select(s => s.SettingsJson).FirstOrDefaultAsync(ct);
        return SocietySettings.Parse(json);
    }
}
