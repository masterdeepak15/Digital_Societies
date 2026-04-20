using System.Text;
using Serilog;
using Microsoft.AspNetCore.Authentication.JwtBearer;
using Microsoft.IdentityModel.Tokens;
using DigitalSocieties.Identity.Infrastructure;
using DigitalSocieties.Identity.Infrastructure.Security;
using DigitalSocieties.Api.Middleware;
using DigitalSocieties.Api.Extensions;
using DigitalSocieties.Api.Endpoints.Identity;

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

    // Redis (used for rate limiting + refresh token allow-list)
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

            // Support JWT in SignalR query string (for WebSocket connections)
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
        opts.AddPolicy("AdminOnly",     p => p.RequireClaim("role", "admin"));
        opts.AddPolicy("ResidentOrAdmin", p => p.RequireClaim("role", "resident", "admin"));
        opts.AddPolicy("GuardOnly",     p => p.RequireClaim("role", "guard"));
    });

    // HttpContext accessor (for ICurrentUser middleware)
    builder.Services.AddHttpContextAccessor();

    // ICurrentUser — extracted from JWT by middleware, available everywhere via DI
    builder.Services.AddScoped<DigitalSocieties.Shared.Contracts.ICurrentUser,
                               DigitalSocieties.Api.Middleware.JwtCurrentUser>();

    // Rate limiting (IP + phone-level throttles)
    builder.Services.AddMemoryCache();
    builder.Services.AddInMemoryRateLimiting();
    builder.Services.Configure<IpRateLimitOptions>(config.GetSection("IpRateLimiting"));
    builder.Services.AddSingleton<IRateLimitConfiguration, RateLimitConfiguration>();

    // CORS — tighten per environment
    builder.Services.AddCors(opts =>
        opts.AddPolicy("Default", p => p
            .WithOrigins(config.GetSection("AllowedOrigins").Get<string[]>() ?? ["http://localhost:3000"])
            .AllowAnyMethod()
            .AllowAnyHeader()
            .AllowCredentials()));

    // Health checks
    builder.Services.AddHealthChecks()
        .AddNpgsql(config.GetConnectionString("Postgres")!, name: "postgres")
        .AddRedis(config.GetConnectionString("Redis")!,       name: "redis");

    // OpenAPI / Scalar (replaces Swagger UI — cleaner, works with .NET 8 minimal APIs)
    builder.Services.AddOpenApi();

    // ── Domain modules (each module registers its own dependencies via extension method)
    builder.Services.AddIdentityModule(config);

    // ── MediatR pipeline behaviors (order matters: logging → validation → handler)
    builder.Services.AddMediatR(cfg =>
    {
        cfg.RegisterServicesFromAssembly(typeof(Program).Assembly);
        cfg.AddOpenBehavior(typeof(DigitalSocieties.Identity.Application.Behaviors.LoggingBehavior<,>));
        cfg.AddOpenBehavior(typeof(DigitalSocieties.Identity.Application.Behaviors.ValidationBehavior<,>));
    });

    builder.Services.AddFluentValidationAutoValidation();

    // SignalR (real-time notifications for visitor approvals, alerts)
    builder.Services.AddSignalR();

    // ── Build the app ─────────────────────────────────────────────────────────
    var app = builder.Build();

    // ── Middleware pipeline (ORDER IS CRITICAL) ───────────────────────────────
    app.UseIpRateLimiting();

    app.UseSerilogRequestLogging(opts =>
        opts.MessageTemplate = "HTTP {RequestMethod} {RequestPath} responded {StatusCode} in {Elapsed:0.0000}ms");

    app.UseExceptionHandler(appBuilder => appBuilder.Run(GlobalExceptionHandler.HandleAsync));

    if (!app.Environment.IsProduction())
        app.MapOpenApi();

    app.UseHttpsRedirection();
    app.UseCors("Default");
    app.UseAuthentication();
    app.UseMiddleware<TenantResolutionMiddleware>();   // extracts society_id from JWT → sets DB RLS
    app.UseAuthorization();

    // ── Endpoint registration (each module registers its own endpoints) ───────
    app.MapGroup("/api/v1/auth").MapIdentityEndpoints();
    app.MapHealthChecks("/health");

    // ── Auto-migrate on startup (dev only — use flyway/liquibase in prod) ─────
    if (app.Environment.IsDevelopment())
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
