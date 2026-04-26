using MediatR;
using DigitalSocieties.Parking.Application.Commands;
using DigitalSocieties.Parking.Application.Queries;

namespace DigitalSocieties.Api.Endpoints.Parking;

public static class ParkingEndpoints
{
    public static RouteGroupBuilder MapParkingEndpoints(this RouteGroupBuilder g)
    {
        // ── Admin: levels ──────────────────────────────────────────────────
        g.MapGet("/levels", async (IMediator mediator) =>
        {
            var r = await mediator.Send(new GetParkingLevelsQuery());
            return r.IsSuccess ? Results.Ok(r.Value) : Results.BadRequest(r.Error);
        }).RequireAuthorization("AdminOnly");

        g.MapPost("/levels", async (IMediator mediator, CreateParkingLevelCommand cmd) =>
        {
            var r = await mediator.Send(cmd);
            return r.IsSuccess
                ? Results.Created($"/api/v1/parking/levels/{r.Value}", r.Value)
                : Results.BadRequest(r.Error);
        }).RequireAuthorization("AdminOnly");

        // ── Admin: slots ───────────────────────────────────────────────────
        g.MapGet("/levels/{levelId:guid}/slots", async (IMediator mediator, Guid levelId) =>
        {
            var r = await mediator.Send(new GetLevelSlotsQuery(levelId));
            return r.IsSuccess ? Results.Ok(r.Value) : Results.BadRequest(r.Error);
        }).RequireAuthorization("AdminOnly");

        g.MapPost("/slots", async (IMediator mediator, AddParkingSlotCommand cmd) =>
        {
            var r = await mediator.Send(cmd);
            return r.IsSuccess
                ? Results.Created($"/api/v1/parking/slots/{r.Value}", r.Value)
                : Results.BadRequest(r.Error);
        }).RequireAuthorization("AdminOnly");

        g.MapPost("/slots/{slotId:guid}/assign", async (IMediator mediator, Guid slotId, AssignSlotBody body) =>
        {
            var r = await mediator.Send(new AssignSlotCommand(slotId, body.FlatId, body.VehicleNumber, body.VehicleType));
            return r.IsSuccess ? Results.Ok() : Results.BadRequest(r.Error);
        }).RequireAuthorization("AdminOnly");

        g.MapPost("/slots/{slotId:guid}/unassign", async (IMediator mediator, Guid slotId) =>
        {
            var r = await mediator.Send(new UnassignSlotCommand(slotId));
            return r.IsSuccess ? Results.Ok() : Results.BadRequest(r.Error);
        }).RequireAuthorization("AdminOnly");

        g.MapPost("/slots/{slotId:guid}/visitor-pass", async (IMediator mediator, Guid slotId, VisitorPassBody body) =>
        {
            var r = await mediator.Send(new IssueVisitorPassCommand(slotId, body.VisitorId, body.ExpiresAt));
            return r.IsSuccess ? Results.Ok() : Results.BadRequest(r.Error);
        }).RequireAuthorization("GuardOrAdmin");

        // ── Resident: my parking + vehicles ───────────────────────────────
        g.MapGet("/my", async (IMediator mediator) =>
        {
            var r = await mediator.Send(new GetMyParkingQuery());
            return r.IsSuccess ? Results.Ok(r.Value) : Results.BadRequest(r.Error);
        }).RequireAuthorization();

        g.MapGet("/my/vehicles", async (IMediator mediator) =>
        {
            var r = await mediator.Send(new GetMyVehiclesQuery());
            return r.IsSuccess ? Results.Ok(r.Value) : Results.BadRequest(r.Error);
        }).RequireAuthorization();

        g.MapPost("/my/vehicles", async (IMediator mediator, RegisterVehicleCommand cmd) =>
        {
            var r = await mediator.Send(cmd);
            return r.IsSuccess
                ? Results.Created($"/api/v1/parking/my/vehicles/{r.Value}", r.Value)
                : Results.BadRequest(r.Error);
        }).RequireAuthorization();

        return g;
    }

    private sealed record AssignSlotBody(Guid FlatId, string VehicleNumber, string VehicleType);
    private sealed record VisitorPassBody(Guid VisitorId, DateTimeOffset ExpiresAt);
}
