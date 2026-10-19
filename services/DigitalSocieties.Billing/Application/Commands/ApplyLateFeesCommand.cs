using MediatR;
using Microsoft.EntityFrameworkCore;
using DigitalSocieties.Shared.Contracts;
using DigitalSocieties.Shared.Domain.ValueObjects;
using DigitalSocieties.Shared.Results;
using DigitalSocieties.Billing.Domain.Entities;
using DigitalSocieties.Billing.Infrastructure.Persistence;

namespace DigitalSocieties.Billing.Application.Commands;

/// <summary>
/// Adds the society's late fee to every unpaid bill that is past its grace period. The grace period and the
/// penalty percentage come from Settings. It runs when an admin or accountant asks (money is never changed silently),
/// and a bill is charged once: pressing the button again changes nothing.
/// </summary>
public sealed record ApplyLateFeesCommand(DateOnly Today) : IRequest<Result<ApplyLateFeesResponse>>;

public sealed record ApplyLateFeesResponse(int BillsCharged, decimal TotalLateFeeRupees, int GracePeriodDays, decimal PenaltyPercent);

public sealed class ApplyLateFeesHandler : IRequestHandler<ApplyLateFeesCommand, Result<ApplyLateFeesResponse>>
{
    private readonly BillingDbContext       _db;
    private readonly ICurrentUser           _cu;
    private readonly ISocietySettingsReader _settings;
    public ApplyLateFeesHandler(BillingDbContext db, ICurrentUser cu, ISocietySettingsReader settings) => (_db, _cu, _settings) = (db, cu, settings);

    public async Task<Result<ApplyLateFeesResponse>> Handle(ApplyLateFeesCommand cmd, CancellationToken ct)
    {
        if (_cu.SocietyId is not { } societyId)
            return Result<ApplyLateFeesResponse>.Fail("AUTH.REQUIRED", "Society context required.");

        var rules = await _settings.GetAsync(societyId, ct);
        if (rules.LatePenaltyPercent <= 0)
            return Result<ApplyLateFeesResponse>.Fail("BILLING.NO_PENALTY", "No late penalty is set. Set one in Settings > Billing first.");

        // Past the grace period means more than GracePeriodDays after the due date.
        var lastDueDateStillInGrace = cmd.Today.AddDays(-rules.GracePeriodDays);
        var late = await _db.Bills
            .Where(b => b.SocietyId == societyId
                     && (b.Status == BillStatus.Pending || b.Status == BillStatus.Overdue)
                     && b.DueDate < lastDueDateStillInGrace
                     && b.LateFee.Paise == 0)
            .ToListAsync(ct);

        decimal total = 0;
        var charged = 0;
        foreach (var bill in late)
        {
            var fee = Money.CreateInr(bill.Amount.Amount * rules.LatePenaltyPercent / 100m);
            if (fee.IsFailure || fee.Value!.Paise == 0) continue;
            bill.ApplyLateFee(fee.Value);
            total += fee.Value.Amount;
            charged++;
        }

        if (charged > 0) await _db.SaveChangesAsync(ct);
        return Result<ApplyLateFeesResponse>.Ok(new ApplyLateFeesResponse(charged, total, rules.GracePeriodDays, rules.LatePenaltyPercent));
    }
}
