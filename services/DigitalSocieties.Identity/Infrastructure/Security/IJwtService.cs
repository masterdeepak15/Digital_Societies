using DigitalSocieties.Identity.Domain.Entities;
using DigitalSocieties.Identity.Application.Commands;

namespace DigitalSocieties.Identity.Infrastructure.Security;

public interface IJwtService
{
    Task<(string AccessToken, string RefreshToken, int ExpiresIn)> IssueTokensAsync(
        User user, IReadOnlyList<MembershipInfo> memberships, CancellationToken ct);

    Task<RefreshResult> RefreshAsync(string refreshToken, CancellationToken ct);
    Task RevokeAsync(string refreshToken, CancellationToken ct);
}

public sealed record RefreshResult(
    bool Success, string? AccessToken = null,
    string? RefreshToken = null, int ExpiresIn = 0, string? Error = null);
