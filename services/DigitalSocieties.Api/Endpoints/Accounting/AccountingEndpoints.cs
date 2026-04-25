using MediatR;
using DigitalSocieties.Accounting.Application.Commands;
using DigitalSocieties.Accounting.Application.Queries;

namespace DigitalSocieties.Api.Endpoints.Accounting;

public static class AccountingEndpoints
{
    public static RouteGroupBuilder MapAccountingEndpoints(this RouteGroupBuilder g)
    {
        // ── Ledger entries ─────────────────────────────────────────────────
        g.MapGet("/entries", async (
            IMediator mediator,
            string? type, string? category,
            int month = 0, int year = 0,
            int page = 1, int pageSize = 50,
            bool pendingOnly = false) =>
        {
            var result = await mediator.Send(new GetLedgerEntriesQuery(
                type, category, month, year, page, pageSize, pendingOnly));
            return result.IsSuccess ? Results.Ok(result.Value) : Results.BadRequest(result.Error);
        }).RequireAuthorization("ResidentOrAdmin");

        g.MapPost("/entries", async (IMediator mediator, PostLedgerEntryCommand cmd) =>
        {
            var result = await mediator.Send(cmd);
            return result.IsSuccess ? Results.Created($"/api/v1/accounting/entries/{result.Value}", result.Value)
                                    : Results.BadRequest(result.Error);
        }).RequireAuthorization("AdminOnly");

        g.MapPost("/entries/{id:guid}/approve", async (IMediator mediator, Guid id) =>
        {
            var result = await mediator.Send(new ApproveLedgerEntryCommand(id));
            return result.IsSuccess ? Results.Ok() : Results.BadRequest(result.Error);
        }).RequireAuthorization("AdminOnly");

        g.MapPost("/entries/{id:guid}/reject", async (
            IMediator mediator, Guid id, RejectLedgerEntryCommand cmd) =>
        {
            var result = await mediator.Send(cmd with { EntryId = id });
            return result.IsSuccess ? Results.Ok() : Results.BadRequest(result.Error);
        }).RequireAuthorization("AdminOnly");

        // ── Monthly report ─────────────────────────────────────────────────
        g.MapGet("/report", async (IMediator mediator, int month = 0, int year = 0) =>
        {
            var result = await mediator.Send(new GetMonthlyReportQuery(month, year));
            return result.IsSuccess ? Results.Ok(result.Value) : Results.BadRequest(result.Error);
        }).RequireAuthorization("AdminOnly");

        return g;
    }
}
