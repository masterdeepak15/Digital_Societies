using System.ComponentModel;
using MediatR;
using ModelContextProtocol.Server;
using DigitalSocieties.Shared.Contracts;
using DigitalSocieties.Communication.Application.Queries;
using DigitalSocieties.Communication.Application.Commands;
using DigitalSocieties.Mcp.Settings;
using Microsoft.Extensions.Options;

namespace DigitalSocieties.Mcp.Tools;

/// <summary>
/// MCP notice tools — summarize existing notices and draft new ones.
/// </summary>
[McpServerToolType]
public sealed class NoticeTools
{
    private readonly IMediator    _mediator;
    private readonly ICurrentUser _currentUser;
    private readonly McpSettings  _settings;

    public NoticeTools(IMediator mediator, ICurrentUser currentUser, IOptions<McpSettings> opts)
        => (_mediator, _currentUser, _settings) = (mediator, currentUser, opts.Value);

    [McpServerTool(Name = "society.summarize_notices")]
    [Description(
        "Retrieves and summarizes recent society notices so the resident doesn't have to read them all. " +
        "Use when the resident asks 'what's new in the society', 'any announcements?', or " +
        "'what notices have been posted lately?'.")]
    public async Task<string> SummarizeNotices(
        [Description("Maximum number of recent notices to summarize (1–20). Default: 10.")]
        int count,
        CancellationToken ct)
    {
        if (!_settings.Enabled || !_settings.EnableSummarizeNotices)
            return "Notice summarization is currently disabled.";

        if (_currentUser.SocietyId is null)
            return "No society context — please log in first.";

        count = Math.Clamp(count <= 0 ? 10 : count, 1, 20);

        // GetSocietyNoticesQuery requires SocietyId as first parameter
        var result = await _mediator.Send(
            new GetSocietyNoticesQuery(_currentUser.SocietyId.Value, null, Page: 1, PageSize: count),
            ct);

        if (result.IsFailure)
            return $"Could not retrieve notices: {result.Error}";

        // Result<NoticePagedResult> — extract the items list
        var notices = result.Value?.Items ?? [];

        if (notices.Count == 0)
            return "No notices have been posted recently.";

        var pinned = notices.Where(n => n.IsPinned).ToList();
        var recent = notices.Where(n => !n.IsPinned).ToList();

        var parts = new List<string>();

        if (pinned.Count > 0)
        {
            parts.Add("📌 Pinned notices:");
            parts.AddRange(pinned.Select(n =>
                // DTO has CreatedAt (not PostedAt)
                $"  • [{n.CreatedAt:dd MMM}] {n.Title} — {TruncateBody(n.Body)}"));
        }

        if (recent.Count > 0)
        {
            parts.Add("📋 Recent notices:");
            parts.AddRange(recent.Select(n =>
                $"  • [{n.CreatedAt:dd MMM}] {n.Title} — {TruncateBody(n.Body)}"));
        }

        parts.Add($"\n{notices.Count} notice(s) retrieved. Open the Notices tab to read in full.");

        return string.Join("\n", parts);
    }

    [McpServerTool(Name = "society.draft_notice")]
    [Description(
        "Drafts a formal society notice for the admin to review and post. " +
        "Use when an admin says things like 'write a notice about the water shutdown tomorrow', " +
        "'draft an announcement for the AGM', or 'compose a reminder about parking rules'. " +
        "Returns a draft only — admin must explicitly confirm to post it.")]
    public Task<string> DraftNotice(
        [Description("What the notice is about (e.g. 'water supply shutdown on 27 Apr 6–9 AM').")]
        string topic,
        [Description("Tone: Formal, Friendly, Urgent. Default: Formal.")]
        string tone,
        CancellationToken ct)
    {
        if (!_settings.Enabled || !_settings.EnableDraftNotice)
            return Task.FromResult("Notice drafting is currently disabled.");

        if (!_currentUser.IsInRole("admin"))
            return Task.FromResult("Only society admins can draft notices.");

        // Template-driven draft — no external LLM call (P6 will add Claude API call here).
        var date = DateTimeOffset.UtcNow.ToString("dd MMM yyyy");
        var tonePrefix = tone.ToLowerInvariant() switch
        {
            "urgent"   => "⚠️ URGENT NOTICE",
            "friendly" => "Dear Residents 😊",
            _          => "Dear Residents,",
        };

        var draft =
            $"**[DRAFT — Please review before posting]**\n\n" +
            $"{tonePrefix}\n\n" +
            $"This is to inform you that {topic.TrimEnd('.')}.\n\n" +
            $"We request your cooperation and understanding in this matter. " +
            $"For any queries, please contact the society office.\n\n" +
            $"Regards,\nSociety Management\n{date}\n\n" +
            $"---\n" +
            $"Reply with 'post this notice' to publish it, or ask me to revise any part.";

        return Task.FromResult(draft);
    }

    // ── Helpers ──────────────────────────────────────────────────────────────
    private static string TruncateBody(string body, int maxLen = 80)
        => body.Length <= maxLen ? body : body[..maxLen].TrimEnd() + "…";
}
