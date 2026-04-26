using MediatR;
using DigitalSocieties.Wallet.Application.Commands;
using DigitalSocieties.Wallet.Application.Queries;

namespace DigitalSocieties.Api.Endpoints.Wallet;

public static class WalletEndpoints
{
    public static RouteGroupBuilder MapWalletEndpoints(this RouteGroupBuilder g)
    {
        // ── Ensure wallet exists (idempotent) ─────────────────────────────
        g.MapPost("/ensure", async (IMediator mediator) =>
        {
            var r = await mediator.Send(new EnsureWalletCommand());
            return r.IsSuccess ? Results.Ok(new { walletId = r.Value }) : Results.BadRequest(r.Error);
        }).RequireAuthorization();

        // ── Balance ───────────────────────────────────────────────────────
        g.MapGet("/balance", async (IMediator mediator) =>
        {
            var r = await mediator.Send(new GetWalletBalanceQuery());
            return r.IsSuccess ? Results.Ok(r.Value) : Results.BadRequest(r.Error);
        }).RequireAuthorization();

        // ── Transaction history ───────────────────────────────────────────
        g.MapGet("/transactions", async (IMediator mediator, int page = 1, int pageSize = 30) =>
        {
            var r = await mediator.Send(new GetWalletTransactionsQuery(page, pageSize));
            return r.IsSuccess ? Results.Ok(r.Value) : Results.BadRequest(r.Error);
        }).RequireAuthorization();

        // ── Top-up: create Razorpay order ──────────────────────────────────
        g.MapPost("/topup/initiate", async (IMediator mediator, TopUpBody body) =>
        {
            var r = await mediator.Send(new InitiateTopUpCommand(body.AmountRupees));
            return r.IsSuccess ? Results.Ok(r.Value) : Results.BadRequest(r.Error);
        }).RequireAuthorization();

        // ── Top-up: verify Razorpay payment ───────────────────────────────
        g.MapPost("/topup/verify", async (IMediator mediator, VerifyTopUpCommand cmd) =>
        {
            var r = await mediator.Send(cmd);
            return r.IsSuccess ? Results.Ok() : Results.BadRequest(r.Error);
        }).RequireAuthorization();

        return g;
    }

    private sealed record TopUpBody(decimal AmountRupees);
}
