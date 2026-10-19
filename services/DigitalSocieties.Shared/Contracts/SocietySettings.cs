using System.Text.Json;
using System.Text.Json.Serialization;

namespace DigitalSocieties.Shared.Contracts;

/// <summary>
/// The rules a society sets for itself in Settings: contact details, billing, who gets notified, visitor security.
/// Stored with the society, read by the modules that act on them through <see cref="ISocietySettingsReader"/>.
/// A society that has never saved anything uses <see cref="Defaults"/>.
/// </summary>
public sealed record SocietySettings
{
    // Contact
    public string  ContactEmail { get; init; } = string.Empty;
    public string  ContactPhone { get; init; } = string.Empty;
    public string  City         { get; init; } = string.Empty;
    public string  Pincode      { get; init; } = string.Empty;

    // Billing
    /// <summary>Monthly maintenance per flat, in rupees. 0 means "not set yet".</summary>
    public decimal MaintenanceAmount  { get; init; }
    /// <summary>Day of the month bills are meant to go out (1 to 28).</summary>
    public int     BillingCycleDay    { get; init; } = 1;
    /// <summary>Days after the due date before a late fee can be added.</summary>
    public int     GracePeriodDays    { get; init; } = 7;
    /// <summary>Late fee as a percentage of the bill. 0 means no late fee.</summary>
    public decimal LatePenaltyPercent { get; init; }
    public bool    GstEnabled         { get; init; }
    public string  GstNumber          { get; init; } = string.Empty;

    // Notifications
    public bool PushEnabled      { get; init; } = true;
    public bool SmsEnabled       { get; init; }
    public bool EmailEnabled     { get; init; } = true;
    public bool VisitorAlerts    { get; init; } = true;
    public bool PaymentReminders { get; init; } = true;

    // Security
    /// <summary>How long a visitor's QR code works once the resident approves them.</summary>
    public int  VisitorQrTtlMinutes { get; init; } = 2;
    public int  PiiWipeDays         { get; init; } = 7;
    public bool OfflineSyncEnabled  { get; init; } = true;

    public static SocietySettings Defaults { get; } = new();

    [JsonIgnore]
    public TimeSpan VisitorQrTtl => TimeSpan.FromMinutes(VisitorQrTtlMinutes);

    /// <summary>The first problem in plain words, or null when the values can be saved.</summary>
    public string? Validate()
    {
        if (ContactEmail.Length > 0 && (!ContactEmail.Contains('@') || ContactEmail.Length > 200)) return "Enter a valid contact email, or leave it empty.";
        if (ContactPhone.Length > 25) return "The contact phone is too long.";
        if (City.Length > 100) return "The city name is too long.";
        if (Pincode.Length > 10) return "The pincode is too long.";
        if (MaintenanceAmount < 0 || MaintenanceAmount > 1_000_000) return "Monthly maintenance must be between 0 and 10,00,000 rupees.";
        if (BillingCycleDay is < 1 or > 28) return "The billing day must be between 1 and 28.";
        if (GracePeriodDays is < 0 or > 30) return "The grace period must be between 0 and 30 days.";
        if (LatePenaltyPercent < 0 || LatePenaltyPercent > 36) return "The late penalty must be between 0 and 36 percent.";
        if (GstEnabled && GstNumber.Trim().Length != 15) return "A GST number has 15 characters. Add it, or switch GST off.";
        if (VisitorQrTtlMinutes is < 1 or > 30) return "The visitor QR code lifetime must be between 1 and 30 minutes.";
        if (PiiWipeDays is < 1 or > 30) return "Visitor details are kept for 1 to 30 days on the guard's phone.";
        return null;
    }

    private static readonly JsonSerializerOptions Json = new(JsonSerializerDefaults.Web) { DefaultIgnoreCondition = JsonIgnoreCondition.Never };

    /// <summary>Settings from the stored text. Missing or unreadable values fall back to the defaults, one by one.</summary>
    public static SocietySettings Parse(string? json)
    {
        if (string.IsNullOrWhiteSpace(json)) return Defaults;
        try { return JsonSerializer.Deserialize<SocietySettings>(json, Json) ?? Defaults; }
        catch (JsonException) { return Defaults; }
    }

    public string ToJson() => JsonSerializer.Serialize(this, Json);
}

/// <summary>Lets any module read the society's rules without depending on the Identity module.</summary>
public interface ISocietySettingsReader
{
    Task<SocietySettings> GetAsync(Guid societyId, CancellationToken ct);
}
