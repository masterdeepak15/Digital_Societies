using System.Security.Cryptography;

namespace DigitalSocieties.Shared.Media;

/// <summary>
/// Rules for uploaded images. Files are content-addressed: the id of an image is the SHA-256 of its bytes,
/// so uploading the same picture twice (feed, complaint, task, visitor) stores it once.
/// </summary>
public static class MediaRules
{
    public const long MaxBytes = 5 * 1024 * 1024;

    /// <summary>The content type from the file's first bytes (never from the name or the client's header), or null.</summary>
    public static string? Sniff(ReadOnlySpan<byte> head)
    {
        if (head.Length >= 3 && head[0] == 0xFF && head[1] == 0xD8 && head[2] == 0xFF) return "image/jpeg";
        if (head.Length >= 8 && head[0] == 0x89 && head[1] == 0x50 && head[2] == 0x4E && head[3] == 0x47
            && head[4] == 0x0D && head[5] == 0x0A && head[6] == 0x1A && head[7] == 0x0A) return "image/png";
        if (head.Length >= 12 && head[0] == 'R' && head[1] == 'I' && head[2] == 'F' && head[3] == 'F'
            && head[8] == 'W' && head[9] == 'E' && head[10] == 'B' && head[11] == 'P') return "image/webp";
        return null;
    }

    public static string Sha256Hex(ReadOnlySpan<byte> bytes) => Convert.ToHexString(SHA256.HashData(bytes)).ToLowerInvariant();

    public static bool IsValidId(string? id) =>
        id is { Length: 64 } && id.All(c => c is (>= '0' and <= '9') or (>= 'a' and <= 'f'));

    /// <summary>Object key for an image. Per society, so one tenant can never fetch or probe another's pictures.</summary>
    public static string KeyFor(Guid societyId, string id)
    {
        if (!IsValidId(id)) throw new ArgumentException("Not a media id.", nameof(id));
        return $"media/{societyId:N}/{id[..2]}/{id}";
    }
}
