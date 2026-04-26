using MediatR;
using FluentValidation;
using DigitalSocieties.Shared.Results;
using DigitalSocieties.Shared.Contracts;
using DigitalSocieties.Billing.Infrastructure.Persistence;
using Microsoft.EntityFrameworkCore;

namespace DigitalSocieties.Billing.Application.Commands;

// ── Command ─────────────────────────────────────────────────────────────────
/// <summary>
/// Creates a Razorpay order for a bill and returns the payment URL/order ID.
/// The mobile app uses this to open the Razorpay checkout sheet.
/// </summary>
public sealed record InitiatePaymentCommand(Guid BillId) : IRequest<Result<PaymentInitiatedResponse>>;

public sealed record PaymentInitiatedResponse(
    string OrderId, string? PaymentUrl, long AmountPaise, string Currency, string Key);

public sealed class InitiatePaymentCommandValidator : AbstractValidator<InitiatePaymentCommand>
{
    public InitiatePaymentCommandValidator() => RuleFor(x => x.BillId).NotEmpty();
}

// ── Handler ─────────────────────────────────────────────────────────────────
public sealed class InitiatePaymentCommandHandler
    : IRequestHandler<InitiatePaymentCommand, Result<PaymentInitiatedResponse>>
{
    private readonly BillingDbContext _db;
    private readonly IPaymentProvider _payment;
    private readonly ICurrentUser     _currentUser;

    // OCP: IPaymentProvider swapped via DI config (Razorpay → Cashfree without code change)
    public InitiatePaymentCommandHandler(
        BillingDbContext db,
        IEnumerable<IPaymentProvider> providers,
        ICurrentUser currentUser)
    {
        _db          = db;
        _payment     = providers.First(p => p.ProviderName == "razorpay");
        _currentUser = currentUser;
    }

    public async Task<Result<PaymentInitiatedResponse>> Handle(
        InitiatePaymentCommand cmd, CancellationToken ct)
    {
        var bill = await _db.Bills
            .Include(b => b.Payments)
            .FirstOrDefaultAsync(b => b.Id == cmd.BillId, ct);

        if (bill is null)
            return Result<PaymentInitiatedResponse>.Fail(Error.NotFound("Bill", cmd.BillId));

        if (bill.Status == Domain.Entities.BillStatus.Paid)
            return Result<PaymentInitiatedResponse>.Fail("BILL.ALREADY_PAID", "This bill has already been paid.");

        // Authorization: resident can only pay their own flat's bills
        if (_currentUser.FlatId.HasValue && bill.FlatId != _currentUser.FlatId)
            return Result<PaymentInitiatedResponse>.Fail(Error.Unauthorized("You can only pay bills for your flat."));

        var payment = bill.InitiatePayment("razorpay");

        var order = await _payment.CreateOrderAsync(new CreateOrderRequest(
            Amount:    bill.TotalDue.Amount,
            Currency:  "INR",
            ReceiptId: $"bill_{bill.Id}_{bill.Period}",
            SocietyId: bill.SocietyId,
            FlatId:    bill.FlatId,
            Notes:     new Dictionary<string, string>
            {
                ["period"]  = bill.Period,
                ["bill_id"] = bill.Id.ToString(),
            }
        ), ct);

        if (!order.Success)
            return Result<PaymentInitiatedResponse>.Fail("PAYMENT.ORDER_FAILED", order.Error ?? "Failed to create payment order.");

        payment.SetGatewayOrder(order.OrderId!);
        await _db.SaveChangesAsync(ct);

        return Result<PaymentInitiatedResponse>.Ok(new PaymentInitiatedResponse(
            order.OrderId!, order.PaymentUrl, bill.TotalDue.Paise, "INR", ""));
    }
}
