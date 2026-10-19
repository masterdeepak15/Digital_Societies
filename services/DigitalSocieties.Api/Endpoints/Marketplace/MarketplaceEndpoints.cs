using MediatR;
using DigitalSocieties.Billing.Application.Commands;
using DigitalSocieties.Shared.Contracts;
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

        MapMarket(g);
        return g;
    }

    // ── The society market: sell / wanted / borrow posts and the replies under them ──────────────
    private static void MapMarket(RouteGroupBuilder g)
    {
        // The queries carry the author's flat id; the apps show the label ("A-101").
        static string Label(string flatId, Dictionary<Guid, string> labels) =>
            string.IsNullOrEmpty(flatId) ? "Management"
            : Guid.TryParse(flatId, out var id) && labels.TryGetValue(id, out var l) ? l : "Resident";

        g.MapGet("/market", async (IMediator mediator, ICurrentUser cu, IFlatQueryService flats, CancellationToken ct,
            string? kind, string? status, bool mine = false, int page = 1, int pageSize = 30) =>
        {
            var r = await mediator.Send(new GetMarketPostsQuery(kind, status, mine, page, pageSize), ct);
            if (!r.IsSuccess) return Results.BadRequest(r.Error);
            var labels = await flats.GetFlatLabelsAsync(cu.SocietyId!.Value, ct);
            return Results.Ok(r.Value!.Select(p => p with { AuthorFlatDisplay = Label(p.AuthorFlatDisplay, labels) }));
        }).RequireAuthorization();

        g.MapGet("/market/{id:guid}", async (IMediator mediator, ICurrentUser cu, IFlatQueryService flats, CancellationToken ct, Guid id) =>
        {
            var r = await mediator.Send(new GetMarketPostQuery(id), ct);
            if (!r.IsSuccess) return Results.NotFound(r.Error);
            var labels = await flats.GetFlatLabelsAsync(cu.SocietyId!.Value, ct);
            var d = r.Value!;
            return Results.Ok(new MarketPostDetailDto(
                d.Post with { AuthorFlatDisplay = Label(d.Post.AuthorFlatDisplay, labels) },
                d.Replies.Select(x => x with { AuthorFlatDisplay = Label(x.AuthorFlatDisplay, labels) }).ToList()));
        }).RequireAuthorization();

        g.MapPost("/market", async (IMediator mediator, CreateMarketPostCommand cmd) =>
        {
            var r = await mediator.Send(cmd);
            return r.IsSuccess ? Results.Created($"/api/v1/marketplace/market/{r.Value}", r.Value) : Results.BadRequest(r.Error);
        }).RequireAuthorization();

        g.MapPut("/market/{id:guid}", async (IMediator mediator, Guid id, MarketPostBody b) =>
        {
            var r = await mediator.Send(new UpdateMarketPostCommand(id, b.Kind, b.Title, b.Description, b.PriceRupees, b.Condition, b.ImageIds));
            return r.IsSuccess ? Results.NoContent() : Results.BadRequest(r.Error);
        }).RequireAuthorization();

        g.MapPost("/market/{id:guid}/close", async (IMediator mediator, Guid id, CloseMarketBody? b) =>
        {
            var r = await mediator.Send(new CloseMarketPostCommand(id, b?.WithUserId));
            return r.IsSuccess ? Results.NoContent() : Results.BadRequest(r.Error);
        }).RequireAuthorization();

        g.MapPost("/market/{id:guid}/reopen", async (IMediator mediator, Guid id) =>
        {
            var r = await mediator.Send(new ReopenMarketPostCommand(id));
            return r.IsSuccess ? Results.NoContent() : Results.BadRequest(r.Error);
        }).RequireAuthorization();

        g.MapDelete("/market/{id:guid}", async (IMediator mediator, Guid id) =>
        {
            var r = await mediator.Send(new DeleteMarketPostCommand(id));
            return r.IsSuccess ? Results.NoContent() : Results.BadRequest(r.Error);
        }).RequireAuthorization();

        g.MapPost("/market/{id:guid}/replies", async (IMediator mediator, Guid id, ReplyBody b) =>
        {
            var r = await mediator.Send(new AddMarketReplyCommand(id, b.Body));
            return r.IsSuccess ? Results.Created($"/api/v1/marketplace/market/{id}", r.Value) : Results.BadRequest(r.Error);
        }).RequireAuthorization();

        g.MapDelete("/market/replies/{replyId:guid}", async (IMediator mediator, Guid replyId) =>
        {
            var r = await mediator.Send(new DeleteMarketReplyCommand(replyId));
            return r.IsSuccess ? Results.NoContent() : Results.BadRequest(r.Error);
        }).RequireAuthorization();
    }

    private sealed record MarketPostBody(string Kind, string Title, string Description, decimal? PriceRupees, string? Condition, List<string>? ImageIds);
    private sealed record CloseMarketBody(Guid? WithUserId);
    private sealed record ReplyBody(string Body);

    private sealed record CompleteBody(decimal FinalAmountRupees);
    private sealed record CancelBody(string Reason);
    private sealed record ReviewBody(int Rating, string Comment);

    private sealed record SetListingActiveRequest(bool IsActive);
    private sealed record RejectListingRequest(string Reason);
    private sealed record ListingDetails(string ProviderName, string Phone, string Category, string Title,
        string Description, decimal BaseRateRupees, string RateUnit, decimal CommissionPct);
}
