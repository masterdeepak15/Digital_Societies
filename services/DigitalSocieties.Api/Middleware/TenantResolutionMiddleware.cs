using Microsoft.EntityFrameworkCore;

namespace DigitalSocieties.Api.Middleware;

/// <summary>
/// Sets the Postgres session variable `app.current_society_id` on each request.
/// Postgres Row-Level Security policies read this variable to enforce tenant isolation.
/// This is the SECOND line of defense after JWT-claim validation. (Security: defense-in-depth)
/// </summary>
public sealed class TenantResolutionMiddleware
{
    private readonly RequestDelegate _next;

    public TenantResolutionMiddleware(RequestDelegate next) => _next = next;

    public async Task InvokeAsync(
        HttpContext ctx,
        DigitalSocieties.Shared.Contracts.ICurrentUser currentUser,
        DigitalSocieties.Identity.Infrastructure.Persistence.IdentityDbContext db)
    {
        if (currentUser.IsAuthenticated && currentUser.SocietyId.HasValue)
        {
            // Tell Postgres who the current tenant is — RLS policies use this
            await db.Database.ExecuteSqlRawAsync(
                $"SET LOCAL app.current_society_id = '{currentUser.SocietyId}'");
        }

        await _next(ctx);
    }
}
