using DigitalSocieties.Shared.Domain.Entities;

namespace DigitalSocieties.Parking.Domain.Entities;

/// <summary>
/// A registered vehicle belonging to a resident flat.
/// Enables ANPR hook and visitor parking nav URL generation.
/// </summary>
public sealed class Vehicle : AuditableEntity
{
    private Vehicle() { }

    private Vehicle(Guid id, Guid societyId, Guid flatId,
        string registrationNumber, string type, string? makeModel, string? color)
        : base(id)
    {
        SocietyId          = societyId;
        FlatId             = flatId;
        RegistrationNumber = registrationNumber;
        Type               = type;
        MakeModel          = makeModel;
        Color              = color;
        IsActive           = true;
    }

    public Guid    SocietyId          { get; private set; }
    public Guid    FlatId             { get; private set; }
    public string  RegistrationNumber { get; private set; } = default!; // "MH01AB1234"
    public string  Type               { get; private set; } = default!; // "Car" | "Bike" | "EV"
    public string? MakeModel          { get; private set; }             // "Honda City"
    public string? Color              { get; private set; }
    public bool    IsActive           { get; private set; }
    public string? RcDocumentUrl      { get; private set; }             // MinIO ref for RC book

    public static Vehicle Register(Guid societyId, Guid flatId,
        string registrationNumber, string type,
        string? makeModel = null, string? color = null)
        => new(Guid.NewGuid(), societyId, flatId,
               registrationNumber.ToUpperInvariant().Replace(" ", ""),
               type, makeModel, color);

    public void AttachRcDocument(string url) => RcDocumentUrl = url;
    public void Deactivate() => IsActive = false;
}
