using MediatR;
using Microsoft.EntityFrameworkCore;
using FluentValidation;
using DigitalSocieties.Shared.Results;
using DigitalSocieties.Shared.Contracts;
using DigitalSocieties.Identity.Infrastructure.Services;
using DigitalSocieties.Identity.Infrastructure.Security;
using DigitalSocieties.Identity.Infrastructure.Persistence;
using DigitalSocieties.Identity.Domain.Entities;
using DigitalSocieties.Identity.Domain.Events;

namespace DigitalSocieties.Identity.Application.Commands;

// ── Command ──────────────────────────────────────────────────────────────────
public sealed record VerifyOtpCommand(
    string Email,
    string Otp,
    string Purpose,
    string? DeviceId,
    string? DeviceName,
    string? Platform
) : IRequest<Result<AuthTokenResponse>>;

public sealed record AuthTokenResponse(
    string  AccessToken,
    string  RefreshToken,
    int     ExpiresIn,       // seconds
    bool    IsNewUser,
    UserProfile Profile,
    // 2FA: when true, AccessToken + RefreshToken are empty.
    // Client must call POST /auth/2fa/verify with the TOTP code + PendingUserId.
    bool    RequiresTwoFactor = false,
    Guid?   PendingUserId     = null);

public sealed record UserProfile(
    Guid   UserId,
    string Name,
    string Email,
    string? Phone,
    IReadOnlyList<MembershipInfo> Memberships)
{
    /// <summary>Safe projection of a user: never exposes 2FA secrets or other entity internals.</summary>
    public static UserProfile FromUser(User user) => new(
        user.Id, user.Name, user.Email, user.Phone,
        user.Memberships
            .Where(m => m.IsActive)
            .Select(m => new MembershipInfo(
                m.SocietyId, m.Society?.Name ?? "", m.Role.ToString(), m.FlatId, m.Flat?.DisplayName))
            .ToList());
}

public sealed record MembershipInfo(
    Guid   SocietyId,
    string SocietyName,
    string Role,
    Guid?  FlatId,
    string? FlatDisplay);

// ── Validator ─────────────────────────────────────────────────────────────────
public sealed class VerifyOtpCommandValidator : AbstractValidator<VerifyOtpCommand>
{
    public VerifyOtpCommandValidator()
    {
        RuleFor(x => x.Email).NotEmpty().MaximumLength(DigitalSocieties.Shared.Domain.ValueObjects.Email.MaxLength);
        RuleFor(x => x.Otp).NotEmpty().Length(6).WithMessage("OTP must be 6 digits.");
        RuleFor(x => x.Purpose).NotEmpty();
    }
}

// ── Handler ───────────────────────────────────────────────────────────────────
public sealed class VerifyOtpCommandHandler : IRequestHandler<VerifyOtpCommand, Result<AuthTokenResponse>>
{
    private readonly IOtpService          _otpService;
    private readonly IUserRepository      _users;
    private readonly IJwtService          _jwt;
    private readonly IUnitOfWork          _uow;

    public VerifyOtpCommandHandler(
        IOtpService otpService,
        IUserRepository users,
        IJwtService jwt,
        IUnitOfWork uow)
    {
        _otpService = otpService;
        _users      = users;
        _jwt        = jwt;
        _uow        = uow;
    }

    private static void RecordSignIn(User user, VerifyOtpCommand request)
    {
        user.MarkVerified();
        user.RecordLogin();

        // Register device if provided (security binding)
        if (!string.IsNullOrEmpty(request.DeviceId) && !user.HasDevice(request.DeviceId))
            user.RegisterDevice(request.DeviceId, request.DeviceName ?? "Unknown", request.Platform ?? "unknown");
    }

    public async Task<Result<AuthTokenResponse>> Handle(
        VerifyOtpCommand request, CancellationToken ct)
    {
        var emailResult = DigitalSocieties.Shared.Domain.ValueObjects.Email.Create(request.Email);
        if (emailResult.IsFailure)
            return Result<AuthTokenResponse>.Fail(emailResult.Error!);
        var email = emailResult.Value!;

        // Verify OTP
        var verifyResult = await _otpService.VerifyAsync(email.Value, request.Otp, request.Purpose, ct);
        if (!verifyResult.IsSuccess)
            return Result<AuthTokenResponse>.Fail(verifyResult.Error!);

        // Get or create user
        var user = await _users.FindByEmailAsync(email.Value, ct);
        bool isNew = user is null;

        if (isNew)
        {
            user = User.Create(email, "New User");
        }

        RecordSignIn(user!, request);

        if (isNew)
            _users.Add(user!);
        else
            _users.Update(user!);

        try
        {
            // OtpVerifiedEvent raised internally by user.MarkVerified() domain method
            await _uow.CommitAsync(ct);
        }
        catch (DbUpdateException) when (isNew)
        {
            // Two sign-ins for the same brand-new email raced and the other one inserted first
            // (unique index on email). The code is already consumed, so continue as that user
            // rather than failing the person who just proved they own the mailbox.
            _users.ClearPendingChanges();
            user = await _users.FindByEmailAsync(email.Value, ct);
            if (user is null) throw;
            isNew = false;
            RecordSignIn(user, request);
            _users.Update(user);
            await _uow.CommitAsync(ct);
        }

        var memberships = user.Memberships
            .Where(m => m.IsActive)
            .Select(m => new MembershipInfo(
                m.SocietyId,
                m.Society?.Name ?? "",
                m.Role,
                m.FlatId,
                m.Flat?.DisplayName))
            .ToList();

        // ── 2FA gate: if enabled, don't issue tokens yet ──────────────────────
        // Return a RequiresTwoFactor response — client must follow up with
        // POST /auth/2fa/verify using the PendingUserId and their TOTP code.
        if (user.TwoFactorEnabled)
        {
            return Result<AuthTokenResponse>.Ok(new AuthTokenResponse(
                AccessToken: string.Empty,
                RefreshToken: string.Empty,
                ExpiresIn: 0,
                IsNewUser: isNew,
                Profile: new UserProfile(user.Id, user.Name, user.Email, user.Phone, memberships),
                RequiresTwoFactor: true,
                PendingUserId: user.Id));
        }

        // Issue JWT (no 2FA)
        var (accessToken, refreshToken, expiresIn) =
            await _jwt.IssueTokensAsync(user, memberships, ct);

        return Result<AuthTokenResponse>.Ok(new AuthTokenResponse(
            accessToken, refreshToken, expiresIn, isNew,
            new UserProfile(user.Id, user.Name, user.Email, user.Phone, memberships)));
    }
}
