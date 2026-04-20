namespace DigitalSocieties.Shared.Contracts;

/// <summary>
/// OCP: S3-compatible storage. Swap between MinIO (self-host) and AWS S3 (SaaS)
/// by registering a different concrete via DI config. (DIP)
/// </summary>
public interface IStorageProvider
{
    Task<string>  UploadAsync(UploadRequest request, CancellationToken ct = default);
    Task<string>  GetPresignedUrlAsync(string key, TimeSpan expires, CancellationToken ct = default);
    Task          DeleteAsync(string key, CancellationToken ct = default);
}

public sealed record UploadRequest(
    Stream Content, string FileName, string ContentType,
    string Bucket, string? Prefix = null);
