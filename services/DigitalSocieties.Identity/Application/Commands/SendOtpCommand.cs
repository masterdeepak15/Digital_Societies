using MediatR;
using FluentValidation;
using DigitalSocieties.Shared.Results;
using DigitalSocieties.Shared.Contracts;
using DigitalSocieties.Shared.Domain.ValueObjects;
using DigitalSocieties.Identity.Infrastructure.Services;

namespace DigitalSocieties.Identity.Application.Commands;

// ── Command ──────────────────────────────────────────────────────────────────
/// <summary>
/// Emails a one-time code to the given address.
/// Returns a masked confirmation; never returns the actual code (security).
/// </summary>
public sealed record SendOtpCommand(string Email, string Purpose) : IRequest<Result<SendOtpResponse>>;

public sealed record SendOtpResponse(string MaskedEmail, int ExpiresInSeconds);

// ── Validator (FluentValidation — SRP: validation separate from business logic) ─
public sealed class SendOtpCommandValidator : AbstractValidator<SendOtpCommand>
{
    public SendOtpCommandValidator()
    {
        RuleFor(x => x.Email)
            .NotEmpty().WithMessage("Email is required.")
            .MaximumLength(Email.MaxLength).WithMessage("Email is too long.")
            .Must(e => Email.Create(e).IsSuccess).WithMessage("Enter a valid email address.");

        RuleFor(x => x.Purpose)
            .NotEmpty()
            .Must(p => new[] { "login", "register", "step_up" }.Contains(p))
            .WithMessage("Purpose must be login, register, or step_up.");
    }
}

// ── Handler (SRP: only this handler sends OTPs) ───────────────────────────────
public sealed class SendOtpCommandHandler : IRequestHandler<SendOtpCommand, Result<SendOtpResponse>>
{
    private readonly IOtpService                      _otpService;
    private readonly IEnumerable<INotificationChannel> _channels;
    private readonly IRateLimiter                     _rateLimiter;

    // DIP: depends on abstractions, not a concrete mail provider. The channel is looked up
    // per request so the API still starts (and other modules work) when email is unconfigured.
    public SendOtpCommandHandler(
        IOtpService otpService,
        IEnumerable<INotificationChannel> channels,
        IRateLimiter rateLimiter)
    {
        _otpService  = otpService;
        _channels    = channels;
        _rateLimiter = rateLimiter;
    }

    public async Task<Result<SendOtpResponse>> Handle(
        SendOtpCommand request, CancellationToken ct)
    {
        var emailResult = Email.Create(request.Email);
        if (emailResult.IsFailure)
            return Result<SendOtpResponse>.Fail(emailResult.Error!);
        var email = emailResult.Value!.Value;

        var channel = _channels.FirstOrDefault(c => c.ChannelName == "email" && c.IsEnabled);
        if (channel is null)
            return Result<SendOtpResponse>.Fail("EMAIL.NOT_CONFIGURED",
                "Email delivery is not configured on this server.");

        // Rate limiting: 3 codes per address per hour
        var rateCheck = await _rateLimiter.CheckAsync($"otp:{email}", 3, TimeSpan.FromHours(1), ct);
        if (!rateCheck.Allowed)
            return Result<SendOtpResponse>.Fail("OTP.RATE_LIMITED",
                $"Too many requests. Try again in {rateCheck.RetryAfterSeconds}s.");

        var otp = await _otpService.CreateAsync(email, request.Purpose, ct);

        var sent = await channel.SendAsync(new NotificationMessage(
            Recipient:  email,
            Subject:    "Your sign-in code",
            Body:       $"Your Digital Societies code is {otp.PlainOtp}. Valid for 10 minutes. Do not share it.",
            TemplateId: "otp_login"
        ), ct);

        if (!sent)
            return Result<SendOtpResponse>.Fail("EMAIL.SEND_FAILED",
                "Could not send the code. Please try again later.");

        return Result<SendOtpResponse>.Ok(new SendOtpResponse(Mask(email), 600));
    }

    /// <summary>"ann@example.com" → "a***@example.com".</summary>
    public static string Mask(string email)
    {
        var at = email.IndexOf('@');
        return at <= 0 ? "***" : email[0] + "***" + email[at..];
    }
}
