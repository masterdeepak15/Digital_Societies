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

        Result<bool> transitionResult = request.Status.ToLower() switch
        {
            "inprogress" => complaint.StartWork(request.UpdatedByUserId, request.Note),
            "resolved"   => complaint.Resolve(request.UpdatedByUserId, request.Note),
            "closed"     => complaint.Close(request.UpdatedByUserId, request.Note),
            "reopened"   => complaint.Reopen(request.UpdatedByUserId, request.Note),
            _ => Result<bool>.Fail(new Error("Complaint.InvalidStatus",
                    $"Unknown status '{request.Status}'. Valid: InProgress, Resolved, Closed, Reopened."))
        };

        if (!transitionResult.IsSuccess) return transitionResult;

        await db.SaveChangesAsync(ct);
        return Result<bool>.Ok(true);
    }
}
