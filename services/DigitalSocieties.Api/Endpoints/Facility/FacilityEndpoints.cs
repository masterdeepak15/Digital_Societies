using MediatR;
using Microsoft.EntityFrameworkCore;
using DigitalSocieties.Facility.Application.Commands;
using DigitalSocieties.Facility.Application.Queries;
using DigitalSocieties.Facility.Infrastructure.Persistence;
using DigitalSocieties.Shared.Contracts;

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

        // ── Admin: all bookings for a given date ───────────────────────────
        // GET /api/v1/facilities/bookings?date=2026-04-28
        g.MapGet("/bookings", async (
            FacilityDbContext db,
            ICurrentUser cu,
            string? date,
            CancellationToken ct) =>
        {
            if (cu.SocietyId is null) return Results.BadRequest("Society context required.");

            var query = db.Bookings
                .Include(b => b.Facility)
                .Where(b => b.SocietyId == cu.SocietyId && !b.IsDeleted);

            if (DateOnly.TryParse(date, out var parsed))
                query = query.Where(b => b.BookingDate == parsed);

            var items = await query
                .OrderBy(b => b.StartTime)
                .Select(b => new {
                    b.Id,
                    FacilityId   = b.FacilityId,
                    FacilityName = b.Facility!.Name,
                    b.BookingDate,
                    StartTime    = b.StartTime.ToString("HH:mm"),
                    EndTime      = b.EndTime.ToString("HH:mm"),
                    Status       = b.Status.ToString(),
                    b.FlatId,
                    b.BookedBy,
                })
                .ToListAsync(ct);

            return Results.Ok(items);
        })
        .RequireAuthorization("AdminOnly")
        .WithName("AdminGetFacilityBookings")
        .WithSummary("Admin: list all facility bookings, optionally filtered by date")
        .WithTags("Facilities");

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

        // ── Cancel booking (admin: DELETE, resident: POST cancel) ──────────
        g.MapDelete("/bookings/{bookingId:guid}", async (
            IMediator mediator, Guid bookingId, CancellationToken ct) =>
        {
            var result = await mediator.Send(new CancelBookingCommand(bookingId, "Cancelled by admin"));
            return result.IsSuccess ? Results.NoContent() : Results.BadRequest(result.Error);
        })
        .RequireAuthorization("AdminOnly")
        .WithName("AdminCancelFacilityBooking")
        .WithTags("Facilities");

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
