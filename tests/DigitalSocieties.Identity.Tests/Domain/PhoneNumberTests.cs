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

    [Theory]
    [InlineData("")]
    [InlineData(null)]
    [InlineData("12345")]
    public void Create_InvalidPhone_ReturnsFailure(string? input)
    {
        PhoneNumber.Create(input).IsFailure.Should().BeTrue();
    }
}
