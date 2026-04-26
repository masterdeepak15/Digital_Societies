using DigitalSocieties.Shared.Domain.Entities;
using DigitalSocieties.Identity.Domain.Events;

namespace DigitalSocieties.Identity.Domain.Entities;

/// <summary>
/// Aggregate root: a housing society (tenant in multi-tenant model).
/// Each society is isolated via Postgres Row-Level Security on society_id.
/// </summary>
public sealed class Society : AuditableEntity
{
    private Society() { } // EF Core

    private Society(Guid id, string name, string address, string registrationNumber)
        : base(id)
    {
        Name               = name;
        Address            = address;
        RegistrationNumber = registrationNumber;
        IsActive           = true;
        Tier               = "free";
    }

    public string Name               { get; private set; } = default!;
    public string Address            { get; private set; } = default!;
    public string RegistrationNumber { get; private set; } = default!;
    public string Tier               { get; private set; } = default!;  // free/starter/standard/pro
    public bool   IsActive           { get; private set; }
    public string? LogoUrl           { get; private set; }
    public string? PrimaryPhone      { get; private set; }
    public string? PrimaryEmail      { get; private set; }
    public int    TotalFlats         { get; private set; }

    private readonly List<Flat> _flats = [];
    public IReadOnlyList<Flat>  Flats  => _flats.AsReadOnly();

    public static Society Create(string name, string address, string registrationNumber)
    {
        var society = new Society(Guid.NewGuid(), name, address, registrationNumber);
        society.Raise(new SocietyCreatedEvent(society.Id, name));
        return society;
    }

    public void UpdateTier(string tier)
    {
        Tier = tier;
        Raise(new SocietyTierChangedEvent(Id, tier));
    }

    public void Deactivate()
    {
        IsActive = false;
        Raise(new SocietyDeactivatedEvent(Id));
    }

    public Flat AddFlat(string number, string wing, int floor)
    {
        var flat = Flat.Create(Id, number, wing, floor);
        _flats.Add(flat);
        TotalFlats = _flats.Count;
        return flat;
    }
}
