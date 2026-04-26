using DigitalSocieties.Shared.Domain.Entities;

namespace DigitalSocieties.Parking.Domain.Entities;

/// <summary>
/// A floor/zone of parking in a society (e.g. "B1 Basement", "Podium Level").
/// SRP: knows its own layout metadata.
/// </summary>
public sealed class ParkingLevel : AuditableEntity
{
    private ParkingLevel() { }

    private ParkingLevel(Guid id, Guid societyId, string name, int levelNumber, string? floorPlanUrl)
        : base(id)
    {
        SocietyId    = societyId;
        Name         = name;
        LevelNumber  = levelNumber;
        FloorPlanUrl = floorPlanUrl;
    }

    public Guid    SocietyId    { get; private set; }
    public string  Name         { get; private set; } = default!;  // "Basement B1"
    public int     LevelNumber  { get; private set; }              // -1, 0, 1 …
    public string? FloorPlanUrl { get; private set; }              // MinIO pre-signed reference

    private readonly List<ParkingSlot> _slots = [];
    public IReadOnlyList<ParkingSlot> Slots => _slots.AsReadOnly();

    public static ParkingLevel Create(Guid societyId, string name, int levelNumber, string? floorPlanUrl = null)
        => new(Guid.NewGuid(), societyId, name, levelNumber, floorPlanUrl);

    public void SetFloorPlan(string url) => FloorPlanUrl = url;
}
