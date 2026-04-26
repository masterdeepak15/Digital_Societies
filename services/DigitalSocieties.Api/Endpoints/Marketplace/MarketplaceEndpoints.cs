using MediatR;
using DigitalSocieties.Marketplace.Application.Commands;
using DigitalSocieties.Marketplace.Application.Queries;

namespace DigitalSocieties.Api.Endpoints.Marketplace;

public static class MarketplaceEndpoints
{
    public static RouteGroupBuilder MapMarketplaceEndpoints(this RouteGroupBuilder g)
    {
        // ── Browse & search (resident) ────────────────────────────────────
        g.MapGet("/listings", async (IMediator mediator, string? category, int page = 1, int pageSize = 20) =>
        {
            var r = await mediator.Send(new GetListingsQuery(category, page, pageSize));
            return r.IsSuccess ? Results.Ok(r.Value) : Results.BadRequest(r.Error);
        }).RequireAuthorization();

        g.MapGet("/my/bookings", async (IMediator mediator, string? status) =>
        {
            var r = await mediator.Send(new GetMyBookingsQuery(status));
            return r.IsSuccess ? Results.Ok(r.Value) : Results.BadRequest(r.Error);
        }).RequireAuthorization();

        // ── Provider ──────────────────────────────────────────────────────
        g.MapGet("/provider/bookings", async (IMediator mediator, string? status) =>
        {
            var r = await mediator.Send(new GetProviderBookingsQuery(status));
            return r.IsSuccess ? Results.Ok(r.Value) : Results.BadRequest(r.Error);
        }).RequireAuthorization();

        g.MapPost("/listings", async (IMediator mediator, CreateListingCommand cmd) =>
        {
            var r = await mediator.Send(cmd);
            return r.IsSuccess
                ? Results.Created($"/api/v1/marketplace/listings/{r.Value}", r.Value)
                : Results.BadRequest(r.Error);
        }).RequireAuthorization();

        g.MapPost("/bookings/{bookingId:guid}/confirm", async (IMediator mediator, Guid bookingId) =>
        {
            var r = await mediator.Send(new ConfirmBookingCommand(bookingId));
            return r.IsSuccess ? Results.Ok() : Results.BadRequest(r.Error);
        }).RequireAuthorization();

        g.MapPost("/bookings/{bookingId:guid}/complete",
            async (IMediator mediator, Guid bookingId, CompleteBody body) =>
            {
                var r = await mediator.Send(new CompleteBookingCommand(bookingId, body.FinalAmountRupees));
                return r.IsSuccess ? Results.Ok() : Results.BadRequest(r.Error);
            }).RequireAuthorization();

        // ── Resident actions ──────────────────────────────────────────────
        g.MapPost("/bookings", async (IMediator mediator, BookServiceCommand cmd) =>
        {
            var r = await mediator.Send(cmd);
            return r.IsSuccess
                ? Results.Created($"/api/v1/marketplace/bookings/{r.Value}", r.Value)
                : Results.BadRequest(r.Error);
        }).RequireAuthorization();

        g.MapPost("/bookings/{bookingId:guid}/cancel",
            async (IMediator mediator, Guid bookingId, CancelBody body) =>
            {
                var r = await mediator.Send(new CancelBookingCommand(bookingId, body.Reason));
                return r.IsSuccess ? Results.Ok() : Results.BadRequest(r.Error);
            }).RequireAuthorization();

        g.MapPost("/bookings/{bookingId:guid}/review",
            async (IMediator mediator, Guid bookingId, ReviewBody body) =>
            {
                var r = await mediator.Send(new ReviewServiceCommand(bookingId, body.Rating, body.Comment));
                return r.IsSuccess ? Results.Ok(r.Value) : Results.BadRequest(r.Error);
            }).RequireAuthorization();

        return g;
    }

    private sealed record CompleteBody(decimal FinalAmountRupees);
    private sealed record CancelBody(string Reason);
    private sealed record ReviewBody(int Rating, string Comment);
}
