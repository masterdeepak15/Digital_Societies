using MediatR;
using FluentValidation;
using Microsoft.EntityFrameworkCore;
using DigitalSocieties.Shared.Results;
using DigitalSocieties.Shared.Media;
using DigitalSocieties.Complaint.Infrastructure.Persistence;

namespace DigitalSocieties.Complaint.Application.Commands;

/// <summary>
/// A progress update on a complaint: a note, optional pictures (media ids) and optionally the next status.
/// Who may do this is decided by the endpoint; this applies it.
/// </summary>
public sealed record AddComplaintUpdateCommand(
    Guid ComplaintId,
    Guid UpdatedBy,
    string Comment,
    IReadOnlyList<string>? MediaIds = null,
    string? Status = null) : IRequest<Result<bool>>;

public sealed class AddComplaintUpdateValidator : AbstractValidator<AddComplaintUpdateCommand>
{
    public AddComplaintUpdateValidator()
    {
        RuleFor(x => x.Comment).NotEmpty().MaximumLength(2000);
        RuleFor(x => x.MediaIds).Must(m => m is null || m.Count <= 6).WithMessage("At most 6 pictures per update.");
        RuleForEach(x => x.MediaIds).Must(MediaRules.IsValidId).WithMessage("A picture id is not valid.");
        RuleFor(x => x.Status)
            .Must(s => s is null || new[] { "InProgress", "Resolved", "Closed", "Reopened" }.Contains(s, StringComparer.OrdinalIgnoreCase))
            .WithMessage("Status must be InProgress, Resolved, Closed or Reopened.");
    }
}

public sealed class AddComplaintUpdateHandler(ComplaintDbContext db)
    : IRequestHandler<AddComplaintUpdateCommand, Result<bool>>
{
    public async Task<Result<bool>> Handle(AddComplaintUpdateCommand c, CancellationToken ct)
    {
        var complaint = await db.Complaints.FirstOrDefaultAsync(x => x.Id == c.ComplaintId, ct);
        if (complaint is null) return Result<bool>.Fail("Complaint.NotFound", "Complaint not found.");

        // The status change first (it writes its own timeline line), then the note with its pictures.
        switch (c.Status?.ToLowerInvariant())
        {
            case "inprogress": complaint.StartWork(c.UpdatedBy); break;
            case "resolved":   complaint.Resolve(c.UpdatedBy, c.Comment); break;
            case "closed":     complaint.Close(c.UpdatedBy); break;
            case "reopened":   complaint.Reopen(c.UpdatedBy, c.Comment); break;
        }
        complaint.AddNote(c.UpdatedBy, c.Comment, c.MediaIds);

        await db.SaveChangesAsync(ct);
        return Result<bool>.Ok(true);
    }
}
