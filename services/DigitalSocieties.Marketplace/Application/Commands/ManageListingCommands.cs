using MediatR;
using FluentValidation;
using Microsoft.EntityFrameworkCore;
using DigitalSocieties.Shared.Contracts;
using DigitalSocieties.Shared.Domain.ValueObjects;
using DigitalSocieties.Shared.Results;
using DigitalSocieties.Marketplace.Domain.Entities;
using DigitalSocieties.Marketplace.Infrastructure.Persistence;

namespace DigitalSocieties.Marketplace.Application.Commands;

// ── Edit a service (admin, or the resident who registered it) ──────────────
// A resident's change sends the listing back for approval and cannot touch the commission.
public sealed record UpdateListingCommand(
    Guid    ListingId,
    string  ProviderName,
    string  Phone,
    string  Category,
    string  Title,
    string  Description,
    decimal BaseRateRupees,
    string  RateUnit,
    decimal CommissionPct) : IRequest<Result>;

public sealed class UpdateListingValidator : AbstractValidator<UpdateListingCommand>
{
    public UpdateListingValidator()
    {
        RuleFor(x => x.ProviderName).NotEmpty().MaximumLength(100);
        RuleFor(x => x.Phone).Matches(@"^\+?[0-9]{10,13}$").WithMessage("Enter a valid phone number.");
        RuleFor(x => x.Title).NotEmpty().MaximumLength(120);
        RuleFor(x => x.Description).MaximumLength(1000);
        RuleFor(x => x.BaseRateRupees).GreaterThan(0);
        RuleFor(x => x.CommissionPct).InclusiveBetween(0, 100);
    }
}

public sealed class UpdateListingHandler : IRequestHandler<UpdateListingCommand, Result>
{
    private readonly MarketplaceDbContext _db;
    private readonly ICurrentUser         _cu;
    public UpdateListingHandler(MarketplaceDbContext db, ICurrentUser cu) => (_db, _cu) = (db, cu);

    public async Task<Result> Handle(UpdateListingCommand cmd, CancellationToken ct)
    {
        if (_cu.SocietyId is not { } societyId)
            return Result.Fail("AUTH.REQUIRED", "Society context required.");

        var listing = await _db.ServiceListings.FirstOrDefaultAsync(l => l.Id == cmd.ListingId && l.SocietyId == societyId, ct);
        if (listing is null) return Result.Fail("LISTING.NOT_FOUND", "Listing not found.");

        var isAdmin = _cu.IsInRole("admin");
        if (!isAdmin && listing.ProviderId != _cu.UserId)
            return Result.Fail("FORBIDDEN", "Only the person who registered this service, or an admin, can change it.");

        var rate = Money.CreateInr(cmd.BaseRateRupees);
        if (rate.IsFailure) return Result.Fail(rate.Error!);
        if (!Enum.TryParse<ServiceCategory>(cmd.Category, true, out var category))
            return Result.Fail("LISTING.INVALID_CATEGORY", $"Unknown category: {cmd.Category}");
        if (!Enum.TryParse<RateUnit>(cmd.RateUnit, true, out var unit))
            return Result.Fail("LISTING.INVALID_RATE_UNIT", $"Unknown rate unit: {cmd.RateUnit}");

        listing.Update(cmd.ProviderName, cmd.Phone, category, cmd.Title, cmd.Description, rate.Value!, unit,
            isAdmin ? cmd.CommissionPct : listing.CommissionPct);
        if (!isAdmin) listing.SendForApproval();
        await _db.SaveChangesAsync(ct);
        return Result.Ok();
    }
}

// ── Delete a service (admin, or the resident who registered it) ────────────
// Refused while a booking is still waiting or confirmed; switch it off instead.
public sealed record DeleteListingCommand(Guid ListingId) : IRequest<Result>;

public sealed class DeleteListingHandler : IRequestHandler<DeleteListingCommand, Result>
{
    private readonly MarketplaceDbContext _db;
    private readonly ICurrentUser         _cu;
    public DeleteListingHandler(MarketplaceDbContext db, ICurrentUser cu) => (_db, _cu) = (db, cu);

