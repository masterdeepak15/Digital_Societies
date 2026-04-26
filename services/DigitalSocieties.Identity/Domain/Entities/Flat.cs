using DigitalSocieties.Shared.Domain.Entities;

namespace DigitalSocieties.Identity.Domain.Entities;

/// <summary>
/// A physical flat/unit within a society. Primary grouping for billing and resident assignment.
/// </summary>
public sealed class Flat : AuditableEntity
{
    private Flat() { }

    private Flat(Guid id, Guid societyId, string number, string wing, int floor)
        : base(id)
    {
        SocietyId = societyId;
        Number    = number;
        Wing      = wing;
        Floor     = floor;
    }

    public Guid   SocietyId   { get; private set; }
    public string Number      { get; private set; } = default!;  // e.g. "204"
    public string Wing        { get; private set; } = default!;  // e.g. "A"
    public int    Floor       { get; private set; }
    public string? OwnerPhone { get; private set; }              // denormalized for quick lookup
    public bool   IsOccupied  { get; private set; }

    private readonly List<Membership> _memberships = [];
    public IReadOnlyList<Membership>  Memberships  => _memberships.AsReadOnly();

    public static Flat Create(Guid societyId, string number, string wing, int floor)
        => new(Guid.NewGuid(), societyId, number, wing, floor);

    public string DisplayName => $"{Wing}-{Number}";
}
