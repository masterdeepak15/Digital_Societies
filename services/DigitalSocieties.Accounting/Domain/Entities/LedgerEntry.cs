using DigitalSocieties.Shared.Domain.Entities;
using DigitalSocieties.Shared.Domain.ValueObjects;
using DigitalSocieties.Accounting.Domain.Events;

namespace DigitalSocieties.Accounting.Domain.Entities;

/// <summary>
/// A single credit or debit in the society ledger.
/// SRP: entry only knows its own state and approval lifecycle.
/// </summary>
public sealed class LedgerEntry : AuditableEntity
{
    private LedgerEntry() { }

    private LedgerEntry(Guid id, Guid societyId, EntryType type, string category,
        string description, Money amount, DateOnly entryDate, Guid postedBy)
        : base(id)
    {
        SocietyId   = societyId;
        Type        = type;
        Category    = category;
        Description = description;
        Amount      = amount;
        EntryDate   = entryDate;
        PostedBy    = postedBy;
        Status      = RequiresApproval(type, amount)
                      ? ApprovalStatus.PendingApproval
                      : ApprovalStatus.Approved;   // income + small expenses auto-approved
    }

    public Guid          SocietyId       { get; private set; }
    public EntryType     Type            { get; private set; }  // Income | Expense
    public string        Category        { get; private set; } = default!;
    public string        Description     { get; private set; } = default!;
    public Money         Amount          { get; private set; } = default!;
    public DateOnly      EntryDate       { get; private set; }
    public Guid          PostedBy        { get; private set; }  // user_id
    public ApprovalStatus Status         { get; private set; }
    public Guid?         ApprovedBy      { get; private set; }
    public DateTimeOffset? ApprovedAt    { get; private set; }
    public string?       RejectionReason { get; private set; }
    public string?       ReceiptUrl      { get; private set; }  // MinIO pre-signed ref

    /// <summary>Expenses above ₹10,000 wait for approval; everything else is approved at once.</summary>
    public static bool RequiresApproval(EntryType type, Money amount)
        => type == EntryType.Expense && amount.Paise > 1_000_000;

    // ── Factory ────────────────────────────────────────────────────────────
    public static LedgerEntry Create(Guid societyId, EntryType type, string category,
        string description, Money amount, DateOnly entryDate, Guid postedBy)
    {
        var entry = new LedgerEntry(Guid.NewGuid(), societyId, type, category,
                                    description, amount, entryDate, postedBy);
        entry.Raise(new LedgerEntryPostedEvent(entry.Id, societyId, type.ToString(),
                                               category, amount.Paise));
        return entry;
    }

    // ── Approval lifecycle ─────────────────────────────────────────────────
    public void Approve(Guid approvedBy)
    {
        if (Status != ApprovalStatus.PendingApproval)
            throw new InvalidOperationException("Entry is not pending approval.");
        Status     = ApprovalStatus.Approved;
        ApprovedBy = approvedBy;
        ApprovedAt = DateTimeOffset.UtcNow;
        Raise(new LedgerEntryApprovedEvent(Id, SocietyId, approvedBy, Amount.Paise));
    }

    public void Reject(Guid rejectedBy, string reason)
    {
        if (Status != ApprovalStatus.PendingApproval)
            throw new InvalidOperationException("Entry is not pending approval.");
        Status          = ApprovalStatus.Rejected;
        ApprovedBy      = rejectedBy;
        ApprovedAt      = DateTimeOffset.UtcNow;
        RejectionReason = reason;
        Raise(new LedgerEntryRejectedEvent(Id, SocietyId, rejectedBy, reason));
    }

    /// <summary>Takes back an approval or rejection so the expense can be decided again.</summary>
    public void Reopen()
    {
        if (Type != EntryType.Expense)
            throw new InvalidOperationException("Only expenses go through approval.");
        if (Status == ApprovalStatus.PendingApproval)
            throw new InvalidOperationException("Entry is already waiting for approval.");
        Status          = ApprovalStatus.PendingApproval;
        ApprovedBy      = null;
        ApprovedAt      = null;
        RejectionReason = null;
    }

    /// <summary>
    /// Corrects the entry. A changed amount, or a rejected entry being fixed, goes back through the normal
    /// approval rule (so a bigger expense cannot slip past approval by being edited after the fact).
    /// </summary>
    public void Edit(string category, string description, Money amount, DateOnly entryDate)
    {
        var amountChanged = amount.Paise != Amount.Paise;
        Category    = category;
        Description = description;
        Amount      = amount;
        EntryDate   = entryDate;

        if (amountChanged || Status == ApprovalStatus.Rejected)
        {
            Status          = RequiresApproval(Type, amount) ? ApprovalStatus.PendingApproval : ApprovalStatus.Approved;
            ApprovedBy      = null;
            ApprovedAt      = null;
            RejectionReason = null;
        }
    }

    public void AttachReceipt(string url) => ReceiptUrl = url;
}

public enum EntryType     { Income, Expense }
public enum ApprovalStatus { Approved, PendingApproval, Rejected }
