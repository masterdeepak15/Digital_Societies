using Microsoft.EntityFrameworkCore;
using DigitalSocieties.Communication.Infrastructure.Persistence;

namespace DigitalSocieties.Communication.Infrastructure.Push;

/// <summary>
/// Stores Expo push tokens in the communication schema.
/// </summary>
public sealed class PostgresPushTokenStore : IPushTokenStore
{
    private readonly CommunicationDbContext _db;
    public PostgresPushTokenStore(CommunicationDbContext db) => _db = db;

    public async Task<List<string>> GetTokensAsync(Guid userId, CancellationToken ct)
        => await _db.PushTokens
            .Where(t => t.UserId == userId && t.IsActive)
            .Select(t => t.ExpoPushToken)
            .ToListAsync(ct);

    public async Task UpsertAsync(Guid userId, Guid societyId,
                                  string expoPushToken, CancellationToken ct)
    {
        var existing = await _db.PushTokens
            .FirstOrDefaultAsync(t => t.ExpoPushToken == expoPushToken, ct);

        if (existing is not null)
        {
            existing.UserId    = userId;
            existing.SocietyId = societyId;
            existing.IsActive  = true;
            existing.UpdatedAt = DateTimeOffset.UtcNow;
        }
        else
        {
            _db.PushTokens.Add(new PushToken
            {
                Id            = Guid.NewGuid(),
                UserId        = userId,
                SocietyId     = societyId,
                ExpoPushToken = expoPushToken,
                IsActive      = true,
                CreatedAt     = DateTimeOffset.UtcNow,
                UpdatedAt     = DateTimeOffset.UtcNow,
            });
        }
        await _db.SaveChangesAsync(ct);
    }

    public async Task RemoveAsync(Guid userId, string expoPushToken, CancellationToken ct)
    {
        var token = await _db.PushTokens
            .FirstOrDefaultAsync(t => t.UserId == userId && t.ExpoPushToken == expoPushToken, ct);
        if (token is not null)
        {
            token.IsActive = false;
            await _db.SaveChangesAsync(ct);
        }
    }
}

// ── Entity (owned by Communication module) ─────────────────────────────────
public sealed class PushToken
{
    public Guid   Id            { get; set; }
    public Guid   UserId        { get; set; }
    public Guid   SocietyId     { get; set; }
    public string ExpoPushToken { get; set; } = default!;
    public bool   IsActive      { get; set; }
    public DateTimeOffset CreatedAt { get; set; }
    public DateTimeOffset UpdatedAt { get; set; }
}
