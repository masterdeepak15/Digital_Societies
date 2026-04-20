using MediatR;
using DigitalSocieties.Shared.Results;
using DigitalSocieties.Social.Domain.Entities;
using DigitalSocieties.Social.Infrastructure.Persistence;
using Microsoft.EntityFrameworkCore;

namespace DigitalSocieties.Social.Application.Commands;

public record UpsertDirectoryEntryCommand(
    Guid UserId,
    Guid SocietyId,
    string DisplayName,
    bool ShowPhone,
    bool ShowEmail,
    string? Bio) : IRequest<Result<bool>>;

internal sealed class UpsertDirectoryEntryCommandHandler(SocialDbContext db)
    : IRequestHandler<UpsertDirectoryEntryCommand, Result<bool>>
{
    public async Task<Result<bool>> Handle(UpsertDirectoryEntryCommand request, CancellationToken ct)
    {
        var existing = await db.Directory
            .FirstOrDefaultAsync(d => d.UserId == request.UserId && d.SocietyId == request.SocietyId, ct);

        if (existing is not null)
        {
            var updateResult = existing.Update(
                request.DisplayName, request.ShowPhone, request.ShowEmail, request.Bio);
            if (!updateResult.IsSuccess) return updateResult;
        }
        else
        {
            var createResult = DirectoryEntry.Create(
                request.UserId, request.SocietyId,
                request.DisplayName, request.ShowPhone, request.ShowEmail, request.Bio);
            if (!createResult.IsSuccess) return Result<bool>.Fail(createResult.Error!);
            db.Directory.Add(createResult.Value);
        }

        await db.SaveChangesAsync(ct);
        return Result<bool>.Ok(true);
    }
}
