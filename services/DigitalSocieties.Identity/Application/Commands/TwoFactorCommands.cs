using MediatR;
using OtpNet;
using FluentValidation;
using Microsoft.EntityFrameworkCore;
using DigitalSocieties.Shared.Results;
using DigitalSocieties.Shared.Contracts;
using DigitalSocieties.Identity.Infrastructure.Persistence;
using DigitalSocieties.Identity.Infrastructure.Security;
using DigitalSocieties.Identity.Application.Commands;

namespace DigitalSocieties.Identity.Application.Commands;

// ────────────────────────────────────────────────────────────────────────────
// ENROLL 2FA — Generate TOTP secret + QR code URI for authenticator app setup
// ────────────────────────────────────────────────────────────────────────────

public sealed record Enroll2FaCommand : IRequest<Result<Enroll2FaResponse>>;

public sealed record Enroll2FaResponse(
    string TotpSecret,   // Base32, shown to user as backup key
    string QrCodeUri     // otpauth:// URI → encode into QR code in client
);

public sealed class Enroll2FaHandler : IRequestHandler<Enroll2FaCommand, Result<Enroll2FaResponse>>
{
    private readonly IdentityDbContext _db;
    private readonly ICurrentUser      _currentUser;

    public Enroll2FaHandler(IdentityDbContext db, ICurrentUser currentUser)
    {
        _db          = db;
        _currentUser = currentUser;
    }

    public async Task<Result<Enroll2FaResponse>> Handle(Enroll2FaCommand _, CancellationToken ct)
    {
        if (_currentUser.UserId is null)
            return Result<Enroll2FaResponse>.Fail(Error.Unauthorized());

        var user = await _db.Users.FindAsync([_currentUser.UserId.Value], ct);
        if (user is null)
            return Result<Enroll2FaResponse>.Fail(Error.NotFound("User", "User not found."));

        // Generate a 20-byte (160-bit) random secret
        var secretBytes = KeyGeneration.GenerateRandomKey(20);
        var secretBase32 = Base32Encoding.ToString(secretBytes);

        // Store un-activated secret — activated only after Confirm2Fa succeeds
        user.SetPending2FaSecret(secretBase32);
        await _db.SaveChangesAsync(ct);

        // Build standard otpauth URI so any authenticator app (Google, Authy, etc.) can scan it
        var issuer    = "DigitalSocieties";
        var label     = Uri.EscapeDataString($"{issuer}:{user.Phone}");
        var qrUri     = $"otpauth://totp/{label}?secret={secretBase32}&issuer={Uri.EscapeDataString(issuer)}&algorithm=SHA1&digits=6&period=30";

        return Result<Enroll2FaResponse>.Ok(new Enroll2FaResponse(secretBase32, qrUri));
    }
}

// ────────────────────────────────────────────────────────────────────────────
// CONFIRM 2FA — Verify first TOTP code to activate 2FA on the account
// ────────────────────────────────────────────────────────────────────────────

public sealed record Confirm2FaCommand(string TotpCode) : IRequest<Result<bool>>;

public sealed class Confirm2FaValidator : AbstractValidator<Confirm2FaCommand>
{
    public Confirm2FaValidator()
    {
        RuleFor(x => x.TotpCode).NotEmpty().Length(6).Matches(@"^\d{6}$");
    }
}

public sealed class Confirm2FaHandler : IRequestHandler<Confirm2FaCommand, Result<bool>>
{
    private readonly IdentityDbContext _db;
    private readonly ICurrentUser      _currentUser;

    public Confirm2FaHandler(IdentityDbContext db, ICurrentUser currentUser)
    {
        _db          = db;
        _currentUser = currentUser;
    }

    public async Task<Result<bool>> Handle(Confirm2FaCommand cmd, CancellationToken ct)
    {
        if (_currentUser.UserId is null)
            return Result<bool>.Fail(Error.Unauthorized());

        var user = await _db.Users.FindAsync([_currentUser.UserId.Value], ct);
        if (user is null)
            return Result<bool>.Fail(Error.NotFound("User", "User not found."));

        if (string.IsNullOrEmpty(user.Pending2FaSecret))
            return Result<bool>.Fail(Error.Validation("2FaNotEnrolled", "Start enrollment first via POST /auth/2fa/enroll."));

        var totp = new Totp(Base32Encoding.ToBytes(user.Pending2FaSecret));
        bool valid = totp.VerifyTotp(cmd.TotpCode, out _, VerificationWindow.RfcSpecifiedNetworkDelay);

        if (!valid)
            return Result<bool>.Fail(Error.Validation("InvalidTotp", "TOTP code is incorrect or expired."));

        user.Activate2Fa();
        await _db.SaveChangesAsync(ct);
        return Result<bool>.Ok(true);
    }
}

