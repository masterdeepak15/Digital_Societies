using System.Text;
using Microsoft.AspNetCore.RateLimiting;
using FluentValidation.AspNetCore;
using Serilog;
using Microsoft.AspNetCore.Authentication.JwtBearer;
using Microsoft.IdentityModel.Tokens;
using DigitalSocieties.Identity.Infrastructure;
using DigitalSocieties.Identity.Infrastructure.Security;
using DigitalSocieties.Billing.Infrastructure;
using DigitalSocieties.Visitor.Infrastructure;
using DigitalSocieties.Complaint.Infrastructure;
using DigitalSocieties.Communication.Infrastructure;
using DigitalSocieties.Communication.Infrastructure.Hubs;
using DigitalSocieties.Api.Middleware;
using DigitalSocieties.Api.Extensions;
using DigitalSocieties.Api.Endpoints.Identity;
using DigitalSocieties.Api.Endpoints.Billing;
using DigitalSocieties.Api.Endpoints.Visitor;
using DigitalSocieties.Api.Endpoints.Complaint;
using DigitalSocieties.Api.Endpoints.Notice;
using DigitalSocieties.Api.Endpoints.Social;
using DigitalSocieties.Api.Infrastructure.Storage;
using DigitalSocieties.Social.Infrastructure;
using DigitalSocieties.Accounting.Infrastructure;
using DigitalSocieties.Facility.Infrastructure;
using DigitalSocieties.Api.Endpoints.Accounting;
using DigitalSocieties.Api.Endpoints.Facility;
using DigitalSocieties.Api.Endpoints.Member;
using DigitalSocieties.Parking.Infrastructure;
using DigitalSocieties.Api.Endpoints.Parking;
using DigitalSocieties.Mcp;
using DigitalSocieties.Calling.Infrastructure;
using DigitalSocieties.Api.Endpoints.Calling;
using DigitalSocieties.Marketplace.Infrastructure;
using DigitalSocieties.Api.Endpoints.Marketplace;
using DigitalSocieties.Wallet.Infrastructure;
using DigitalSocieties.Api.Endpoints.Wallet;
using DigitalSocieties.Api.Endpoints.Setup;
using DigitalSocieties.Api.Endpoints.Settings;
using OpenTelemetry.Resources;
using OpenTelemetry.Trace;
using OpenTelemetry.Metrics;

// ── Bootstrap logger (captures startup errors before Serilog is fully configured)
Log.Logger = new LoggerConfiguration()
    .WriteTo.Console()
    .CreateBootstrapLogger();

