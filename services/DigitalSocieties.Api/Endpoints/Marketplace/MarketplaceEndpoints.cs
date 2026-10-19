using MediatR;
using DigitalSocieties.Marketplace.Application.Commands;
using DigitalSocieties.Marketplace.Application.Queries;

namespace DigitalSocieties.Api.Endpoints.Marketplace;

public static class MarketplaceEndpoints
{
    public static RouteGroupBuilder MapMarketplaceEndpoints(this RouteGroupBuilder g)
    {
        // ── Browse & search (resident) ────────────────────────────────────
        g.MapGet("/listings", async (IMediator mediator, string? category, int page = 1, int pageSize = 20, bool includeInactive = false, string? approval = null) =>
        {
            var r = await mediator.Send(new GetListingsQuery(category, page, pageSize, includeInactive, approval));
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

        g.MapPut("/listings/{id:guid}", async (IMediator mediator, Guid id, ListingDetails d) =>
        {
            var r = await mediator.Send(new UpdateListingCommand(id, d.ProviderName, d.Phone, d.Category, d.Title,
                d.Description, d.BaseRateRupees, d.RateUnit, d.CommissionPct));
            return r.IsSuccess ? Results.NoContent() : Results.BadRequest(r.Error);
        }).RequireAuthorization();

        g.MapDelete("/listings/{id:guid}", async (IMediator mediator, Guid id) =>
        {
            var r = await mediator.Send(new DeleteListingCommand(id));
            return r.IsSuccess ? Results.NoContent() : Results.BadRequest(r.Error);
        }).RequireAuthorization();

        g.MapPost("/listings/{id:guid}/approve", async (IMediator mediator, Guid id) =>
        {
            var r = await mediator.Send(new ApproveListingCommand(id));
            return r.IsSuccess ? Results.NoContent() : Results.BadRequest(r.Error);
        }).RequireAuthorization("AdminOnly");

        g.MapPost("/listings/{id:guid}/reject", async (IMediator mediator, Guid id, RejectListingRequest req) =>
        {
            var r = await mediator.Send(new RejectListingCommand(id, req.Reason));
            return r.IsSuccess ? Results.NoContent() : Results.BadRequest(r.Error);
        }).RequireAuthorization("AdminOnly");

        g.MapPut("/listings/{id:guid}/active", async (IMediator mediator, Guid id, SetListingActiveRequest req) =>
        {
            var r = await mediator.Send(new SetListingActiveCommand(id, req.IsActive));
            return r.IsSuccess ? Results.NoContent() : Results.BadRequest(r.Error);
        }).RequireAuthorization("AdminOnly");

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

    private sealed record SetListingActiveRequest(bool IsActive);
    private sealed record RejectListingRequest(string Reason);
    private sealed record ListingDetails(string ProviderName, string Phone, string Category, string Title,
        string Description, decimal BaseRateRupees, string RateUnit, decimal CommissionPct);
}
