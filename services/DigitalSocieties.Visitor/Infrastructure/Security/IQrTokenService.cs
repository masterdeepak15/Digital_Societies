namespace DigitalSocieties.Visitor.Infrastructure.Security;

public interface IQrTokenService
{
    /// <summary>How long the QR code works: the society's setting when given, else the server default.</summary>
    string Generate(Guid visitorId, Guid societyId, TimeSpan? lifetime = null);
    QrTokenResult Validate(string token);
}

public sealed record QrTokenResult(bool IsValid, Guid? VisitorId = null, string? Error = null);
