using DigitalSocieties.Shared.Results;
using DigitalSocieties.Identity.Domain.Entities;
using DigitalSocieties.Identity.Infrastructure.Persistence;
using Microsoft.EntityFrameworkCore;

namespace DigitalSocieties.Identity.Infrastructure.Services;

/// <summary>
/// Creates and verifies time-limited, hashed OTPs keyed by email address.
/// Security: OTP stored as BCrypt hash; plain-text never persisted.
/// </summary>
public sealed class OtpService : IOtpService
{
    private readonly IdentityDbContext _db;

    public OtpService(IdentityDbContext db) => _db = db;

    public async Task<OtpCreateResult> CreateAsync(string email, string purpose, CancellationToken ct)
    {
        // Invalidate any previous pending OTPs for same email+purpose
        var old = await _db.OtpRequests
            .Where(o => o.Email == email && o.Purpose == purpose && !o.IsUsed && o.ExpiresAt > DateTimeOffset.UtcNow)
            .ToListAsync(ct);
        _db.OtpRequests.RemoveRange(old);

        string plain  = GenerateOtp();
        string hashed = BCrypt.Net.BCrypt.HashPassword(plain, workFactor: 10);

        var otp = OtpRequest.Create(email, hashed, purpose);
        _db.OtpRequests.Add(otp);
        await _db.SaveChangesAsync(ct);

        return new OtpCreateResult(plain, otp.ExpiresAt);
    }

    public async Task<Result> VerifyAsync(string email, string candidateOtp, string purpose, CancellationToken ct)
    {
        // Only unused requests are candidates: a consumed code can never be replayed,
        // and replaying it must not burn attempts on a newer request.
        var request = await _db.OtpRequests
            .Where(o => o.Email == email && o.Purpose == purpose && !o.IsUsed)
            .OrderByDescending(o => o.CreatedAt)
            .FirstOrDefaultAsync(ct);

        if (request is null)
            return Result.Fail("OTP.NOT_FOUND", "No active code found. Please request a new one.");

        if (request.IsExpired)
            return Result.Fail("OTP.EXPIRED", "Code has expired. Please request a new one.");

        if (request.IsMaxedOut)
            return Result.Fail("OTP.MAXED_OUT", "Too many failed attempts. Please request a new code.");

        bool match = request.Verify(candidateOtp);
        await _db.SaveChangesAsync(ct);

        if (!match)
        {
            int remaining = OtpRequest.MaxAttempts - request.Attempts;
            return Result.Fail("OTP.INVALID", $"Incorrect code. {remaining} attempt(s) remaining.");
        }

        return Result.Ok();
    }

    /// <summary>Cryptographically random, unbiased 6-digit code.</summary>
    public static string GenerateOtp()
        => System.Security.Cryptography.RandomNumberGenerator.GetInt32(0, 1_000_000).ToString("D6");
}
