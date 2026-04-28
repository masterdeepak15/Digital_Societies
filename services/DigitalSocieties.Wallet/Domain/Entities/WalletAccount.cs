using DigitalSocieties.Shared.Domain.Entities;
using DigitalSocieties.Shared.Domain.ValueObjects;
using DigitalSocieties.Shared.Results;

namespace DigitalSocieties.Wallet.Domain.Entities;

/// <summary>
/// Pre-paid wallet per resident flat.  One account per (society, flat) pair.
/// Aggregate root — all balance mutations go through this entity.
/// </summary>
public sealed class WalletAccount : AuditableEntity
{
    public new Guid Id      { get; private set; } = Guid.NewGuid();
    public Guid   SocietyId { get; private set; }
    public Guid   FlatId    { get; private set; }
    public Guid   OwnerId   { get; private set; }

    /// <summary>Current confirmed balance in paise to avoid decimal rounding issues.</summary>
    public long   BalancePaise { get; private set; }

    /// <summary>Convenience: balance as Money (read-only projection).</summary>
    public Money Balance => Money.CreateInr(BalancePaise / 100m).Value!;

    public bool   IsActive  { get; private set; } = true;

    public IReadOnlyCollection<WalletTransaction> Transactions => _txns.AsReadOnly();
    private readonly List<WalletTransaction> _txns = [];

    private WalletAccount() { }

    public static WalletAccount Create(Guid societyId, Guid flatId, Guid ownerId) =>
        new() { SocietyId = societyId, FlatId = flatId, OwnerId = ownerId };

    // ── Mutations (all guard against negative balance) ─────────────────────
    public Result Credit(long paise, WalletTxnType type, string description, string? refId = null)
    {
        if (paise <= 0)
            return Result.Fail("WALLET.INVALID_AMOUNT", "Credit amount must be positive.");

        BalancePaise += paise;
        _txns.Add(WalletTransaction.Create(Id, SocietyId, paise, WalletDirection.Credit,
                                           type, description, BalancePaise, refId));
        return Result.Ok();
    }

    public Result Debit(long paise, WalletTxnType type, string description, string? refId = null)
    {
        if (paise <= 0)
            return Result.Fail("WALLET.INVALID_AMOUNT", "Debit amount must be positive.");

        if (BalancePaise < paise)
            return Result.Fail("WALLET.INSUFFICIENT_FUNDS",
                $"Insufficient balance. Available: ₹{BalancePaise / 100m:N2}");

        BalancePaise -= paise;
        _txns.Add(WalletTransaction.Create(Id, SocietyId, paise, WalletDirection.Debit,
                                           type, description, BalancePaise, refId));
        return Result.Ok();
    }
}

public sealed class WalletTransaction : AuditableEntity
{
    public new Guid        Id            { get; private set; } = Guid.NewGuid();
    public Guid            WalletId      { get; private set; }
    public Guid            SocietyId     { get; private set; }
    public long            AmountPaise   { get; private set; }
    public WalletDirection Direction     { get; private set; }
    public WalletTxnType   Type          { get; private set; }
    public string          Description   { get; private set; } = string.Empty;
    public long            BalanceAfterPaise { get; private set; }

    /// <summary>Razorpay order/payment ID, booking ID, bill ID, etc.</summary>
    public string?         ReferenceId   { get; private set; }
    public DateTimeOffset  CreatedAt2    { get; private set; } = DateTimeOffset.UtcNow;

    private WalletTransaction() { }

    internal static WalletTransaction Create(
        Guid walletId, Guid societyId, long paise,
        WalletDirection direction, WalletTxnType type,
        string description, long balanceAfter, string? refId)
    => new()
    {
        WalletId          = walletId,
        SocietyId         = societyId,
        AmountPaise       = paise,
        Direction         = direction,
        Type              = type,
        Description       = description,
        BalanceAfterPaise = balanceAfter,
        ReferenceId       = refId,
    };
}

public enum WalletDirection { Credit, Debit }
public enum WalletTxnType   { TopUp, BillPayment, ServiceBooking, FacilityBooking, Refund, Cashback, Adjustment }
