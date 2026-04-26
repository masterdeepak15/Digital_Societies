using DigitalSocieties.Shared.Contracts;
using DigitalSocieties.Identity.Domain.Entities;

namespace DigitalSocieties.Identity.Infrastructure.Persistence;

/// <summary>
/// ISP: focused repository for User aggregate. Not a generic fat repository.
/// Extends both query and command interfaces (DIP — application layer depends on this).
/// </summary>
public interface IUserRepository :
    ICommandRepository<User>,
    IQueryRepository<User>
{
    Task<User?> FindByPhoneAsync(string phone, CancellationToken ct = default);
    Task<User?> FindWithMembershipsAsync(Guid userId, CancellationToken ct = default);
}
