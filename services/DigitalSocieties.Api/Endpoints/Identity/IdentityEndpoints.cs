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

        // ── 2FA endpoints ─────────────────────────────────────────────────────
        // Enroll: authenticated user generates TOTP secret + QR URI
        group.MapPost("/2fa/enroll",  Enroll2Fa) .WithName("Enroll2Fa") .RequireAuthorization()
             .WithSummary("Generate TOTP secret + QR code URI. User scans into authenticator app.");
        // Confirm: user submits first TOTP code to activate 2FA
        group.MapPost("/2fa/confirm", Confirm2Fa).WithName("Confirm2Fa").RequireAuthorization()
             .WithSummary("Activate 2FA by submitting first TOTP code from authenticator app.");
        // Verify: 2nd-factor check during login (called when VerifyOtp returns RequiresTwoFactor)
        group.MapPost("/2fa/verify",  Verify2Fa) .WithName("Verify2Fa") .AllowAnonymous()
             .WithSummary("Second-factor login: submit TOTP code for pending user → returns JWT.");
        // Disable: authenticated user disables 2FA by confirming current TOTP
        group.MapPost("/2fa/disable", Disable2Fa).WithName("Disable2Fa").RequireAuthorization()
             .WithSummary("Disable 2FA. Requires current TOTP code to confirm.");

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

    // ── POST /api/v1/auth/2fa/enroll ─────────────────────────────────────────
    private static async Task<IResult> Enroll2Fa(IMediator mediator, CancellationToken ct)
    {
        var result = await mediator.Send(new Enroll2FaCommand(), ct);
        return result.IsSuccess
            ? Results.Ok(result.Value)
            : Results.Problem(result.Error!.Message, statusCode: 400, title: result.Error.Code);
    }

    // ── POST /api/v1/auth/2fa/confirm ─────────────────────────────────────────
    private static async Task<IResult> Confirm2Fa(
        Confirm2FaRequest req, IMediator mediator, CancellationToken ct)
    {
        var result = await mediator.Send(new Confirm2FaCommand(req.TotpCode), ct);
        return result.IsSuccess
            ? Results.Ok(new { twoFactorEnabled = true })
            : Results.Problem(result.Error!.Message, statusCode: 400, title: result.Error.Code);
    }

    // ── POST /api/v1/auth/2fa/verify ──────────────────────────────────────────
    private static async Task<IResult> Verify2Fa(
        Verify2FaRequest req, IMediator mediator, CancellationToken ct)
    {
        var result = await mediator.Send(new Verify2FaCommand(req.PendingUserId, req.TotpCode), ct);
        return result.IsSuccess
            ? Results.Ok(result.Value)
            : Results.Problem(result.Error!.Message, statusCode: 401, title: result.Error.Code);
    }

    // ── POST /api/v1/auth/2fa/disable ─────────────────────────────────────────
    private static async Task<IResult> Disable2Fa(
        Disable2FaRequest req, IMediator mediator, CancellationToken ct)
    {
        var result = await mediator.Send(new Disable2FaCommand(req.TotpCode), ct);
        return result.IsSuccess
            ? Results.Ok(new { twoFactorEnabled = false })
            : Results.Problem(result.Error!.Message, statusCode: 400, title: result.Error.Code);
    }

    private sealed record RefreshTokenRequest(string RefreshToken);
    private sealed record LogoutRequest(string RefreshToken);
    private sealed record Confirm2FaRequest(string TotpCode);
    private sealed record Verify2FaRequest(Guid PendingUserId, string TotpCode);
    private sealed record Disable2FaRequest(string TotpCode);
}
