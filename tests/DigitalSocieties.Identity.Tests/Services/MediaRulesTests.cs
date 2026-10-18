using Xunit;
using FluentAssertions;
using DigitalSocieties.Shared.Media;

namespace DigitalSocieties.Identity.Tests.Services;

public class MediaRulesTests
{
    private static readonly byte[] Jpeg = [0xFF, 0xD8, 0xFF, 0xE0, 0, 0x10];
    private static readonly byte[] Png  = [0x89, 0x50, 0x4E, 0x47, 0x0D, 0x0A, 0x1A, 0x0A, 0, 0];
    private static readonly byte[] Webp = "RIFF\0\0\0\0WEBPVP8 "u8.ToArray();

    [Fact] public void Sniff_RecognisesJpegPngWebp()
    {
        MediaRules.Sniff(Jpeg).Should().Be("image/jpeg");
        MediaRules.Sniff(Png).Should().Be("image/png");
        MediaRules.Sniff(Webp).Should().Be("image/webp");
    }

    [Fact] public void Sniff_RejectsEverythingElse()
    {
        MediaRules.Sniff("<svg onload=alert(1)>"u8).Should().BeNull();
        MediaRules.Sniff("GIF89a"u8).Should().BeNull();
        MediaRules.Sniff("MZ\x90\0"u8).Should().BeNull();
        MediaRules.Sniff(ReadOnlySpan<byte>.Empty).Should().BeNull();
    }

    [Fact] public void Sha256Hex_SameBytesSameId_DifferentBytesDifferentId()
    {
        MediaRules.Sha256Hex(Jpeg).Should().Be(MediaRules.Sha256Hex(Jpeg.ToArray()));
        MediaRules.Sha256Hex(Jpeg).Should().NotBe(MediaRules.Sha256Hex(Png));
        MediaRules.Sha256Hex("abc"u8).Should().Be("ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad");
    }

    [Fact] public void IsValidId_OnlyLowercase64HexCharacters()
    {
        MediaRules.IsValidId(MediaRules.Sha256Hex(Jpeg)).Should().BeTrue();
        MediaRules.IsValidId("../../etc/passwd").Should().BeFalse();
        MediaRules.IsValidId(new string('A', 64)).Should().BeFalse();
        MediaRules.IsValidId(null).Should().BeFalse();
    }

    [Fact] public void KeyFor_IsPerSocietyAndRejectsBadIds()
    {
        var id = MediaRules.Sha256Hex(Jpeg);
        var a = Guid.NewGuid(); var b = Guid.NewGuid();
        MediaRules.KeyFor(a, id).Should().NotBe(MediaRules.KeyFor(b, id));
        MediaRules.KeyFor(a, id).Should().StartWith($"media/{a:N}/").And.EndWith(id);
        Assert.Throws<ArgumentException>(() => MediaRules.KeyFor(a, "../x"));
    }
}
