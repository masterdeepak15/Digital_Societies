using Xunit;
using FluentAssertions;
using NSubstitute;
using Microsoft.EntityFrameworkCore;
using System.Text.RegularExpressions;
using DigitalSocieties.Identity.Domain.Entities;
using DigitalSocieties.Identity.Infrastructure.Persistence;
using DigitalSocieties.Identity.Infrastructure.Services;
using DigitalSocieties.Shared.Contracts;

namespace DigitalSocieties.Identity.Tests.Services;

public class OtpServiceTests
{
    private const string Email   = "ann@example.com";
    private const string Purpose = "login";

    private static DbContextOptions<IdentityDbContext> NewOptions()
        => new DbContextOptionsBuilder<IdentityDbContext>()
            .UseInMemoryDatabase(Guid.NewGuid().ToString())
            .Options;

    private static IdentityDbContext Ctx(DbContextOptions<IdentityDbContext> o)
        => new(o, Substitute.For<ICurrentUser>());

    [Fact]
    public void GenerateOtp_Is6Digits()
    {
        for (int i = 0; i < 1000; i++)
            Regex.IsMatch(OtpService.GenerateOtp(), @"^\d{6}$").Should().BeTrue();
    }

    [Fact]
    public async Task Verify_CorrectOtp_Succeeds()
    {
        var o = NewOptions();
        await using var db = Ctx(o);
        var svc = new OtpService(db);
        var created = await svc.CreateAsync(Email, Purpose, default);

        var result = await svc.VerifyAsync(Email, created.PlainOtp, Purpose, default);

        result.IsSuccess.Should().BeTrue();
    }

    [Fact]
    public async Task Verify_SameOtpTwice_SecondFailsNotFoundAndAttemptsUnchanged()
    {
        var o = NewOptions();
        await using var db = Ctx(o);
        var svc = new OtpService(db);
        var created = await svc.CreateAsync(Email, Purpose, default);
        (await svc.VerifyAsync(Email, created.PlainOtp, Purpose, default)).IsSuccess.Should().BeTrue();
        var attemptsAfterUse = (await db.OtpRequests.SingleAsync()).Attempts;

        var second = await svc.VerifyAsync(Email, created.PlainOtp, Purpose, default);

        second.IsFailure.Should().BeTrue();
        second.Error!.Code.Should().Be("OTP.NOT_FOUND");
        (await db.OtpRequests.SingleAsync()).Attempts.Should().Be(attemptsAfterUse);
    }

    [Fact]
    public async Task Verify_Expired_ReturnsExpired()
    {
        var o = NewOptions();
        await using var db = Ctx(o);
        var svc = new OtpService(db);
        var created = await svc.CreateAsync(Email, Purpose, default);
        var row = await db.OtpRequests.SingleAsync();
        db.Entry(row).Property(nameof(OtpRequest.ExpiresAt)).CurrentValue = DateTimeOffset.UtcNow.AddMinutes(-1);
        await db.SaveChangesAsync();

        var result = await svc.VerifyAsync(Email, created.PlainOtp, Purpose, default);

        result.Error!.Code.Should().Be("OTP.EXPIRED");
    }

    [Fact]
    public async Task Verify_WrongOtp_ReportsRemainingAttempts()
    {
        var o = NewOptions();
        await using var db = Ctx(o);
        var svc = new OtpService(db);
        await svc.CreateAsync(Email, Purpose, default);

        var result = await svc.VerifyAsync(Email, "000000", Purpose, default);

        result.Error!.Code.Should().Be("OTP.INVALID");
        result.Error.Message.Should().Contain("2 attempt(s) remaining");
    }

    [Fact]
    public async Task Verify_AfterThreeMisses_ReturnsMaxedOutEvenForCorrectOtp()
    {
        var o = NewOptions();
        await using var db = Ctx(o);
        var svc = new OtpService(db);
        var created = await svc.CreateAsync(Email, Purpose, default);
        var wrong = created.PlainOtp == "000000" ? "111111" : "000000";
        for (int i = 0; i < OtpRequest.MaxAttempts; i++)
            await svc.VerifyAsync(Email, wrong, Purpose, default);

        var result = await svc.VerifyAsync(Email, created.PlainOtp, Purpose, default);

        result.Error!.Code.Should().Be("OTP.MAXED_OUT");
    }

    [Fact]
    public async Task Create_ReplacesPreviousPendingOtp()
    {
        var o = NewOptions();
        await using var db = Ctx(o);
        var svc = new OtpService(db);
        var first  = await svc.CreateAsync(Email, Purpose, default);
        var second = await svc.CreateAsync(Email, Purpose, default);

        (await db.OtpRequests.CountAsync()).Should().Be(1);
        if (first.PlainOtp != second.PlainOtp)
            (await svc.VerifyAsync(Email, first.PlainOtp, Purpose, default)).IsFailure.Should().BeTrue();
    }

    [Fact]
    public async Task Verify_UsesLatestUnusedRequest()
    {
        var o = NewOptions();
        await using var db = Ctx(o);
        db.OtpRequests.Add(OtpRequest.Create(Email, BCrypt.Net.BCrypt.HashPassword("111111", workFactor: 4), Purpose));
        await db.SaveChangesAsync();
        await Task.Delay(10);
        db.OtpRequests.Add(OtpRequest.Create(Email, BCrypt.Net.BCrypt.HashPassword("222222", workFactor: 4), Purpose));
        await db.SaveChangesAsync();
        var svc = new OtpService(db);

        (await svc.VerifyAsync(Email, "222222", Purpose, default)).IsSuccess.Should().BeTrue();
    }
}