// ────────────────────────────────────────────────────────────────────────────
// DISABLE 2FA — Verify current TOTP then remove 2FA from the account
// ────────────────────────────────────────────────────────────────────────────

public sealed record Disable2FaCommand(string TotpCode) : IRequest<Result<bool>>;

public sealed class Disable2FaHandler : IRequestHandler<Disable2FaCommand, Result<bool>>
{
    private readonly IdentityDbContext _db;
    private readonly ICurrentUser      _currentUser;

    public Disable2FaHandler(IdentityDbContext db, ICurrentUser currentUser)
    {
        _db          = db;
        _currentUser = currentUser;
    }

    public async Task<Result<bool>> Handle(Disable2FaCommand cmd, CancellationToken ct)
    {
        if (_currentUser.UserId is null)
            return Result<bool>.Fail(Error.Unauthorized());

        var user = await _db.Users.FindAsync([_currentUser.UserId.Value], ct);
        if (user is null || !user.TwoFactorEnabled)
            return Result<bool>.Fail(Error.Validation("2FaNotEnabled", "2FA is not enabled on this account."));

        var totp = new Totp(Base32Encoding.ToBytes(user.TwoFactorSecret!));
        bool valid = totp.VerifyTotp(cmd.TotpCode, out _, VerificationWindow.RfcSpecifiedNetworkDelay);

        if (!valid)
            return Result<bool>.Fail(Error.Validation("InvalidTotp", "TOTP code is incorrect or expired."));

        user.Disable2Fa();
        await _db.SaveChangesAsync(ct);
        return Result<bool>.Ok(true);
    }
}

// ────────────────────────────────────────────────────────────────────────────
// VERIFY 2FA — Called during login when 2FA is enabled (second factor)
// Returns a full JWT if TOTP is correct.
// ────────────────────────────────────────────────────────────────────────────

public sealed record Verify2FaCommand(
    Guid   UserId,
    string TotpCode
) : IRequest<Result<AuthTokenResponse>>;

public sealed class Verify2FaValidator : AbstractValidator<Verify2FaCommand>
{
    public Verify2FaValidator()
    {
        RuleFor(x => x.UserId).NotEmpty();
        RuleFor(x => x.TotpCode).NotEmpty().Length(6).Matches(@"^\d{6}$");
    }
}

public sealed class Verify2FaHandler : IRequestHandler<Verify2FaCommand, Result<AuthTokenResponse>>
{
    private readonly IdentityDbContext _db;
    private readonly IJwtService       _jwt;

    public Verify2FaHandler(IdentityDbContext db, IJwtService jwt)
    {
        _db  = db;
        _jwt = jwt;
    }

    public async Task<Result<AuthTokenResponse>> Handle(Verify2FaCommand cmd, CancellationToken ct)
    {
        var user = await _db.Users
            .IgnoreQueryFilters()
            .FirstOrDefaultAsync(u => u.Id == cmd.UserId, ct);

        if (user is null || !user.TwoFactorEnabled || string.IsNullOrEmpty(user.TwoFactorSecret))
            return Result<AuthTokenResponse>.Fail(Error.Unauthorized());

        var totp = new Totp(Base32Encoding.ToBytes(user.TwoFactorSecret));
        bool valid = totp.VerifyTotp(cmd.TotpCode, out _, VerificationWindow.RfcSpecifiedNetworkDelay);

        if (!valid)
            return Result<AuthTokenResponse>.Fail(Error.Validation("InvalidTotp", "Incorrect or expired TOTP code."));

        var memberships = await _db.Memberships
            .IgnoreQueryFilters()
            .Where(m => m.UserId == user.Id)
            .Join(_db.Societies.IgnoreQueryFilters(),
                  m => m.SocietyId,
                  s => s.Id,
                  (m, s) => new MembershipInfo(s.Id, s.Name, m.Role.ToString(), m.FlatId, null))
            .ToListAsync(ct);

        var (accessToken, refreshToken, expiresIn) = await _jwt.IssueTokensAsync(user, memberships, ct);

        return Result<AuthTokenResponse>.Ok(new AuthTokenResponse(
            accessToken, refreshToken, expiresIn,
            IsNewUser: false,
            Profile: new UserProfile(user.Id, user.Name, user.Phone, memberships)));
    }
}
