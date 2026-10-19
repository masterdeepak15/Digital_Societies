using System.Text.Json;
using Xunit;
using FluentAssertions;
using DigitalSocieties.Facility.Application.Commands;
using DigitalSocieties.Shared.Serialization;

namespace DigitalSocieties.Identity.Tests.Facility;

/// <summary>The console and the app send opening hours as "06:00"; the server must accept exactly what the forms send.</summary>
public class FacilityPayloadTests
{
    // The same options the API registers (Program.cs).
    private static readonly JsonSerializerOptions Web = new(JsonSerializerDefaults.Web) { Converters = { new LenientTimeOnlyConverter() } };

    [Theory]
    [InlineData("06:00", "22:00")]
    [InlineData("06:00:00", "22:00:00")]
    [InlineData("6:30", "21:45")]
    public void OpeningHours_AcceptEveryShapeTheFormsSend(string open, string close)
    {
        var json = $$"""
            {"name":"Gym","description":"","capacityPersons":20,"slotDurationMinutes":60,
             "openTime":"{{open}}","closeTime":"{{close}}","advanceBookingDays":7,"maxBookingsPerFlat":2}
            """;

        var d = JsonSerializer.Deserialize<FacilityDetails>(json, Web);

        d.Should().NotBeNull();
        d!.OpenTime.Should().BeBefore(d.CloseTime);
        new FacilityDetailsValidator().Validate(d).IsValid.Should().BeTrue();
    }

    [Theory]
    [InlineData("\"not a time\"")]
    [InlineData("\"25:00\"")]
    [InlineData("\"\"")]
    [InlineData("null")]
    public void ANonsenseTime_IsStillRefused(string value)
    {
        var json = "{\"name\":\"Gym\",\"description\":\"\",\"capacityPersons\":20,\"slotDurationMinutes\":60,\"openTime\":" + value + ",\"closeTime\":\"22:00\"}";
        var act = () => JsonSerializer.Deserialize<FacilityDetails>(json, Web);
        act.Should().Throw<JsonException>();
    }

    [Fact] public void ATimeIsWrittenWithSeconds_SoOlderReadersKeepWorking()
        => JsonSerializer.Serialize(new TimeOnly(6, 5), Web).Should().Be("\"06:05:00\"");

    [Fact] public void TheBookingTimes_AcceptTheFormShapeToo()
    {
        var b = JsonSerializer.Deserialize<BookFacilityCommand>(
            "{\"facilityId\":\"11111111-1111-1111-1111-111111111111\",\"bookingDate\":\"2026-10-20\",\"startTime\":\"09:00\",\"endTime\":\"10:00:00\"}", Web);
        (b!.StartTime, b.EndTime).Should().Be((new TimeOnly(9, 0), new TimeOnly(10, 0)));
    }
}
