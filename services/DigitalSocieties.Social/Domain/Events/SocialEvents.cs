using DigitalSocieties.Shared.Domain.Events;

namespace DigitalSocieties.Social.Domain.Events;

/// <summary>Raised when any resident (or admin) creates a new post.</summary>
public sealed record PostCreatedEvent(
    Guid PostId,
    Guid SocietyId,
    Guid AuthorUserId,
    string Category,
    Guid? GroupId) : DomainEvent;

/// <summary>Raised when a post is soft-deleted.</summary>
public sealed record PostDeletedEvent(
    Guid PostId,
    Guid SocietyId,
    Guid DeletedByUserId) : DomainEvent;

/// <summary>Raised when an admin posts to the Emergency Wall — triggers loud push.</summary>
public sealed record EmergencyPostCreatedEvent(
    Guid PostId,
    Guid SocietyId,
    string Body) : DomainEvent;

/// <summary>Raised when a comment is added to a post — notifies post author.</summary>
public sealed record CommentAddedEvent(
    Guid CommentId,
    Guid PostId,
    Guid SocietyId,
    Guid AuthorUserId) : DomainEvent;

/// <summary>Raised when a user reacts to a post — notifies post author.</summary>
public sealed record PostReactedEvent(
    Guid PostId,
    Guid SocietyId,
    Guid ReactingUserId,
    string ReactionType) : DomainEvent;

/// <summary>Raised when a poll ends (scheduled) — sends results to society.</summary>
public sealed record PollEndedEvent(
    Guid PollId,
    Guid PostId,
    Guid SocietyId) : DomainEvent;

/// <summary>Raised when a post is reported for moderation.</summary>
public sealed record PostReportedEvent(
    Guid PostId,
    Guid SocietyId,
    Guid ReportedByUserId,
    string Reason) : DomainEvent;
