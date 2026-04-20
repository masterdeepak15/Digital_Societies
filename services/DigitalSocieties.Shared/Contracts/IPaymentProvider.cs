namespace DigitalSocieties.Shared.Contracts;

/// <summary>
/// OCP: new gateways (Razorpay, Cashfree, UPI direct) added by implementing this.
/// Swapped per deployment config (DIP — app never imports Razorpay SDK directly).
/// </summary>
public interface IPaymentProvider
{
    string ProviderName { get; }
    Task<PaymentOrderResult>   CreateOrderAsync(CreateOrderRequest request, CancellationToken ct = default);
    Task<PaymentVerifyResult>  VerifyWebhookAsync(string payload, string signature, CancellationToken ct = default);
    Task<RefundResult>         RefundAsync(RefundRequest request, CancellationToken ct = default);
}

public sealed record CreateOrderRequest(
    decimal Amount, string Currency, string ReceiptId,
    Guid SocietyId, Guid FlatId, Dictionary<string, string>? Notes = null);

public sealed record PaymentOrderResult(
    bool Success, string? OrderId, string? PaymentUrl, string? Error = null);

public sealed record PaymentVerifyResult(
    bool IsValid, string? PaymentId, string? OrderId,
    decimal? AmountPaid, string? Status);

public sealed record RefundRequest(string PaymentId, decimal Amount, string Reason);
public sealed record RefundResult(bool Success, string? RefundId, string? Error = null);
