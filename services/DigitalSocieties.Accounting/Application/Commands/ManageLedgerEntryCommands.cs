using MediatR;
using FluentValidation;
using Microsoft.EntityFrameworkCore;
using DigitalSocieties.Shared.Contracts;
using DigitalSocieties.Shared.Domain.ValueObjects;
using DigitalSocieties.Shared.Results;
using DigitalSocieties.Accounting.Domain.Entities;
using DigitalSocieties.Accounting.Infrastructure.Persistence;

namespace DigitalSocieties.Accounting.Application.Commands;

// All three actions are for the management only: the accountant records and approves, the admin can correct.

// ── Correct an entry ───────────────────────────────────────────────────────
public sealed record EditLedgerEntryCommand(
    Guid     EntryId,
    string   Category,
    string   Description,
    long     AmountPaise,
    DateOnly EntryDate) : IRequest<Result>;

public sealed class EditLedgerEntryValidator : AbstractValidator<EditLedgerEntryCommand>
{
    public EditLedgerEntryValidator()
    {
        RuleFor(x => x.Category).NotEmpty().MaximumLength(100);
        RuleFor(x => x.Description).NotEmpty().MaximumLength(500);
        RuleFor(x => x.AmountPaise).GreaterThan(0).WithMessage("Amount must be positive.");
    }
}

public sealed class EditLedgerEntryHandler : IRequestHandler<EditLedgerEntryCommand, Result>
{
    private readonly AccountingDbContext _db;
    private readonly ICurrentUser        _cu;
    public EditLedgerEntryHandler(AccountingDbContext db, ICurrentUser cu) => (_db, _cu) = (db, cu);

    public async Task<Result> Handle(EditLedgerEntryCommand cmd, CancellationToken ct)
    {
        if (_cu.SocietyId is not { } societyId) return Result.Fail("AUTH.REQUIRED", "Authentication context is required.");
        if (!_cu.IsInRole("admin")) return Result.Fail("FORBIDDEN", "Only the management can change ledger entries.");

        var entry = await _db.LedgerEntries.FirstOrDefaultAsync(e => e.Id == cmd.EntryId && e.SocietyId == societyId && !e.IsDeleted, ct);
        if (entry is null) return Result.Fail("ENTRY.NOT_FOUND", "Ledger entry not found.");

        var money = Money.CreateInr(cmd.AmountPaise / 100m);
        if (money.IsFailure) return Result.Fail(money.Error!);

        entry.Edit(cmd.Category.Trim(), cmd.Description.Trim(), money.Value!, cmd.EntryDate);
        await _db.SaveChangesAsync(ct);
        return Result.Ok();
    }
}

// ── Take back an approval or rejection ─────────────────────────────────────
public sealed record ReopenLedgerEntryCommand(Guid EntryId) : IRequest<Result>;

public sealed class ReopenLedgerEntryHandler : IRequestHandler<ReopenLedgerEntryCommand, Result>
{
    private readonly AccountingDbContext _db;
    private readonly ICurrentUser        _cu;
    public ReopenLedgerEntryHandler(AccountingDbContext db, ICurrentUser cu) => (_db, _cu) = (db, cu);

    public async Task<Result> Handle(ReopenLedgerEntryCommand cmd, CancellationToken ct)
    {
        if (_cu.SocietyId is not { } societyId) return Result.Fail("AUTH.REQUIRED", "Authentication context is required.");
        if (!_cu.IsInRole("admin")) return Result.Fail("FORBIDDEN", "Only the management can reopen an entry.");

        var entry = await _db.LedgerEntries.FirstOrDefaultAsync(e => e.Id == cmd.EntryId && e.SocietyId == societyId && !e.IsDeleted, ct);
        if (entry is null) return Result.Fail("ENTRY.NOT_FOUND", "Ledger entry not found.");
        if (entry.Type != EntryType.Expense) return Result.Fail("ENTRY.NOT_EXPENSE", "Only expenses go through approval. Edit or delete this entry instead.");
        if (entry.Status == ApprovalStatus.PendingApproval) return Result.Fail("ENTRY.ALREADY_PENDING", "This entry is already waiting for approval.");

        entry.Reopen();
        await _db.SaveChangesAsync(ct);
        return Result.Ok();
    }
}

// ── Delete an entry ────────────────────────────────────────────────────────
// The row stays in the database (marked deleted) so the books keep an audit trail; it disappears from the ledger,
// the totals and the reports.
public sealed record DeleteLedgerEntryCommand(Guid EntryId) : IRequest<Result>;

public sealed class DeleteLedgerEntryHandler : IRequestHandler<DeleteLedgerEntryCommand, Result>
{
    private readonly AccountingDbContext _db;
    private readonly ICurrentUser        _cu;
    public DeleteLedgerEntryHandler(AccountingDbContext db, ICurrentUser cu) => (_db, _cu) = (db, cu);

    public async Task<Result> Handle(DeleteLedgerEntryCommand cmd, CancellationToken ct)
    {
        if (_cu.SocietyId is not { } societyId) return Result.Fail("AUTH.REQUIRED", "Authentication context is required.");
        if (!_cu.IsInRole("admin")) return Result.Fail("FORBIDDEN", "Only the management can delete ledger entries.");

        var entry = await _db.LedgerEntries.FirstOrDefaultAsync(e => e.Id == cmd.EntryId && e.SocietyId == societyId && !e.IsDeleted, ct);
        if (entry is null) return Result.Fail("ENTRY.NOT_FOUND", "Ledger entry not found.");

        entry.SoftDelete();
        await _db.SaveChangesAsync(ct);
        return Result.Ok();
    }
}
