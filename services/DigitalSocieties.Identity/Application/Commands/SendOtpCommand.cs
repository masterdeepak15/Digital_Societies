using MediatR;
using FluentValidation;
using DigitalSocieties.Shared.Results;
using DigitalSocieties.Shared.Contracts;
using DigitalSocieties.Identity.Infrastructure.Services;

namespace DigitalSocieties.Identity.Application.Commands;

// ── Command ──────────────────────────────────────────────────────────────────
/// <summary>
/// Sends an OTP to the given phone number.
/// Returns masked confirmation; never returns the actual OTP (security).
/// </summary>
public sealed record SendOtpCommand(string Phone, string Purpose) : IRequest<Result<SendOtpResponse>>;

public sealed record SendOtpResponse(string MaskedPhone, int ExpiresInSeconds);

// ── Validator (FluentValidation — SRP: validation separate from business logic) ─
public sealed class SendOtpCommandValidator : AbstractValidator<SendOtpCommand>
{
    public SendOtpCommandValidator()
    {
        RuleFor(x => x.Phone)
            .NotEmpty().WithMessage("Phone is required.")
            .Matches(@"^(\+91)?[6-9]\d{9}$").WithMessage("Enter a valid Indian mobile number.");

        RuleFor(x => x.Purpose)
            .NotEmpty()
            .Must(p => new[] { "login", "register", "step_up" }.Contains(p))
            .WithMessage("Purpose must be login, register, or step_up.");
    }
}

// ── Handler (SRP: only this handler sends OTPs) ───────────────────────────────
public sealed class SendOtpCommandHandler : IRequestHandler<SendOtpCommand, Result<SendOtpResponse>>
{
    private readonly IOtpService         _otpService;
    private readonly INotificationChannel _smsChannel;
    private readonly IRateLimiter         _rateLimiter;

    // DIP: depends on abstractions, not concrete SMS provider
    public SendOtpCommandHandler(
        IOtpService otpService,
        IEnumerable<INotificationChannel> channels,
        IRateLimiter rateLimiter)
    {
        _otpService  = otpService;
        _smsChannel  = channels.First(c => c.ChannelName == "sms");
        _rateLimiter = rateLimiter;
    }

    public async Task<Result<SendOtpResponse>> Handle(
        SendOtpCommand request, CancellationToken ct)
    {
        // Rate limiting: 3 OTPs per phone per hour
        var rateCheck = await _rateLimiter.CheckAsync($"otp:{request.Phone}", 3, TimeSpan.FromHours(1), ct);
        if (!rateCheck.Allowed)
            return Result<SendOtpResponse>.Fail("OTP.RATE_LIMITED",
                $"Too many requests. Try again in {rateCheck.RetryAfterSeconds}s.");

        var otp = await _otpService.CreateAsync(request.Phone, request.Purpose, ct);

        await _smsChannel.SendAsync(new NotificationMessage(
            Recipient:  request.Phone,
            Subject:    "Digital Societies OTP",
            Body:       $"Your OTP is {otp.PlainOtp}. Valid for 10 minutes. Do not share with anyone.",
            TemplateId: "otp_login"
        ), ct);

        var masked = "XXXXXX" + request.Phone[^4..];
        return Result<SendOtpResponse>.Ok(new SendOtpResponse(masked, 600));
    }
}
