namespace DigitalSocieties.Identity.Infrastructure.Services;

public interface IRateLimiter
{
    Task<RateLimitResult> CheckAsync(string key, int maxRequests, TimeSpan window, CancellationToken ct);
}

public sealed record RateLimitResult(bool Allowed, int RetryAfterSeconds = 0);
