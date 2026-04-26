using Microsoft.EntityFrameworkCore;
using DigitalSocieties.Identity.Domain.Entities;
using System.Linq.Expressions;

namespace DigitalSocieties.Identity.Infrastructure.Persistence;

/// <summary>
/// Concrete EF Core implementation. Registered in DI — application layer
/// only ever sees IUserRepository (DIP).
/// </summary>
public sealed class UserRepository : IUserRepository
{
    private readonly IdentityDbContext _db;

    public UserRepository(IdentityDbContext db) => _db = db;

    // ── ICommandRepository ────────────────────────────────────────────────────
    public void Add(User entity)    => _db.Users.Add(entity);
    public void Update(User entity) => _db.Users.Update(entity);
    public void Remove(User entity) => entity.SoftDelete();
    public Task SaveChangesAsync(CancellationToken ct) => _db.SaveChangesAsync(ct);

    // ── IQueryRepository ──────────────────────────────────────────────────────
    public IQueryable<User> Query() => _db.Users.AsNoTracking();

    public async Task<User?> FindByIdAsync(Guid id, CancellationToken ct = default)
        => await _db.Users.FindAsync([id], ct);

    public async Task<bool> ExistsAsync(Expression<Func<User, bool>> predicate, CancellationToken ct = default)
        => await _db.Users.AnyAsync(predicate, ct);

    // ── Domain-specific queries ───────────────────────────────────────────────
    public async Task<User?> FindByPhoneAsync(string phone, CancellationToken ct = default)
        => await _db.Users
            .Include(u => u.Devices)
            .FirstOrDefaultAsync(u => u.Phone == phone, ct);

    public async Task<User?> FindWithMembershipsAsync(Guid userId, CancellationToken ct = default)
        => await _db.Users
            .Include(u => u.Memberships.Where(m => m.IsActive))
                .ThenInclude(m => m.Society)
            .Include(u => u.Memberships.Where(m => m.IsActive))
                .ThenInclude(m => m.Flat)
            .FirstOrDefaultAsync(u => u.Id == userId, ct);
}
