using MediatR;
using FluentValidation;
using Microsoft.EntityFrameworkCore;
using DigitalSocieties.Shared.Contracts;
using DigitalSocieties.Shared.Results;
using DigitalSocieties.Shared.Domain.ValueObjects;
using DigitalSocieties.Identity.Domain.Entities;
using DigitalSocieties.Identity.Infrastructure.Persistence;

namespace DigitalSocieties.Identity.Application.Commands;

// ── Add family member ──────────────────────────────────────────────────────
public sealed record AddFamilyMemberCommand(
    string  Email,
    string  Name,
    string  MemberType,   // "owner" | "tenant" | "family"
    string? Phone = null, // optional profile field
    string? Wing = null,         // admins name the flat; residents always add to their own
    string? FlatNumber = null
) : IRequest<Result<Guid>>;

public sealed class AddFamilyMemberValidator : AbstractValidator<AddFamilyMemberCommand>
{
    // Use string constants directly to avoid name collision with the Shared enum type
    private static readonly HashSet<string> ValidTypes = ["owner", "tenant", "family"];

    public AddFamilyMemberValidator()
    {
        RuleFor(x => x.Email).NotEmpty().MaximumLength(DigitalSocieties.Shared.Domain.ValueObjects.Email.MaxLength);
        RuleFor(x => x.Phone).MaximumLength(20);
        RuleFor(x => x.Name).NotEmpty().MaximumLength(200);
        RuleFor(x => x.MemberType)
            .Must(t => ValidTypes.Contains(t))
            .WithMessage("MemberType must be 'owner', 'tenant', or 'family'.");
    }
}

public sealed class AddFamilyMemberHandler : IRequestHandler<AddFamilyMemberCommand, Result<Guid>>
{
    private readonly IdentityDbContext _db;
    private readonly ICurrentUser      _currentUser;

    public AddFamilyMemberHandler(IdentityDbContext db, ICurrentUser currentUser)
        => (_db, _currentUser) = (db, currentUser);

    public async Task<Result<Guid>> Handle(AddFamilyMemberCommand cmd, CancellationToken ct)
    {
        if (_currentUser.SocietyId is null)
            return Result<Guid>.Fail("SOCIETY.REQUIRED", "Society context is required.");

        // Residents add to their own flat. An admin has no flat, so they name one by wing + number.
        var flatId = _currentUser.FlatId;
        if (_currentUser.IsInRole("admin") && !string.IsNullOrWhiteSpace(cmd.FlatNumber))
        {
            var number = cmd.FlatNumber.Trim();
            var wing   = cmd.Wing?.Trim() ?? "";
            var flat = await _db.Flats.FirstOrDefaultAsync(f =>
                f.SocietyId == _currentUser.SocietyId.Value && f.Number == number &&
                (wing == "" || f.Wing == wing) && !f.IsDeleted, ct);
            if (flat is null)
                return Result<Guid>.Fail("FLAT.NOT_FOUND", "No flat with that wing and number in this society.");
            flatId = flat.Id;
        }
        if (flatId is null)
            return Result<Guid>.Fail("FLAT.REQUIRED", "You must be a flat resident to add family members.");

        // Validate and normalize email (identity) and optional phone
        var emailResult = Shared.Domain.ValueObjects.Email.Create(cmd.Email);
        if (emailResult.IsFailure)
            return Result<Guid>.Fail(emailResult.Error!);

        PhoneNumber? phone = null;
        if (!string.IsNullOrWhiteSpace(cmd.Phone))
        {
            var phoneResult = PhoneNumber.Create(cmd.Phone);
            if (phoneResult.IsFailure)
                return Result<Guid>.Fail(phoneResult.Error!);
            phone = phoneResult.Value!;
        }

        // Find or create the user by email
        var email = emailResult.Value!;
        var user = await _db.Users
            .FirstOrDefaultAsync(u => u.Email == email.Value, ct);

        if (user is null)
        {
            if (phone is not null &&
                await _db.Users.AnyAsync(u => u.Phone == phone.Value, ct))
                return Result<Guid>.Fail("PHONE.TAKEN", "That phone number is already registered to another account.");

            user = User.Create(email, cmd.Name, phone);
            _db.Users.Add(user);
            await _db.SaveChangesAsync(ct);
        }

        // Prevent duplicate membership for the same flat
        var exists = await _db.Memberships.AnyAsync(m =>
            m.UserId    == user.Id &&
            m.SocietyId == _currentUser.SocietyId.Value &&
            m.FlatId    == flatId.Value &&
            m.IsActive  &&
            !m.IsDeleted, ct);

        if (exists)
            return Result<Guid>.Fail("MEMBER.EXISTS", "This person is already a member of that flat.");

        var membership = Membership.Create(
            user.Id,
            _currentUser.SocietyId.Value,
            "resident",
            flatId.Value,
            cmd.MemberType);

        _db.Memberships.Add(membership);
        await _db.SaveChangesAsync(ct);

        return Result<Guid>.Ok(user.Id);
    }
}

// ── Remove family member ───────────────────────────────────────────────────
public sealed record RemoveFamilyMemberCommand(Guid MemberUserId) : IRequest<Result>;

public sealed class RemoveFamilyMemberHandler : IRequestHandler<RemoveFamilyMemberCommand, Result>
{
    private readonly IdentityDbContext _db;
    private readonly ICurrentUser      _currentUser;

    public RemoveFamilyMemberHandler(IdentityDbContext db, ICurrentUser currentUser)
        => (_db, _currentUser) = (db, currentUser);

    public async Task<Result> Handle(RemoveFamilyMemberCommand cmd, CancellationToken ct)
    {
        var isAdmin = _currentUser.IsInRole("admin");
        if (_currentUser.SocietyId is null || (_currentUser.FlatId is null && !isAdmin))
            return Result.Fail("CONTEXT.REQUIRED", "Society and flat context are required.");

        if (_currentUser.UserId == cmd.MemberUserId)
            return Result.Fail("MEMBER.SELF_REMOVE", "Cannot remove yourself.");

        // Residents remove people from their own flat; an admin can remove a resident of any flat.
        var membership = await _db.Memberships
            .FirstOrDefaultAsync(m =>
                m.UserId    == cmd.MemberUserId &&
                m.SocietyId == _currentUser.SocietyId.Value &&
                m.Role      == "resident" &&
                (isAdmin || m.FlatId == _currentUser.FlatId) &&
                m.IsActive  &&
                !m.IsDeleted, ct);

        if (membership is null)
            return Result.Fail("MEMBER.NOT_FOUND", "Member not found in your flat.");

        membership.Revoke();
        await _db.SaveChangesAsync(ct);
        return Result.Ok();
    }
}
