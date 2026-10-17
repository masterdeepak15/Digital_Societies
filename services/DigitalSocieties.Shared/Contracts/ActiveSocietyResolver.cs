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
