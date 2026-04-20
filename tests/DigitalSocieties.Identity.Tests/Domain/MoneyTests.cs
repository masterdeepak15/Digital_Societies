using FluentAssertions;
using DigitalSocieties.Shared.Domain.ValueObjects;

namespace DigitalSocieties.Identity.Tests.Domain;

public class MoneyTests
{
    [Theory]
    [InlineData(3500.00, 350000)]
    [InlineData(0.01, 1)]
    [InlineData(0.00, 0)]
    public void CreateInr_ConvertsToPaiseCorrectly(decimal rupees, long expectedPaise)
    {
        var result = Money.CreateInr(rupees);
        result.IsSuccess.Should().BeTrue();
        result.Value!.Paise.Should().Be(expectedPaise);
    }

    [Fact]
    public void CreateInr_NegativeAmount_ReturnsFailure()
    {
        Money.CreateInr(-100m).IsFailure.Should().BeTrue();
    }

    [Fact]
    public void Add_TwoAmounts_ReturnsCorrectSum()
    {
        var a = Money.CreateInr(1000m).Value!;
        var b = Money.CreateInr(500m).Value!;
        a.Add(b).Amount.Should().Be(1500m);
    }
}
