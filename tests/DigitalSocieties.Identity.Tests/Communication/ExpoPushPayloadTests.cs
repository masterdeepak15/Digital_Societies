using System.Text.Json;
using Xunit;
using FluentAssertions;
using DigitalSocieties.Shared.Contracts;
using DigitalSocieties.Communication.Infrastructure.Push;

namespace DigitalSocieties.Identity.Tests.Communication;

/// <summary>A visitor at the gate must ring and vibrate the resident's phone; chat is softer. The Android channel decides which.</summary>
public class ExpoPushPayloadTests
{
    private static NotificationMessage Visitor() => new("flat-id", "Visitor at gate: Ramesh", "Ramesh is at the gate for Delivery.", null,
        new Dictionary<string, string> { ["type"] = "visitor", ["channelId"] = "visitors", ["recipientKind"] = "flat", ["visitorId"] = "v1" });

    private static JsonElement One(NotificationMessage m, string token = "ExponentPushToken[abc]")
        => JsonSerializer.SerializeToElement(ExpoPushPayloads.Build(m, new[] { token }).Single());

    [Fact] public void AVisitorAlert_UsesTheLoudChannel_AtHighPriority_AndExpiresQuickly()
    {
        var p = One(Visitor());
        p.GetProperty("channelId").GetString().Should().Be("visitors");
        p.GetProperty("priority").GetString().Should().Be("high");
        p.GetProperty("sound").GetString().Should().Be("default");
        p.GetProperty("ttl").GetInt32().Should().Be(120);
        p.GetProperty("to").GetString().Should().Be("ExponentPushToken[abc]");
        p.GetProperty("title").GetString().Should().Be("Visitor at gate: Ramesh");
    }

    [Fact] public void TheAddressingHint_IsNotSentToThePhone_ButTheRestOfTheDataIs()
    {
        var data = One(Visitor()).GetProperty("data");
        data.TryGetProperty("recipientKind", out _).Should().BeFalse();
        data.GetProperty("visitorId").GetString().Should().Be("v1");
        data.GetProperty("type").GetString().Should().Be("visitor");
    }

    [Theory]
    [InlineData("visitor", "visitors")]
    [InlineData("emergency", "emergency")]
    [InlineData("chat", "chat")]
    [InlineData("bill", "general")]
    public void TheChannel_IsChosenFromTheType_WhenNotNamed(string type, string channel)
        => ExpoPushPayloads.ChannelOf(new NotificationMessage("u", "s", "b", null, new() { ["type"] = type })).Should().Be(channel);

    [Fact] public void WithNoData_ItIsAGeneralNotification()
        => ExpoPushPayloads.ChannelOf(new NotificationMessage("u", "s", "b")).Should().Be("general");

    [Fact] public void ChatIsLessUrgentThanAVisitor()
    {
        var chat = One(new NotificationMessage("u", "Wing A", "Asha: hi", null, new() { ["type"] = "chat", ["channelId"] = "chat" }));
        chat.GetProperty("channelId").GetString().Should().Be("chat");
        chat.GetProperty("ttl").GetInt32().Should().BeGreaterThan(120);
    }

    [Fact] public void OnlyAFlatAddressedMessage_IsTreatedAsAFlat()
    {
        ExpoPushPayloads.IsFlatRecipient(Visitor()).Should().BeTrue();
        ExpoPushPayloads.IsFlatRecipient(new NotificationMessage("u", "s", "b")).Should().BeFalse();
    }

    [Fact] public void EveryTokenGetsItsOwnMessage()
        => ExpoPushPayloads.Build(Visitor(), new[] { "a", "b", "c" }).Should().HaveCount(3);
}
