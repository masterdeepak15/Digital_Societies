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

        int status = ex switch
        {
            // A malformed or incomplete request body is the caller's mistake, not a server fault.
            BadHttpRequestException bad => bad.StatusCode,
            JsonException               => 400,
            UnauthorizedAccessException => 401,
            KeyNotFoundException        => 404,
            InvalidOperationException   => 422,
            Microsoft.EntityFrameworkCore.DbUpdateConcurrencyException => 409,
            _                           => 500,
        };

        if (status >= 500)
            log.LogError(ex, "Unhandled exception on {Method} {Path}", ctx.Request.Method, ctx.Request.Path);
        else
            log.LogWarning("Rejected {Method} {Path} with {Status}: {Reason}",
                ctx.Request.Method, ctx.Request.Path, status, ex?.Message);

        ctx.Response.StatusCode  = status;
        ctx.Response.ContentType = "application/problem+json";

        var problem = new
        {
            type    = $"https://httpstatuses.com/{status}",
            title   = ex?.GetType().Name ?? "Error",
            status,
            detail  = status < 500 || !env.IsProduction() ? ex?.Message : "An internal error occurred.",
            traceId = ctx.TraceIdentifier,
        };

        await ctx.Response.WriteAsync(JsonSerializer.Serialize(problem));
    }
}
