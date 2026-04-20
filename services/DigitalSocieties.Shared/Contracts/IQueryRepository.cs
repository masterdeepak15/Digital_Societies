using System.Linq.Expressions;

namespace DigitalSocieties.Shared.Contracts;

/// <summary>
/// Read-side repository — returns IQueryable for flexible projections (ISP).
/// </summary>
public interface IQueryRepository<TEntity> where TEntity : class
{
    IQueryable<TEntity> Query();
    Task<TEntity?> FindByIdAsync(Guid id, CancellationToken ct = default);
    Task<bool>     ExistsAsync(Expression<Func<TEntity, bool>> predicate, CancellationToken ct = default);
}
