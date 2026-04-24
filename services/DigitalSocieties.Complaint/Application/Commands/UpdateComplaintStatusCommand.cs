using MediatR;
using DigitalSocieties.Shared.Results;
using DigitalSocieties.Complaint.Infrastructure.Persistence;
using Microsoft.EntityFrameworkCore;

namespace DigitalSocieties.Complaint.Application.Commands;

/// <summary>
/// Transitions a complaint through its state machine.
/// Status string maps to domain methods: InProgress→StartWork, Resolved→Resolve,
/// Closed→Close, Reopened→Reopen.
/// </summary>
public record UpdateComplaintStatusCommand(
    Guid ComplaintId,
    string Status,
    string? Note,
    Guid UpdatedByUserId) : IRequest<Result<bool>>;

internal sealed class UpdateComplaintStatusCommandHandler(ComplaintDbContext db)
    : IRequestHandler<UpdateComplaintStatusCommand, Result<bool>>
{
    public async Task<Result<bool>> Handle(UpdateComplaintStatusCommand request, CancellationToken ct)
    {
        var complaint = await db.Complaints
            .FirstOrDefaultAsync(c => c.Id == request.ComplaintId, ct);

        if (complaint is null)
            return Result<bool>.Fail(new Error("Complaint.NotFound", "Complaint not found."));

        // Domain methods return void — call then wrap in Result
        switch (request.Status.ToLower())
        {
            case "inprogress":
                complaint.StartWork(request.UpdatedByUserId);
                break;
            case "resolved":
                complaint.Resolve(request.UpdatedByUserId, request.Note ?? "Resolved.");
                break;
            case "closed":
                complaint.Close(request.UpdatedByUserId);
                break;
            case "reopened":
                complaint.Reopen(request.UpdatedByUserId, request.Note ?? "Reopened.");
                break;
            default:
                return Result<bool>.Fail(new Error("Complaint.InvalidStatus",
                    $"Unknown status '{request.Status}'. Valid: InProgress, Resolved, Closed, Reopened."));
        }

        await db.SaveChangesAsync(ct);
        return Result<bool>.Ok(true);
    }
}
