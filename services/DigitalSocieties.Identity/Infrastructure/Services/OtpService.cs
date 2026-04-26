using DigitalSocieties.Shared.Results;
using DigitalSocieties.Identity.Domain.Entities;
using DigitalSocieties.Identity.Infrastructure.Persistence;
using Microsoft.EntityFrameworkCore;

namespace DigitalSocieties.Identity.Infrastructure.Services;

/// <summary>
/// Creates and verifies time-limited, hashed OTPs.
/// Security: OTP stored as BCrypt hash; plain-text never persisted.
/// </summary>
public sealed class OtpService : IOtpService
{
    private readonly IdentityDbContext _db;

    public OtpService(IdentityDbContext db) => _db = db;

    public async Task<OtpCreateResult> CreateAsync(string phone, string purpose, CancellationToken ct)
    {
        // Invalidate any previous pending OTPs for same phone+purpose
        var old = await _db.OtpRequests
            .Where(o => o.Phone == phone && o.Purpose == purpose && !o.IsUsed && o.ExpiresAt > DateTimeOffset.UtcNow)
            .ToListAsync(ct);
        _db.OtpRequests.RemoveRange(old);

        string plain  = GenerateOtp();
        string hashed = BCrypt.Net.BCrypt.HashPassword(plain, workFactor: 10);

        var otp = OtpRequest.Create(phone, hashed, purpose);
        _db.OtpRequests.Add(otp);
        await _db.SaveChangesAsync(ct);

        return new OtpCreateResult(plain, otp.ExpiresAt);
    }

    public async Task<Result> VerifyAsync(string phone, string candidateOtp, string purpose, CancellationToken ct)
    {
        var request = await _db.OtpRequests
            .Where(o => o.Phone == phone && o.Purpose == purpose)
            .OrderByDescending(o => o.CreatedAt)
            .FirstOrDefaultAsync(ct);

        if (request is null)
            return Result.Fail("OTP.NOT_FOUND", "No OTP found. Please request a new one.");

        if (request.IsExpired)
            return Result.Fail("OTP.EXPIRED", "OTP has expired. Please request a new one.");

        if (request.IsMaxedOut)
            return Result.Fail("OTP.MAXED_OUT", "Too many failed attempts. Please request a new OTP.");

        if (!request.Verify(candidateOtp))
        {
            await _db.SaveChangesAsync(ct);
            int remaining = 3 - request.Attempts;
            return Result.Fail("OTP.INVALID", $"Incorrect OTP. {remaining} attempt(s) remaining.");
        }

        await _db.SaveChangesAsync(ct);
        return Result.Ok();
    }

    private static string GenerateOtp()
    {
        // Cryptographically random 6-digit OTP
        using var rng = System.Security.Cryptography.RandomNumberGenerator.Create();
        var bytes = new byte[4];
        rng.GetBytes(bytes);
        int num = Math.Abs(BitConverter.ToInt32(bytes, 0)) % 1_000_000;
        return num.ToString("D6");
    }
}
