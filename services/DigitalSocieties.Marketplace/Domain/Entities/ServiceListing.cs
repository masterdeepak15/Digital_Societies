using DigitalSocieties.Shared.Domain.Entities;
using DigitalSocieties.Shared.Domain.ValueObjects;

namespace DigitalSocieties.Marketplace.Domain.Entities;

/// <summary>
/// A local service provider listing (plumber, electrician, carpenter, etc.)
/// visible to all residents of the society.
/// </summary>
public sealed class ServiceListing : AuditableEntity
{
    public Guid      Id           { get; private set; } = Guid.NewGuid();
    public Guid      SocietyId    { get; private set; }

    /// <summary>Provider's User ID (registered in Identity module).</summary>
    public Guid      ProviderId   { get; private set; }
    public string    ProviderName { get; private set; } = string.Empty;
    public string    Phone        { get; private set; } = string.Empty;

    public ServiceCategory Category     { get; private set; }
    public string          Title        { get; private set; } = string.Empty;
    public string          Description  { get; private set; } = string.Empty;
    public string?         ProfilePhotoUrl { get; private set; }

    /// <summary>Base rate displayed to residents (₹ per hour or per visit).</summary>
    public Money           BaseRate     { get; private set; } = null!;
    public RateUnit        RateUnit     { get; private set; }

    /// <summary>Platform commission rate applied to each booking (8–12%).</summary>
    public decimal         CommissionPct { get; private set; } = 10m;

    public float           AverageRating { get; private set; }
    public int             ReviewCount   { get; private set; }
    public bool            IsActive      { get; private set; } = true;

    // EF navigation
    public IReadOnlyCollection<ServiceBooking> Bookings => _bookings.AsReadOnly();
    private readonly List<ServiceBooking> _bookings = [];

    private ServiceListing() { }

    public static ServiceListing Create(
        Guid            societyId,
        Guid            providerId,
        string          providerName,
        string          phone,
        ServiceCategory category,
        string          title,
        string          description,
        Money           baseRate,
        RateUnit        rateUnit,
        decimal         commissionPct = 10m)
    {
        if (commissionPct is < 0 or > 100)
            throw new ArgumentOutOfRangeException(nameof(commissionPct), "Commission must be 0–100%.");

        return new ServiceListing
        {
            SocietyId     = societyId,
            ProviderId    = providerId,
            ProviderName  = providerName.Trim(),
            Phone         = phone.Trim(),
            Category      = category,
            Title         = title.Trim(),
            Description   = description.Trim(),
            BaseRate      = baseRate,
            RateUnit      = rateUnit,
            CommissionPct = commissionPct,
        };
    }

    public void UpdateRating(float avg, int count)
    {
        AverageRating = avg;
        ReviewCount   = count;
    }

    public void Deactivate() => IsActive = false;
    public void Activate()   => IsActive = true;

    /// <summary>Resident-facing price = base rate (commission is deducted from provider payout).</summary>
    public Money ResidentPrice => BaseRate;

    /// <summary>Amount paid out to the provider after platform commission.</summary>
    public Money ProviderPayout(Money totalCharged)
        => Money.CreateInr(totalCharged.Amount * (1 - CommissionPct / 100m)).Value!;
}

public enum ServiceCategory
{
    Plumber, Electrician, Carpenter, Painter, Cleaner,
    PestControl, AcRepair, ApplianceRepair, Gardener, Other
}

public enum RateUnit { PerHour, PerVisit, PerDay }
