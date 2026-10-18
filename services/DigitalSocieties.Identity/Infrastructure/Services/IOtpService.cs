namespace DigitalSocieties.Identity.Infrastructure.Services;

public interface IOtpService
{
    Task<OtpCreateResult> CreateAsync(string email, string purpose, CancellationToken ct);
    Task<DigitalSocieties.Shared.Results.Result> VerifyAsync(string email, string otp, string purpose, CancellationToken ct);
}

public sealed record OtpCreateResult(string PlainOtp, DateTimeOffset ExpiresAt);
