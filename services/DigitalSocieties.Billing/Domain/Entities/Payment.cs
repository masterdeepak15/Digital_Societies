using DigitalSocieties.Shared.Domain.Entities;
using DigitalSocieties.Shared.Domain.ValueObjects;

namespace DigitalSocieties.Billing.Domain.Entities;

/// <summary>
/// Tracks one payment attempt (one bill may have multiple attempts before success).
/// Immutable after creation — only state fields change. (SRP)
/// </summary>
public sealed class Payment : Entity
{
    private Payment() { }

    private Payment(Guid id, Guid billId, Guid societyId, Guid flatId, Money amount, string gateway)
        : base(id)
    {
        BillId       = billId;
        SocietyId    = societyId;
        FlatId       = flatId;
        Amount       = amount;
        Gateway      = gateway;
        Status       = PaymentStatus.Initiated;
        InitiatedAt  = DateTimeOffset.UtcNow;
    }

    public Guid    BillId            { get; private set; }
    public Guid    SocietyId         { get; private set; }
    public Guid    FlatId            { get; private set; }
    public Money   Amount            { get; private set; } = default!;
    public string  Gateway           { get; private set; } = default!; // razorpay / cashfree / wallet
    public string? GatewayOrderId    { get; private set; }
    public string? GatewayPaymentId  { get; private set; }
    public PaymentStatus Status      { get; private set; }
    public DateTimeOffset InitiatedAt  { get; private set; }
    public DateTimeOffset? CompletedAt { get; private set; }

    public static Payment Create(Guid billId, Guid societyId, Guid flatId, Money amount, string gateway)
        => new(Guid.NewGuid(), billId, societyId, flatId, amount, gateway);

    public void SetGatewayOrder(string orderId)   => GatewayOrderId   = orderId;
    public void SetGatewayPayment(string payId)   => GatewayPaymentId = payId;
    public void Complete(DateTimeOffset at)        { Status = PaymentStatus.Completed; CompletedAt = at; }
    public void Fail()                             => Status = PaymentStatus.Failed;
    public void Refund()                           => Status = PaymentStatus.Refunded;
}

public enum PaymentStatus { Initiated, Completed, Failed, Refunded }
