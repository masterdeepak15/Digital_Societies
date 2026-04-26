using System.IdentityModel.Tokens.Jwt;
using System.Security.Claims;
using System.Text;
using System.Text.Json;
using Microsoft.Extensions.Options;
using Microsoft.IdentityModel.Tokens;
using DigitalSocieties.Calling.Domain.Contracts;
using DigitalSocieties.Calling.Infrastructure.Settings;

namespace DigitalSocieties.Calling.Infrastructure;

/// <summary>
/// LiveKit SaaS A/V provider.
/// Generates room tokens via JWT (LiveKit spec) and manages rooms via LiveKit REST API.
/// DIP: implements IVideoCallProvider — API layer never touches LiveKit SDK types directly.
/// </summary>
public sealed class LiveKitProvider : IVideoCallProvider
{
    private readonly CallingSettings          _settings;
    private readonly IHttpClientFactory       _http;

    public string ProviderName => "LiveKit";

    public LiveKitProvider(IOptions<CallingSettings> opts, IHttpClientFactory http)
        => (_settings, _http) = (opts.Value, http);

    // ── Token generation (LiveKit JWT format) ──────────────────────────────
    public Task<RoomToken> GenerateTokenAsync(
        string roomName,
        string participantIdentity,
        string participantName,
        bool   canPublish,
        bool   canSubscribe,
        TimeSpan ttl,
        CancellationToken ct = default)
    {
        var videoGrant = new
        {
            roomJoin    = true,
            room        = roomName,
            canPublish,
            canSubscribe,
            canPublishData = true,
        };

        var key      = new SymmetricSecurityKey(Encoding.UTF8.GetBytes(_settings.LiveKit.ApiSecret));
        var creds    = new SigningCredentials(key, SecurityAlgorithms.HmacSha256);
        var now      = DateTimeOffset.UtcNow;

        var claims = new List<Claim>
        {
            new("iss",   _settings.LiveKit.ApiKey),
            new("sub",   participantIdentity),
            new("name",  participantName),
            new("nbf",   now.ToUnixTimeSeconds().ToString(), ClaimValueTypes.Integer64),
            new("exp",   (now + ttl).ToUnixTimeSeconds().ToString(), ClaimValueTypes.Integer64),
            new("video", JsonSerializer.Serialize(videoGrant)),
        };

        var token = new JwtSecurityTokenHandler().WriteToken(
            new JwtSecurityToken(claims: claims, signingCredentials: creds));

        return Task.FromResult(new RoomToken(token, _settings.LiveKit.ServerUrl, ProviderName));
    }

    // ── Room management (LiveKit REST API) ─────────────────────────────────
    public async Task CreateRoomAsync(string roomName, TimeSpan emptyTimeout, CancellationToken ct)
    {
        var client   = _http.CreateClient("livekit");
        var adminToken = GenerateAdminToken();

        var body = JsonSerializer.Serialize(new
        {
            name              = roomName,
            empty_timeout     = (int)emptyTimeout.TotalSeconds,
            max_participants  = 50,
        });

        var req = new HttpRequestMessage(HttpMethod.Post, "/twirp/livekit.RoomService/CreateRoom")
        {
            Content = new StringContent(body, Encoding.UTF8, "application/json"),
        };
        req.Headers.Authorization =
            new System.Net.Http.Headers.AuthenticationHeaderValue("Bearer", adminToken);

        var resp = await client.SendAsync(req, ct);
        resp.EnsureSuccessStatusCode();
    }

    public async Task DeleteRoomAsync(string roomName, CancellationToken ct)
    {
        var client     = _http.CreateClient("livekit");
        var adminToken = GenerateAdminToken();

        var body = JsonSerializer.Serialize(new { room = roomName });
        var req  = new HttpRequestMessage(HttpMethod.Post, "/twirp/livekit.RoomService/DeleteRoom")
        {
            Content = new StringContent(body, Encoding.UTF8, "application/json"),
        };
        req.Headers.Authorization =
            new System.Net.Http.Headers.AuthenticationHeaderValue("Bearer", adminToken);

        await client.SendAsync(req, ct); // best-effort — don't throw if already gone
    }

    // ── Helpers ────────────────────────────────────────────────────────────
    private string GenerateAdminToken()
    {
        var key   = new SymmetricSecurityKey(Encoding.UTF8.GetBytes(_settings.LiveKit.ApiSecret));
        var creds = new SigningCredentials(key, SecurityAlgorithms.HmacSha256);
        var now   = DateTimeOffset.UtcNow;

        var claims = new[]
        {
            new Claim("iss", _settings.LiveKit.ApiKey),
            new Claim("sub", "server-admin"),
            new Claim("nbf", now.ToUnixTimeSeconds().ToString(), ClaimValueTypes.Integer64),
            new Claim("exp", (now + TimeSpan.FromMinutes(1)).ToUnixTimeSeconds().ToString(),
                      ClaimValueTypes.Integer64),
            new Claim("video", JsonSerializer.Serialize(new { roomAdmin = true, room = "*" })),
        };

        return new JwtSecurityTokenHandler().WriteToken(
            new JwtSecurityToken(claims: claims, signingCredentials: creds));
    }
}
