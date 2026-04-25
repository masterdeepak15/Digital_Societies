# ── Build stage ───────────────────────────────────────────────────────────────
FROM mcr.microsoft.com/dotnet/sdk:8.0-alpine AS build
WORKDIR /src

# Copy solution + ALL project files first (layer cache for restore)
COPY DigitalSocieties.sln                                                       .
COPY DigitalSocieties.Shared/DigitalSocieties.Shared.csproj                    DigitalSocieties.Shared/
COPY DigitalSocieties.Identity/DigitalSocieties.Identity.csproj                DigitalSocieties.Identity/
COPY DigitalSocieties.Billing/DigitalSocieties.Billing.csproj                  DigitalSocieties.Billing/
COPY DigitalSocieties.Visitor/DigitalSocieties.Visitor.csproj                  DigitalSocieties.Visitor/
COPY DigitalSocieties.Complaint/DigitalSocieties.Complaint.csproj              DigitalSocieties.Complaint/
COPY DigitalSocieties.Communication/DigitalSocieties.Communication.csproj      DigitalSocieties.Communication/
COPY DigitalSocieties.Social/DigitalSocieties.Social.csproj                    DigitalSocieties.Social/
COPY DigitalSocieties.Api/DigitalSocieties.Api.csproj                          DigitalSocieties.Api/

# Restore full solution so every NuGet package (including analyzers) is cached
RUN dotnet restore DigitalSocieties.sln

# Copy source and publish
COPY . .
RUN dotnet publish DigitalSocieties.Api/DigitalSocieties.Api.csproj \
    -c Release -o /app/publish \
    --no-restore \
    /p:UseAppHost=false

# ── Runtime stage (minimal, no SDK) ──────────────────────────────────────────
FROM mcr.microsoft.com/dotnet/aspnet:8.0-alpine AS runtime
WORKDIR /app

# Security: run as non-root user
RUN addgroup -g 1001 dsapp && adduser -u 1001 -G dsapp -s /bin/false -D dsapp
USER dsapp

COPY --from=build /app/publish .

EXPOSE 8080
ENTRYPOINT ["dotnet", "DigitalSocieties.Api.dll"]
