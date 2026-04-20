using MediatR;
using FluentValidation;
using DigitalSocieties.Shared.Results;
using DigitalSocieties.Shared.Contracts;
using DigitalSocieties.Identity.Infrastructure.Services;
using DigitalSocieties.Identity.Infrastructure.Security;
using DigitalSocieties.Identity.Domain.Entities;
using DigitalSocieties.Identity.Domain.Events;

namespace DigitalSocieties.Identity.Application.Commands;

// ── Command ──────────────────────────────────────────────────────────────────
public sealed record VerifyOtpCommand(
    string Phone,
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
    UserProfile Profile);

public sealed record UserProfile(
    Guid   UserId,
    string Name,
    string Phone,
    IReadOnlyList<MembershipInfo> Memberships);

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
        RuleFor(x => x.Phone).NotEmpty();
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

    public async Task<Result<AuthTokenResponse>> Handle(
        VerifyOtpCommand request, CancellationToken ct)
    {
        // Verify OTP
        var verifyResult = await _otpService.VerifyAsync(request.Phone, request.Otp, request.Purpose, ct);
        if (!verifyResult.IsSuccess)
            return Result<AuthTokenResponse>.Fail(verifyResult.Error!);

        // Get or create user
        var user = await _users.FindByPhoneAsync(request.Phone, ct);
        bool isNew = user is null;

        if (isNew)
        {
            user = User.Create(
                (await DigitalSocieties.Shared.Domain.ValueObjects.PhoneNumber.Create(request.Phone)).Value!,
                "New User");
        }

        user!.MarkVerified();
        user.RecordLogin();

        // Register device if provided (security binding)
        if (!string.IsNullOrEmpty(request.DeviceId) && !user.HasDevice(request.DeviceId))
            user.RegisterDevice(request.DeviceId, request.DeviceName ?? "Unknown", request.Platform ?? "unknown");

        if (isNew)
            _users.Add(user);
        else
            _users.Update(user);

        user.Raise(new OtpVerifiedEvent(request.Phone, request.Purpose, request.DeviceId));
        await _uow.CommitAsync(ct);

        // Issue JWT
        var memberships = user.Memberships
            .Where(m => m.IsActive)
            .Select(m => new MembershipInfo(
                m.SocietyId,
                m.Society?.Name ?? "",
                m.Role,
                m.FlatId,
                m.Flat?.DisplayName))
            .ToList();

        var (accessToken, refreshToken, expiresIn) =
            await _jwt.IssueTokensAsync(user, memberships, ct);

        return Result<AuthTokenResponse>.Ok(new AuthTokenResponse(
            accessToken, refreshToken, expiresIn, isNew,
            new UserProfile(user.Id, user.Name, user.Phone, memberships)));
    }
}
