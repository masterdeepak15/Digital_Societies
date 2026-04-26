using DigitalSocieties.Shared.Results;

namespace DigitalSocieties.Shared.Extensions;

/// <summary>
/// Defensive guard clauses. Used at application layer boundaries (command handlers).
/// Returns Result failures instead of throwing — keeps the call stack clean.
/// </summary>
public static class Guard
{
    public static Result AgainstNull(object? value, string fieldName)
        => value is null
            ? Result.Fail("REQUIRED", $"{fieldName} is required.")
            : Result.Ok();

    public static Result AgainstNullOrEmpty(string? value, string fieldName)
        => string.IsNullOrWhiteSpace(value)
            ? Result.Fail("REQUIRED", $"{fieldName} cannot be empty.")
            : Result.Ok();

    public static Result AgainstOutOfRange(int value, int min, int max, string fieldName)
        => value < min || value > max
            ? Result.Fail("OUT_OF_RANGE", $"{fieldName} must be between {min} and {max}.")
            : Result.Ok();

    public static Result AgainstPast(DateTimeOffset date, string fieldName)
        => date < DateTimeOffset.UtcNow
            ? Result.Fail("DATE.PAST", $"{fieldName} cannot be in the past.")
            : Result.Ok();
}
