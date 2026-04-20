using MediatR;
using FluentValidation;
using DigitalSocieties.Shared.Results;
using DigitalSocieties.Shared.Contracts;
using DigitalSocieties.Complaint.Domain.Entities;
using DigitalSocieties.Complaint.Infrastructure.Persistence;

namespace DigitalSocieties.Complaint.Application.Commands;

public sealed record RaiseComplaintCommand(
    Guid     SocietyId,
    Guid     FlatId,
    string   Title,
    string   Description,
    string   Category,
    string   Priority,
    IReadOnlyList<string>? ImageUrls   // pre-uploaded to MinIO by client
) : IRequest<Result<RaiseComplaintResponse>>;

public sealed record RaiseComplaintResponse(Guid ComplaintId, string TicketNumber);

public sealed class RaiseComplaintCommandValidator : AbstractValidator<RaiseComplaintCommand>
{
    private static readonly string[] ValidCategories =
        ["Plumbing", "Electrical", "Housekeeping", "Security", "Lift", "Parking", "Noise", "Other"];

    private static readonly string[] ValidPriorities = ["Low", "Medium", "High", "Urgent"];

    public RaiseComplaintCommandValidator()
    {
        RuleFor(x => x.SocietyId).NotEmpty();
        RuleFor(x => x.FlatId).NotEmpty();
        RuleFor(x => x.Title).NotEmpty().MaximumLength(200);
        RuleFor(x => x.Description).NotEmpty().MaximumLength(2000);
        RuleFor(x => x.Category)
            .NotEmpty()
            .Must(c => ValidCategories.Contains(c))
            .WithMessage($"Category must be: {string.Join(", ", ValidCategories)}.");
        RuleFor(x => x.Priority)
            .NotEmpty()
            .Must(p => ValidPriorities.Contains(p))
            .WithMessage($"Priority must be: {string.Join(", ", ValidPriorities)}.");
        RuleFor(x => x.ImageUrls)
            .Must(u => u is null || u.Count <= 5)
            .WithMessage("Maximum 5 images per complaint.");
    }
}

public sealed class RaiseComplaintCommandHandler
    : IRequestHandler<RaiseComplaintCommand, Result<RaiseComplaintResponse>>
{
    private readonly ComplaintDbContext _db;
    private readonly ICurrentUser       _currentUser;

    public RaiseComplaintCommandHandler(ComplaintDbContext db, ICurrentUser cu)
    { _db = db; _currentUser = cu; }

    public async Task<Result<RaiseComplaintResponse>> Handle(
        RaiseComplaintCommand cmd, CancellationToken ct)
    {
        if (_currentUser.UserId is null)
            return Result<RaiseComplaintResponse>.Fail(Error.Unauthorized());

        var priority = Enum.Parse<Priority>(cmd.Priority);
        var complaint = Complaint.Create(
            cmd.SocietyId, cmd.FlatId, _currentUser.UserId.Value,
            cmd.Title, cmd.Description, cmd.Category, priority);

        foreach (var url in cmd.ImageUrls ?? [])
            complaint.AddImage(url);

        _db.Complaints.Add(complaint);
        await _db.SaveChangesAsync(ct);

        // Ticket number: C-{year}-{short id} e.g. C-2026-A3F2
        var ticket = $"C-{DateTime.UtcNow.Year}-{complaint.Id.ToString("N")[..4].ToUpper()}";
        return Result<RaiseComplaintResponse>.Ok(new RaiseComplaintResponse(complaint.Id, ticket));
    }
}
