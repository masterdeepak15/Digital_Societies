using MediatR;
using FluentValidation;
using DigitalSocieties.Shared.Contracts;
using DigitalSocieties.Shared.Domain.ValueObjects;
using DigitalSocieties.Shared.Results;
using DigitalSocieties.Accounting.Domain.Entities;
using DigitalSocieties.Accounting.Infrastructure.Persistence;

namespace DigitalSocieties.Accounting.Application.Commands;

// ── Command ────────────────────────────────────────────────────────────────
public sealed record PostLedgerEntryCommand(
    string   Type,         // "Income" | "Expense"
    string   Category,
    string   Description,
    long     AmountPaise,
    DateOnly EntryDate,
    string?  ReceiptUrl
) : IRequest<Result<Guid>>;

// ── Validator ──────────────────────────────────────────────────────────────
public sealed class PostLedgerEntryValidator : AbstractValidator<PostLedgerEntryCommand>
{
    public PostLedgerEntryValidator()
    {
        RuleFor(x => x.Type).Must(t => t is "Income" or "Expense")
            .WithMessage("Type must be Income or Expense.");
        RuleFor(x => x.Category).NotEmpty().MaximumLength(100);
        RuleFor(x => x.Description).NotEmpty().MaximumLength(500);
        RuleFor(x => x.AmountPaise).GreaterThan(0)
            .WithMessage("Amount must be positive.");
    }
}

// ── Handler ────────────────────────────────────────────────────────────────
public sealed class PostLedgerEntryHandler : IRequestHandler<PostLedgerEntryCommand, Result<Guid>>
{
    private readonly AccountingDbContext _db;
    private readonly ICurrentUser        _currentUser;

    public PostLedgerEntryHandler(AccountingDbContext db, ICurrentUser currentUser)
    {
        _db          = db;
        _currentUser = currentUser;
    }

    public async Task<Result<Guid>> Handle(PostLedgerEntryCommand cmd, CancellationToken ct)
    {
        var type   = Enum.Parse<EntryType>(cmd.Type);
        var amount = Money.FromPaise(cmd.AmountPaise);

        var entry = LedgerEntry.Create(
            _currentUser.SocietyId, type, cmd.Category,
            cmd.Description, amount, cmd.EntryDate, _currentUser.UserId);

        if (cmd.ReceiptUrl is not null)
            entry.AttachReceipt(cmd.ReceiptUrl);

        _db.LedgerEntries.Add(entry);
        await _db.SaveChangesAsync(ct);

        return Result<Guid>.Ok(entry.Id);
    }
}
