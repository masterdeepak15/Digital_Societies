using System.Text.Json;
using Xunit;
using FluentAssertions;
using DigitalSocieties.Identity.Application.Commands;
using DigitalSocieties.Identity.Domain.Entities;
using DigitalSocieties.Shared.Domain.ValueObjects;

namespace DigitalSocieties.Identity.Tests.Application;

public class UserProfileTests
{
    [Fact]
    public void FromUser_MapsEmailAndPhone_AndSerialisedJsonHasNoSecrets()
    {
        var user = User.Create(Email.Create("ann@example.com").Value!, "Ann", PhoneNumber.Create("+14155552671").Value!);
        user.SetPending2FaSecret("PENDINGSECRET234");
        user.Activate2Fa();
        user.SetPending2FaSecret("NEXTPENDINGSECRET");

        var profile = UserProfile.FromUser(user);
        var json = JsonSerializer.Serialize(profile);

        profile.Email.Should().Be("ann@example.com");
        profile.Phone.Should().Be("+14155552671");
        json.Should().NotContain("PENDINGSECRET234").And.NotContain("NEXTPENDINGSECRET");
        json.ToLowerInvariant().Should().NotContain("twofactorsecret").And.NotContain("pending2fasecret");
    }

    [Fact]
    public void FromUser_UserWithoutPhone_HasNullPhone()
    {
        var user = User.Create(Email.Create("ann@example.com").Value!, "Ann");
        UserProfile.FromUser(user).Phone.Should().BeNull();
    }
}
