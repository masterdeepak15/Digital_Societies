using Xunit;
using FluentAssertions;
using DigitalSocieties.Identity.Domain.Entities;
using DigitalSocieties.Shared.Domain.ValueObjects;

namespace DigitalSocieties.Identity.Tests.Domain;

public class UserTests
{
    private static Email E(string v) => Email.Create(v).Value!;
    private static PhoneNumber P(string v) => PhoneNumber.Create(v).Value!;

    [Fact]
    public void Create_SetsEmailAndNullPhone()
    {
        var user = User.Create(E("Ann@Example.com"), "Ann");
        user.Email.Should().Be("ann@example.com");
        user.Phone.Should().BeNull();
        user.Name.Should().Be("Ann");
    }

    [Fact]
    public void Create_WithPhone_StoresPhone()
    {
        User.Create(E("a@x.io"), "A", P("9876543210")).Phone.Should().Be("+919876543210");
    }

    [Fact]
    public void SetPhone_ThenClearPhone_NullsPhone()
    {
        var user = User.Create(E("a@x.io"), "A");
        user.SetPhone(P("+14155552671"));
        user.Phone.Should().Be("+14155552671");
        user.ClearPhone();
        user.Phone.Should().BeNull();
    }

    [Theory]
    [InlineData("")]
    [InlineData("   ")]
    public void Rename_RejectsBlank(string name)
    {
        var user = User.Create(E("a@x.io"), "A");
        var act = () => user.Rename(name);
        act.Should().Throw<ArgumentException>();
    }

    [Fact]
    public void Rename_UpdatesName()
    {
        var user = User.Create(E("a@x.io"), "New User");
        user.Rename("  Priya ");
        user.Name.Should().Be("Priya");
    }
}