    public async Task<Result> Handle(DeleteListingCommand cmd, CancellationToken ct)
    {
        if (_cu.SocietyId is not { } societyId)
            return Result.Fail("AUTH.REQUIRED", "Society context required.");

        var listing = await _db.ServiceListings.FirstOrDefaultAsync(l => l.Id == cmd.ListingId && l.SocietyId == societyId, ct);
        if (listing is null) return Result.Fail("LISTING.NOT_FOUND", "Listing not found.");

        if (!_cu.IsInRole("admin") && listing.ProviderId != _cu.UserId)
            return Result.Fail("FORBIDDEN", "Only the person who registered this service, or an admin, can remove it.");

        if (await _db.ServiceBookings.AnyAsync(b => b.ListingId == listing.Id &&
                (b.Status == BookingStatus.Pending || b.Status == BookingStatus.Confirmed), ct))
            return Result.Fail("LISTING.HAS_BOOKINGS", "This service has open bookings. Finish or cancel them first, or switch it off.");

        listing.SoftDelete();
        await _db.SaveChangesAsync(ct);
        return Result.Ok();
    }
}

// ── Approve a resident's service (admin) ───────────────────────────────────
public sealed record ApproveListingCommand(Guid ListingId) : IRequest<Result>;

public sealed class ApproveListingHandler : IRequestHandler<ApproveListingCommand, Result>
{
    private readonly MarketplaceDbContext _db;
    private readonly ICurrentUser         _cu;
    public ApproveListingHandler(MarketplaceDbContext db, ICurrentUser cu) => (_db, _cu) = (db, cu);

    public async Task<Result> Handle(ApproveListingCommand cmd, CancellationToken ct)
    {
        if (_cu.SocietyId is not { } societyId) return Result.Fail("AUTH.REQUIRED", "Society context required.");
        if (!_cu.IsInRole("admin")) return Result.Fail("FORBIDDEN", "Only the management can approve a service.");

        var listing = await _db.ServiceListings.FirstOrDefaultAsync(l => l.Id == cmd.ListingId && l.SocietyId == societyId, ct);
        if (listing is null) return Result.Fail("LISTING.NOT_FOUND", "Listing not found.");

        listing.Approve();
        await _db.SaveChangesAsync(ct);
        return Result.Ok();
    }
}

// ── Reject a resident's service (admin) ────────────────────────────────────
public sealed record RejectListingCommand(Guid ListingId, string Reason) : IRequest<Result>;

public sealed class RejectListingValidator : AbstractValidator<RejectListingCommand>
{
    public RejectListingValidator() =>
        RuleFor(x => x.Reason).NotEmpty().Must(r => !string.IsNullOrWhiteSpace(r)).MaximumLength(500)
            .WithMessage("Tell the resident why, in a few words.");
}

public sealed class RejectListingHandler : IRequestHandler<RejectListingCommand, Result>
{
    private readonly MarketplaceDbContext _db;
    private readonly ICurrentUser         _cu;
    public RejectListingHandler(MarketplaceDbContext db, ICurrentUser cu) => (_db, _cu) = (db, cu);

    public async Task<Result> Handle(RejectListingCommand cmd, CancellationToken ct)
    {
        if (_cu.SocietyId is not { } societyId) return Result.Fail("AUTH.REQUIRED", "Society context required.");
        if (!_cu.IsInRole("admin")) return Result.Fail("FORBIDDEN", "Only the management can reject a service.");

        var listing = await _db.ServiceListings.FirstOrDefaultAsync(l => l.Id == cmd.ListingId && l.SocietyId == societyId, ct);
        if (listing is null) return Result.Fail("LISTING.NOT_FOUND", "Listing not found.");

        listing.Reject(cmd.Reason);
        await _db.SaveChangesAsync(ct);
        return Result.Ok();
    }
}
