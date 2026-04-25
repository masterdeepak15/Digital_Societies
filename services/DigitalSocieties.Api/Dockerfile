# ── Build stage ───────────────────────────────────────────────────────────────
FROM mcr.microsoft.com/dotnet/sdk:8.0-alpine AS build
WORKDIR /src

# Copy all service project files first (layer cache for restore)
# Note: tests/ is outside the build context (context=services/), so we restore
# only service projects. Publish runs its own restore to catch any remaining gaps.
COPY DigitalSocieties.Shared/DigitalSocieties.Shared.csproj                    DigitalSocieties.Shared/
COPY DigitalSocieties.Identity/DigitalSocieties.Identity.csproj                DigitalSocieties.Identity/
COPY DigitalSocieties.Billing/DigitalSocieties.Billing.csproj                  DigitalSocieties.Billing/
COPY DigitalSocieties.Visitor/DigitalSocieties.Visitor.csproj                  DigitalSocieties.Visitor/
COPY DigitalSocieties.Complaint/DigitalSocieties.Complaint.csproj              DigitalSocieties.Complaint/
COPY DigitalSocieties.Communication/DigitalSocieties.Communication.csproj      DigitalSocieties.Communication/
COPY DigitalSocieties.Social/DigitalSocieties.Social.csproj                    DigitalSocieties.Social/
COPY DigitalSocieties.Accounting/DigitalSocieties.Accounting.csproj            DigitalSocieties.Accounting/
COPY DigitalSocieties.Facility/DigitalSocieties.Facility.csproj                DigitalSocieties.Facility/
COPY DigitalSocieties.Api/DigitalSocieties.Api.csproj                          DigitalSocieties.Api/

# Restore the API project (transitively restores all service-layer packages)
RUN dotnet restore DigitalSocieties.Api/DigitalSocieties.Api.csproj

# Copy source and publish (publish re-runs restore to pick up any analyzer packages)
COPY . .
RUN dotnet publish DigitalSocieties.Api/DigitalSocieties.Api.csproj \
    -c Release -o /app/publish \
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
