namespace DigitalSocieties.Api.Infrastructure.Storage;

/// <summary>
/// All MinIO / S3 settings loaded from appsettings / env vars.
/// OCP: switch to AWS S3 by replacing MinioStorageProvider with S3StorageProvider
/// — nothing else in the codebase changes because all code depends on IStorageProvider.
/// </summary>
public sealed class MinioSettings
{
    public const string SectionName = "Storage:Minio";

    /// <summary>MinIO server endpoint, e.g. "minio:9000" in Docker Compose.</summary>
    public string Endpoint { get; init; } = "localhost:9000";

    public string AccessKey { get; init; } = string.Empty;
    public string SecretKey { get; init; } = string.Empty;

    /// <summary>Single bucket used by this application; created on startup if missing.</summary>
    public string BucketName { get; init; } = "digital-societies";

    /// <summary>False in Docker Compose (internal network), true for external MinIO or AWS S3.</summary>
    public bool UseSSL { get; init; } = false;

    /// <summary>
    /// Public-facing base URL for generating pre-signed download links shown to clients.
    /// Differs from Endpoint when MinIO is behind a reverse proxy.
    /// Example: "https://files.myapp.com"
    /// </summary>
    public string PublicBaseUrl { get; init; } = "http://localhost:9000";

    /// <summary>Pre-signed URL TTL for client uploads (PUT). Default 15 minutes.</summary>
    public int PresignedUploadTtlSeconds { get; init; } = 900;

    /// <summary>Pre-signed URL TTL for download links. Default 1 hour.</summary>
    public int PresignedDownloadTtlSeconds { get; init; } = 3600;
}
