using DigitalSocieties.Shared.Results;

namespace DigitalSocieties.Shared.Domain.ValueObjects;

/// <summary>
/// Value object for monetary amounts. Avoids floating-point arithmetic bugs.
/// All amounts stored and computed in paise (1/100 rupee) as integer, displayed as decimal.
/// </summary>
public sealed record Money
{
    private Money(long paise, string currency) { Paise = paise; Currency = currency; }

    public long   Paise    { get; }        // e.g. 150000 = ₹1500.00
    public string Currency { get; }        // "INR"
    public decimal Amount  => Paise / 100m;

    public static Result<Money> CreateInr(decimal rupees)
    {
        if (rupees < 0)
            return Result<Money>.Fail("MONEY.NEGATIVE", "Amount cannot be negative.");
        if (rupees > 10_000_000m)
            return Result<Money>.Fail("MONEY.TOO_LARGE", "Amount exceeds maximum allowed.");

        long paise = (long)Math.Round(rupees * 100, MidpointRounding.AwayFromZero);
        return Result<Money>.Ok(new Money(paise, "INR"));
    }

    public static Money Zero => new(0, "INR");

    public Money Add(Money other)
    {
        if (Currency != other.Currency)
            throw new InvalidOperationException("Cannot add amounts in different currencies.");
        return new Money(Paise + other.Paise, Currency);
    }

    public Money Subtract(Money other) => new(Paise - other.Paise, Currency);

    public override string ToString() => $"₹{Amount:F2}";
}
