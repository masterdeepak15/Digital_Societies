namespace DigitalSocieties.Calling.Infrastructure.Settings;

public sealed class CallingSettings
{
    public const string SectionName = "Calling";

    /// <summary>"LiveKit" or "JitsiMeet"</summary>
    public string Provider { get; set; } = "LiveKit";

    public LiveKitOptions LiveKit { get; set; } = new();
    public JitsiOptions   Jitsi   { get; set; } = new();
}

public sealed class LiveKitOptions
{
    public string ServerUrl { get; set; } = "wss://your-project.livekit.cloud";
    public string ApiKey    { get; set; } = "LIVEKIT_API_KEY";
    public string ApiSecret { get; set; } = "LIVEKIT_API_SECRET";
}

public sealed class JitsiOptions
{
    public string ServerUrl { get; set; } = "https://meet.yourdomain.com";
    public string AppId     { get; set; } = "JITSI_APP_ID";
    public string AppSecret { get; set; } = "JITSI_APP_SECRET";
}
