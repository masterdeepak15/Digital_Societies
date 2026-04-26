using System.IdentityModel.Tokens.Jwt;
using System.Security.Claims;
using System.Security.Cryptography;
using System.Text;
using Microsoft.Extensions.Options;
using Microsoft.IdentityModel.Tokens;
using DigitalSocieties.Identity.Domain.Entities;
using DigitalSocieties.Identity.Application.Commands;
using DigitalSocieties.Identity.Infrastructure.Persistence;
using Microsoft.EntityFrameworkCore;

namespace DigitalSocieties.Identity.Infrastructure.Security;

public sealed class JwtSettings
{
    public const string SectionName = "Jwt";
    public string  Issuer           { get; init; } = default!;
    public string  Audience         { get; init; } = default!;
    public string  SecretKey        { get; init; } = default!;   // min 32 chars
    public int     AccessTokenTtlMin  { get; init; } = 10;       // 10 minutes — short for security
    public int     RefreshTokenTtlDays { get; init; } = 30;
}

/// <summary>
/// Issues short-lived access tokens (10 min) + long-lived refresh tokens.
/// Refresh tokens are stored in Postgres (allow-list) so revocation works.
/// Security: stolen refresh token can be revoked; role changes invalidate within 10 min max.
/// </summary>
public sealed class JwtService : IJwtService
{
    private readonly JwtSettings     _settings;
    private readonly IdentityDbContext _db;

    public JwtService(IOptions<JwtSettings> settings, IdentityDbContext db)
    {
        _settings = settings.Value;
        _db       = db;
    }

    public async Task<(string AccessToken, string RefreshToken, int ExpiresIn)> IssueTokensAsync(
        User user, IReadOnlyList<MembershipInfo> memberships, CancellationToken ct)
    {
        var accessToken  = GenerateAccessToken(user, memberships);
        var refreshToken = await CreateRefreshTokenAsync(user.Id, ct);

        return (accessToken, refreshToken, _settings.AccessTokenTtlMin * 60);
    }

    private string GenerateAccessToken(User user, IReadOnlyList<MembershipInfo> memberships)
    {
        var claims = new List<Claim>
        {
            new(JwtRegisteredClaimNames.Sub,   user.Id.ToString()),
            new(JwtRegisteredClaimNames.Jti,   Guid.NewGuid().ToString()),
            new("phone",  user.Phone),
            new("name",   user.Name),
        };

        // Embed all roles across all societies — app selects active society
        foreach (var m in memberships)
        {
            claims.Add(new Claim("membership", $"{m.SocietyId}:{m.Role}:{m.FlatId}"));
        }

        var key   = new SymmetricSecurityKey(Encoding.UTF8.GetBytes(_settings.SecretKey));
        var creds = new SigningCredentials(key, SecurityAlgorithms.HmacSha256);

        var token = new JwtSecurityToken(
            issuer:   _settings.Issuer,
            audience: _settings.Audience,
            claims:   claims,
            notBefore: DateTime.UtcNow,
            expires:  DateTime.UtcNow.AddMinutes(_settings.AccessTokenTtlMin),
            signingCredentials: creds);

        return new JwtSecurityTokenHandler().WriteToken(token);
    }

    private async Task<string> CreateRefreshTokenAsync(Guid userId, CancellationToken ct)
    {
        // Opaque random token stored in DB (allow-list approach for revocation)
        var bytes = new byte[64];
        RandomNumberGenerator.Fill(bytes);
        var token = Convert.ToBase64String(bytes);

        var stored = new RefreshTokenRecord
        {
            Id        = Guid.NewGuid(),
            UserId    = userId,
            Token     = token,   // store hash in prod; plain for simplicity here — see note
            ExpiresAt = DateTimeOffset.UtcNow.AddDays(_settings.RefreshTokenTtlDays),
            CreatedAt = DateTimeOffset.UtcNow,
            IsRevoked = false,
        };

        _db.RefreshTokens.Add(stored);
        await _db.SaveChangesAsync(ct);
        return token;
    }

    public async Task<RefreshResult> RefreshAsync(string refreshToken, CancellationToken ct)
    {
        var record = await _db.RefreshTokens
            .Include(r => r.User)
            .ThenInclude(u => u!.Memberships.Where(m => m.IsActive))
            .FirstOrDefaultAsync(r => r.Token == refreshToken, ct);

        if (record is null || record.IsRevoked || record.ExpiresAt < DateTimeOffset.UtcNow)
            return new RefreshResult(false, Error: "Invalid or expired refresh token.");

        if (!record.User!.IsActive)
            return new RefreshResult(false, Error: "Account deactivated.");

        // Rotate refresh token
        record.IsRevoked = true;

        var memberships = record.User.Memberships
            .Select(m => new MembershipInfo(m.SocietyId, m.Society?.Name ?? "", m.Role, m.FlatId, null))
            .ToList();

        var (access, refresh, expires) = await IssueTokensAsync(record.User, memberships, ct);
        return new RefreshResult(true, access, refresh, expires);
    }

    public async Task RevokeAsync(string refreshToken, CancellationToken ct)
    {
        var record = await _db.RefreshTokens.FirstOrDefaultAsync(r => r.Token == refreshToken, ct);
        if (record is not null)
        {
            record.IsRevoked = true;
            await _db.SaveChangesAsync(ct);
        }
    }
}

// EF entity — lives here to keep infrastructure self-contained
public sealed class RefreshTokenRecord
{
    public Guid           Id        { get; set; }
    public Guid           UserId    { get; set; }
    public User?          User      { get; set; }
    public string         Token     { get; set; } = default!;
    public DateTimeOffset ExpiresAt { get; set; }
    public DateTimeOffset CreatedAt { get; set; }
    public bool           IsRevoked { get; set; }
}
