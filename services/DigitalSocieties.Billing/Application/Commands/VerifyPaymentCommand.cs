using MediatR;
using DigitalSocieties.Shared.Results;
using DigitalSocieties.Shared.Contracts;
using DigitalSocieties.Billing.Infrastructure.Persistence;
using Microsoft.EntityFrameworkCore;

namespace DigitalSocieties.Billing.Application.Commands;

// ── Command ─────────────────────────────────────────────────────────────────
/// <summary>
/// Called by the Razorpay webhook on payment completion.
/// Security: HMAC signature verified before handler runs.
/// Idempotent: second call with same payment_id is a no-op.
/// </summary>
public sealed record VerifyPaymentWebhookCommand(
    string Payload,
    string Signature,
    string GatewayPaymentId,
    string GatewayOrderId
) : IRequest<Result>;

// ── Handler ─────────────────────────────────────────────────────────────────
public sealed class VerifyPaymentWebhookCommandHandler
    : IRequestHandler<VerifyPaymentWebhookCommand, Result>
{
    private readonly BillingDbContext _db;
    private readonly IPaymentProvider _payment;
    private readonly INotificationChannel _smsChannel;

    public VerifyPaymentWebhookCommandHandler(
        BillingDbContext db,
        IEnumerable<IPaymentProvider> providers,
        IEnumerable<INotificationChannel> channels)
    {
        _db         = db;
        _payment    = providers.First(p => p.ProviderName == "razorpay");
        _smsChannel = channels.First(c => c.ChannelName == "sms");
    }

    public async Task<Result> Handle(VerifyPaymentWebhookCommand cmd, CancellationToken ct)
    {
        // 1. Verify HMAC signature (security — reject spoofed webhooks)
        var verify = await _payment.VerifyWebhookAsync(cmd.Payload, cmd.Signature, ct);
        if (!verify.IsValid)
            return Result.Fail("WEBHOOK.INVALID_SIGNATURE", "Webhook signature verification failed.");

        // 2. Find the bill via payment order
        var bill = await _db.Bills
            .Include(b => b.Payments)
            .FirstOrDefaultAsync(b => b.Payments.Any(p => p.GatewayOrderId == cmd.GatewayOrderId), ct);

        if (bill is null)
            return Result.Fail("WEBHOOK.BILL_NOT_FOUND", "No bill found for this order.");

        // 3. Idempotency — already marked paid
        if (bill.Status == Domain.Entities.BillStatus.Paid)
            return Result.Ok();

        // 4. Mark bill paid
        bill.MarkPaid(cmd.GatewayPaymentId, DateTimeOffset.UtcNow);
        await _db.SaveChangesAsync(ct);

        // 5. Send confirmation SMS (fire-and-forget — don't fail the webhook on SMS error)
        _ = _smsChannel.SendAsync(new NotificationMessage(
            Recipient:  "",  // resolved from flat owner — simplified here
            Subject:    "Payment Confirmed",
            Body:       $"✅ Your maintenance payment of ₹{bill.TotalDue.Amount:F0} for {bill.Period} is confirmed. Receipt: {cmd.GatewayPaymentId}",
            TemplateId: "payment_success"
        ), ct);

        return Result.Ok();
    }
}
