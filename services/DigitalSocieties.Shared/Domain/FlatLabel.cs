namespace DigitalSocieties.Shared.Domain;

/// <summary>How a flat is written for people: "A-807". One rule, used everywhere a flat is shown.</summary>
public static class FlatLabel
{
    /// <summary>
    /// Wing and number joined with a dash. A number that already starts with its wing ("A-807") is left as it is,
    /// so the wing is never written twice.
    /// </summary>
    public static string Of(string? wing, string number)
    {
        number = number.Trim();
        wing = wing?.Trim();
        if (string.IsNullOrEmpty(wing)) return number;
        return number.StartsWith(wing + "-", StringComparison.OrdinalIgnoreCase) ? number : $"{wing}-{number}";
    }
}
