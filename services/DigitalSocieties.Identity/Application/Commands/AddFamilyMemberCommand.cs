using MediatR;
using FluentValidation;
using Microsoft.EntityFrameworkCore;
using DigitalSocieties.Shared.Contracts;
using DigitalSocieties.Shared.Results;
using DigitalSocieties.Shared.Domain.Enums;
using DigitalSocieties.Identity.Domain.Entities;
using DigitalSocieties.Identity.Infrastructure.Persistence;

namespace DigitalSocieties.Identity.Application.Commands;

// ── Add family member ──────────────────────────────────────────────────────
public sealed record AddFamilyMemberCommand(
    string Phone,
    string Name,
    string MemberType   // "owner" | "tenant"  (use MemberType constants)
) : IRequest<Result<Guid>>;

public sealed class AddFamilyMemberValidator : AbstractValidator<AddFamilyMemberCommand>
{
    public AddFamilyMemberValidator()
    {
        RuleFor(x => x.Phone).NotEmpty().MaximumLength(20);
        RuleFor(x => x.Name).NotEmpty().MaximumLength(200);
        RuleFor(x => x.MemberType)
            .Must(t => t is MemberType.Owner or MemberType.Tenant)
            .WithMessage("MemberType must be 'owner' or 'tenant'.");
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
            return Result<Guid>.Fail("You must be a flat resident to add family members.");
        if (_currentUser.SocietyId is null)
            return Result<Guid>.Fail("Society context is required.");

        // Find or create the user by phone
        var user = await _db.Users
            .FirstOrDefaultAsync(u => u.Phone == cmd.Phone, ct);

        if (user is null)
        {
            user = User.Create(cmd.Phone, cmd.Name);
            _db.Users.Add(user);
            await _db.SaveChangesAsync(ct);
        }

        // Prevent duplicate membership for same flat
        var exists = await _db.Memberships.AnyAsync(m =>
            m.UserId    == user.Id &&
            m.SocietyId == _currentUser.SocietyId.Value &&
            m.FlatId    == _currentUser.FlatId.Value &&
            m.IsActive  &&
            !m.IsDeleted, ct);

        if (exists)
            return Result<Guid>.Fail("This person is already a member of your flat.");

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
            return Result.Fail("Society/flat context required.");

        if (_currentUser.UserId == cmd.MemberUserId)
            return Result.Fail("Cannot remove yourself.");

        var membership = await _db.Memberships
            .FirstOrDefaultAsync(m =>
                m.UserId    == cmd.MemberUserId &&
                m.SocietyId == _currentUser.SocietyId.Value &&
                m.FlatId    == _currentUser.FlatId.Value &&
                m.IsActive  &&
                !m.IsDeleted, ct);

        if (membership is null) return Result.Fail("Member not found in your flat.");

        membership.Revoke();
        await _db.SaveChangesAsync(ct);
        return Result.Ok();
    }
}
