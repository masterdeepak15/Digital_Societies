using MediatR;
using Microsoft.EntityFrameworkCore;
using DigitalSocieties.Shared.Results;
using DigitalSocieties.Identity.Infrastructure.Persistence;
using DigitalSocieties.Identity.Infrastructure.Security;

namespace DigitalSocieties.Identity.Application.Commands;

/// <summary>
/// Trusted-internal command: issues JWT tokens for the demo admin user without OTP.
/// Called ONLY from the /setup/demo endpoint, which is itself guarded to reject
/// if a real (non-demo) society already exists.
/// </summary>
public sealed record IssueTokenForDemoAdminCommand(Guid AdminUserId) : IRequest<Result<DemoTokenResponse>>;

public sealed record DemoTokenResponse(string AccessToken, Guid SocietyId);

public sealed class IssueTokenForDemoAdminHandler
    : IRequestHandler<IssueTokenForDemoAdminCommand, Result<DemoTokenResponse>>
{
    private readonly IdentityDbContext _db;
    private readonly IJwtService       _jwt;

    public IssueTokenForDemoAdminHandler(IdentityDbContext db, IJwtService jwt)
    {
        _db  = db;
        _jwt = jwt;
    }

    public async Task<Result<DemoTokenResponse>> Handle(
        IssueTokenForDemoAdminCommand cmd, CancellationToken ct)
    {
        var user = await _db.Users
            .IgnoreQueryFilters()
            .FirstOrDefaultAsync(u => u.Id == cmd.AdminUserId, ct);

        if (user is null)
            return Result<DemoTokenResponse>.Fail(
                Error.NotFound("DemoAdmin", "Demo admin user not found — has SeedAsync run?"));

        var memberships = await _db.Memberships
            .IgnoreQueryFilters()
            .Where(m => m.UserId == cmd.AdminUserId)
            .Join(_db.Societies.IgnoreQueryFilters(),
                  m => m.SocietyId,
                  s => s.Id,
                  (m, s) => new MembershipInfo(s.Id, s.Name, m.Role.ToString(), m.FlatId, null))
            .ToListAsync(ct);

        var (accessToken, _, _) = await _jwt.IssueTokensAsync(user, memberships, ct);

        var societyId = memberships.FirstOrDefault()?.SocietyId ?? Guid.Empty;
        return Result<DemoTokenResponse>.Ok(new DemoTokenResponse(accessToken, societyId));
    }
}
