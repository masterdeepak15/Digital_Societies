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

// ── Remove one role from a person (admin) ──────────────────────────────────
// Ends that role only; other roles and the account itself stay. Admins can never be removed.
public sealed record RemoveSocietyMembershipCommand(Guid MembershipId) : IRequest<Result>;

public sealed class RemoveSocietyMembershipHandler : IRequestHandler<RemoveSocietyMembershipCommand, Result>
{
    private readonly IdentityDbContext _db;
    private readonly ICurrentUser      _cu;
    public RemoveSocietyMembershipHandler(IdentityDbContext db, ICurrentUser cu) => (_db, _cu) = (db, cu);

    public async Task<Result> Handle(RemoveSocietyMembershipCommand cmd, CancellationToken ct)
    {
        if (_cu.SocietyId is not { } societyId)
            return Result.Fail("SOCIETY.REQUIRED", "Society context is required.");
        if (!_cu.IsInRole(UserRole.Admin))
            return Result.Fail("FORBIDDEN", "Only the management can remove people.");

        var m = await _db.Memberships.FirstOrDefaultAsync(x =>
            x.Id == cmd.MembershipId && x.SocietyId == societyId && x.IsActive && !x.IsDeleted, ct);
        if (m is null) return Result.Fail("MEMBER.NOT_FOUND", "That person is not a member of this society.");

        if (m.Role == UserRole.Admin)
            return Result.Fail("MEMBER.ADMIN_PROTECTED", "An admin cannot be removed.");

        m.Revoke();
        await _db.SaveChangesAsync(ct);
        return Result.Ok();
    }
}

// ── Edit a person and one of their roles (admin) ───────────────────────────
// Name and phone belong to the person; flat, relationship and role belong to the one role being edited.
public sealed record EditSocietyMemberCommand(
    Guid    MembershipId,
    string  Name,
    string? Phone,
    string? Role       = null,   // omit to keep; an admin stays admin
    string? MemberType = null,
    Guid?   FlatId     = null
) : IRequest<Result>;

public sealed class EditSocietyMemberValidator : AbstractValidator<EditSocietyMemberCommand>
{
    private static readonly HashSet<string> ResidentTypes = ["owner", "tenant", "family"];

    public EditSocietyMemberValidator()
    {
        RuleFor(x => x.Name).NotEmpty().MaximumLength(200);
        RuleFor(x => x.Phone).MaximumLength(20);
        RuleFor(x => x.Role).Must(r => r is null || AddSocietyMemberValidator.AllowedRoles.Contains(r))
            .WithMessage("Role must be resident, guard, staff, accountant or admin.");
        RuleFor(x => x.MemberType).Must(t => t is null || ResidentTypes.Contains(t))
            .WithMessage("Relationship must be owner, tenant or family.");
    }
}

public sealed class EditSocietyMemberHandler : IRequestHandler<EditSocietyMemberCommand, Result>
{
    private readonly IdentityDbContext _db;
    private readonly ICurrentUser      _cu;
    public EditSocietyMemberHandler(IdentityDbContext db, ICurrentUser cu) => (_db, _cu) = (db, cu);

    public async Task<Result> Handle(EditSocietyMemberCommand cmd, CancellationToken ct)
    {
        if (_cu.SocietyId is not { } societyId)
            return Result.Fail("SOCIETY.REQUIRED", "Society context is required.");
        if (!_cu.IsInRole(UserRole.Admin))
            return Result.Fail("FORBIDDEN", "Only the management can edit people.");

        var m = await _db.Memberships.Include(x => x.User).FirstOrDefaultAsync(x =>
            x.Id == cmd.MembershipId && x.SocietyId == societyId && x.IsActive && !x.IsDeleted, ct);
        if (m?.User is null) return Result.Fail("MEMBER.NOT_FOUND", "That person is not a member of this society.");

        var newRole = cmd.Role ?? m.Role;
        if (m.Role == UserRole.Admin && newRole != UserRole.Admin)
            return Result.Fail("MEMBER.ADMIN_PROTECTED", "An admin cannot be changed to another role.");

        // Phone belongs to the person and must stay unique.
        PhoneNumber? phone = null;
        if (!string.IsNullOrWhiteSpace(cmd.Phone))
        {
            var p = PhoneNumber.Create(cmd.Phone);
            if (p.IsFailure) return Result.Fail(p.Error!);
            phone = p.Value!;
            if (await _db.Users.AnyAsync(u => u.Phone == phone.Value && u.Id != m.UserId, ct))
                return Result.Fail("PHONE.TAKEN", "That phone number is already registered to another account.");
        }

        // A resident lives in a flat; the other roles have none.
        Guid? flatId = newRole == UserRole.Resident ? (cmd.FlatId ?? m.FlatId) : null;
        if (newRole == UserRole.Resident)
        {
            if (flatId is null) return Result.Fail("FLAT.REQUIRED", "Choose the flat this resident lives in.");
            if (!await _db.Flats.AnyAsync(f => f.Id == flatId && f.SocietyId == societyId && !f.IsDeleted, ct))
                return Result.Fail("FLAT.NOT_FOUND", "That flat is not in this society.");
        }
        var memberType = newRole == UserRole.Resident ? (cmd.MemberType ?? (m.MemberType == "staff" ? "owner" : m.MemberType)) : "staff";

        if (newRole != m.Role &&
            await _db.Memberships.AnyAsync(x => x.Id != m.Id && x.UserId == m.UserId && x.SocietyId == societyId &&
                x.Role == newRole && x.FlatId == flatId && x.IsActive && !x.IsDeleted, ct))
            return Result.Fail("MEMBER.EXISTS", "This person already has that role here.");

        m.User.Rename(cmd.Name);
        if (phone is null) m.User.ClearPhone(); else m.User.SetPhone(phone);
        if (newRole != m.Role) m.ChangeRole(newRole);
        m.Update(flatId, memberType);
        await _db.SaveChangesAsync(ct);
        return Result.Ok();
    }
}
