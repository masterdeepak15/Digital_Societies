namespace DigitalSocieties.Shared.Contracts;

/// <summary>
/// Write-side repository. Separated from query side (ISP + CQRS-lite).
/// Depend on this abstraction, not a concrete DbContext (DIP).
/// </summary>
public interface ICommandRepository<TEntity> where TEntity : class
{
    void    Add(TEntity entity);
    void    Update(TEntity entity);
    void    Remove(TEntity entity);
    Task    SaveChangesAsync(CancellationToken ct = default);
}
