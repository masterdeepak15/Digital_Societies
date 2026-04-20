using DigitalSocieties.Shared.Domain.Entities;

namespace DigitalSocieties.Identity.Domain.Entities;

/// <summary>
/// One-time password request. Immutable after creation.
/// Security rules baked in: TTL, max-attempts, single-use. (SRP)
/// </summary>
public sealed class OtpRequest : Entity
{
    private const int MaxAttempts  = 3;
    private const int TtlMinutes   = 10;

    private OtpRequest() { }

    private OtpRequest(Guid id, string phone, string hashedOtp, string purpose)
        : base(id)
    {
        Phone      = phone;
        HashedOtp  = hashedOtp;
        Purpose    = purpose;
        ExpiresAt  = DateTimeOffset.UtcNow.AddMinutes(TtlMinutes);
        IsUsed     = false;
        Attempts   = 0;
        CreatedAt  = DateTimeOffset.UtcNow;
    }

    public string Phone      { get; private set; } = default!;
    public string HashedOtp  { get; private set; } = default!;  // BCrypt hash
    public string Purpose    { get; private set; } = default!;  // "login" | "register" | "step_up"
    public bool   IsUsed     { get; private set; }
    public int    Attempts   { get; private set; }
    public DateTimeOffset ExpiresAt  { get; private set; }
    public DateTimeOffset CreatedAt  { get; private set; }

    public bool IsExpired        => DateTimeOffset.UtcNow > ExpiresAt;
    public bool IsMaxedOut       => Attempts >= MaxAttempts;
    public bool CanAttempt       => !IsUsed && !IsExpired && !IsMaxedOut;

    public static OtpRequest Create(string phone, string hashedOtp, string purpose)
        => new(Guid.NewGuid(), phone, hashedOtp, purpose);

    /// <summary>Returns true if OTP matches AND request is usable.</summary>
    public bool Verify(string candidateOtp)
    {
        if (!CanAttempt) return false;
        Attempts++;

        bool match = BCrypt.Net.BCrypt.Verify(candidateOtp, HashedOtp);
        if (match) IsUsed = true;
        return match;
    }
}
