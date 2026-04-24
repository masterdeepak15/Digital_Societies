using MediatR;
using FluentValidation;
using DigitalSocieties.Shared.Results;
using DigitalSocieties.Shared.Domain.ValueObjects;
using DigitalSocieties.Billing.Domain.Entities;
using DigitalSocieties.Billing.Infrastructure.Persistence;
using Microsoft.EntityFrameworkCore;

namespace DigitalSocieties.Billing.Application.Commands;

// ── Command ─────────────────────────────────────────────────────────────────
/// <summary>
/// Generates maintenance bills for all active flats in a society for a given month.
/// Idempotent — skips flats that already have a bill for the period.
/// Triggered by: admin button, or scheduled job (1st of each month).
/// </summary>
public sealed record GenerateMonthlyBillsCommand(
    Guid    SocietyId,
    string  Period,         // "2026-05"
    decimal AmountPerFlat,
    string  Description,
    DateOnly DueDate
) : IRequest<Result<GenerateMonthlyBillsResponse>>;

public sealed record GenerateMonthlyBillsResponse(
    int BillsCreated, int BillsSkipped, string Period);

// ── Validator ───────────────────────────────────────────────────────────────
public sealed class GenerateMonthlyBillsCommandValidator : AbstractValidator<GenerateMonthlyBillsCommand>
{
    public GenerateMonthlyBillsCommandValidator()
    {
        RuleFor(x => x.SocietyId).NotEmpty();
        RuleFor(x => x.Period)
            .NotEmpty()
            .Matches(@"^\d{4}-\d{2}$").WithMessage("Period must be in YYYY-MM format (e.g. 2026-05).");
        RuleFor(x => x.AmountPerFlat)
            .GreaterThan(0).WithMessage("Amount must be greater than 0.")
            .LessThanOrEqualTo(1_000_000).WithMessage("Amount exceeds maximum allowed.");
        RuleFor(x => x.Description).NotEmpty().MaximumLength(500);
        RuleFor(x => x.DueDate)
            .Must(d => d >= DateOnly.FromDateTime(DateTime.Today))
            .WithMessage("Due date cannot be in the past.");
    }
}

// ── Handler ─────────────────────────────────────────────────────────────────
public sealed class GenerateMonthlyBillsCommandHandler
    : IRequestHandler<GenerateMonthlyBillsCommand, Result<GenerateMonthlyBillsResponse>>
{
    private readonly BillingDbContext _db;
    private readonly IFlatQueryService _flatQuery;

    public GenerateMonthlyBillsCommandHandler(BillingDbContext db, IFlatQueryService flatQuery)
    {
        _db        = db;
        _flatQuery = flatQuery;
    }

    public async Task<Result<GenerateMonthlyBillsResponse>> Handle(
        GenerateMonthlyBillsCommand cmd, CancellationToken ct)
    {
        // Get all active flat IDs for this society (cross-module via service interface)
        var flatIds = await _flatQuery.GetActiveFlatIdsAsync(cmd.SocietyId, ct);
        if (flatIds.Count == 0)
            return Result<GenerateMonthlyBillsResponse>.Fail("BILLING.NO_FLATS",
                "No active flats found for this society.");

        // Check which flats already have a bill this period (idempotency)
        var existing = await _db.Bills
            .Where(b => b.SocietyId == cmd.SocietyId && b.Period == cmd.Period)
            .Select(b => b.FlatId)
            .ToListAsync(ct);

        var toCreate = flatIds.Except(existing).ToList();

        var amountResult = Money.CreateInr(cmd.AmountPerFlat);
        if (amountResult.IsFailure)
            return Result<GenerateMonthlyBillsResponse>.Fail(amountResult.Error!);

        // Create bills in batch
        var bills = toCreate.Select(flatId =>
            Bill.Create(cmd.SocietyId, flatId, cmd.Period,
                        amountResult.Value!, cmd.DueDate, cmd.Description)).ToList();

        _db.Bills.AddRange(bills);
        await _db.SaveChangesAsync(ct);

        return Result<GenerateMonthlyBillsResponse>.Ok(
            new GenerateMonthlyBillsResponse(toCreate.Count, existing.Count, cmd.Period));
    }
}

// Cross-module query interface (DIP — billing never imports Identity project directly)
public interface IFlatQueryService
{
    Task<List<Guid>> GetActiveFlatIdsAsync(Guid societyId, CancellationToken ct);
}
