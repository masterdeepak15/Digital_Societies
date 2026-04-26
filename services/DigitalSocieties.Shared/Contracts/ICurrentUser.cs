namespace DigitalSocieties.Shared.Contracts;

/// <summary>
/// DIP: Application layer depends on this abstraction, not HttpContext.
/// Injected from middleware that unpacks the JWT. (ISP — lean interface)
/// </summary>
public interface ICurrentUser
{
    Guid?   UserId     { get; }
    Guid?   SocietyId  { get; }  // Active tenant from JWT claim
    Guid?   FlatId     { get; }
    string? Phone      { get; }
    IReadOnlyList<string> Roles { get; }

    bool IsInRole(string role);
    bool IsAuthenticated { get; }
}
