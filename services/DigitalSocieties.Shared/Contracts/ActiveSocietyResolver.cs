namespace DigitalSocieties.Shared.Contracts;

/// <summary>
/// Decides which society a request acts on, from the JWT's membership claims
/// ("{societyId}:{role}:{flatId}") and the optional X-Society-Id header.
/// A header can only select a society the user actually belongs to; without a header the
/// first membership is used, so single-society clients (the web console) need no header.
/// </summary>
public static class ActiveSocietyResolver
{
    public static Guid? Resolve(IEnumerable<string> membershipClaims, string? header)
    {
        var societies = membershipClaims
            .Select(c => c.Split(':'))
            .Where(p => p.Length >= 1 && Guid.TryParse(p[0], out _))
            .Select(p => Guid.Parse(p[0]))
            .ToList();

        if (societies.Count == 0) return null;

        if (Guid.TryParse(header, out var requested))
            return societies.Contains(requested) ? requested : null;

        return societies[0];
    }
}

/// <summary>
/// What a person is in one society, from their membership claims. One person can hold several roles
/// there (resident and admin, say), and every one of them counts.
/// </summary>
public static class ActiveMembership
{
    private static IEnumerable<string[]> InSociety(IEnumerable<string> membershipClaims, Guid societyId)
        => membershipClaims
            .Select(c => c.Split(':'))
            .Where(p => p.Length >= 2 && Guid.TryParse(p[0], out var sid) && sid == societyId);

    /// <summary>Every role held in the society, once each.</summary>
    public static IReadOnlyList<string> RolesIn(IEnumerable<string> membershipClaims, Guid societyId)
        => InSociety(membershipClaims, societyId).Select(p => p[1]).Distinct(StringComparer.OrdinalIgnoreCase).ToList();

    /// <summary>The flat the person lives in, taken from whichever of their roles has one (admins and guards have none).</summary>
    public static Guid? FlatIn(IEnumerable<string> membershipClaims, Guid societyId)
        => InSociety(membershipClaims, societyId)
            .Select(p => p.Length >= 3 && Guid.TryParse(p[2], out var fid) && fid != Guid.Empty ? fid : (Guid?)null)
            .FirstOrDefault(f => f is not null);
}
