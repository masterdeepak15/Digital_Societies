using Xunit;
using FluentAssertions;
using DigitalSocieties.Shared.Domain.ValueObjects;

namespace DigitalSocieties.Identity.Tests.Domain;

public class EmailTests
{
    [Fact]
    public void Create_TrimsAndLowercases()
    {
        var result = Email.Create("  Ann@Example.COM ");
        result.IsSuccess.Should().BeTrue();
        result.Value!.Value.Should().Be("ann@example.com");
    }

    [Fact]
    public void Create_KeepsPlusTag()
    {
        Email.Create("a+b@x.io").Value!.Value.Should().Be("a+b@x.io");
    }

    [Theory]
    [InlineData(null,   "EMAIL.REQUIRED")]
    [InlineData("",     "EMAIL.REQUIRED")]
    [InlineData("   ",  "EMAIL.REQUIRED")]
    [InlineData("no-at",   "EMAIL.INVALID")]
    [InlineData("a@b",     "EMAIL.INVALID")]
    [InlineData("a b@c.io", "EMAIL.INVALID")]
    public void Create_Rejects(string? input, string code)
    {
        var result = Email.Create(input);
        result.IsFailure.Should().BeTrue();
        result.Error!.Code.Should().Be(code);
    }

    [Fact]
    public void Create_RejectsOver250Chars()
    {
        var tooLong = new string('a', 246) + "@x.io"; // 251 chars
        Email.Create(tooLong).Error!.Code.Should().Be("EMAIL.INVALID");
    }
}
