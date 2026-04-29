using System.Security.Claims;
using Microsoft.AspNetCore.Authentication;

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

        string? role = null;

        var header = _accessor.HttpContext?.Request.Headers["X-Society-Id"].FirstOrDefault();
        if (Guid.TryParse(header, out var societyId))
        {
            role = memberships
                .FirstOrDefault(p => Guid.TryParse(p[0], out var sid) && sid == societyId)
                ?[1];
        }

        // Fallback: use first membership's role if header missing or not matched
        role ??= memberships[0][1];

        if (role is null)
            return Task.FromResult(principal);

        var cloned = principal.Clone();
        ((ClaimsIdentity)cloned.Identity!).AddClaim(new Claim("role", role));
        return Task.FromResult(cloned);
    }
}
