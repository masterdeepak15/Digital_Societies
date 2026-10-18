using DigitalSocieties.Shared.Contracts;

namespace DigitalSocieties.Api.Infrastructure.Storage;

/// <summary>
/// IStorageProvider that keeps files in a folder on the API host (a Docker volume in the demo).
/// Used when no MinIO credentials are configured, so photos work out of the box; same contract as MinIO,
/// so switching later changes nothing else. Pre-signed URLs do not exist here: files are always served through the API.
/// </summary>
public sealed class LocalFileStorageProvider : IStorageProvider
{
    private readonly string _root;

    public LocalFileStorageProvider(IConfiguration config)
        => _root = Path.GetFullPath(config["Storage:LocalPath"] ?? Path.Combine(AppContext.BaseDirectory, "media-data"));

    // Keys are built by MediaRules (hex ids, a Guid and fixed words), but never trust a key: refuse to leave the root.
    private string PathFor(string key)
    {
        var full = Path.GetFullPath(Path.Combine(_root, key.Replace('/', Path.DirectorySeparatorChar)));
        if (!full.StartsWith(_root + Path.DirectorySeparatorChar, StringComparison.Ordinal))
            throw new ArgumentException("Invalid storage key.", nameof(key));
        return full;
    }

    public async Task<string> UploadAsync(UploadRequest request, CancellationToken ct = default)
    {
        var key = string.IsNullOrWhiteSpace(request.Prefix) ? request.FileName : $"{request.Prefix.TrimEnd('/')}/{request.FileName}";
        var path = PathFor(key);
        Directory.CreateDirectory(Path.GetDirectoryName(path)!);
        await using (var file = File.Create(path))
            await request.Content.CopyToAsync(file, ct);
        await File.WriteAllTextAsync(path + ".type", request.ContentType, ct);
        return key;
    }

    public Task<string> GetPresignedUrlAsync(string key, TimeSpan expires, CancellationToken ct = default)
        => throw new NotSupportedException("Local storage has no pre-signed URLs; upload through the API.");

    public Task DeleteAsync(string key, CancellationToken ct = default)
    {
        var path = PathFor(key);
        if (File.Exists(path)) File.Delete(path);
        if (File.Exists(path + ".type")) File.Delete(path + ".type");
        return Task.CompletedTask;
    }

    public Task<bool> ExistsAsync(string key, CancellationToken ct = default) => Task.FromResult(File.Exists(PathFor(key)));

    public async Task<StoredObject?> ReadAsync(string key, CancellationToken ct = default)
    {
        var path = PathFor(key);
        if (!File.Exists(path)) return null;
        var type = File.Exists(path + ".type") ? (await File.ReadAllTextAsync(path + ".type", ct)).Trim() : "application/octet-stream";
        return new StoredObject(await File.ReadAllBytesAsync(path, ct), type);
    }
}
