using Microsoft.Extensions.Caching.Distributed;
using System.Text;

namespace DigitalSocieties.Identity.Infrastructure.Services;

/// <summary>
/// Sliding-window rate limiter backed by Redis.
/// Key: "otp:{phone}" → count within window.
/// Falls back to allowing if Redis is unavailable (fail-open — guard logs the issue).
/// </summary>
public sealed class RedisRateLimiter : IRateLimiter
{
    private readonly IDistributedCache _cache;

    public RedisRateLimiter(IDistributedCache cache) => _cache = cache;

    public async Task<RateLimitResult> CheckAsync(
        string key, int maxRequests, TimeSpan window, CancellationToken ct)
    {
        try
        {
            var raw   = await _cache.GetAsync(key, ct);
            int count = raw is null ? 0 : int.Parse(Encoding.UTF8.GetString(raw));

            if (count >= maxRequests)
                return new RateLimitResult(false, (int)window.TotalSeconds);

            count++;
            var options = new DistributedCacheEntryOptions { AbsoluteExpirationRelativeToNow = window };
            await _cache.SetAsync(key, Encoding.UTF8.GetBytes(count.ToString()), options, ct);

            return new RateLimitResult(true);
        }
        catch
        {
            // Fail-open: don't block if Redis is down, but log it
            return new RateLimitResult(true);
        }
    }
}
