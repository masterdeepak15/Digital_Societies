# ── Build stage ───────────────────────────────────────────────────────────────
FROM mcr.microsoft.com/dotnet/sdk:8.0-alpine AS build
WORKDIR /src

# Copy solution and project files first (layer cache for restore)
COPY DigitalSocieties.Shared/DigitalSocieties.Shared.csproj    DigitalSocieties.Shared/
COPY DigitalSocieties.Identity/DigitalSocieties.Identity.csproj DigitalSocieties.Identity/
COPY DigitalSocieties.Api/DigitalSocieties.Api.csproj           DigitalSocieties.Api/

RUN dotnet restore DigitalSocieties.Api/DigitalSocieties.Api.csproj

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
