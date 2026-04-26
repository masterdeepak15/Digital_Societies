namespace DigitalSocieties.Visitor.Infrastructure.Security;

public interface IQrTokenService
{
    string Generate(Guid visitorId, Guid societyId);
    QrTokenResult Validate(string token);
}

public sealed record QrTokenResult(bool IsValid, Guid? VisitorId = null, string? Error = null);
