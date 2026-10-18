using System.Text.RegularExpressions;
using DigitalSocieties.Shared.Results;

namespace DigitalSocieties.Shared.Domain.ValueObjects;

/// <summary>
/// Value object: immutable, equality by value, self-validating. (SRP)
/// Stored trimmed and lowercased so one mailbox maps to one account.
/// </summary>
public sealed record Email
{
    public const int MaxLength = 250;

    private static readonly Regex Shape = new(@"^[^@\s]+@[^@\s]+\.[^@\s]+$", RegexOptions.Compiled);

    private Email(string value) => Value = value;
    public string Value { get; }

    public static Result<Email> Create(string? raw)
    {
        if (string.IsNullOrWhiteSpace(raw))
            return Result<Email>.Fail("EMAIL.REQUIRED", "Email is required.");

        var normalized = raw.Trim().ToLowerInvariant();
        if (normalized.Length > MaxLength || !Shape.IsMatch(normalized))
            return Result<Email>.Fail("EMAIL.INVALID", "Enter a valid email address.");

        return Result<Email>.Ok(new Email(normalized));
    }

    public override string ToString() => Value;
}
