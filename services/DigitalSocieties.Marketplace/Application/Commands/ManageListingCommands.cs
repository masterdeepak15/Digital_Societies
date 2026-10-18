using MediatR;
using FluentValidation;
using Microsoft.EntityFrameworkCore;
using DigitalSocieties.Shared.Contracts;
using DigitalSocieties.Shared.Domain.ValueObjects;
using DigitalSocieties.Shared.Results;
using DigitalSocieties.Marketplace.Domain.Entities;
using DigitalSocieties.Marketplace.Infrastructure.Persistence;

namespace DigitalSocieties.Marketplace.Application.Commands;

// ── Edit a service (admin) ─────────────────────────────────────────────────
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

        var rate = Money.CreateInr(cmd.BaseRateRupees);
        if (rate.IsFailure) return Result.Fail(rate.Error!);
        if (!Enum.TryParse<ServiceCategory>(cmd.Category, true, out var category))
            return Result.Fail("LISTING.INVALID_CATEGORY", $"Unknown category: {cmd.Category}");
        if (!Enum.TryParse<RateUnit>(cmd.RateUnit, true, out var unit))
            return Result.Fail("LISTING.INVALID_RATE_UNIT", $"Unknown rate unit: {cmd.RateUnit}");

        listing.Update(cmd.ProviderName, cmd.Phone, category, cmd.Title, cmd.Description, rate.Value!, unit, cmd.CommissionPct);
        await _db.SaveChangesAsync(ct);
        return Result.Ok();
    }
}

// ── Delete a service (admin) ───────────────────────────────────────────────
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

        if (await _db.ServiceBookings.AnyAsync(b => b.ListingId == listing.Id &&
                (b.Status == BookingStatus.Pending || b.Status == BookingStatus.Confirmed), ct))
            return Result.Fail("LISTING.HAS_BOOKINGS", "This service has open bookings. Finish or cancel them first, or switch it off.");

        listing.SoftDelete();
        await _db.SaveChangesAsync(ct);
        return Result.Ok();
    }
}
