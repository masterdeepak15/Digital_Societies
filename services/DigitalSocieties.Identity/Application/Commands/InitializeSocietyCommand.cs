using MediatR;
using FluentValidation;
using DigitalSocieties.Shared.Results;
using DigitalSocieties.Identity.Infrastructure.Services;
using DigitalSocieties.Identity.Infrastructure.Security;
using DigitalSocieties.Identity.Infrastructure.Persistence;
using DigitalSocieties.Identity.Domain.Entities;
using DigitalSocieties.Shared.Domain.ValueObjects;
using Microsoft.EntityFrameworkCore;

namespace DigitalSocieties.Identity.Application.Commands;

// ── DTOs ─────────────────────────────────────────────────────────────────────
public sealed record SocietyInput(
    string Name,
    string Address,
    string RegistrationNumber,
    int    TotalFlats);

public sealed record AdminInput(
    string  Email,
    string  Name,
    string  Otp,
    string? Phone = null);   // optional profile field

public sealed record SmtpInput(
    string? Host,
    int?    Port,
    string? User,
    string? Password,
    string? From);

public sealed record RazorpayInput(
    string? KeyId,
    string? KeySecret);

public sealed record Msg91Input(string? ApiKey);

public sealed record MinioInput(
    string? Endpoint,
    string? AccessKey,
    string? SecretKey,
    string? Bucket);

// ── Command ──────────────────────────────────────────────────────────────────
public sealed record InitializeSocietyCommand(
    SocietyInput  Society,
    AdminInput    Admin,
    SmtpInput?    Smtp,
    RazorpayInput? Razorpay,
    Msg91Input?   Msg91,
    MinioInput?   Minio
) : IRequest<Result<SetupResponse>>;

public sealed record SetupResponse(
    string      AccessToken,
    SetupUser   User);

public sealed record SetupUser(
    Guid    UserId,
    string  Name,
    string  Email,
    string? Phone,
    IReadOnlyList<string> Roles,
    Guid   SocietyId);

// ── Validator ─────────────────────────────────────────────────────────────────
public sealed class InitializeSocietyCommandValidator : AbstractValidator<InitializeSocietyCommand>
{
    public InitializeSocietyCommandValidator()
    {
        RuleFor(x => x.Society.Name).NotEmpty().MinimumLength(3);
        RuleFor(x => x.Society.Address).NotEmpty().MinimumLength(10);
        RuleFor(x => x.Society.RegistrationNumber).NotEmpty().MinimumLength(2);
        RuleFor(x => x.Society.TotalFlats).GreaterThan(0);
        RuleFor(x => x.Admin.Email).NotEmpty().MaximumLength(DigitalSocieties.Shared.Domain.ValueObjects.Email.MaxLength);
        RuleFor(x => x.Admin.Phone).MaximumLength(20);
        RuleFor(x => x.Admin.Name).NotEmpty().MinimumLength(2);
        RuleFor(x => x.Admin.Otp).NotEmpty().Length(6);
    }
}

// ── Handler ───────────────────────────────────────────────────────────────────
public sealed class InitializeSocietyCommandHandler
    : IRequestHandler<InitializeSocietyCommand, Result<SetupResponse>>
{
    private readonly IdentityDbContext _db;
    private readonly IOtpService       _otpService;
    private readonly IJwtService       _jwt;

    public InitializeSocietyCommandHandler(
        IdentityDbContext db,
        IOtpService       otpService,
        IJwtService       jwt)
    {
        _db         = db;
        _otpService = otpService;
        _jwt        = jwt;
    }

    public async Task<Result<SetupResponse>> Handle(
        InitializeSocietyCommand request, CancellationToken ct)
    {
        // 1. Guard — only allowed when no society exists yet
        bool alreadySetup = await _db.Societies
            .IgnoreQueryFilters()
            .AnyAsync(ct);

        if (alreadySetup)
            return Result<SetupResponse>.Fail(new Error(
                "SETUP_ALREADY_DONE",
                "Society has already been initialized. Use the admin panel to make changes."));

        var adminEmail = Email.Create(request.Admin.Email);
        if (adminEmail.IsFailure)
            return Result<SetupResponse>.Fail(adminEmail.Error!);

        PhoneNumber? adminPhone = null;
        if (!string.IsNullOrWhiteSpace(request.Admin.Phone))
        {
            var p = PhoneNumber.Create(request.Admin.Phone);
            if (p.IsFailure)
                return Result<SetupResponse>.Fail(p.Error!);
            adminPhone = p.Value!;
        }

        // 2. Verify the admin code (the setup screen requests it with purpose "register")
        var verifyResult = await _otpService.VerifyAsync(
            adminEmail.Value!.Value, request.Admin.Otp, "register", ct);

        if (!verifyResult.IsSuccess)
            return Result<SetupResponse>.Fail(verifyResult.Error!);

        // 3. Create Society
        var society = Society.Create(
            request.Society.Name,
            request.Society.Address,
            request.Society.RegistrationNumber);

        // No flats are invented here: the admin describes the real buildings (wings, floors, flats per
        // floor) from the Flats screen, so every flat that exists is one the society actually has.
        society.SetTotalFlats(request.Society.TotalFlats);

        _db.Societies.Add(society);
        await _db.SaveChangesAsync(ct);      // save to get Id

        // 4. Create admin user (or reuse if email already registered)
        var existing = await _db.Users
            .IgnoreQueryFilters()
            .FirstOrDefaultAsync(u => u.Email == adminEmail.Value!.Value, ct);

        User adminUser;
        if (existing is null)
        {
            adminUser = User.Create(adminEmail.Value!, request.Admin.Name, adminPhone);
            adminUser.MarkVerified();
            _db.Users.Add(adminUser);
        }
        else
        {
            adminUser = existing;
            adminUser.MarkVerified();
            _db.Users.Update(adminUser);
        }

        await _db.SaveChangesAsync(ct);

        // 5. Create admin membership
        var membership = Membership.Create(
            adminUser.Id, society.Id, "admin", flatId: null, memberType: "staff");

        _db.Memberships.Add(membership);
        await _db.SaveChangesAsync(ct);

        // 6. Issue JWT (short-lived access token only — client should do a full OTP login flow)
        var memberships = new List<MembershipInfo>
        {
            new(society.Id, society.Name, "admin", null, null),
        };

        var (accessToken, _, _) = await _jwt.IssueTokensAsync(adminUser, memberships, ct);

        return Result<SetupResponse>.Ok(new SetupResponse(
            accessToken,
            new SetupUser(
                adminUser.Id,
                adminUser.Name,
                adminUser.Email,
                adminUser.Phone,
                ["admin"],
                society.Id)));
    }
}
