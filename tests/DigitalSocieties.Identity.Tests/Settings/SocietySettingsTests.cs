using Xunit;
using FluentAssertions;
using DigitalSocieties.Shared.Contracts;

namespace DigitalSocieties.Identity.Tests.Settings;

public class SocietySettingsTests
{
    [Fact] public void ASocietyThatNeverSavedAnything_GetsSensibleDefaults()
    {
        var s = SocietySettings.Parse(null);
        (s.BillingCycleDay, s.GracePeriodDays, s.LatePenaltyPercent, s.MaintenanceAmount).Should().Be((1, 7, 0m, 0m));
        (s.PushEnabled, s.VisitorAlerts, s.SmsEnabled, s.VisitorQrTtlMinutes, s.OfflineSyncEnabled).Should().Be((true, true, false, 2, true));
        s.Validate().Should().BeNull();
    }

    [Fact] public void SavedValues_ComeBackExactly()
    {
        var saved = new SocietySettings { MaintenanceAmount = 3500, BillingCycleDay = 5, GracePeriodDays = 10, LatePenaltyPercent = 2.5m, GstEnabled = true, GstNumber = "27AAPFU0939F1ZV",
            ContactEmail = "office@society.in", City = "Pune", VisitorAlerts = false, VisitorQrTtlMinutes = 10, PiiWipeDays = 14, SmsEnabled = true, EmailEnabled = false };

        var back = SocietySettings.Parse(saved.ToJson());

        back.Should().Be(saved);
    }

    [Fact] public void ValuesMissingFromOlderSavedText_FallBackOneByOne()
    {
        var s = SocietySettings.Parse("{\"maintenanceAmount\":1200}");
        (s.MaintenanceAmount, s.BillingCycleDay, s.PushEnabled).Should().Be((1200m, 1, true));
    }

    [Theory]
    [InlineData("not json")]
    [InlineData("[]")]
    [InlineData("")]
    public void UnreadableText_MeansDefaults_NotACrash(string text)
        => SocietySettings.Parse(text).Should().Be(SocietySettings.Defaults);

    [Theory]
    [InlineData(nameof(SocietySettings.BillingCycleDay), 0, false)]
    [InlineData(nameof(SocietySettings.BillingCycleDay), 28, true)]
    [InlineData(nameof(SocietySettings.BillingCycleDay), 29, false)]
    [InlineData(nameof(SocietySettings.GracePeriodDays), 31, false)]
    [InlineData(nameof(SocietySettings.GracePeriodDays), 0, true)]
    [InlineData(nameof(SocietySettings.VisitorQrTtlMinutes), 0, false)]
    [InlineData(nameof(SocietySettings.VisitorQrTtlMinutes), 30, true)]
    [InlineData(nameof(SocietySettings.PiiWipeDays), 31, false)]
    public void TheWholeNumberRules(string field, int value, bool valid)
    {
        var s = field switch
        {
            nameof(SocietySettings.BillingCycleDay)     => new SocietySettings { BillingCycleDay = value },
            nameof(SocietySettings.GracePeriodDays)     => new SocietySettings { GracePeriodDays = value },
            nameof(SocietySettings.VisitorQrTtlMinutes) => new SocietySettings { VisitorQrTtlMinutes = value },
            _                                           => new SocietySettings { PiiWipeDays = value },
        };
        (s.Validate() is null).Should().Be(valid);
    }

    [Fact] public void MoneyAndPercentageRules()
    {
        new SocietySettings { MaintenanceAmount = -1 }.Validate().Should().NotBeNull();
        new SocietySettings { MaintenanceAmount = 1_000_001 }.Validate().Should().NotBeNull();
        new SocietySettings { MaintenanceAmount = 3500.50m }.Validate().Should().BeNull();
        new SocietySettings { LatePenaltyPercent = 37 }.Validate().Should().NotBeNull();
        new SocietySettings { LatePenaltyPercent = 36 }.Validate().Should().BeNull();
    }

    [Fact] public void GstNeedsAFifteenCharacterNumber_OnlyWhenOn()
    {
        new SocietySettings { GstEnabled = true, GstNumber = "123" }.Validate().Should().Contain("GST");
        new SocietySettings { GstEnabled = true, GstNumber = "27AAPFU0939F1ZV" }.Validate().Should().BeNull();
        new SocietySettings { GstEnabled = false, GstNumber = "123" }.Validate().Should().BeNull();
    }

    [Fact] public void TheContactEmail_MustLookLikeOne_OrBeEmpty()
    {
        new SocietySettings { ContactEmail = "nope" }.Validate().Should().Contain("email");
        new SocietySettings { ContactEmail = "" }.Validate().Should().BeNull();
    }

    [Fact] public void TheQrLifetime_IsInMinutes()
        => new SocietySettings { VisitorQrTtlMinutes = 5 }.VisitorQrTtl.Should().Be(TimeSpan.FromMinutes(5));
}
