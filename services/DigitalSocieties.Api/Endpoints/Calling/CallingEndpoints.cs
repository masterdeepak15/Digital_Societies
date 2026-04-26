using MediatR;
using DigitalSocieties.Calling.Application.Commands;

namespace DigitalSocieties.Api.Endpoints.Calling;

public static class CallingEndpoints
{
    public static RouteGroupBuilder MapCallingEndpoints(this RouteGroupBuilder g)
    {
        // ── Resident: start a visitor callback ────────────────────────────
        g.MapPost("/visitor/{visitorId:guid}", async (IMediator mediator, Guid visitorId) =>
        {
            var r = await mediator.Send(new CreateVisitorCallCommand(visitorId));
            return r.IsSuccess ? Results.Ok(r.Value) : Results.BadRequest(r.Error);
        }).RequireAuthorization();

        // ── Resident: start an SOS broadcast ─────────────────────────────
        g.MapPost("/sos", async (IMediator mediator) =>
        {
            var r = await mediator.Send(new CreateSosCallCommand());
            return r.IsSuccess ? Results.Ok(r.Value) : Results.BadRequest(r.Error);
        }).RequireAuthorization();

        // ── Any authenticated user: join an existing room ─────────────────
        g.MapPost("/{roomId:guid}/join", async (IMediator mediator, Guid roomId) =>
        {
            var r = await mediator.Send(new JoinCallCommand(roomId));
            return r.IsSuccess ? Results.Ok(r.Value) : Results.BadRequest(r.Error);
        }).RequireAuthorization();

        // ── Host: end a room ──────────────────────────────────────────────
        g.MapPost("/{roomId:guid}/end", async (IMediator mediator, Guid roomId) =>
        {
            var r = await mediator.Send(new EndCallCommand(roomId));
            return r.IsSuccess ? Results.Ok() : Results.BadRequest(r.Error);
        }).RequireAuthorization();

        return g;
    }
}
