using MediatR;
using DigitalSocieties.Facility.Application.Commands;
using DigitalSocieties.Facility.Application.Queries;

namespace DigitalSocieties.Api.Endpoints.Facility;

public static class FacilityEndpoints
{
    public static RouteGroupBuilder MapFacilityEndpoints(this RouteGroupBuilder g)
    {
        // ── List facilities ────────────────────────────────────────────────
        g.MapGet("/", async (IMediator mediator, bool activeOnly = true) =>
        {
            var result = await mediator.Send(new GetFacilitiesQuery(activeOnly));
            return result.IsSuccess ? Results.Ok(result.Value) : Results.BadRequest(result.Error);
        }).RequireAuthorization();

        // ── Available slots for a date ─────────────────────────────────────
        g.MapGet("/{id:guid}/slots", async (
            IMediator mediator, Guid id, DateOnly date) =>
        {
            var result = await mediator.Send(new GetAvailableSlotsQuery(id, date));
            return result.IsSuccess ? Results.Ok(result.Value) : Results.BadRequest(result.Error);
        }).RequireAuthorization();

        // ── Book a slot ────────────────────────────────────────────────────
        g.MapPost("/{id:guid}/book", async (
            IMediator mediator, Guid id, BookFacilityCommand cmd) =>
        {
            var result = await mediator.Send(cmd with { FacilityId = id });
            return result.IsSuccess
                ? Results.Created($"/api/v1/facilities/{id}", result.Value)
                : Results.BadRequest(result.Error);
        }).RequireAuthorization("ResidentOrAdmin");

        // ── Cancel booking ─────────────────────────────────────────────────
        g.MapPost("/bookings/{bookingId:guid}/cancel", async (
            IMediator mediator, Guid bookingId, CancelBookingRequest req) =>
        {
            var result = await mediator.Send(new CancelBookingCommand(bookingId, req.Reason));
            return result.IsSuccess ? Results.Ok() : Results.BadRequest(result.Error);
        }).RequireAuthorization();

        // ── My bookings ────────────────────────────────────────────────────
        g.MapGet("/bookings/mine", async (IMediator mediator, bool upcomingOnly = true) =>
        {
            var result = await mediator.Send(new GetMyBookingsQuery(upcomingOnly));
            return result.IsSuccess ? Results.Ok(result.Value) : Results.BadRequest(result.Error);
        }).RequireAuthorization();

        return g;
    }

    private sealed record CancelBookingRequest(string Reason);
}
