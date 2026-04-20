using Microsoft.Extensions.Options;
using Minio;
using Minio.DataModel.Args;
using DigitalSocieties.Shared.Contracts;

namespace DigitalSocieties.Api.Infrastructure.Storage;

/// <summary>
/// IStorageProvider implementation backed by MinIO (S3-compatible).
/// OCP: the rest of the app never imports Minio — swap to AWSS3StorageProvider
///      or AzureBlobStorageProvider by replacing this registration in Program.cs.
/// Security: pre-signed URLs so files never transit through the API server;
///           bucket policy is private — no public object access.
/// </summary>
public sealed class MinioStorageProvider : IStorageProvider
{
    private readonly IMinioClient _minio;
    private readonly MinioSettings _settings;
    private readonly ILogger<MinioStorageProvider> _logger;

    public MinioStorageProvider(
        IOptions<MinioSettings> settings,
        ILogger<MinioStorageProvider> logger)
    {
        _settings = settings.Value;
        _logger = logger;

        _minio = new MinioClient()
            .WithEndpoint(_settings.Endpoint)
            .WithCredentials(_settings.AccessKey, _settings.SecretKey)
            .WithSSL(_settings.UseSSL)
            .Build();
    }

    // ── IStorageProvider: Upload (server-side, for small files like OTP proof) ──
    public async Task<string> UploadAsync(
        string objectKey,
        Stream data,
        string contentType,
        CancellationToken ct = default)
    {
        await EnsureBucketExistsAsync(ct);

        var putArgs = new PutObjectArgs()
            .WithBucket(_settings.BucketName)
            .WithObject(objectKey)
            .WithStreamData(data)
            .WithObjectSize(data.Length)
            .WithContentType(contentType);

        await _minio.PutObjectAsync(putArgs, ct);

        _logger.LogInformation("Uploaded {ObjectKey} to MinIO bucket {Bucket}",
            objectKey, _settings.BucketName);

        return BuildPublicKey(objectKey);
    }

    // ── IStorageProvider: Pre-signed PUT URL (client uploads directly to MinIO) ──
    /// <summary>
    /// Returns a time-limited signed URL. The client PUTs the file directly to MinIO.
    /// This means no file payload passes through the API server — scalable and cheap.
    /// </summary>
    public async Task<string> GetPresignedUrlAsync(
        string objectKey,
        int ttlSeconds = 0,
        CancellationToken ct = default)
    {
        await EnsureBucketExistsAsync(ct);

        var expiry = ttlSeconds > 0 ? ttlSeconds : _settings.PresignedUploadTtlSeconds;

        var presignArgs = new PresignedPutObjectArgs()
            .WithBucket(_settings.BucketName)
            .WithObject(objectKey)
            .WithExpiry(expiry);

        var url = await _minio.PresignedPutObjectAsync(presignArgs);

        _logger.LogDebug("Generated pre-signed PUT URL for {ObjectKey} (TTL={Ttl}s)", objectKey, expiry);

        return url;
    }

    // ── IStorageProvider: Generate signed download URL ────────────────────────
    public async Task<string> GetPresignedDownloadUrlAsync(
        string objectKey,
        int ttlSeconds = 0,
        CancellationToken ct = default)
    {
        var expiry = ttlSeconds > 0 ? ttlSeconds : _settings.PresignedDownloadTtlSeconds;

        var presignArgs = new PresignedGetObjectArgs()
            .WithBucket(_settings.BucketName)
            .WithObject(objectKey)
            .WithExpiry(expiry);

        return await _minio.PresignedGetObjectAsync(presignArgs);
    }

    // ── IStorageProvider: Delete ──────────────────────────────────────────────
    public async Task DeleteAsync(string objectKey, CancellationToken ct = default)
    {
        var removeArgs = new RemoveObjectArgs()
            .WithBucket(_settings.BucketName)
            .WithObject(objectKey);

        await _minio.RemoveObjectAsync(removeArgs, ct);

        _logger.LogInformation("Deleted {ObjectKey} from MinIO bucket {Bucket}",
            objectKey, _settings.BucketName);
    }

    // ── Helpers ───────────────────────────────────────────────────────────────

    private bool _bucketChecked = false;

    private async Task EnsureBucketExistsAsync(CancellationToken ct)
    {
        if (_bucketChecked) return;

        var existsArgs = new BucketExistsArgs().WithBucket(_settings.BucketName);
        var exists = await _minio.BucketExistsAsync(existsArgs, ct);

        if (!exists)
        {
            var makeArgs = new MakeBucketArgs().WithBucket(_settings.BucketName);
            await _minio.MakeBucketAsync(makeArgs, ct);
            _logger.LogInformation("Created MinIO bucket {Bucket}", _settings.BucketName);

            // Apply private bucket policy — no public read
            var policy = $$"""
                {
                  "Version": "2012-10-17",
                  "Statement": [
                    {
                      "Effect": "Deny",
                      "Principal": "*",
                      "Action": "s3:GetObject",
                      "Resource": "arn:aws:s3:::{{_settings.BucketName}}/*",
                      "Condition": {
                        "StringNotLike": {
                          "aws:Referer": "PRESIGNED"
                        }
                      }
                    }
                  ]
                }
                """;

            var policyArgs = new SetPolicyArgs()
                .WithBucket(_settings.BucketName)
                .WithPolicy(policy);
            await _minio.SetPolicyAsync(policyArgs, ct);
        }

        _bucketChecked = true;
    }

    private string BuildPublicKey(string objectKey) =>
        $"{_settings.PublicBaseUrl}/{_settings.BucketName}/{objectKey}";
}
