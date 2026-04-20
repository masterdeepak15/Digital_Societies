using MediatR;
using DigitalSocieties.Shared.Results;
using DigitalSocieties.Social.Infrastructure.Persistence;
using Microsoft.EntityFrameworkCore;

namespace DigitalSocieties.Social.Application.Queries;

public record GetDirectoryQuery(Guid SocietyId, string? Search)
    : IRequest<Result<IReadOnlyList<DirectoryEntryDto>>>;

public record DirectoryEntryDto(
    Guid UserId,
    string DisplayName,
    string? Bio,
    bool HasPhone,
    bool HasEmail);

internal sealed class GetDirectoryQueryHandler(SocialDbContext db)
    : IRequestHandler<GetDirectoryQuery, Result<IReadOnlyList<DirectoryEntryDto>>>
{
    public async Task<Result<IReadOnlyList<DirectoryEntryDto>>> Handle(
        GetDirectoryQuery request, CancellationToken ct)
    {
        var query = db.Directory
            .Where(d => d.SocietyId == request.SocietyId && !d.IsHiddenByAdmin);

        if (!string.IsNullOrWhiteSpace(request.Search))
            query = query.Where(d =>
                EF.Functions.ILike(d.DisplayName, $"%{request.Search}%"));

        var entries = await query
            .OrderBy(d => d.DisplayName)
            .Select(d => new DirectoryEntryDto(
                d.UserId,
                d.DisplayName,
                d.Bio,
                d.ShowPhone,
                d.ShowEmail))
            .ToListAsync(ct);

        return Result<IReadOnlyList<DirectoryEntryDto>>.Ok(entries);
    }
}
