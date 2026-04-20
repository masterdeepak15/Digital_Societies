using MediatR;
using DigitalSocieties.Shared.Results;
using DigitalSocieties.Complaint.Infrastructure.Persistence;
using Microsoft.EntityFrameworkCore;

namespace DigitalSocieties.Complaint.Application.Commands;

public record AssignComplaintCommand(
    Guid ComplaintId,
    Guid AssigneeId,
    string? Note,
    Guid AssignedByUserId) : IRequest<Result<bool>>;

internal sealed class AssignComplaintCommandHandler(ComplaintDbContext db)
    : IRequestHandler<AssignComplaintCommand, Result<bool>>
{
    public async Task<Result<bool>> Handle(AssignComplaintCommand request, CancellationToken ct)
    {
        var complaint = await db.Complaints
            .FirstOrDefaultAsync(c => c.Id == request.ComplaintId, ct);

        if (complaint is null)
            return Result<bool>.Fail(new Error("Complaint.NotFound", "Complaint not found."));

        complaint.Assign(request.AssigneeId, request.AssignedByUserId, request.Note);
        await db.SaveChangesAsync(ct);
        return Result<bool>.Ok(true);
    }
}
