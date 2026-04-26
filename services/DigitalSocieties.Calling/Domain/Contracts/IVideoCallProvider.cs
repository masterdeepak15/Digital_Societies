namespace DigitalSocieties.Calling.Domain.Contracts;

/// <summary>
/// DIP: API layer depends on this abstraction, not on LiveKit/Jitsi directly.
/// OCP: swap providers by registering a different implementation — zero call-site changes.
/// </summary>
public interface IVideoCallProvider
{
    /// <summary>Human-readable name for diagnostics (e.g. "LiveKit", "JitsiMeet").</summary>
    string ProviderName { get; }

    /// <summary>
    /// Generates a short-lived JWT room token for a participant.
    /// The returned token is passed to the mobile SDK to join the room.
    /// </summary>
    Task<RoomToken> GenerateTokenAsync(
        string        roomName,
        string        participantIdentity,
        string        participantName,
        bool          canPublish,
        bool          canSubscribe,
        TimeSpan      ttl,
        CancellationToken ct = default);

    /// <summary>
    /// Creates the room on the provider side (idempotent — safe to call even if it already exists).
    /// </summary>
    Task CreateRoomAsync(string roomName, TimeSpan emptyTimeout, CancellationToken ct = default);

    /// <summary>Terminates all participants and deletes the room.</summary>
    Task DeleteRoomAsync(string roomName, CancellationToken ct = default);
}

public sealed record RoomToken(string Token, string ServerUrl, string ProviderName);
