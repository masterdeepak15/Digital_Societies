using System.ComponentModel;
using MediatR;
using ModelContextProtocol.Server;
using DigitalSocieties.Shared.Contracts;
using DigitalSocieties.Complaint.Application.Commands;
using DigitalSocieties.Complaint.Application.Queries;
using DigitalSocieties.Mcp.Settings;
using Microsoft.Extensions.Options;

namespace DigitalSocieties.Mcp.Tools;

/// <summary>
/// MCP complaint tools — file and intelligently route complaints.
/// </summary>
[McpServerToolType]
public sealed class ComplaintTools
{
    private readonly IMediator    _mediator;
    private readonly ICurrentUser _currentUser;
    private readonly McpSettings  _settings;

    public ComplaintTools(IMediator mediator, ICurrentUser currentUser, IOptions<McpSettings> opts)
        => (_mediator, _currentUser, _settings) = (mediator, currentUser, opts.Value);

    [McpServerTool(Name = "society.file_complaint")]
    [Description(
        "Files a maintenance complaint or grievance on behalf of the authenticated resident. " +
        "Use when the resident describes a problem (water leak, lift breakdown, noise, etc.) and " +
        "wants it formally logged. Returns a complaint reference number.")]
    public async Task<string> FileComplaint(
        [Description("Short title of the complaint (max 120 characters).")]
        string title,
        [Description("Detailed description of the problem.")]
        string description,
        [Description("Category: Maintenance, Plumbing, Electrical, Lift, Security, Housekeeping, Noise, Other")]
        string category,
        CancellationToken ct)
    {
        if (!_settings.Enabled || !_settings.EnableFileComplaint)
            return "Filing complaints via AI is currently disabled.";

        if (_currentUser.SocietyId is null || _currentUser.FlatId is null || _currentUser.UserId is null)
            return "Please log in as a resident before filing a complaint.";

        var cmd = new RaiseComplaintCommand(
            SocietyId:   _currentUser.SocietyId.Value,
            FlatId:      _currentUser.FlatId.Value,
            Title:       title.Trim()[..Math.Min(title.Length, 120)],
            Description: description.Trim(),
            Category:    category.Trim(),
            Priority:    "Normal",
            ImageUrls:   null);

        var result = await _mediator.Send(cmd, ct);

        return result.IsSuccess
            ? $"Complaint filed successfully. Reference: {result.Value}\n" +
              $"You can track it in the Complaints section of the app."
            : $"Could not file complaint: {result.Error}";
    }

    [McpServerTool(Name = "society.route_complaint")]
    [Description(
        "Suggests the correct department and priority for a complaint based on its description. " +
        "Use when a resident describes a problem and you need to determine who should handle it " +
        "before filing, or when the admin asks which team should be assigned.")]
    public Task<string> RouteComplaint(
        [Description("Free-text description of the complaint.")]
        string description,
        CancellationToken ct)
    {
        if (!_settings.Enabled || !_settings.EnableRouteComplaint)
            return Task.FromResult("Complaint routing via AI is currently disabled.");

        // Keyword-based routing — lightweight, no external API call needed.
        // In P5 this will call Claude via Anthropic SDK for nuanced reasoning.
        var lower = description.ToLowerInvariant();

        var (department, priority, category) = lower switch
        {
            _ when ContainsAny(lower, "water", "leak", "pipe", "drain", "tap")
                => ("Plumbing Team",   "High",   "Plumbing"),
            _ when ContainsAny(lower, "electric", "power", "short circuit", "light", "switch", "socket")
                => ("Electrical Team", "High",   "Electrical"),
            _ when ContainsAny(lower, "lift", "elevator")
                => ("Lift AMC Vendor", "High",   "Lift"),
            _ when ContainsAny(lower, "security", "theft", "break-in", "intruder", "cctv")
                => ("Security Desk",   "Urgent", "Security"),
            _ when ContainsAny(lower, "noise", "loud", "party", "music", "nuisance")
                => ("Society Manager", "Normal", "Noise"),
            _ when ContainsAny(lower, "sweeping", "cleaning", "garbage", "dust", "housekeeping")
                => ("Housekeeping",    "Normal", "Housekeeping"),
            _
                => ("Society Manager", "Normal", "Other"),
        };

        return Task.FromResult(
            $"Suggested routing:\n" +
            $"• Department: {department}\n" +
            $"• Category:   {category}\n" +
            $"• Priority:   {priority}\n\n" +
            $"Would you like me to file this complaint with these details?");
    }

    // ── Helpers ──────────────────────────────────────────────────────────────
    private static bool ContainsAny(string text, params string[] keywords)
        => keywords.Any(text.Contains);
}
