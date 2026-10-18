using MediatR;
using DigitalSocieties.Identity.Application.Commands;

namespace DigitalSocieties.Api.Endpoints.Flat;

public static class FlatEndpoints
{
    public static RouteGroupBuilder MapFlatEndpoints(this RouteGroupBuilder g)
    {
        // The flats of the society, with how many people live in each.
        g.MapGet("/", async (IMediator mediator) =>
        {
            var r = await mediator.Send(new GetFlatsQuery());
            return r.IsSuccess ? Results.Ok(r.Value) : Results.BadRequest(r.Error);
        }).RequireAuthorization("AdminOnly");

        // Describe the buildings: wings, floors, flats per floor.
        g.MapPost("/layout", async (IMediator mediator, ConfigureFlatLayoutCommand cmd) =>
        {
            var r = await mediator.Send(cmd);
            return r.IsSuccess ? Results.Ok(r.Value) : Results.BadRequest(r.Error);
        }).RequireAuthorization("AdminOnly");

        g.MapPost("/", async (IMediator mediator, AddFlatCommand cmd) =>
        {
            var r = await mediator.Send(cmd);
            return r.IsSuccess ? Results.Created($"/api/v1/flats/{r.Value}", r.Value) : Results.BadRequest(r.Error);
        }).RequireAuthorization("AdminOnly");

        g.MapPut("/{id:guid}", async (IMediator mediator, Guid id, FlatRequest body) =>
        {
            var r = await mediator.Send(new UpdateFlatCommand(id, body.Wing, body.Number, body.Floor));
            return r.IsSuccess ? Results.NoContent() : Results.BadRequest(r.Error);
        }).RequireAuthorization("AdminOnly");

        g.MapDelete("/{id:guid}", async (IMediator mediator, Guid id) =>
        {
            var r = await mediator.Send(new DeleteFlatCommand(id));
            return r.IsSuccess ? Results.NoContent() : Results.BadRequest(r.Error);
        }).RequireAuthorization("AdminOnly");

        return g;
    }

    private sealed record FlatRequest(string Wing, string Number, int Floor);
}
