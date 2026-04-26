using Xunit;
using FluentAssertions;
using DigitalSocieties.Identity.Domain.Entities;

namespace DigitalSocieties.Identity.Tests.Domain;

public class OtpRequestTests
{
    [Fact]
    public void Verify_WithCorrectOtp_ReturnsTrue()
    {
        var plain  = "123456";
        var hashed = BCrypt.Net.BCrypt.HashPassword(plain, workFactor: 4);
        var otp    = OtpRequest.Create("+919876543210", hashed, "login");
        otp.Verify(plain).Should().BeTrue();
        otp.IsUsed.Should().BeTrue();
    }

    [Fact]
    public void Verify_WithWrongOtp_IncrementsAttempts()
    {
        var hashed = BCrypt.Net.BCrypt.HashPassword("999999", workFactor: 4);
        var otp    = OtpRequest.Create("+919876543210", hashed, "login");
        otp.Verify("111111").Should().BeFalse();
        otp.Attempts.Should().Be(1);
    }

    [Fact]
    public void CanAttempt_AfterMaxAttempts_ReturnsFalse()
    {
        var hashed = BCrypt.Net.BCrypt.HashPassword("999999", workFactor: 4);
        var otp    = OtpRequest.Create("+919876543210", hashed, "login");
        otp.Verify("000000"); otp.Verify("111111"); otp.Verify("222222");
        otp.CanAttempt.Should().BeFalse();
        otp.IsMaxedOut.Should().BeTrue();
    }
}
