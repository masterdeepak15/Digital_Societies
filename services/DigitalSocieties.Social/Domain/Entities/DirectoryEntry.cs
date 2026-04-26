using DigitalSocieties.Shared.Domain.Entities;
using DigitalSocieties.Shared.Results;

namespace DigitalSocieties.Social.Domain.Entities;

/// <summary>
/// A resident's opted-in directory entry.
/// Each field is independently opt-in — a resident may show their name+flat
/// but hide their phone. Admin can force-hide any entry.
///
/// Privacy: no entry is created unless the resident explicitly opts in.
/// </summary>
public sealed class DirectoryEntry : Entity
{
    public Guid UserId       { get; private set; }
    public Guid SocietyId    { get; private set; }
    public string DisplayName { get; private set; } = string.Empty;
    public bool ShowPhone    { get; private set; }
    public bool ShowEmail    { get; private set; }
    public string? Bio       { get; private set; }   // max 150 chars
    public bool IsHiddenByAdmin { get; private set; }
    public DateTimeOffset UpdatedAt { get; private set; }

    private DirectoryEntry() { }

    public static Result<DirectoryEntry> Create(
        Guid userId,
        Guid societyId,
        string displayName,
        bool showPhone = false,
        bool showEmail = false,
        string? bio = null)
    {
        if (string.IsNullOrWhiteSpace(displayName) || displayName.Length > 80)
            return Result<DirectoryEntry>.Fail(new Error("Directory.InvalidName",
                "Display name must be between 1 and 80 characters."));

        if (bio?.Length > 150)
            return Result<DirectoryEntry>.Fail(new Error("Directory.BioTooLong",
                "Bio must be 150 characters or fewer."));

        return Result<DirectoryEntry>.Ok(new DirectoryEntry
        {
            Id          = Guid.NewGuid(),
            UserId      = userId,
            SocietyId   = societyId,
            DisplayName = displayName.Trim(),
            ShowPhone   = showPhone,
            ShowEmail   = showEmail,
            Bio         = bio?.Trim(),
            UpdatedAt   = DateTimeOffset.UtcNow,
        });
    }

    public Result<bool> Update(string displayName, bool showPhone, bool showEmail, string? bio)
    {
        if (string.IsNullOrWhiteSpace(displayName) || displayName.Length > 80)
            return Result<bool>.Fail(new Error("Directory.InvalidName",
                "Display name must be between 1 and 80 characters."));

        if (bio?.Length > 150)
            return Result<bool>.Fail(new Error("Directory.BioTooLong",
                "Bio must be 150 characters or fewer."));

        DisplayName = displayName.Trim();
        ShowPhone   = showPhone;
        ShowEmail   = showEmail;
        Bio         = bio?.Trim();
        UpdatedAt   = DateTimeOffset.UtcNow;
        return Result<bool>.Ok(true);
    }

    public void AdminHide()   => IsHiddenByAdmin = true;
    public void AdminUnhide() => IsHiddenByAdmin = false;
}
