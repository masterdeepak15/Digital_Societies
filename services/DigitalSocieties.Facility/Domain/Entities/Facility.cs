using DigitalSocieties.Shared.Domain.Entities;

namespace DigitalSocieties.Facility.Domain.Entities;

/// <summary>
/// A bookable society amenity (clubhouse, gym, pool, court, etc.).
/// </summary>
public sealed class Facility : AuditableEntity
{
    private Facility() { }

    private Facility(Guid id, Guid societyId, string name, string description,
        int capacityPersons, int slotDurationMinutes, TimeOnly openTime, TimeOnly closeTime)
        : base(id)
    {
        SocietyId           = societyId;
        Name                = name;
        Description         = description;
        CapacityPersons     = capacityPersons;
        SlotDurationMinutes = slotDurationMinutes;
        OpenTime            = openTime;
        CloseTime           = closeTime;
        IsActive            = true;
    }

    public Guid    SocietyId           { get; private set; }
    public string  Name                { get; private set; } = default!;
    public string  Description         { get; private set; } = default!;
    public string? ImageUrl            { get; private set; }
    public int     CapacityPersons     { get; private set; }
    public int     SlotDurationMinutes { get; private set; }  // 30, 60, 90, 120
    public TimeOnly OpenTime           { get; private set; }
    public TimeOnly CloseTime          { get; private set; }
    public bool    IsActive            { get; private set; }
    public int     AdvanceBookingDays  { get; private set; } = 7;
    public int     MaxBookingsPerFlat  { get; private set; } = 2;

    private readonly List<FacilityBooking> _bookings = [];
    public IReadOnlyList<FacilityBooking> Bookings => _bookings.AsReadOnly();

    public static Facility Create(Guid societyId, string name, string description,
        int capacity, int slotMinutes, TimeOnly open, TimeOnly close)
        => new(Guid.NewGuid(), societyId, name, description, capacity, slotMinutes, open, close);

    public void SetImage(string url) => ImageUrl = url;
    public void Deactivate()         => IsActive  = false;
    public void Activate()           => IsActive  = true;
}
