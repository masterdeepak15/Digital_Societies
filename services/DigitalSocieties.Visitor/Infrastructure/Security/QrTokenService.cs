using System.IdentityModel.Tokens.Jwt;
using System.Security.Claims;
using System.Text;
using Microsoft.Extensions.Options;
using Microsoft.IdentityModel.Tokens;

namespace DigitalSocieties.Visitor.Infrastructure.Security;

public sealed class QrTokenSettings
{
    public const string SectionName = "QrToken";
    public string SecretKey { get; init; } = default!;
    public int    TtlSeconds { get; init; } = 120;   // 2 minutes — short for replay protection
}

/// <summary>
/// Issues signed visitor QR tokens.
/// Security: 2-min TTL + nonce prevents replay attacks.
/// Guard scans QR → boom barrier opens. Visitor cannot reuse the same QR.
/// </summary>
public sealed class QrTokenService : IQrTokenService
{
    private readonly QrTokenSettings _settings;
    private readonly HashSet<string> _usedNonces = new(); // in prod: Redis set with TTL

    public QrTokenService(IOptions<QrTokenSettings> settings) => _settings = settings.Value;

    public string Generate(Guid visitorId, Guid societyId)
    {
        var key    = new SymmetricSecurityKey(Encoding.UTF8.GetBytes(_settings.SecretKey));
        var creds  = new SigningCredentials(key, SecurityAlgorithms.HmacSha256);
        var nonce  = Guid.NewGuid().ToString("N");   // single-use

        var token = new JwtSecurityToken(
            issuer:   "digital-societies-visitor",
            audience: "gate-scanner",
            claims:   [
                new Claim("visitor_id", visitorId.ToString()),
                new Claim("society_id", societyId.ToString()),
                new Claim("nonce",      nonce),
            ],
            notBefore: DateTime.UtcNow,
            expires:   DateTime.UtcNow.AddSeconds(_settings.TtlSeconds),
            signingCredentials: creds);

        return new JwtSecurityTokenHandler().WriteToken(token);
    }

    public QrTokenResult Validate(string token)
    {
        try
        {
            var handler = new JwtSecurityTokenHandler();
            var key     = new SymmetricSecurityKey(Encoding.UTF8.GetBytes(_settings.SecretKey));
            handler.ValidateToken(token, new TokenValidationParameters
            {
                ValidateIssuer           = true,  ValidIssuer   = "digital-societies-visitor",
                ValidateAudience         = true,  ValidAudience = "gate-scanner",
                ValidateLifetime         = true,
                ValidateIssuerSigningKey = true,  IssuerSigningKey = key,
                ClockSkew                = TimeSpan.Zero,  // no tolerance — strict 2-min window
            }, out var validated);

            var jwt     = (JwtSecurityToken)validated;
            var nonce   = jwt.Claims.First(c => c.Type == "nonce").Value;
            var visitId = Guid.Parse(jwt.Claims.First(c => c.Type == "visitor_id").Value);

            // Nonce check — prevents QR replay even within the TTL window
            if (_usedNonces.Contains(nonce))
                return new QrTokenResult(false, Error: "QR already used.");
            _usedNonces.Add(nonce);

            return new QrTokenResult(true, visitId);
        }
        catch (Exception ex)
        {
            return new QrTokenResult(false, Error: ex.Message);
        }
    }
}
