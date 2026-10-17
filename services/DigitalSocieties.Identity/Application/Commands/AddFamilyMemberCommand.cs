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
    string? Phone = null  // optional profile field
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
        if (_currentUser.FlatId is null)
            return Result<Guid>.Fail("FLAT.REQUIRED", "You must be a flat resident to add family members.");
        if (_currentUser.SocietyId is null)
            return Result<Guid>.Fail("SOCIETY.REQUIRED", "Society context is required.");

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
            user = User.Create(email, cmd.Name, phone);
            _db.Users.Add(user);
            await _db.SaveChangesAsync(ct);
        }

        // Prevent duplicate membership for the same flat
        var exists = await _db.Memberships.AnyAsync(m =>
            m.UserId    == user.Id &&
            m.SocietyId == _currentUser.SocietyId.Value &&
            m.FlatId    == _currentUser.FlatId.Value &&
            m.IsActive  &&
            !m.IsDeleted, ct);

        if (exists)
            return Result<Guid>.Fail("MEMBER.EXISTS", "This person is already a member of your flat.");

        var membership = Membership.Create(
            user.Id,
            _currentUser.SocietyId.Value,
            "resident",
            _currentUser.FlatId.Value,
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
        if (_currentUser.FlatId is null || _currentUser.SocietyId is null)
            return Result.Fail("CONTEXT.REQUIRED", "Society and flat context are required.");

        if (_currentUser.UserId == cmd.MemberUserId)
            return Result.Fail("MEMBER.SELF_REMOVE", "Cannot remove yourself.");

        var membership = await _db.Memberships
            .FirstOrDefaultAsync(m =>
                m.UserId    == cmd.MemberUserId &&
                m.SocietyId == _currentUser.SocietyId.Value &&
                m.FlatId    == _currentUser.FlatId.Value &&
                m.IsActive  &&
                !m.IsDeleted, ct);

        if (membership is null)
            return Result.Fail("MEMBER.NOT_FOUND", "Member not found in your flat.");

        membership.Revoke();
        await _db.SaveChangesAsync(ct);
        return Result.Ok();
    }
}
