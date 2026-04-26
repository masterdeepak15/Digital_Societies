using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.DependencyInjection;
using DigitalSocieties.Mcp.Settings;
using DigitalSocieties.Mcp.Tools;

namespace DigitalSocieties.Mcp;

/// <summary>
/// OCP: adding the MCP module = one call here, no changes to existing code.
/// </summary>
public static class McpServiceExtensions
{
    public static IServiceCollection AddMcpModule(
        this IServiceCollection services,
        IConfiguration config)
    {
        // Bind settings (supports per-society runtime overrides via env vars)
        services.Configure<McpSettings>(config.GetSection(McpSettings.SectionName));

        // Transport (HTTP SSE) is registered via app.MapMcp() in Program.cs
        services
            .AddMcpServer()
            .WithTools<BillingTools>()
            .WithTools<ComplaintTools>()
            .WithTools<NoticeTools>()
            .WithTools<AccountingTools>();

        return services;
    }
}
