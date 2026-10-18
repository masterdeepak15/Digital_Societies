using MediatR;
using FluentValidation;
using Microsoft.EntityFrameworkCore;
using DigitalSocieties.Shared.Contracts;
using DigitalSocieties.Shared.Domain.Enums;
using DigitalSocieties.Shared.Domain.ValueObjects;
using DigitalSocieties.Shared.Results;
using DigitalSocieties.Identity.Domain.Entities;
using DigitalSocieties.Identity.Infrastructure.Persistence;

namespace DigitalSocieties.Identity.Application.Commands;

// ── Add anyone to the society (admin) ──────────────────────────────────────
// The management adds residents, guards, staff, accountants and other admins. A person who
// already has an account (same email) simply gets one more role; nobody is created twice.
public sealed record AddSocietyMemberCommand(
    string  Email,
    string  Name,
    string  Role,                 // resident | guard | staff | accountant | admin
    string? Phone      = null,
    string? MemberType = null,    // residents only: owner | tenant | family
    string? Wing       = null,
    string? FlatNumber = null,
    Guid?   FlatId     = null  // wins over Wing + FlatNumber when both are given
) : IRequest<Result<Guid>>;

public sealed class AddSocietyMemberValidator : AbstractValidator<AddSocietyMemberCommand>
{
    public static readonly IReadOnlySet<string> AllowedRoles = new HashSet<string>
    {
        UserRole.Resident, UserRole.Guard, UserRole.Staff, UserRole.Accountant, UserRole.Admin,
    };
    private static readonly HashSet<string> ResidentTypes = ["owner", "tenant", "family"];

    public AddSocietyMemberValidator()
    {
        RuleFor(x => x.Email).NotEmpty().MaximumLength(DigitalSocieties.Shared.Domain.ValueObjects.Email.MaxLength);
        RuleFor(x => x.Name).NotEmpty().MaximumLength(200);
        RuleFor(x => x.Phone).MaximumLength(20);
        RuleFor(x => x.Role).Must(r => AllowedRoles.Contains(r))
            .WithMessage("Role must be resident, guard, staff, accountant or admin.");
        RuleFor(x => x).Must(x => x.FlatId is not null || !string.IsNullOrWhiteSpace(x.FlatNumber))
            .When(x => x.Role == UserRole.Resident)
            .WithMessage("Choose the flat this resident lives in.");
        RuleFor(x => x.MemberType).Must(t => t is not null && ResidentTypes.Contains(t))
            .When(x => x.Role == UserRole.Resident)
            .WithMessage("Say whether the resident is an owner, tenant or family member.");
    }
}

public sealed class AddSocietyMemberHandler : IRequestHandler<AddSocietyMemberCommand, Result<Guid>>
{
    private readonly IdentityDbContext _db;
    private readonly ICurrentUser      _cu;
    public AddSocietyMemberHandler(IdentityDbContext db, ICurrentUser cu) => (_db, _cu) = (db, cu);

