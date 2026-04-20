using MediatR;
using DigitalSocieties.Shared.Results;
using DigitalSocieties.Complaint.Infrastructure.Persistence;
using Microsoft.EntityFrameworkCore;

namespace DigitalSocieties.Complaint.Application.Queries;

public record GetComplaintDetailQuery(Guid ComplaintId) : IRequest<Result<ComplaintDetailDto>>;

public record ComplaintUpdateDto(
    string Note,
    string Status,
    Guid UpdatedByUserId,
    DateTimeOffset UpdatedAt);

public record ComplaintDetailDto(
    Guid Id,
    string TicketNumber,
    string Title,
    string Description,
    string Category,
    string Priority,
    string Status,
    Guid SocietyId,
    Guid FlatId,
    Guid RaisedByUserId,
    Guid? AssignedToUserId,
    IReadOnlyList<string> ImageUrls,
    IReadOnlyList<ComplaintUpdateDto> Updates,
    DateTimeOffset CreatedAt,
    DateTimeOffset? ResolvedAt);

internal sealed class GetComplaintDetailQueryHandler(ComplaintDbContext db)
    : IRequestHandler<GetComplaintDetailQuery, Result<ComplaintDetailDto>>
{
    public async Task<Result<ComplaintDetailDto>> Handle(
        GetComplaintDetailQuery request, CancellationToken ct)
    {
        var complaint = await db.Complaints
            .FirstOrDefaultAsync(c => c.Id == request.ComplaintId && !c.IsDeleted, ct);

        if (complaint is null)
            return Result<ComplaintDetailDto>.Fail(
                new Error("Complaint.NotFound", "Complaint not found."));

        var dto = new ComplaintDetailDto(
            complaint.Id,
            complaint.TicketNumber,
            complaint.Title,
            complaint.Description,
            complaint.Category,
            complaint.Priority,
            complaint.Status,
            complaint.SocietyId,
            complaint.FlatId,
            complaint.RaisedByUserId,
            complaint.AssignedToUserId,
            complaint.ImageUrls,
            complaint.Updates.Select(u =>
                new ComplaintUpdateDto(u.Note, u.Status, u.UpdatedByUserId, u.UpdatedAt))
                .ToList(),
            complaint.CreatedAt,
            complaint.ResolvedAt);

        return Result<ComplaintDetailDto>.Ok(dto);
    }
}
