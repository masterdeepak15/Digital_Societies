using System.Text.Json;
using MediatR;
using DigitalSocieties.Visitor.Application.Commands;
using DigitalSocieties.Shared.Results;
using DigitalSocieties.Visitor.Domain.Entities;
using DigitalSocieties.Visitor.Infrastructure.Persistence;
using Microsoft.EntityFrameworkCore;

namespace DigitalSocieties.Visitor.Application.Queries;

public record GetVisitorsQuery(
    Guid SocietyId,
    Guid? FlatId,
    string? Status,
    int Page,
    int PageSize) : IRequest<Result<PagedResult<VisitorDto>>>;

public record VisitorDto(
    Guid Id,
    string VisitorName,
    string? VisitorPhone,
    string Purpose,
    string Status,
    Guid FlatId,
    string? VehicleNumber,
    string? QrToken,
    DateTimeOffset CreatedAt,
    DateTimeOffset EntryTime,
    DateTimeOffset? ExitTime,
    string? PhotoMediaId = null,
    string? IdType = null,
    string? VehicleType = null,
    IReadOnlyList<VisitorCompanion>? Companions = null);

public record PagedResult<T>(IReadOnlyList<T> Items, int TotalCount, int Page, int PageSize);

internal sealed class GetVisitorsQueryHandler(VisitorDbContext db)
    : IRequestHandler<GetVisitorsQuery, Result<PagedResult<VisitorDto>>>
{
    public async Task<Result<PagedResult<VisitorDto>>> Handle(
        GetVisitorsQuery request, CancellationToken ct)
    {
        var query = db.Visitors
            .Where(v => v.SocietyId == request.SocietyId);

        if (request.FlatId.HasValue)
            query = query.Where(v => v.FlatId == request.FlatId.Value);

        // Parse Status string to enum for type-safe EF Core filter
        if (!string.IsNullOrWhiteSpace(request.Status) &&
            Enum.TryParse<VisitorStatus>(request.Status, ignoreCase: true, out var statusEnum))
            query = query.Where(v => v.Status == statusEnum);

        var total = await query.CountAsync(ct);

        // Fetch then project client-side: enum.ToString() not reliably translated by Npgsql
        var raw = await query
            .OrderByDescending(v => v.CreatedAt)
            .Skip((request.Page - 1) * request.PageSize)
            .Take(request.PageSize)
            .ToListAsync(ct);

        var items = raw.Select(v => new VisitorDto(
            v.Id,
            v.Name,          // domain property is Name, not VisitorName
            v.Phone,         // domain property is Phone, not VisitorPhone
            v.Purpose,
            v.Status.ToString(),
            v.FlatId,
            v.VehicleNumber,
            v.QrToken,
            v.CreatedAt,
            v.EntryTime,
            v.ExitTime,
            v.PhotoMediaId,
            v.IdType,
            v.VehicleType,
            ParseCompanions(v.CompanionsJson)
        )).ToList();

        return Result<PagedResult<VisitorDto>>.Ok(
            new PagedResult<VisitorDto>(items, total, request.Page, request.PageSize));
    }

    private static IReadOnlyList<VisitorCompanion> ParseCompanions(string? json)
    {
        if (string.IsNullOrEmpty(json)) return [];
        try { return JsonSerializer.Deserialize<List<VisitorCompanion>>(json) ?? []; }
        catch (JsonException) { return []; }
    }
}
