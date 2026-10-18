using System.Security.Claims;
using DigitalSocieties.Shared.Contracts;
using DigitalSocieties.Shared.Domain.Enums;

namespace DigitalSocieties.Api.Middleware;

/// <summary>
/// Extracts identity from the JWT ClaimsPrincipal.
/// The app logic depends on ICurrentUser — never on ClaimsPrincipal directly. (DIP)
/// </summary>
public sealed class JwtCurrentUser : ICurrentUser
{
    private readonly IHttpContextAccessor _accessor;

    public JwtCurrentUser(IHttpContextAccessor accessor) => _accessor = accessor;

    private ClaimsPrincipal? Principal => _accessor.HttpContext?.User;

    public bool IsAuthenticated => Principal?.Identity?.IsAuthenticated ?? false;

    public Guid? UserId => IsAuthenticated && Guid.TryParse(
        Principal!.FindFirstValue(ClaimTypes.NameIdentifier) ??
        Principal.FindFirstValue("sub"), out var id) ? id : null;

    public Guid? SocietyId
    {
        get
        {
            if (!IsAuthenticated) return null;
            // X-Society-Id may pick one of the user's memberships; without it the first one is used.
            var header = _accessor.HttpContext?.Request.Headers["X-Society-Id"].FirstOrDefault();
            return ActiveSocietyResolver.Resolve(Principal!.FindAll("membership").Select(c => c.Value), header);
        }
    }

    public Guid? FlatId
    {
        get
        {
            if (SocietyId is not { } sid) return null;
            return ActiveMembership.FlatIn(Principal!.FindAll("membership").Select(c => c.Value), sid);
        }
    }

    public string? Email => Principal?.FindFirstValue("email");

    public IReadOnlyList<string> Roles
    {
        get
        {
            if (!IsAuthenticated || SocietyId is null) return [];
            return Principal!.FindAll("membership")
                .Select(c => c.Value.Split(':'))
                .Where(p => p.Length >= 2 && Guid.TryParse(p[0], out var sid) && sid == SocietyId)
                .Select(p => p[1])
                .ToList();
        }
    }

    public bool IsInRole(string role) => Roles.Contains(role, StringComparer.OrdinalIgnoreCase);

    private (string role, Guid? flatId)? GetMembershipForActiveSociety()
    {
        if (SocietyId is null) return null;
        var claim = Principal!.FindAll("membership")
            .Select(c => c.Value.Split(':'))
            .FirstOrDefault(p => p.Length >= 2 && Guid.TryParse(p[0], out var sid) && sid == SocietyId);

        if (claim is null) return null;
        Guid? flatId = claim.Length >= 3 && Guid.TryParse(claim[2], out var fid) ? fid : null;
        return (claim[1], flatId);
    }
}
