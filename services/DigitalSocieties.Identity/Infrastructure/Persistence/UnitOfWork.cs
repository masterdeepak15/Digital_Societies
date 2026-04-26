using DigitalSocieties.Shared.Contracts;

namespace DigitalSocieties.Identity.Infrastructure.Persistence;

public sealed class UnitOfWork : IUnitOfWork
{
    private readonly IdentityDbContext _db;
    public UnitOfWork(IdentityDbContext db) => _db = db;
    public Task<int> CommitAsync(CancellationToken ct) => _db.SaveChangesAsync(ct);
    public void Dispose() => _db.Dispose();
}
