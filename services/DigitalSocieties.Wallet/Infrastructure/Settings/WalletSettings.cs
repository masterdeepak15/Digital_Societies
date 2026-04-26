namespace DigitalSocieties.Wallet.Infrastructure.Settings;

public sealed class WalletSettings
{
    public const string SectionName = "Razorpay"; // reuses the same Razorpay section
    public string KeyId     { get; set; } = string.Empty;
    public string KeySecret { get; set; } = string.Empty;
}
