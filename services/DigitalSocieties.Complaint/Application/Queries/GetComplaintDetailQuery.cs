using MediatR;
using DigitalSocieties.Shared.Results;
using DigitalSocieties.Complaint.Infrastructure.Persistence;
using Microsoft.EntityFrameworkCore;

namespace DigitalSocieties.Complaint.Application.Queries;

public record GetComplaintDetailQuery(Guid ComplaintId) : IRequest<Result<ComplaintDetailDto>>;

public record ComplaintUpdateDto(
    string Comment,
    string Status,
    Guid UpdatedBy,
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
    Guid RaisedBy,
    Guid? AssignedTo,
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

        var ticket = $"C-{complaint.CreatedAt.Year}-{complaint.Id.ToString("N")[..4].ToUpper()}";

        var dto = new ComplaintDetailDto(
            complaint.Id,
            ticket,
            complaint.Title,
            complaint.Description,
            complaint.Category,
            complaint.Priority.ToString(),
            complaint.Status.ToString(),
            complaint.SocietyId,
            complaint.FlatId,
            complaint.RaisedBy,
            complaint.AssignedTo,
            complaint.ImageUrls,
            complaint.Updates.Select(u =>
                new ComplaintUpdateDto(
                    u.Comment,
                    u.Status.ToString(),
                    u.UpdatedBy,
                    u.CreatedAt))
                .ToList(),
            complaint.CreatedAt,
            complaint.ResolvedAt);

        return Result<ComplaintDetailDto>.Ok(dto);
    }
}
