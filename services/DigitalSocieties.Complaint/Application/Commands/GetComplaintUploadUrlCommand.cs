using MediatR;
using DigitalSocieties.Shared.Results;
using DigitalSocieties.Shared.Contracts;

namespace DigitalSocieties.Complaint.Application.Commands;

/// <summary>
/// Returns a MinIO pre-signed PUT URL. Client uploads image directly to object storage
/// (never passes through the API server — efficient, no size limits on server).
/// OCP: IStorageProvider — swap MinIO ↔ S3 via config.
/// </summary>
public sealed record GetComplaintUploadUrlCommand(string FileName, string ContentType)
    : IRequest<Result<UploadUrlResponse>>;

public sealed record UploadUrlResponse(string UploadUrl, string ObjectKey, int ExpiresInSeconds);

public sealed class GetComplaintUploadUrlCommandHandler
    : IRequestHandler<GetComplaintUploadUrlCommand, Result<UploadUrlResponse>>
{
    private readonly IStorageProvider _storage;
    private readonly ICurrentUser     _currentUser;

    public GetComplaintUploadUrlCommandHandler(IStorageProvider storage, ICurrentUser cu)
    { _storage = storage; _currentUser = cu; }

    public async Task<Result<UploadUrlResponse>> Handle(
        GetComplaintUploadUrlCommand cmd, CancellationToken ct)
    {
        if (_currentUser.SocietyId is null)
            return Result<UploadUrlResponse>.Fail(Error.Unauthorized());

        var ext = Path.GetExtension(cmd.FileName).ToLower();
        if (!new[] { ".jpg", ".jpeg", ".png", ".webp" }.Contains(ext))
            return Result<UploadUrlResponse>.Fail("UPLOAD.INVALID_TYPE", "Only JPG, PNG, and WEBP images are allowed.");

        var key = $"complaints/{_currentUser.SocietyId}/{DateTimeOffset.UtcNow:yyyyMM}/{Guid.NewGuid()}{ext}";

        // Pre-signed URL — client PUTs directly; server never sees the bytes
        var url = await _storage.GetPresignedUrlAsync(key, TimeSpan.FromMinutes(5), ct);
        return Result<UploadUrlResponse>.Ok(new UploadUrlResponse(url, key, 300));
    }
}
