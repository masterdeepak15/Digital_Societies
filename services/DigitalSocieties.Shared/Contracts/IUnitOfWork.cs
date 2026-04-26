namespace DigitalSocieties.Shared.Contracts;

/// <summary>
/// Coordinates persistence across multiple repositories in one transaction. (SRP)
/// </summary>
public interface IUnitOfWork : IDisposable
{
    Task<int> CommitAsync(CancellationToken ct = default);
}
