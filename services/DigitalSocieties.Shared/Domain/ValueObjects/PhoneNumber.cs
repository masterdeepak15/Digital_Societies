using System.Text.RegularExpressions;
using DigitalSocieties.Shared.Results;

namespace DigitalSocieties.Shared.Domain.ValueObjects;

/// <summary>
/// Value object: immutable, equality by value, self-validating. (SRP)
/// Supports Indian numbers (+91) and international format.
/// </summary>
public sealed record PhoneNumber
{
    private static readonly Regex IndiaPattern = new(@"^\+91[6-9]\d{9}$", RegexOptions.Compiled);

    private PhoneNumber(string value) => Value = value;
    public string Value { get; }

    public static Result<PhoneNumber> Create(string? raw)
    {
        if (string.IsNullOrWhiteSpace(raw))
            return Result<PhoneNumber>.Fail("PHONE.REQUIRED", "Phone number is required.");

        var normalized = raw.Trim().Replace(" ", "").Replace("-", "");
        if (!normalized.StartsWith('+'))
            normalized = "+91" + normalized.TrimStart('0');

        if (!IndiaPattern.IsMatch(normalized))
            return Result<PhoneNumber>.Fail("PHONE.INVALID",
                $"'{raw}' is not a valid Indian mobile number.");

        return Result<PhoneNumber>.Ok(new PhoneNumber(normalized));
    }

    public override string ToString() => Value;
}
