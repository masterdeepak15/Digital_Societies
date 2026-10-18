using Xunit;
using FluentAssertions;
using DigitalSocieties.Shared.Contracts;

namespace DigitalSocieties.Identity.Tests.Services;

/// <summary>One person, several roles: every role counts, and a resident keeps their flat when they are also an admin.</summary>
public class ActiveMembershipTests
{
    private static readonly Guid Society = Guid.Parse("10000000-0000-0000-0000-000000000001");
    private static readonly Guid Other   = Guid.Parse("10000000-0000-0000-0000-000000000002");
    private static readonly Guid Flat    = Guid.Parse("20000000-0000-0000-0000-000000000807");

    private static string Claim(Guid society, string role, Guid? flat = null) => $"{society}:{role}:{flat}";

    [Fact] public void ResidentAndAdmin_BothRolesCount_WhicheverIsListedFirst()
    {
        var claims = new[] { Claim(Society, "resident", Flat), Claim(Society, "admin") };
        ActiveMembership.RolesIn(claims, Society).Should().BeEquivalentTo("resident", "admin");
        ActiveMembership.RolesIn(claims.Reverse(), Society).Should().BeEquivalentTo("resident", "admin");
    }

    [Fact] public void ARepeatedRole_IsListedOnce()
        => ActiveMembership.RolesIn([Claim(Society, "guard"), Claim(Society, "Guard")], Society).Should().ContainSingle();

    [Fact] public void RolesInAnotherSociety_AreNotMixedIn()
        => ActiveMembership.RolesIn([Claim(Society, "resident", Flat), Claim(Other, "admin")], Society).Should().Equal("resident");

    [Fact] public void NoMembershipHere_MeansNoRoles()
        => ActiveMembership.RolesIn([Claim(Other, "admin")], Society).Should().BeEmpty();

    [Fact] public void TheFlat_ComesFromTheRoleThatHasOne_EvenWhenAdminIsListedFirst()
    {
        ActiveMembership.FlatIn([Claim(Society, "admin"), Claim(Society, "resident", Flat)], Society).Should().Be(Flat);
        ActiveMembership.FlatIn([Claim(Society, "resident", Flat), Claim(Society, "admin")], Society).Should().Be(Flat);
    }

    [Fact] public void AnAdminOrGuardWithNoFlat_HasNoFlat()
        => ActiveMembership.FlatIn([Claim(Society, "admin"), Claim(Society, "guard")], Society).Should().BeNull();

    [Fact] public void AFlatInAnotherSociety_IsNotUsed()
        => ActiveMembership.FlatIn([Claim(Other, "resident", Flat)], Society).Should().BeNull();

    [Fact] public void AnEmptyFlatGuid_CountsAsNoFlat()
        => ActiveMembership.FlatIn([Claim(Society, "admin", Guid.Empty)], Society).Should().BeNull();
}
