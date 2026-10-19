using System.Globalization;
using System.Text.Json;
using System.Text.Json.Serialization;

namespace DigitalSocieties.Shared.Serialization;

/// <summary>
/// Reads a time of day the way people and forms write it: "06:00", "6:30", "06:00:00" or "06:00:00.5".
/// The built-in converter insists on seconds, so an HTML time field ("06:00") was refused with a bare 400.
/// Always writes "HH:mm:ss".
/// </summary>
public sealed class LenientTimeOnlyConverter : JsonConverter<TimeOnly>
{
    private static readonly string[] Formats = { "H:mm", "HH:mm", "H:mm:ss", "HH:mm:ss", "H:mm:ss.FFFFFFF", "HH:mm:ss.FFFFFFF" };

    public override TimeOnly Read(ref Utf8JsonReader reader, Type typeToConvert, JsonSerializerOptions options)
    {
        var text = reader.GetString()?.Trim();
        if (text is not null && TimeOnly.TryParseExact(text, Formats, CultureInfo.InvariantCulture, DateTimeStyles.None, out var time))
            return time;
        throw new JsonException($"'{text}' is not a time of day. Use HH:mm, for example 06:00.");
    }

    public override void Write(Utf8JsonWriter writer, TimeOnly value, JsonSerializerOptions options)
        => writer.WriteStringValue(value.ToString("HH:mm:ss", CultureInfo.InvariantCulture));
}
