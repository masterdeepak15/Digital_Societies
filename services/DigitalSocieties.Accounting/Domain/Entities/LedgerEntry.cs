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
        Status      = type == EntryType.Expense && amount.Paise > 1_000_000  // >₹10,000
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

    public void AttachReceipt(string url) => ReceiptUrl = url;
}

public enum EntryType     { Income, Expense }
public enum ApprovalStatus { Approved, PendingApproval, Rejected }
