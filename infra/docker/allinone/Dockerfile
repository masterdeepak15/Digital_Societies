# One image with everything a society needs: the API, the admin website, MinIO (pictures), Postgres,
# Redis, a reverse proxy, and the Android app for download. Data lives in one volume: /data.
#
#   docker build -f infra/docker/allinone/Dockerfile -t digital-societies .      (run from the repo root)
#   put the Android app at ./apk/digital-societies.apk first, or the download link stays hidden.

# ── Backend ───────────────────────────────────────────────────────────────────
FROM mcr.microsoft.com/dotnet/sdk:8.0-bookworm-slim AS api-build
WORKDIR /src
COPY services/ ./
RUN dotnet publish DigitalSocieties.Api/DigitalSocieties.Api.csproj -c Release -o /out /p:UseAppHost=false

# ── Admin website (Next.js standalone) ────────────────────────────────────────
FROM node:20-bookworm-slim AS web-build
WORKDIR /app
COPY apps/web-admin/package.json ./
RUN npm install --legacy-peer-deps --ignore-scripts
COPY apps/web-admin/ ./
# Relative addresses: the site works behind whatever host name or tunnel it is opened with.
ENV NEXT_PUBLIC_API_URL=/api/v1 NEXT_PUBLIC_HUB_URL=/hubs NEXT_TELEMETRY_DISABLED=1
ENV NEXT_PUBLIC_MAP_TILE_URL=https://demotiles.maplibre.org/style.json
RUN npm run build

# ── Binaries borrowed from their official / free images ───────────────────────
FROM chainguard/minio:latest AS minio
FROM caddy:2-alpine AS caddy
FROM mcr.microsoft.com/dotnet/aspnet:8.0-bookworm-slim AS dotnet-runtime
FROM node:20-bookworm-slim AS node-runtime

# ── Final image: Postgres 16 plus everything else ─────────────────────────────
FROM postgres:16-bookworm
ARG DEBIAN_FRONTEND=noninteractive
RUN apt-get update \
 && apt-get install -y --no-install-recommends redis-server supervisor curl ca-certificates tzdata libicu72 \
 && rm -rf /var/lib/apt/lists/* \
 && useradd --system --uid 1001 --create-home --shell /usr/sbin/nologin dsapp

COPY --from=dotnet-runtime /usr/share/dotnet /usr/share/dotnet
RUN ln -s /usr/share/dotnet/dotnet /usr/bin/dotnet
COPY --from=node-runtime /usr/local/bin/node /usr/local/bin/node
COPY --from=minio /usr/bin/minio /usr/local/bin/minio
COPY --from=caddy /usr/bin/caddy /usr/local/bin/caddy

COPY --from=api-build /out /app/api
COPY --from=web-build /app/.next/standalone /app/web
COPY --from=web-build /app/.next/static /app/web/.next/static
COPY --from=web-build /app/public /app/web/public
# The Android app people download from the sign-in page (empty folder = no link shown).
COPY apk/ /app/downloads/
RUN rm -f /app/downloads/.gitkeep

COPY infra/docker/allinone/entrypoint.sh   /usr/local/bin/ds-entrypoint
COPY infra/docker/allinone/run-api.sh      /usr/local/bin/ds-run-api
COPY infra/docker/allinone/supervisord.conf /etc/supervisor/ds-supervisord.conf
COPY infra/docker/allinone/Caddyfile        /etc/caddy/Caddyfile
COPY infra/docker/allinone/ds-backup        /usr/local/bin/ds-backup
COPY infra/docker/allinone/ds-restore       /usr/local/bin/ds-restore
RUN chmod +x /usr/local/bin/ds-entrypoint /usr/local/bin/ds-run-api /usr/local/bin/ds-backup /usr/local/bin/ds-restore \
 && sed -i 's/\r$//' /usr/local/bin/ds-entrypoint /usr/local/bin/ds-run-api /usr/local/bin/ds-backup /usr/local/bin/ds-restore /etc/supervisor/ds-supervisord.conf /etc/caddy/Caddyfile

ENV ASPNETCORE_ENVIRONMENT=Production NODE_ENV=production
VOLUME /data
EXPOSE 8080
HEALTHCHECK --interval=30s --timeout=10s --start-period=90s --retries=3 \
  CMD curl -fsS http://127.0.0.1:8080/health >/dev/null || exit 1
ENTRYPOINT ["/usr/local/bin/ds-entrypoint"]
