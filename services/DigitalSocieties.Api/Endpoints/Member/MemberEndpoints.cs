using MediatR;
using Microsoft.AspNetCore.Mvc;
using DigitalSocieties.Communication.Infrastructure.Push;
using DigitalSocieties.Identity.Application.Commands;
using DigitalSocieties.Identity.Application.Queries;

namespace DigitalSocieties.Api.Endpoints.Member;

public static class MemberEndpoints
{
    public static RouteGroupBuilder MapMemberEndpoints(this RouteGroupBuilder g)
    {
        // ── Society-wide member list (admin) ───────────────────────────────
        g.MapGet("/", async (
            IMediator mediator,
            string? role, string? wing,
            int page = 1, int pageSize = 50) =>
        {
            var result = await mediator.Send(new GetSocietyMembersQuery(role, wing, page, pageSize));
            return result.IsSuccess ? Results.Ok(result.Value) : Results.BadRequest(result.Error);
        }).RequireAuthorization("AdminOnly");

        // ── Flat members (resident sees their own flat) ────────────────────
        g.MapGet("/flat/{flatId:guid?}", async (IMediator mediator, Guid? flatId) =>
        {
            var result = await mediator.Send(new GetFlatMembersQuery(flatId));
            return result.IsSuccess ? Results.Ok(result.Value) : Results.BadRequest(result.Error);
        }).RequireAuthorization();

        // ── Add family member ──────────────────────────────────────────────
        g.MapPost("/family", async (IMediator mediator, AddFamilyMemberCommand cmd) =>
        {
            var result = await mediator.Send(cmd);
            return result.IsSuccess
                ? Results.Created($"/api/v1/members/{result.Value}", result.Value)
                : Results.BadRequest(result.Error);
        }).RequireAuthorization("ResidentOrAdmin");

        // ── Remove family member ───────────────────────────────────────────
        g.MapDelete("/family/{userId:guid}", async (IMediator mediator, Guid userId) =>
        {
            var result = await mediator.Send(new RemoveFamilyMemberCommand(userId));
            return result.IsSuccess ? Results.Ok() : Results.BadRequest(result.Error);
        }).RequireAuthorization("ResidentOrAdmin");

        // ── Push notification token registration ───────────────────────────
        g.MapPost("/push-token", async (
            [FromServices] IPushTokenStore tokenStore,
            [FromServices] DigitalSocieties.Shared.Contracts.ICurrentUser cu,
            PushTokenRequest req,
            CancellationToken ct) =>
        {
            if (cu.UserId is null || cu.SocietyId is null)
                return Results.Unauthorized();
            await tokenStore.UpsertAsync(cu.UserId.Value, cu.SocietyId.Value, req.Token, ct);
            return Results.Ok();
        }).RequireAuthorization();

        // DELETE with a body is non-standard; use query param for token instead
        g.MapDelete("/push-token", async (
            [FromServices] IPushTokenStore tokenStore,
            [FromServices] DigitalSocieties.Shared.Contracts.ICurrentUser cu,
            [FromQuery] string token,
            CancellationToken ct) =>
        {
            if (cu.UserId is null) return Results.Unauthorized();
            await tokenStore.RemoveAsync(cu.UserId.Value, token, ct);
            return Results.Ok();
        }).RequireAuthorization();

        return g;
    }

    private sealed record PushTokenRequest(string Token);
}
