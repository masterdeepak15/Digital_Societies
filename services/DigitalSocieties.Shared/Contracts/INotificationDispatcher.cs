namespace DigitalSocieties.Shared.Contracts;

/// <summary>
/// Delivers a notification to a user, trying channels in priority order
/// (push → SMS → email) until one succeeds.
///
/// This is the guard offline hardening contract: when the resident's app
/// is not reachable via push (offline, no token, delivery failure), the
/// dispatcher automatically falls back to SMS so the resident is always
/// notified about a pending visitor.
///
/// The concrete implementation lives in the Communication module.
/// The interface lives here (Shared) so any module (Visitor, Billing, etc.)
/// can inject it without creating a circular dependency.
/// </summary>
public interface INotificationDispatcher
{
    /// <summary>
    /// Try channels in order until one succeeds.
    /// </summary>
    /// <param name="message">Notification payload. Recipient = userId (Guid string).</param>
    /// <param name="recipientPhone">Phone number for SMS fallback.</param>
    /// <param name="ct">Cancellation token.</param>
    /// <returns>Channel name that succeeded ("push" | "sms" | "email"), or null if all failed.</returns>
    Task<string?> DispatchAsync(
        NotificationMessage message,
        string              recipientPhone,
        CancellationToken   ct = default);
}
