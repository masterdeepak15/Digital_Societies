using MediatR;
using DigitalSocieties.Identity.Application.Commands;

namespace DigitalSocieties.Api.Endpoints.Identity;

/// <summary>
/// Maps auth endpoints. Grouped under /api/v1/auth.
/// Minimal APIs: no controller class, no base class. (SRP — routing only)
/// </summary>
public static class IdentityEndpoints
{
    public static RouteGroupBuilder MapIdentityEndpoints(this RouteGroupBuilder group)
    {
        group.MapPost("/otp/send",   SendOtp)  .WithName("SendOtp")  .AllowAnonymous();
        group.MapPost("/otp/verify", VerifyOtp).WithName("VerifyOtp").AllowAnonymous();
        group.MapPost("/refresh",    Refresh)  .WithName("Refresh")  .AllowAnonymous();
        group.MapPost("/logout",     Logout)   .WithName("Logout")   .RequireAuthorization();
        group.MapGet ("/me",         Me)       .WithName("GetMe")    .RequireAuthorization();

        return group;
    }

    // ── POST /api/v1/auth/otp/send ────────────────────────────────────────────
    private static async Task<IResult> SendOtp(
        SendOtpCommand cmd, IMediator mediator, CancellationToken ct)
    {
        var result = await mediator.Send(cmd, ct);
        return result.IsSuccess
            ? Results.Ok(result.Value)
            : Results.Problem(result.Error!.Message, statusCode: 400, title: result.Error.Code);
    }

    // ── POST /api/v1/auth/otp/verify ──────────────────────────────────────────
    private static async Task<IResult> VerifyOtp(
        VerifyOtpCommand cmd, IMediator mediator, CancellationToken ct)
    {
        var result = await mediator.Send(cmd, ct);
        return result.IsSuccess
            ? Results.Ok(result.Value)
            : Results.Problem(result.Error!.Message, statusCode: 401, title: result.Error.Code);
    }

    // ── POST /api/v1/auth/refresh ─────────────────────────────────────────────
    private static async Task<IResult> Refresh(
        RefreshTokenRequest req,
        DigitalSocieties.Identity.Infrastructure.Security.IJwtService jwt,
        CancellationToken ct)
    {
        var result = await jwt.RefreshAsync(req.RefreshToken, ct);
        return result.Success
            ? Results.Ok(new { result.AccessToken, result.RefreshToken, result.ExpiresIn })
            : Results.Problem(result.Error, statusCode: 401, title: "TOKEN_INVALID");
    }

    // ── POST /api/v1/auth/logout ──────────────────────────────────────────────
    private static async Task<IResult> Logout(
        LogoutRequest req,
        DigitalSocieties.Identity.Infrastructure.Security.IJwtService jwt,
        CancellationToken ct)
    {
        await jwt.RevokeAsync(req.RefreshToken, ct);
        return Results.NoContent();
    }

    // ── GET /api/v1/auth/me ───────────────────────────────────────────────────
    private static async Task<IResult> Me(
        DigitalSocieties.Shared.Contracts.ICurrentUser currentUser,
        DigitalSocieties.Identity.Infrastructure.Persistence.IUserRepository users,
        CancellationToken ct)
    {
        if (!currentUser.IsAuthenticated || currentUser.UserId is null)
            return Results.Unauthorized();

        var user = await users.FindWithMembershipsAsync(currentUser.UserId.Value, ct);
        return user is null ? Results.NotFound() : Results.Ok(user);
    }

    private sealed record RefreshTokenRequest(string RefreshToken);
    private sealed record LogoutRequest(string RefreshToken);
}
