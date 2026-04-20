using DigitalSocieties.Shared.Domain.Entities;
using DigitalSocieties.Shared.Results;

namespace DigitalSocieties.Social.Domain.Entities;

/// <summary>
/// Community group within a society.
/// Auto-groups (wing/floor) are created when society flats are provisioned.
/// Manual groups are created by any resident.
/// </summary>
public sealed class SocialGroup : AggregateRoot
{
    public const string TypeAutoWing  = "auto_wing";
    public const string TypeAutoFloor = "auto_floor";
    public const string TypeManual    = "manual";

    public Guid SocietyId              { get; private set; }
    public string Name                 { get; private set; } = string.Empty;
    public string Type                 { get; private set; } = TypeManual;
    public Guid? CreatedByUserId       { get; private set; }
    public DateTimeOffset CreatedAt    { get; private set; }

    public ICollection<GroupMember> Members { get; private set; } = [];

    private SocialGroup() { }

    public static Result<SocialGroup> Create(
        Guid societyId,
        string name,
        string type,
        Guid? createdByUserId)
    {
        if (string.IsNullOrWhiteSpace(name) || name.Length > 80)
            return Result<SocialGroup>.Fail(new Error("Group.InvalidName",
                "Group name must be between 1 and 80 characters."));

        return Result<SocialGroup>.Ok(new SocialGroup
        {
            Id                = Guid.NewGuid(),
            SocietyId         = societyId,
            Name              = name.Trim(),
            Type              = type,
            CreatedByUserId   = createdByUserId,
            CreatedAt         = DateTimeOffset.UtcNow,
        });
    }
}

public sealed class GroupMember : Entity
{
    public Guid GroupId   { get; private set; }
    public Guid UserId    { get; private set; }
    public DateTimeOffset JoinedAt { get; private set; }

    private GroupMember() { }

    public static GroupMember Create(Guid groupId, Guid userId) => new()
    {
        Id       = Guid.NewGuid(),
        GroupId  = groupId,
        UserId   = userId,
        JoinedAt = DateTimeOffset.UtcNow,
    };
}
