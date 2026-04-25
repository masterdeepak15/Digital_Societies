using MediatR;
using Microsoft.EntityFrameworkCore;
using DigitalSocieties.Shared.Contracts;
using DigitalSocieties.Shared.Results;
using DigitalSocieties.Accounting.Infrastructure.Persistence;

namespace DigitalSocieties.Accounting.Application.Commands;

// ── Approve ────────────────────────────────────────────────────────────────
public sealed record ApproveLedgerEntryCommand(Guid EntryId) : IRequest<Result>;

public sealed class ApproveLedgerEntryHandler : IRequestHandler<ApproveLedgerEntryCommand, Result>
{
    private readonly AccountingDbContext _db;
    private readonly ICurrentUser        _currentUser;

    public ApproveLedgerEntryHandler(AccountingDbContext db, ICurrentUser currentUser)
        => (_db, _currentUser) = (db, currentUser);

    public async Task<Result> Handle(ApproveLedgerEntryCommand cmd, CancellationToken ct)
    {
        var entry = await _db.LedgerEntries
            .Where(e => e.Id == cmd.EntryId && e.SocietyId == _currentUser.SocietyId)
            .FirstOrDefaultAsync(ct);

        if (entry is null) return Result.Fail("Entry not found.");

        entry.Approve(_currentUser.UserId);
        await _db.SaveChangesAsync(ct);
        return Result.Ok();
    }
}

// ── Reject ─────────────────────────────────────────────────────────────────
public sealed record RejectLedgerEntryCommand(Guid EntryId, string Reason) : IRequest<Result>;

public sealed class RejectLedgerEntryHandler : IRequestHandler<RejectLedgerEntryCommand, Result>
{
    private readonly AccountingDbContext _db;
    private readonly ICurrentUser        _currentUser;

    public RejectLedgerEntryHandler(AccountingDbContext db, ICurrentUser currentUser)
        => (_db, _currentUser) = (db, currentUser);

    public async Task<Result> Handle(RejectLedgerEntryCommand cmd, CancellationToken ct)
    {
        var entry = await _db.LedgerEntries
            .Where(e => e.Id == cmd.EntryId && e.SocietyId == _currentUser.SocietyId)
            .FirstOrDefaultAsync(ct);

        if (entry is null) return Result.Fail("Entry not found.");

        entry.Reject(_currentUser.UserId, cmd.Reason);
        await _db.SaveChangesAsync(ct);
        return Result.Ok();
    }
}
