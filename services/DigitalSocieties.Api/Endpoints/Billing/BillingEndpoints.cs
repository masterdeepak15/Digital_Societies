using MediatR;
using DigitalSocieties.Billing.Application.Commands;
using DigitalSocieties.Billing.Application.Queries;
using DigitalSocieties.Shared.Contracts;
using Microsoft.AspNetCore.Mvc;

namespace DigitalSocieties.Api.Endpoints.Billing;

/// <summary>
/// Billing endpoints — ISP: minimal surface, each route does one thing.
/// All amounts are in paise (integer) to avoid floating-point money bugs.
/// </summary>
public static class BillingEndpoints
{
    public static RouteGroupBuilder MapBillingEndpoints(this RouteGroupBuilder group)
    {
        // ── Admin: generate monthly bills for entire society ──────────────────
        // POST /api/v1/billing/generate
        // Body: { "societyId": "...", "periodYear": 2026, "periodMonth": 4, "amountPaise": 150000 }
        group.MapPost("/generate", async (
            GenerateMonthlyBillsCommand cmd,
            IMediator mediator,
            CancellationToken ct) =>
        {
            var result = await mediator.Send(cmd, ct);
            return result.IsSuccess
                ? Results.Ok(new { generated = result.Value })
                : Results.BadRequest(result.Error);
        })
        .RequireAuthorization("AdminOnly")
        .WithName("GenerateMonthlyBills")
        .WithSummary("Generate monthly maintenance bills for all flats in a society")
        .WithTags("Billing");

        // ── Admin: get society-wide billing summary ────────────────────────────
        // GET /api/v1/billing/summary?societyId=...&year=2026&month=4
        group.MapGet("/summary", async (
            [FromQuery] Guid societyId,
            [FromQuery] int year,
            [FromQuery] int month,
            IMediator mediator,
            CancellationToken ct) =>
        {
            var query = new GetSocietyBillSummaryQuery(societyId, $"{year}-{month:D2}");
            var result = await mediator.Send(query, ct);
            return result.IsSuccess
                ? Results.Ok(result.Value)
                : Results.NotFound(result.Error);
        })
        .RequireAuthorization("AdminOnly")
        .WithName("GetSocietyBillSummary")
        .WithSummary("Get paid/pending/overdue summary + defaulters list for a billing period")
        .WithTags("Billing");

        // ── Resident: list my flat's bills (paginated) ────────────────────────
        // GET /api/v1/billing/my?page=1&pageSize=20
        group.MapGet("/my", async (
            [FromQuery] int page,
            [FromQuery] int pageSize,
            IMediator mediator,
            ICurrentUser currentUser,
            CancellationToken ct) =>
        {
            if (currentUser.FlatId is null)
                return Results.BadRequest("No flat associated with your account.");

            var query = new GetFlatBillsQuery(currentUser.FlatId.Value, page, pageSize);
            var result = await mediator.Send(query, ct);
            return result.IsSuccess
                ? Results.Ok(result.Value)
                : Results.BadRequest(result.Error);
        })
        .RequireAuthorization("ResidentOrAdmin")
        .WithName("GetMyBills")
        .WithSummary("Get paginated list of bills for the authenticated resident's flat")
        .WithTags("Billing");

        // ── Resident: initiate payment for a bill ─────────────────────────────
        // POST /api/v1/billing/{billId}/pay
        // Returns Razorpay order details to open checkout sheet on mobile
        group.MapPost("/{billId:guid}/pay", async (
            Guid billId,
            IMediator mediator,
            ICurrentUser currentUser,
            CancellationToken ct) =>
        {
            var cmd = new InitiatePaymentCommand(billId);
            var result = await mediator.Send(cmd, ct);
            return result.IsSuccess
                ? Results.Ok(result.Value)
                : Results.BadRequest(result.Error);
        })
        .RequireAuthorization("ResidentOrAdmin")
        .WithName("InitiatePayment")
        .WithSummary("Create a Razorpay order for the given bill and return checkout details")
        .WithTags("Billing");

        // ── Webhook: Razorpay payment verification ────────────────────────────
        // POST /api/v1/billing/webhook/razorpay
        // Called by Razorpay with HMAC-signed payload — no JWT auth (verified by HMAC)
        group.MapPost("/webhook/razorpay", async (
            HttpRequest request,
            IMediator mediator,
            CancellationToken ct) =>
        {
            // Read raw body for HMAC verification (must not be parsed as JSON first)
            using var reader = new StreamReader(request.Body);
            var rawBody = await reader.ReadToEndAsync(ct);

            var signature = request.Headers["X-Razorpay-Signature"].ToString();

            // Parse payment IDs from Razorpay webhook payload
            string gatewayPaymentId = "", gatewayOrderId = "";
            try
            {
                using var doc = System.Text.Json.JsonDocument.Parse(rawBody);
                var entity = doc.RootElement
                    .GetProperty("payload").GetProperty("payment").GetProperty("entity");
                gatewayPaymentId = entity.GetProperty("id").GetString() ?? "";
                gatewayOrderId   = entity.GetProperty("order_id").GetString() ?? "";
            }
            catch { /* Malformed payload — handler will fail HMAC and return error */ }

            var cmd = new VerifyPaymentWebhookCommand(rawBody, signature, gatewayPaymentId, gatewayOrderId);
            var result = await mediator.Send(cmd, ct);

            // Always return 200 to Razorpay — they retry on non-200 (idempotent handler)
            return result.IsSuccess ? Results.Ok() : Results.Ok(new { warning = result.Error?.Message });
        })
        .AllowAnonymous()
        .WithName("RazorpayWebhook")
        .WithSummary("Razorpay webhook endpoint — verifies HMAC signature and marks bill as paid")
        .WithTags("Billing");

        return group;
    }
}
