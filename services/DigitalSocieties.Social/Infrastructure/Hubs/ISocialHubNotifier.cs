namespace DigitalSocieties.Social.Infrastructure.Hubs;

/// <summary>
/// ISP: focused contract for social feed real-time events only.
/// Concrete implementation lives in the Communication module (SignalRSocialHubNotifier)
/// which gets wired in when both modules are loaded.
/// The Social module registers NullSocialHubNotifier as a safe default.
/// </summary>
public interface ISocialHubNotifier
{
    /// <summary>New post on the main society feed.</summary>
    Task NotifyNewFeedPostAsync(Guid societyId, Guid postId, CancellationToken ct = default);

    /// <summary>New post in a specific group.</summary>
    Task NotifyGroupPostAsync(Guid groupId, Guid postId, CancellationToken ct = default);

    /// <summary>Emergency wall post — loud push to entire society.</summary>
    Task NotifyEmergencyPostAsync(Guid societyId, Guid postId, string body, CancellationToken ct = default);

    /// <summary>New comment on a post — notifies post author.</summary>
    Task NotifyNewCommentAsync(Guid postAuthorUserId, Guid postId, CancellationToken ct = default);

    /// <summary>Someone reacted to a post — notifies post author.</summary>
    Task NotifyReactionAsync(Guid postAuthorUserId, Guid postId, string reactionType, CancellationToken ct = default);
}

/// <summary>
/// Null-object: safe no-op default registered by SocialServiceExtensions.
/// Overridden when the Communication module is loaded in Program.cs.
/// </summary>
public sealed class NullSocialHubNotifier : ISocialHubNotifier
{
    public Task NotifyNewFeedPostAsync(Guid societyId, Guid postId, CancellationToken ct = default)      => Task.CompletedTask;
    public Task NotifyGroupPostAsync(Guid groupId, Guid postId, CancellationToken ct = default)           => Task.CompletedTask;
    public Task NotifyEmergencyPostAsync(Guid societyId, Guid postId, string body, CancellationToken ct = default) => Task.CompletedTask;
    public Task NotifyNewCommentAsync(Guid postAuthorUserId, Guid postId, CancellationToken ct = default) => Task.CompletedTask;
    public Task NotifyReactionAsync(Guid postAuthorUserId, Guid postId, string reactionType, CancellationToken ct = default) => Task.CompletedTask;
}
