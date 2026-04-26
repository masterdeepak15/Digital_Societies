using System.Text.Json;
using Microsoft.AspNetCore.Diagnostics;

namespace DigitalSocieties.Api.Middleware;

/// <summary>
/// Converts unhandled exceptions to RFC-7807 Problem Details responses.
/// Never leaks stack traces to clients in production. (Security: information disclosure)
/// </summary>
public static class GlobalExceptionHandler
{
    public static async Task HandleAsync(HttpContext ctx)
    {
        var ex  = ctx.Features.Get<IExceptionHandlerFeature>()?.Error;
        var env = ctx.RequestServices.GetRequiredService<IWebHostEnvironment>();
        var log = ctx.RequestServices.GetRequiredService<ILogger<Program>>();

        log.LogError(ex, "Unhandled exception on {Method} {Path}",
            ctx.Request.Method, ctx.Request.Path);

        int status = ex switch
        {
            UnauthorizedAccessException => 401,
            KeyNotFoundException        => 404,
            InvalidOperationException   => 422,
            _                           => 500,
        };

        ctx.Response.StatusCode  = status;
        ctx.Response.ContentType = "application/problem+json";

        var problem = new
        {
            type    = $"https://httpstatuses.com/{status}",
            title   = ex?.GetType().Name ?? "Error",
            status,
            detail  = env.IsProduction() ? "An internal error occurred." : ex?.Message,
            traceId = ctx.TraceIdentifier,
        };

        await ctx.Response.WriteAsync(JsonSerializer.Serialize(problem));
    }
}