    public async Task<Result<Guid>> Handle(AddSocietyMemberCommand cmd, CancellationToken ct)
    {
        if (_cu.SocietyId is not { } societyId)
            return Result<Guid>.Fail("SOCIETY.REQUIRED", "Society context is required.");
        if (!_cu.IsInRole(UserRole.Admin))
            return Result<Guid>.Fail("FORBIDDEN", "Only the management can add people.");

        // Residents live in a flat; guards, staff and the rest may have none.
        Guid? flatId = null;
        if (cmd.FlatId is { } wantedFlat)
        {
            if (!await _db.Flats.AnyAsync(f => f.Id == wantedFlat && f.SocietyId == societyId && !f.IsDeleted, ct))
                return Result<Guid>.Fail("FLAT.NOT_FOUND", "That flat is not in this society.");
            flatId = wantedFlat;
        }
        else if (!string.IsNullOrWhiteSpace(cmd.FlatNumber))
        {
            var number = cmd.FlatNumber.Trim();
            var wing   = cmd.Wing?.Trim() ?? "";
            var flat = await _db.Flats.FirstOrDefaultAsync(f =>
                f.SocietyId == societyId && f.Number == number &&
                (wing == "" || f.Wing == wing) && !f.IsDeleted, ct);
            if (flat is null)
                return Result<Guid>.Fail("FLAT.NOT_FOUND", "No flat with that number in this society.");
            flatId = flat.Id;
        }

        var emailResult = Shared.Domain.ValueObjects.Email.Create(cmd.Email);
        if (emailResult.IsFailure) return Result<Guid>.Fail(emailResult.Error!);
        var email = emailResult.Value!;

        PhoneNumber? phone = null;
        if (!string.IsNullOrWhiteSpace(cmd.Phone))
        {
            var phoneResult = PhoneNumber.Create(cmd.Phone);
            if (phoneResult.IsFailure) return Result<Guid>.Fail(phoneResult.Error!);
            phone = phoneResult.Value!;
        }

        var user = await _db.Users.FirstOrDefaultAsync(u => u.Email == email.Value, ct);
        if (user is null)
        {
            if (phone is not null && await _db.Users.AnyAsync(u => u.Phone == phone.Value, ct))
                return Result<Guid>.Fail("PHONE.TAKEN", "That phone number is already registered to another account.");
            user = User.Create(email, cmd.Name.Trim(), phone);
            _db.Users.Add(user);
        }

        var already = await _db.Memberships.AnyAsync(m =>
            m.UserId == user.Id && m.SocietyId == societyId && m.Role == cmd.Role &&
            m.FlatId == flatId && m.IsActive && !m.IsDeleted, ct);
        if (already)
            return Result<Guid>.Fail("MEMBER.EXISTS", "This person already has that role here.");

        var memberType = cmd.Role == UserRole.Resident ? cmd.MemberType! : "staff";
        _db.Memberships.Add(Membership.Create(user.Id, societyId, cmd.Role, flatId, memberType));
        await _db.SaveChangesAsync(ct);
        return Result<Guid>.Ok(user.Id);
    }
}

// ── Remove a person from the society (admin) ───────────────────────────────
// Ends every active role they hold here. The account itself is kept so history stays intact.
public sealed record RemoveSocietyMemberCommand(Guid UserId) : IRequest<Result>;

public sealed class RemoveSocietyMemberHandler : IRequestHandler<RemoveSocietyMemberCommand, Result>
{
    private readonly IdentityDbContext _db;
    private readonly ICurrentUser      _cu;
    public RemoveSocietyMemberHandler(IdentityDbContext db, ICurrentUser cu) => (_db, _cu) = (db, cu);

    public async Task<Result> Handle(RemoveSocietyMemberCommand cmd, CancellationToken ct)
    {
        if (_cu.SocietyId is not { } societyId)
            return Result.Fail("SOCIETY.REQUIRED", "Society context is required.");
        if (!_cu.IsInRole(UserRole.Admin))
            return Result.Fail("FORBIDDEN", "Only the management can remove people.");
        if (_cu.UserId == cmd.UserId)
            return Result.Fail("MEMBER.SELF_REMOVE", "You cannot remove yourself.");

        var memberships = await _db.Memberships
            .Where(m => m.UserId == cmd.UserId && m.SocietyId == societyId && m.IsActive && !m.IsDeleted)
            .ToListAsync(ct);
        if (memberships.Count == 0)
            return Result.Fail("MEMBER.NOT_FOUND", "That person is not a member of this society.");

        // Someone must always be left in charge.
        if (memberships.Any(m => m.Role == UserRole.Admin))
        {
            var otherAdmins = await _db.Memberships.CountAsync(m =>
                m.SocietyId == societyId && m.Role == UserRole.Admin && m.IsActive && !m.IsDeleted &&
                m.UserId != cmd.UserId, ct);
            if (otherAdmins == 0)
                return Result.Fail("MEMBER.LAST_ADMIN", "This is the only admin. Make someone else an admin first.");
        }

        foreach (var m in memberships) m.Revoke();
        await _db.SaveChangesAsync(ct);
        return Result.Ok();
    }
}
