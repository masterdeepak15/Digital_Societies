namespace DigitalSocieties.Shared.Domain.Entities;

/// <summary>
/// Extends Entity with audit columns. Separated from Entity (ISP — not all
/// entities need auditing). Set by EF Core SaveChanges interceptor.
/// </summary>
public abstract class AuditableEntity : AggregateRoot
{
    protected AuditableEntity() { }
    protected AuditableEntity(Guid id) : base(id) { }

    public DateTimeOffset CreatedAt  { get; set; }
    public Guid?          CreatedBy  { get; set; }
    public DateTimeOffset UpdatedAt  { get; set; }
    public Guid?          UpdatedBy  { get; set; }
    public bool           IsDeleted  { get; private set; }

    public void SoftDelete() => IsDeleted = true;
}
