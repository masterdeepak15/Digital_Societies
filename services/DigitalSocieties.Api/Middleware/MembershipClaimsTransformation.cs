using System.Security.Claims;
using Microsoft.AspNetCore.Authentication;
using DigitalSocieties.Shared.Contracts;

namespace DigitalSocieties.Api.Middleware;

/// <summary>
/// Translates the JWT "membership" claim (societyId:role:flatId) into a "role" claim
/// so that ASP.NET authorization policies (RequireClaim("role", "admin")) work correctly.
///
/// Runs after JWT validation, before policy evaluation.
/// Uses X-Society-Id header to pick the correct membership for multi-society users.
/// Falls back to the first membership if the header is absent.
/// </summary>
public sealed class MembershipClaimsTransformation : IClaimsTransformation
{
    private readonly IHttpContextAccessor _accessor;

    public MembershipClaimsTransformation(IHttpContextAccessor accessor)
        => _accessor = accessor;

    public Task<ClaimsPrincipal> TransformAsync(ClaimsPrincipal principal)
    {
        if (principal.Identity?.IsAuthenticated != true)
            return Task.FromResult(principal);

        // Already transformed (avoid adding duplicate claims on re-entry)
        if (principal.HasClaim(c => c.Type == "role"))
            return Task.FromResult(principal);

        var memberships = principal.FindAll("membership")
            .Select(c => c.Value.Split(':'))
            .Where(p => p.Length >= 2)
            .ToList();

        if (memberships.Count == 0)
            return Task.FromResult(principal);

        // The society this request acts on: the header's society if the person belongs to it, else their first.
        var header = _accessor.HttpContext?.Request.Headers["X-Society-Id"].FirstOrDefault();
        var claims = principal.FindAll("membership").Select(c => c.Value).ToList();
        var societyId = ActiveSocietyResolver.Resolve(claims, header);

        // Every role the person holds in that society counts (resident AND admin, for example); policies
        // such as RequireClaim("role", "admin") pass if any of them matches.
        var roles = societyId is { } sid ? ActiveMembership.RolesIn(claims, sid) : [];
        if (roles.Count == 0) return Task.FromResult(principal);

        var cloned = principal.Clone();
        foreach (var role in roles)
            ((ClaimsIdentity)cloned.Identity!).AddClaim(new Claim("role", role));
        return Task.FromResult(cloned);
    }
}
