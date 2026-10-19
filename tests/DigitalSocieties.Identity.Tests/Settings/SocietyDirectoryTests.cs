using Xunit;
using FluentAssertions;
using NSubstitute;
using Microsoft.EntityFrameworkCore;
using DigitalSocieties.Identity.Domain.Entities;
using DigitalSocieties.Identity.Infrastructure.Persistence;
using DigitalSocieties.Identity.Infrastructure.Settings;
using DigitalSocieties.Shared.Contracts;
using DigitalSocieties.Shared.Domain.ValueObjects;

namespace DigitalSocieties.Identity.Tests.Settings;

public class SocietyDirectoryTests
{
    private static IdentityDbContext NewDb()
        => new(new DbContextOptionsBuilder<IdentityDbContext>().UseInMemoryDatabase(Guid.NewGuid().ToString()).Options, Substitute.For<ICurrentUser>());

    private static User Person(string email) => User.Create(Email.Create(email).Value!, email.Split('@')[0]);

    [Fact] public async Task TheDirectory_ListsActiveSocieties_AndTheEmailsOfTheirMembersOnce()
    {
        var db = NewDb();
        var society = Society.Create("Govindbaug", "Dehugaon", "NA");
        var other = Society.Create("Elsewhere", "Pune", "X1");
        var asha = Person("asha@x.in"); var bhaskar = Person("bhaskar@x.in"); var outsider = Person("out@x.in");
        db.Societies.AddRange(society, other);
        db.Users.AddRange(asha, bhaskar, outsider);
        db.Memberships.Add(Membership.Create(asha.Id, society.Id, "resident", null, "owner"));
        db.Memberships.Add(Membership.Create(asha.Id, society.Id, "admin", null, "staff"));        // two roles, one email
        db.Memberships.Add(Membership.Create(bhaskar.Id, society.Id, "guard", null, "staff"));
        db.Memberships.Add(Membership.Create(outsider.Id, other.Id, "resident", null, "owner"));
        await db.SaveChangesAsync();
        var dir = new IdentitySocietyDirectory(db);

        (await dir.ActiveSocietyIdsAsync(default)).Should().BeEquivalentTo(new[] { society.Id, other.Id });
        (await dir.MemberEmailsAsync(society.Id, default)).Should().BeEquivalentTo("asha@x.in", "bhaskar@x.in");
    }

    [Fact] public async Task ProfileShowsTheSocietyAndItsContactDetails()
    {
        var db = NewDb();
        var society = Society.Create("Govindbaug", "Near Parandwal Chowk", "NA");
        society.SaveSettings(new SocietySettings { City = "Pune", Pincode = "412109", ContactEmail = "office@govindbaug.in", ContactPhone = "+919975001173" });
        db.Societies.Add(society);
        await db.SaveChangesAsync();

        var p = await new IdentitySocietyDirectory(db).ProfileAsync(society.Id, default);

        p.Should().Be(new SocietyProfile("Govindbaug", "Near Parandwal Chowk", "Pune", "412109", "office@govindbaug.in", "+919975001173"));
        (await new IdentitySocietyDirectory(db).ProfileAsync(Guid.NewGuid(), default)).Should().BeNull();
    }
}
