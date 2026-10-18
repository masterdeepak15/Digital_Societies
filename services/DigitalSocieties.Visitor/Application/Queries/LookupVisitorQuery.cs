using System.Text.Json;
using MediatR;
using Microsoft.EntityFrameworkCore;
using DigitalSocieties.Shared.Results;
using DigitalSocieties.Visitor.Application.Commands;
using DigitalSocieties.Visitor.Infrastructure.Persistence;

namespace DigitalSocieties.Visitor.Application.Queries;

/// <summary>Finds a returning visitor by mobile number so the guard can see who they were last time.</summary>
public sealed record LookupVisitorQuery(Guid SocietyId, string Phone) : IRequest<Result<VisitorHistoryDto>>;

public sealed record VisitorHistoryDto(
    bool Found,
    string? Name,
    int VisitCount,
    DateTimeOffset? LastVisitAt,
    Guid? LastFlatId,
    string? LastPurpose,
    string? VehicleNumber,
    string? VehicleType,
    string? PhotoMediaId,
    string? IdType,
    string? IdLast4,
    IReadOnlyList<VisitorCompanion> Companions)
{
    public static VisitorHistoryDto None { get; } = new(false, null, 0, null, null, null, null, null, null, null, null, []);
}

public sealed class LookupVisitorQueryHandler(VisitorDbContext db)
    : IRequestHandler<LookupVisitorQuery, Result<VisitorHistoryDto>>
{
    /// <summary>The last 10 digits, so "+91 98765 43210", "09876543210" and "9876543210" all match.</summary>
    public static string? Normalize(string? phone)
    {
        var digits = new string((phone ?? "").Where(char.IsDigit).ToArray());
        return digits.Length >= 10 ? digits[^10..] : null;
    }

    public async Task<Result<VisitorHistoryDto>> Handle(LookupVisitorQuery q, CancellationToken ct)
    {
        var key = Normalize(q.Phone);
        if (key is null) return Result<VisitorHistoryDto>.Ok(VisitorHistoryDto.None);

        var visits = await db.Visitors
            .Where(v => v.SocietyId == q.SocietyId && v.Phone != null && v.Phone.EndsWith(key))
            .OrderByDescending(v => v.EntryTime)
            .Take(50)
            .ToListAsync(ct);
        if (visits.Count == 0) return Result<VisitorHistoryDto>.Ok(VisitorHistoryDto.None);

        var last = visits[0];
        // Photo, ID and vehicle: the most recent visit that recorded each (a later visit may have skipped them).
        var photo   = visits.Select(v => v.PhotoMediaId).FirstOrDefault(x => !string.IsNullOrEmpty(x));
        var withId  = visits.FirstOrDefault(v => !string.IsNullOrEmpty(v.IdType));
        var vehicle = visits.FirstOrDefault(v => !string.IsNullOrEmpty(v.VehicleNumber));
        var companions = new List<VisitorCompanion>();
        if (!string.IsNullOrEmpty(last.CompanionsJson))
        {
            try { companions = JsonSerializer.Deserialize<List<VisitorCompanion>>(last.CompanionsJson) ?? []; }
            catch (JsonException) { /* an unreadable old value is simply not shown */ }
        }

        return Result<VisitorHistoryDto>.Ok(new VisitorHistoryDto(
            true, last.Name, visits.Count, last.EntryTime, last.FlatId, last.Purpose,
            vehicle?.VehicleNumber, vehicle?.VehicleType, photo, withId?.IdType, withId?.IdLast4, companions));
    }
}
