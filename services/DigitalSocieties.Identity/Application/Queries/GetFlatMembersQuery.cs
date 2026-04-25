using MediatR;
using Microsoft.EntityFrameworkCore;
using DigitalSocieties.Shared.Contracts;
using DigitalSocieties.Shared.Results;
using DigitalSocieties.Identity.Infrastructure.Persistence;

namespace DigitalSocieties.Identity.Application.Queries;

public sealed record FlatMemberDto(
    Guid   UserId,
    string Name,
    string Phone,
    string Role,
    string MemberType,
    DateTimeOffset JoinedAt);

public sealed record GetFlatMembersQuery(Guid? FlatId = null) : IRequest<Result<List<FlatMemberDto>>>;

public sealed class GetFlatMembersHandler
    : IRequestHandler<GetFlatMembersQuery, Result<List<FlatMemberDto>>>
{
    private readonly IdentityDbContext _db;
    private readonly ICurrentUser      _currentUser;

    public GetFlatMembersHandler(IdentityDbContext db, ICurrentUser currentUser)
        => (_db, _currentUser) = (db, currentUser);

    public async Task<Result<List<FlatMemberDto>>> Handle(
        GetFlatMembersQuery q, CancellationToken ct)
    {
        if (_currentUser.SocietyId is null) return Result<List<FlatMemberDto>>.Fail("No society context.");

        var flatId = q.FlatId ?? _currentUser.FlatId;
        if (flatId is null) return Result<List<FlatMemberDto>>.Fail("No flat context.");

        var members = await _db.Memberships
            .Include(m => m.User)
            .Where(m => m.SocietyId == _currentUser.SocietyId.Value
                     && m.FlatId    == flatId.Value
                     && m.IsActive
                     && !m.IsDeleted)
            .Select(m => new FlatMemberDto(
                m.UserId,
                m.User!.Name,
                m.User!.Phone,
                m.Role,
                m.MemberType,
                m.JoinedAt))
            .ToListAsync(ct);

        return Result<List<FlatMemberDto>>.Ok(members);
    }
}

// ── Society-wide member list (admin) ───────────────────────────────────────
public sealed record SocietyMemberDto(
    Guid   UserId,
    string Name,
    string Phone,
    string Role,
    string MemberType,
    string? FlatNumber,
    string? Wing,
    DateTimeOffset JoinedAt);

public sealed record GetSocietyMembersQuery(
    string? Role     = null,
    string? Wing     = null,
    int     Page     = 1,
    int     PageSize = 50
) : IRequest<Result<List<SocietyMemberDto>>>;

public sealed class GetSocietyMembersHandler
    : IRequestHandler<GetSocietyMembersQuery, Result<List<SocietyMemberDto>>>
{
    private readonly IdentityDbContext _db;
    private readonly ICurrentUser      _currentUser;

    public GetSocietyMembersHandler(IdentityDbContext db, ICurrentUser currentUser)
        => (_db, _currentUser) = (db, currentUser);

    public async Task<Result<List<SocietyMemberDto>>> Handle(
        GetSocietyMembersQuery q, CancellationToken ct)
    {
        if (_currentUser.SocietyId is null)
            return Result<List<SocietyMemberDto>>.Fail("No society context.");

        var query = _db.Memberships
            .Include(m => m.User)
            .Include(m => m.Flat)
            .Where(m => m.SocietyId == _currentUser.SocietyId.Value
                     && m.IsActive
                     && !m.IsDeleted);

        if (q.Role is not null)   query = query.Where(m => m.Role == q.Role);
        if (q.Wing is not null)   query = query.Where(m => m.Flat!.Wing == q.Wing);

        var members = await query
            .OrderBy(m => m.Flat!.Wing)
            .ThenBy(m => m.Flat!.Number)
            .ThenBy(m => m.User!.Name)
            .Skip((q.Page - 1) * q.PageSize)
            .Take(q.PageSize)
            .Select(m => new SocietyMemberDto(
                m.UserId,
                m.User!.Name,
                m.User!.Phone,
                m.Role,
                m.MemberType,
                m.Flat != null ? m.Flat.Number : null,
                m.Flat != null ? m.Flat.Wing   : null,
                m.JoinedAt))
            .ToListAsync(ct);

        return Result<List<SocietyMemberDto>>.Ok(members);
    }
}
