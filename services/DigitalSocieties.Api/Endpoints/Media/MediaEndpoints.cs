using Microsoft.AspNetCore.Mvc;
using DigitalSocieties.Shared.Contracts;
using DigitalSocieties.Shared.Media;

namespace DigitalSocieties.Api.Endpoints.Media;

/// <summary>
/// Image upload and download. Images are stored by the SHA-256 of their bytes, per society:
/// uploading the same picture again (in the feed, a complaint, a task or at the gate) re-uses the stored copy.
/// Reading needs a signed-in member of the same society.
/// </summary>
public static class MediaEndpoints
{
    public sealed record UploadResult(string Id, string Url, string ContentType, long Size, bool Duplicate);

    public static RouteGroupBuilder MapMediaEndpoints(this RouteGroupBuilder group)
    {
        // POST /api/v1/media   multipart/form-data, field "file"
        group.MapPost("/", async (
            IFormFile file,
            IStorageProvider storage,
            ICurrentUser cu,
            CancellationToken ct) =>
        {
            if (cu.SocietyId is null) return Results.BadRequest("Society context required.");
            if (file.Length is 0 or > MediaRules.MaxBytes)
                return Results.BadRequest($"Pictures must be between 1 byte and {MediaRules.MaxBytes / (1024 * 1024)} MB.");

            byte[] bytes;
            await using (var input = file.OpenReadStream())
            {
                bytes = new byte[file.Length];
                var read = 0;
                while (read < bytes.Length)
                {
                    var n = await input.ReadAsync(bytes.AsMemory(read), ct);
                    if (n == 0) break;
                    read += n;
                }
                if (read != bytes.Length) return Results.BadRequest("Upload was cut short.");
            }

            // The type comes from the bytes themselves, never from the file name or the client's header.
            var contentType = MediaRules.Sniff(bytes);
            if (contentType is null) return Results.BadRequest("Only JPEG, PNG or WebP pictures are accepted.");

            var id  = MediaRules.Sha256Hex(bytes);
            var key = MediaRules.KeyFor(cu.SocietyId.Value, id);
            var duplicate = await storage.ExistsAsync(key, ct);
            if (!duplicate)
                await storage.UploadAsync(new UploadRequest(new MemoryStream(bytes), key, contentType, string.Empty), ct);

            return Results.Ok(new UploadResult(id, $"/api/v1/media/{id}", contentType, bytes.Length, duplicate));
        })
        .DisableAntiforgery()
        .RequireAuthorization()
        .WithName("UploadMedia")
        .WithTags("Media");

        // GET /api/v1/media/{id}
        group.MapGet("/{id}", async (
            string id,
            IStorageProvider storage,
            ICurrentUser cu,
            CancellationToken ct) =>
        {
            if (cu.SocietyId is null || !MediaRules.IsValidId(id)) return Results.NotFound();
            var stored = await storage.ReadAsync(MediaRules.KeyFor(cu.SocietyId.Value, id), ct);
            if (stored is null) return Results.NotFound();
            // Content never changes for a given id, so the phone can keep it; private because only members may read it.
            return Results.File(stored.Content, stored.ContentType, enableRangeProcessing: false,
                lastModified: null, entityTag: new Microsoft.Net.Http.Headers.EntityTagHeaderValue($"\"{id}\""));
        })
        .RequireAuthorization()
        .WithName("GetMedia")
        .WithTags("Media");

        return group;
    }
}
