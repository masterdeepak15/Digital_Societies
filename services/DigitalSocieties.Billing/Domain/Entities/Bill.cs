using DigitalSocieties.Shared.Domain.Entities;
using DigitalSocieties.Shared.Domain.ValueObjects;
using DigitalSocieties.Billing.Domain.Events;

namespace DigitalSocieties.Billing.Domain.Entities;

/// <summary>
/// Aggregate root for a maintenance bill.
/// SRP: bill knows its own state transitions only.
/// All amounts in Money value object (paise) — zero float-point errors.
/// </summary>
public sealed class Bill : AuditableEntity
{
    private Bill() { }

    private Bill(Guid id, Guid societyId, Guid flatId, string period,
                 Money amount, DateOnly dueDate, string description)
        : base(id)
    {
        SocietyId   = societyId;
        FlatId      = flatId;
        Period      = period;
        Amount      = amount;
        LateFee     = Money.Zero;
        DueDate     = dueDate;
        Description = description;
        Status      = BillStatus.Pending;
    }

    public Guid       SocietyId   { get; private set; }
    public Guid       FlatId      { get; private set; }
    public string     Period      { get; private set; } = default!; // "2026-05"
    public Money      Amount      { get; private set; } = default!;
    public Money      LateFee     { get; private set; } = default!;
    public Money      TotalDue    => Amount.Add(LateFee);
    public DateOnly   DueDate     { get; private set; }
    public string     Description { get; private set; } = default!;
    public BillStatus Status      { get; private set; }
    public DateTimeOffset? PaidAt { get; private set; }
    public string?    PaymentId   { get; private set; } // Razorpay payment ID

    private readonly List<Payment> _payments = [];
    public IReadOnlyList<Payment> Payments => _payments.AsReadOnly();

    // ── Factory ────────────────────────────────────────────────────────────
    public static Bill Create(Guid societyId, Guid flatId, string period,
                              Money amount, DateOnly dueDate, string description)
    {
        var bill = new Bill(Guid.NewGuid(), societyId, flatId, period, amount, dueDate, description);
        bill.Raise(new BillCreatedEvent(bill.Id, societyId, flatId, period, amount.Paise));
        return bill;
    }

    // ── State transitions ───────────────────────────────────────────────────
    public void ApplyLateFee(Money fee)
    {
        if (Status != BillStatus.Pending && Status != BillStatus.Overdue)
            return;
        LateFee = fee;
        Status  = BillStatus.Overdue;
        Raise(new BillOverdueEvent(Id, SocietyId, FlatId, fee.Paise));
    }

    public Payment InitiatePayment(string gateway)
    {
        if (Status == BillStatus.Paid)
            throw new InvalidOperationException("Bill is already paid.");

        var payment = Payment.Create(Id, SocietyId, FlatId, TotalDue, gateway);
        _payments.Add(payment);
        Raise(new PaymentInitiatedEvent(Id, payment.Id, gateway));
        return payment;
    }

    public void MarkPaid(string paymentId, DateTimeOffset paidAt)
    {
        Status    = BillStatus.Paid;
        PaymentId = paymentId;
        PaidAt    = paidAt;
        // Mark matching payment
        var p = _payments.FirstOrDefault(p => p.GatewayPaymentId == paymentId);
        p?.Complete(paidAt);
        Raise(new BillPaidEvent(Id, SocietyId, FlatId, paymentId, TotalDue.Paise));
    }

    public void Waive(string reason)
    {
        Status = BillStatus.Waived;
        Raise(new BillWaivedEvent(Id, SocietyId, FlatId, reason));
    }
}

public enum BillStatus { Pending, Paid, Overdue, Waived, Cancelled }
