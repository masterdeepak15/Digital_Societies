namespace DigitalSocieties.Shared.Domain.Enums;

/// <summary>
/// All roles in the system. One user can hold multiple roles across societies.
/// Stored as string in Postgres for readability and migration safety.
/// </summary>
public static class UserRole
{
    public const string Admin      = "admin";       // Management committee member
    public const string Resident   = "resident";    // Flat owner or tenant (primary)
    public const string Family     = "family";      // Family member (scoped permissions)
    public const string Guard      = "guard";       // Security guard
    public const string Staff      = "staff";       // Housekeeping / maintenance staff
    public const string Accountant = "accountant";  // Financial access only
    public const string Vendor     = "vendor";      // Service provider in marketplace

    public static readonly IReadOnlySet<string> All = new HashSet<string>
    {
        Admin, Resident, Family, Guard, Staff, Accountant, Vendor
    };
}