try
{
    var builder = WebApplication.CreateBuilder(args);

    // ── Serilog structured logging ────────────────────────────────────────────
    builder.Host.UseSerilog((ctx, lc) => lc
        .ReadFrom.Configuration(ctx.Configuration)
        .WriteTo.Console(outputTemplate:
            "[{Timestamp:HH:mm:ss} {Level:u3}] {SourceContext} {Message:lj}{NewLine}{Exception}"));

    // ── Configuration: appsettings + env vars + user secrets (dev) ───────────
    builder.Configuration
        .AddJsonFile("appsettings.json", optional: false)
        .AddJsonFile($"appsettings.{builder.Environment.EnvironmentName}.json", optional: true)
        .AddEnvironmentVariables()
        .AddUserSecrets<Program>(optional: true);

    var config = builder.Configuration;

    // ── Services ──────────────────────────────────────────────────────────────

    // Redis (rate limiting + refresh token allow-list)
    builder.Services.AddStackExchangeRedisCache(opts =>
        opts.Configuration = config.GetConnectionString("Redis"));

    // JWT Authentication (DIP: settings injected, not hard-coded)
    var jwtSettings = config.GetSection(JwtSettings.SectionName).Get<JwtSettings>()!;
    builder.Services
        .AddAuthentication(JwtBearerDefaults.AuthenticationScheme)
        .AddJwtBearer(opts =>
        {
            opts.TokenValidationParameters = new TokenValidationParameters
            {
                ValidateIssuer           = true,
                ValidateAudience         = true,
                ValidateLifetime         = true,
                ValidateIssuerSigningKey = true,
                ValidIssuer              = jwtSettings.Issuer,
                ValidAudience            = jwtSettings.Audience,
                IssuerSigningKey         = new SymmetricSecurityKey(
                                               Encoding.UTF8.GetBytes(jwtSettings.SecretKey)),
                ClockSkew                = TimeSpan.FromSeconds(30),
            };

            // Support JWT in SignalR WebSocket query string
            opts.Events = new JwtBearerEvents
            {
                OnMessageReceived = ctx =>
                {
                    var token = ctx.Request.Query["access_token"];
                    if (!string.IsNullOrEmpty(token) &&
                        ctx.HttpContext.Request.Path.StartsWithSegments("/hubs"))
                        ctx.Token = token;
                    return Task.CompletedTask;
                }
            };
        });

    builder.Services.AddAuthorization(opts =>
    {
        opts.AddPolicy("AdminOnly",       p => p.RequireClaim("role", "admin"));
        opts.AddPolicy("ResidentOrAdmin", p => p.RequireClaim("role", "resident", "admin"));
        opts.AddPolicy("GuardOnly",       p => p.RequireClaim("role", "guard"));
        opts.AddPolicy("GuardOrAdmin",    p => p.RequireClaim("role", "guard", "admin"));
    });

    // HttpContext accessor (for ICurrentUser middleware)
    builder.Services.AddHttpContextAccessor();

    // ICurrentUser — extracted from JWT, available everywhere via DI
    builder.Services.AddScoped<DigitalSocieties.Shared.Contracts.ICurrentUser,
                               DigitalSocieties.Api.Middleware.JwtCurrentUser>();

    // Translate JWT "membership:societyId:role:flatId" → "role" claim for ASP.NET auth policies
    builder.Services.AddScoped<Microsoft.AspNetCore.Authentication.IClaimsTransformation,
                               DigitalSocieties.Api.Middleware.MembershipClaimsTransformation>();

    // Rate limiting — .NET 8 built-in (no extra package needed)
    builder.Services.AddMemoryCache();
    builder.Services.AddRateLimiter(opts =>
    {
        opts.AddFixedWindowLimiter("default", o =>
        {
            o.Window      = TimeSpan.FromMinutes(1);
            o.PermitLimit = 60;
            o.QueueLimit  = 0;
        });
        opts.RejectionStatusCode = 429;
    });

    // CORS — tighten per environment
    builder.Services.AddCors(opts =>
        opts.AddPolicy("Default", p => p
            .WithOrigins(config.GetSection("AllowedOrigins").Get<string[]>() ?? ["http://localhost:3000"])
            .AllowAnyMethod()
            .AllowAnyHeader()
            .AllowCredentials()));

    // Health checks
    builder.Services.AddHealthChecks();

    // OpenAPI / Scalar — requires Microsoft.AspNetCore.OpenApi (.NET 9+); omitted for .NET 8 build

    // ── Domain modules (each registers its own EF context, MediatR handlers, etc.)
    // OCP: adding a new module = one line here, no changes anywhere else
    builder.Services.AddIdentityModule(config);
    builder.Services.AddBillingModule(config);
    builder.Services.AddVisitorModule(config);
    builder.Services.AddComplaintModule(config);
    builder.Services.AddCommunicationModule(config);   // ← registers SignalRHubNotifier, overriding NullHubNotifier
    builder.Services.AddSocialModule(config);          // ← Society Feed, Groups, Marketplace, Polls, Directory
    builder.Services.AddAccountingModule(config);     // ← Ledger, expense approval, monthly P&L
    builder.Services.AddFacilityModule(config);       // ← Facility booking, slot availability
    builder.Services.AddParkingModule(config);        // ← Parking levels, slots, vehicles
    builder.Services.AddMcpModule(config);            // ← MCP server: AI tools exposed to Claude
    builder.Services.AddCallingModule(config);        // ← LiveKit / Jitsi A/V calling
    builder.Services.AddMarketplaceModule(config);   // ← Local service provider marketplace
    builder.Services.AddWalletModule(config);         // ← Pre-paid wallet + Razorpay top-up

    // ── IStorageProvider — MinIO S3-compatible (OCP: swap to AWS S3 by changing this line)
    builder.Services.Configure<MinioSettings>(config.GetSection(MinioSettings.SectionName));
    builder.Services.AddScoped<DigitalSocieties.Shared.Contracts.IStorageProvider, MinioStorageProvider>();

    // ── DataSeeder — instance-based for /setup/demo; scoped so it gets the right DbContexts
    builder.Services.AddScoped<DigitalSocieties.Api.Infrastructure.Seeding.DataSeeder>();

    // ── MediatR pipeline behaviors (order: logging → validation → handler)
    builder.Services.AddMediatR(cfg =>
    {
        cfg.RegisterServicesFromAssembly(typeof(Program).Assembly);
        cfg.AddOpenBehavior(typeof(DigitalSocieties.Identity.Application.Behaviors.LoggingBehavior<,>));
        cfg.AddOpenBehavior(typeof(DigitalSocieties.Identity.Application.Behaviors.ValidationBehavior<,>));
    });

    builder.Services.AddFluentValidationAutoValidation();

    // ── OpenTelemetry (tracing + metrics → OTLP collector; /metrics for Prometheus) ──
    var otelEndpoint = config["OpenTelemetry:Endpoint"] ?? "http://otel-collector:4317";
    builder.Services
        .AddOpenTelemetry()
        .ConfigureResource(r => r
            .AddService(
                serviceName:    "digital-societies-api",
                serviceVersion: typeof(Program).Assembly.GetName().Version?.ToString() ?? "0.0.0"))
        .WithTracing(tracing => tracing
            .AddAspNetCoreInstrumentation(opts =>
            {
                opts.RecordException = true;
                opts.Filter = ctx =>
                    !ctx.Request.Path.StartsWithSegments("/health") &&
                    !ctx.Request.Path.StartsWithSegments("/metrics");
            })
            .AddHttpClientInstrumentation()
            .AddEntityFrameworkCoreInstrumentation(opts => opts.SetDbStatementForText = true)
            .AddOtlpExporter(opts => opts.Endpoint = new Uri(otelEndpoint)))
        .WithMetrics(metrics => metrics
            .AddAspNetCoreInstrumentation()
            .AddHttpClientInstrumentation()
            .AddRuntimeInstrumentation()
            .AddPrometheusExporter()        // exposes /metrics endpoint
            .AddOtlpExporter(opts => opts.Endpoint = new Uri(otelEndpoint)));

    // SignalR — real-time push for visitor approvals, notices, emergencies
    builder.Services.AddSignalR(opts =>
    {
        opts.EnableDetailedErrors = !builder.Environment.IsProduction();
        opts.MaximumReceiveMessageSize = 32 * 1024; // 32 KB
    });

    // ── Build the app ─────────────────────────────────────────────────────────
    var app = builder.Build();

    // ── Middleware pipeline (ORDER IS CRITICAL) ───────────────────────────────
    app.UseRateLimiter();

    app.UseSerilogRequestLogging(opts =>
        opts.MessageTemplate =
            "HTTP {RequestMethod} {RequestPath} responded {StatusCode} in {Elapsed:0.0000}ms");

    app.UseExceptionHandler(appBuilder => appBuilder.Run(GlobalExceptionHandler.HandleAsync));

    app.UseHttpsRedirection();
    app.UseCors("Default");
    app.UseAuthentication();
    app.UseMiddleware<TenantResolutionMiddleware>();   // sets Postgres RLS variable per request
    app.UseAuthorization();

    // ── Endpoint registration ─────────────────────────────────────────────────
    app.MapGroup("/api/v1/setup").MapSetupEndpoints();
    app.MapGroup("/api/v1/auth").MapIdentityEndpoints();
    app.MapGroup("/api/v1/billing").MapBillingEndpoints();
    app.MapGroup("/api/v1/visitors").MapVisitorEndpoints();
    app.MapGroup("/api/v1/complaints").MapComplaintEndpoints();
    app.MapGroup("/api/v1/notices").MapNoticeEndpoints();
    app.MapGroup("/api/v1/social").MapSocialEndpoints();
    app.MapGroup("/api/v1/accounting").MapAccountingEndpoints();
    app.MapGroup("/api/v1/facilities").MapFacilityEndpoints();
    app.MapGroup("/api/v1/members").MapMemberEndpoints();
    app.MapGroup("/api/v1/parking").MapParkingEndpoints();
    app.MapGroup("/api/v1/calling").MapCallingEndpoints();
    app.MapGroup("/api/v1/marketplace").MapMarketplaceEndpoints();
    app.MapGroup("/api/v1/wallet").MapWalletEndpoints();
    app.MapGroup("/api/v1/settings").MapSettingsEndpoints();

    // MCP server tools registered via AddMcpModule() in services above.
    // HTTP SSE transport (MapMcp) requires ModelContextProtocol >= 0.2.0 — upgrade in P6.

    // SignalR Hub — clients connect at wss://{host}/hubs/society?access_token={jwt}
    app.MapHub<SocietyHub>("/hubs/society");

    app.MapHealthChecks("/health");
    app.MapPrometheusScrapingEndpoint("/metrics");   // Prometheus pull target

    // ── Auto-migrate on startup (always — safe for self-hosted single-tenant deploy) ───
    await app.Services.MigrateAsync();

    app.Run();
}
catch (Exception ex) when (ex is not HostAbortedException)
{
    Log.Fatal(ex, "Application startup failed.");
}
finally
{
    Log.CloseAndFlush();
}
