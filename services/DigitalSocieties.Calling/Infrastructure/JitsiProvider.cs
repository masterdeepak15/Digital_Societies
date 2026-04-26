using System.IdentityModel.Tokens.Jwt;
using System.Security.Claims;
using System.Text;
using Microsoft.Extensions.Options;
using Microsoft.IdentityModel.Tokens;
using DigitalSocieties.Calling.Domain.Contracts;
using DigitalSocieties.Calling.Infrastructure.Settings;

namespace DigitalSocieties.Calling.Infrastructure;

/// <summary>
/// Jitsi Meet self-hosted A/V provider.
/// Token follows the Jitsi JWT spec (sub = meet.jitsi, context.user, room claim).
/// OCP: swap by changing DI registration — no other code changes.
/// </summary>
public sealed class JitsiProvider : IVideoCallProvider
{
    private readonly CallingSettings _settings;

    public string ProviderName => "JitsiMeet";

    public JitsiProvider(IOptions<CallingSettings> opts) => _settings = opts.Value;

    public Task<RoomToken> GenerateTokenAsync(
        string roomName,
        string participantIdentity,
        string participantName,
        bool   canPublish,
        bool   canSubscribe,
        TimeSpan ttl,
        CancellationToken ct = default)
    {
        var key   = new SymmetricSecurityKey(Encoding.UTF8.GetBytes(_settings.Jitsi.AppSecret));
        var creds = new SigningCredentials(key, SecurityAlgorithms.HmacSha256);
        var now   = DateTimeOffset.UtcNow;

        var claims = new List<Claim>
        {
            new(JwtRegisteredClaimNames.Iss, _settings.Jitsi.AppId),
            new(JwtRegisteredClaimNames.Sub, "meet.jitsi"),
            new(JwtRegisteredClaimNames.Aud, "jitsi"),
            new(JwtRegisteredClaimNames.Nbf, now.ToUnixTimeSeconds().ToString(), ClaimValueTypes.Integer64),
            new(JwtRegisteredClaimNames.Exp, (now + ttl).ToUnixTimeSeconds().ToString(), ClaimValueTypes.Integer64),
            new("room",    roomName),
            new("context", System.Text.Json.JsonSerializer.Serialize(new
            {
                user = new
                {
                    id          = participantIdentity,
                    name        = participantName,
                    moderator   = canPublish, // host = moderator in Jitsi
                },
                features = new
                {
                    livestreaming = false,
                    recording     = false,
                },
            })),
        };

        var meetUrl = $"{_settings.Jitsi.ServerUrl}/{roomName}";
        var token   = new JwtSecurityTokenHandler().WriteToken(
            new JwtSecurityToken(claims: claims, signingCredentials: creds));

        return Task.FromResult(new RoomToken(token, meetUrl, ProviderName));
    }

    // Jitsi rooms are created on-demand — no explicit create needed.
    public Task CreateRoomAsync(string roomName, TimeSpan emptyTimeout, CancellationToken ct)
        => Task.CompletedTask;

    public Task DeleteRoomAsync(string roomName, CancellationToken ct)
        => Task.CompletedTask; // Jitsi auto-closes empty rooms
}
