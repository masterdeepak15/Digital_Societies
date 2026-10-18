using Xunit;
using FluentAssertions;
using DigitalSocieties.Shared.Contracts;

namespace DigitalSocieties.Identity.Tests.Services;

public class ActiveSocietyResolverTests
{
    private static readonly Guid A = Guid.Parse("10000000-0000-0000-0000-000000000001");
    private static readonly Guid B = Guid.Parse("10000000-0000-0000-0000-000000000002");
    private static readonly Guid Stranger = Guid.Parse("10000000-0000-0000-0000-0000000000ff");

    private static string Claim(Guid society, string role = "admin") => $"{society}:{role}:";

    [Fact]
    public void NoHeader_UsesTheOnlyMembership()
    {
        ActiveSocietyResolver.Resolve([Claim(A)], null).Should().Be(A);
    }

    [Fact]
    public void NoHeader_UsesTheFirstMembershipWhenThereAreSeveral()
    {
        ActiveSocietyResolver.Resolve([Claim(A), Claim(B)], null).Should().Be(A);
    }

    [Fact]
    public void Header_SelectsAnotherMembership()
    {
        ActiveSocietyResolver.Resolve([Claim(A), Claim(B)], B.ToString()).Should().Be(B);
    }

    [Fact]
    public void Header_ForASocietyTheUserIsNotAMemberOf_IsRejected()
    {
        ActiveSocietyResolver.Resolve([Claim(A)], Stranger.ToString()).Should().BeNull();
    }

    [Theory]
    [InlineData("")]
    [InlineData("   ")]
    [InlineData("not-a-guid")]
    public void BlankOrGarbageHeader_FallsBackToTheFirstMembership(string header)
    {
        ActiveSocietyResolver.Resolve([Claim(A)], header).Should().Be(A);
    }

    [Fact]
    public void NoMemberships_ResolvesNothingEvenWithAHeader()
    {
        ActiveSocietyResolver.Resolve([], null).Should().BeNull();
        ActiveSocietyResolver.Resolve([], A.ToString()).Should().BeNull();
    }

    [Fact]
    public void MalformedClaims_AreIgnored()
    {
        ActiveSocietyResolver.Resolve(["garbage", "", "xyz:admin:"], null).Should().BeNull();
        ActiveSocietyResolver.Resolve(["garbage", Claim(B)], null).Should().Be(B);
    }
}
