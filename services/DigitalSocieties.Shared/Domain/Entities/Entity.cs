namespace DigitalSocieties.Shared.Domain.Entities;

/// <summary>
/// Base entity with stable identity. (SRP — identity only)
/// </summary>
public abstract class Entity
{
    protected Entity() { }
    protected Entity(Guid id) => Id = id;

    public Guid Id { get; protected init; } = Guid.NewGuid();

    public override bool Equals(object? obj)
        => obj is Entity other && GetType() == other.GetType() && Id == other.Id;

    public override int GetHashCode() => Id.GetHashCode();
    public static bool operator ==(Entity? a, Entity? b)
        => a is null ? b is null : a.Equals(b);
    public static bool operator !=(Entity? a, Entity? b) => !(a == b);
}
