using Xunit;
using FluentAssertions;
using DigitalSocieties.Shared.Domain.ValueObjects;

namespace DigitalSocieties.Identity.Tests.Domain;

public class PhoneNumberTests
{
    [Theory]
    [InlineData("+919876543210")]
    [InlineData("9876543210")]
    [InlineData("09876543210")]
    public void Create_ValidPhone_ReturnsSuccess(string input)
    {
        var result = PhoneNumber.Create(input);
        result.IsSuccess.Should().BeTrue();
        result.Value!.Value.Should().StartWith("+91");
    }

    [Fact]
    public void Create_AcceptsInternationalE164()
    {
        var result = PhoneNumber.Create("+14155552671");
        result.IsSuccess.Should().BeTrue();
        result.Value!.Value.Should().Be("+14155552671");
    }

    [Fact]
    public void Create_RejectsTooShortInternational()
    {
        PhoneNumber.Create("+1234").IsFailure.Should().BeTrue();
    }

    [Theory]
    [InlineData("")]
    [InlineData(null)]
    [InlineData("12345")]
    public void Create_InvalidPhone_ReturnsFailure(string? input)
    {
        PhoneNumber.Create(input).IsFailure.Should().BeTrue();
    }
}
