namespace DigitalSocieties.Mcp.Settings;

/// <summary>
/// Per-society AI tool toggles — stored in appsettings and overridable via Admin API.
/// OCP: add new tools by adding a flag here + a new tool class; no changes to existing code.
/// </summary>
public sealed class McpSettings
{
    public const string SectionName = "Mcp";

    /// <summary>Master kill-switch for all AI tooling.</summary>
    public bool Enabled { get; set; } = true;

    // ── Per-tool toggles ────────────────────────────────────────────────────
    public bool EnableGetBills          { get; set; } = true;
    public bool EnableFileComplaint     { get; set; } = true;
    public bool EnableRouteComplaint    { get; set; } = true;
    public bool EnableSummarizeNotices  { get; set; } = true;
    public bool EnableExpenseAnomaly    { get; set; } = true;
    public bool EnableDraftNotice       { get; set; } = true;

    /// <summary>Which AI model to route tool calls through (for cost control).</summary>
    public string ModelId { get; set; } = "claude-haiku-4-5-20251001";
}
