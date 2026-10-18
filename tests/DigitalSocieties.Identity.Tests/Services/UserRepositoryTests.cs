using Xunit;
using FluentAssertions;
using NSubstitute;
using Microsoft.EntityFrameworkCore;
using DigitalSocieties.Identity.Domain.Entities;
using DigitalSocieties.Identity.Infrastructure.Persistence;
using DigitalSocieties.Shared.Contracts;
using DigitalSocieties.Shared.Domain.ValueObjects;

namespace DigitalSocieties.Identity.Tests.Services;

public class UserRepositoryTests
{
    private static DbContextOptions<IdentityDbContext> NewOptions()
        => new DbContextOptionsBuilder<IdentityDbContext>()
            .UseInMemoryDatabase(Guid.NewGuid().ToString()).Options;

    private static IdentityDbContext Ctx(DbContextOptions<IdentityDbContext> o)
        => new(o, Substitute.For<ICurrentUser>());

    [Fact]
    public async Task FindByEmailAsync_LoadsActiveMembershipsWithSociety_SoLoginTokensCarryRoles()
    {
        var options = NewOptions();
        await using var db = Ctx(options);
        var society = Society.Create("Sunrise Heights", "Plot 42, Baner Road, Pune", "REG-1");
        var user    = User.Create(Email.Create("admin@x.io").Value!, "Admin");
        var active  = Membership.Create(user.Id, society.Id, "admin");
        var revoked = Membership.Create(user.Id, society.Id, "resident");
        revoked.Revoke();
        db.Societies.Add(society);
        db.Users.Add(user);
        db.Memberships.AddRange(active, revoked);
        await db.SaveChangesAsync();

        // Read through a fresh context: the writer's change tracker would otherwise fix up
        // every tracked membership into the user, hiding what the query itself loads.
        await using var reader = Ctx(options);
        var found = await new UserRepository(reader).FindByEmailAsync("admin@x.io");

        found.Should().NotBeNull();
        found!.Memberships.Should().ContainSingle();
        found.Memberships[0].Role.Should().Be("admin");
        found.Memberships[0].Society!.Name.Should().Be("Sunrise Heights");
    }

    [Fact]
    public async Task FindByEmailAsync_UnknownEmail_ReturnsNull()
    {
        await using var db = Ctx(NewOptions());
        (await new UserRepository(db).FindByEmailAsync("nobody@x.io")).Should().BeNull();
    }
}
