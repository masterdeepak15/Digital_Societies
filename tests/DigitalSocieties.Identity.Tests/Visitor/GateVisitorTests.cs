using Xunit;
using FluentAssertions;
using NSubstitute;
using Microsoft.EntityFrameworkCore;
using DigitalSocieties.Shared.Contracts;
using DigitalSocieties.Visitor.Application.Commands;
using DigitalSocieties.Visitor.Application.Queries;
using DigitalSocieties.Visitor.Infrastructure.Persistence;
using VisitorEntity = DigitalSocieties.Visitor.Domain.Entities.Visitor;

namespace DigitalSocieties.Identity.Tests.Visitor;

public class GateVisitorTests
{
    private static readonly Guid Society = Guid.NewGuid();
    private static readonly Guid Flat = Guid.NewGuid();

    private static AddVisitorCommand Cmd(Action<Dictionary<string, object?>>? tweak = null)
        => new(Society, Flat, "Ravi Kumar", "9876543210", "Guest", null, null);

    private static VisitorDbContext Db()
    {
        var opts = new DbContextOptionsBuilder<VisitorDbContext>().UseInMemoryDatabase(Guid.NewGuid().ToString()).Options;
        return new VisitorDbContext(opts, Substitute.For<ICurrentUser>());
    }

    private static readonly string Hash = new('a', 64);

    // ── validation ─────────────────────────────────────────────────────────────
    [Fact] public void Validator_AcceptsAFullEntry()
    {
        var cmd = Cmd() with
        {
            PhotoMediaId = Hash, IdType = "aadhaar", IdNumber = "1234 5678 9012", IdPhotoMediaId = Hash,
            VehicleNumber = "MH12AB1234", VehicleType = "Car",
            Companions = [new VisitorCompanion("Sita", "9876543211"), new VisitorCompanion("Child")],
        };
        new AddVisitorCommandValidator().Validate(cmd).IsValid.Should().BeTrue();
    }

    [Theory]
    [InlineData("passport-ish")]
    [InlineData("<script>")]
    public void Validator_RejectsAnUnknownIdType(string idType)
        => new AddVisitorCommandValidator().Validate(Cmd() with { IdType = idType }).IsValid.Should().BeFalse();

    [Fact] public void Validator_RejectsAPictureIdThatIsNotAHash()
        => new AddVisitorCommandValidator().Validate(Cmd() with { PhotoMediaId = "../../etc/passwd" }).IsValid.Should().BeFalse();

    [Fact] public void Validator_RejectsMoreThanTenCompanions()
        => new AddVisitorCommandValidator()
            .Validate(Cmd() with { Companions = Enumerable.Range(0, 11).Select(i => new VisitorCompanion($"P{i}")).ToList() })
            .IsValid.Should().BeFalse();

    [Fact] public void Validator_RejectsACompanionWithoutAName()
        => new AddVisitorCommandValidator().Validate(Cmd() with { Companions = [new VisitorCompanion("")] }).IsValid.Should().BeFalse();

    // ── phone matching ─────────────────────────────────────────────────────────
    [Theory]
    [InlineData("+91 98765 43210", "9876543210")]
    [InlineData("09876543210", "9876543210")]
    [InlineData("9876543210", "9876543210")]
    [InlineData("12345", null)]
    [InlineData(null, null)]
    public void Normalize_KeepsTheLastTenDigits(string? input, string? expected)
        => LookupVisitorQueryHandler.Normalize(input).Should().Be(expected);

    // ── returning visitors ─────────────────────────────────────────────────────
    [Fact] public async Task Lookup_UnknownNumber_ReturnsNotFound()
    {
        var r = await new LookupVisitorQueryHandler(Db()).Handle(new LookupVisitorQuery(Society, "9000000000"), default);
        r.Value!.Found.Should().BeFalse();
    }

    [Fact] public async Task Lookup_FindsTheLastVisitAcrossNumberFormatsAndKeepsEarlierPhotoAndId()
    {
        var db = Db();
        var first = VisitorEntity.Create(Society, Flat, "Ravi Kumar", "+919876543210", "Delivery", Guid.NewGuid());
        first.SetGateDetails(Hash, "aadhaar", "9012", null, "Bike", null);
        first.SetVehicle("MH12AB1234");
        var second = VisitorEntity.Create(Society, Guid.NewGuid(), "Ravi K", "9876543210", "Guest", Guid.NewGuid());
        db.Visitors.AddRange(first, second);
        await db.SaveChangesAsync();

        var h = (await new LookupVisitorQueryHandler(db).Handle(new LookupVisitorQuery(Society, "098765 43210"), default)).Value!;

        h.Found.Should().BeTrue();
        h.VisitCount.Should().Be(2);
        h.PhotoMediaId.Should().Be(Hash);          // the newer visit recorded none, the older one did
        h.IdType.Should().Be("aadhaar");
        h.IdLast4.Should().Be("9012");
        h.VehicleNumber.Should().Be("MH12AB1234");
    }

    [Fact] public async Task Lookup_NeverCrossesSocieties()
    {
        var db = Db();
        db.Visitors.Add(VisitorEntity.Create(Guid.NewGuid(), Flat, "Other Society Guest", "9876543210", "Guest", Guid.NewGuid()));
        await db.SaveChangesAsync();
        (await new LookupVisitorQueryHandler(db).Handle(new LookupVisitorQuery(Society, "9876543210"), default)).Value!.Found.Should().BeFalse();
    }
}
