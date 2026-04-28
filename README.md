# 🏢 Digital Societies

> **The Digital Operating System for Housing Societies**
> Role-based · Offline-first · Self-hostable · SOLID · MCP-ready

[![CI](https://github.com/masterdeepak15/Digital_Societies/actions/workflows/ci.yml/badge.svg)](https://github.com/masterdeepak15/Digital_Societies/actions/workflows/ci.yml)
[![Docker Image](https://ghcr.io/masterdeepak15/digital-societies-api)](https://github.com/masterdeepak15/Digital_Societies/pkgs/container/digital-societies-api)

---

## What is Digital Societies?

Digital Societies is a role-based mobile + web platform that runs the day-to-day operations of Indian housing societies — maintenance billing, visitor management, complaints, communication, and a private social layer for residents. It ships as:

- **SaaS (Digital Societies Cloud)** — managed multi-tenant, per-flat monthly subscription
- **Self-Hosted (Digital Societies Server)** — one-command Docker install for societies that want data sovereignty

**Current status: Phases 0–5 complete. P6 (Enterprise) is next.**

---

## Quick Start — Production Self-Host

```bash
# 1. Clone
git clone https://github.com/masterdeepak15/Digital_Societies.git
cd Digital_Societies/infra/docker

# 2. Configure secrets
cp .env.prod.example .env
# Edit .env — set DOMAIN, POSTGRES_PASSWORD, JWT_SECRET_KEY, MINIO keys, MSG91_API_KEY

# 3. Launch  (API + PostgreSQL + Redis + MinIO + Caddy with auto-HTTPS)
docker compose -f docker-compose.prod.yml up -d

# The API image is pulled automatically from GHCR — no local build needed
# TLS is handled by Caddy via Let's Encrypt
```

### Required secrets in `.env`

| Variable | Purpose |
|----------|---------|
| `DOMAIN` | Your domain, e.g. `societies.athomes.space` |
| `POSTGRES_PASSWORD` | Strong password for PostgreSQL |
| `REDIS_PASSWORD` | Strong password for Redis |
| `JWT_SECRET_KEY` | ≥32-char random secret (`openssl rand -base64 32`) |
| `MINIO_ACCESS_KEY` | MinIO access key |
| `MINIO_SECRET_KEY` | MinIO secret key (≥8 chars) |
| `MSG91_API_KEY` | MSG91 API key for OTP SMS |

---

## Local Development

```bash
# 1. Start full local stack (API + web-admin + Grafana + Tempo + Prometheus)
cd infra/docker
cp .env.example .env          # fill in secrets
docker compose up -d

# API:       http://localhost:5000   (Swagger: /swagger)
# Web Admin: http://localhost:3000
# Grafana:   http://localhost/grafana  (admin / value from .env GRAFANA_PASSWORD)
# Prometheus metrics: http://localhost:5000/metrics

# 2. Run the API in watch mode (faster iteration)
cd services
dotnet watch --project DigitalSocieties.Api

# 3. Run the web-admin in dev mode
cd apps/web-admin
cp .env.local.example .env.local
npm install
npm run dev                    # http://localhost:3000

# 4. Run the mobile app
cd apps/mobile
npm install --legacy-peer-deps
npx expo start
# Scan QR with Expo Go, or press 'a' for Android emulator

# 5. Run backend tests
cd services
dotnet test DigitalSocieties.sln
```

---

## Architecture

```
Digital_Societies/
├── apps/
│   ├── mobile/                           # React Native + Expo (iOS + Android)
│   │   ├── src/screens/                  # admin / resident / guard / staff screens
│   │   ├── src/database/                 # WatermelonDB models + offline sync
│   │   ├── src/services/                 # REST client + OfflineQueueService
│   │   └── src/navigation/              # role-based tab navigation
│   └── web-admin/                        # Next.js 14 App Router (admin dashboard)
│       ├── src/app/(dashboard)/          # all protected admin pages
│       │   ├── dashboard/                # KPI cards + recharts analytics
│       │   ├── billing/                  # maintenance bills + GenerateBills modal
│       │   ├── members/                  # residents table + role filter
│       │   ├── complaints/               # status board + side-drawer transitions
│       │   ├── visitors/                 # live gate log (30s auto-refresh)
│       │   ├── notices/                  # pinnable notices + create modal
│       │   ├── accounting/               # ledger + expenses + P&L (3-tab)
│       │   ├── social/                   # post moderation + report queue
│       │   ├── facilities/               # amenity bookings + facility toggles
│       │   ├── parking/                  # slot grid + level selector + unassign
│       │   ├── marketplace/              # listing approvals + report moderation
│       │   ├── wallet/                   # corpus balance + transaction history
│       │   └── settings/                 # society profile / billing / notif / security
│       └── src/app/park/v/[token]/       # public visitor parking nav (MapLibre)
├── services/                             # .NET 8 backend (vertical slice mono-repo)
│   ├── DigitalSocieties.Shared/          # SOLID contracts, Result<T>, domain primitives
│   ├── DigitalSocieties.Identity/        # OTP + 2FA auth, JWT, RBAC, multi-tenant
│   ├── DigitalSocieties.Billing/         # Maintenance bills + Razorpay payments
│   ├── DigitalSocieties.Visitor/         # Visitor approval + QR (2-min JWT) + entry/exit
│   ├── DigitalSocieties.Complaint/       # Complaints + MinIO image upload
│   ├── DigitalSocieties.Communication/   # Notices + SignalR hub + push/SMS dispatch
│   ├── DigitalSocieties.Social/          # Feed, Marketplace, Polls, Resident Directory
│   ├── DigitalSocieties.Accounting/      # Ledger, expenses, P&L reports
│   ├── DigitalSocieties.Facility/        # Amenity inventory + slot booking
│   ├── DigitalSocieties.Parking/         # Slot allocation + visitor nav QR + EV
│   └── DigitalSocieties.Api/             # Minimal API host, OTel, Swagger, Dockerfile
├── infra/
│   ├── docker/
│   │   ├── docker-compose.yml            # full local stack (API + web-admin + observability)
│   │   ├── docker-compose.prod.yml       # production stack (pulls from GHCR)
│   │   ├── Caddyfile                     # reverse proxy: API + web-admin + Grafana
│   │   ├── otel-config.yml               # OpenTelemetry Collector pipeline
│   │   ├── tempo-config.yml              # Grafana Tempo distributed tracing
│   │   ├── prometheus/prometheus.yml     # Prometheus scrape config
│   │   ├── grafana/provisioning/         # auto-provision datasources + dashboards
│   │   ├── .env.example                  # all secrets documented
│   │   └── postgres-init/01-rls.sql      # Row-Level Security bootstrap
│   └── postgres/schema.sql               # full schema reference
├── tests/
│   └── DigitalSocieties.Identity.Tests/  # xUnit domain tests
└── .github/workflows/ci.yml              # CI: API → GHCR + web-admin → GHCR + Android APK
```

---

## Backend Modules

Each module is its own .NET project — no cross-module dependencies except through `DigitalSocieties.Shared` contracts.

| Module | Responsibility | Status |
|--------|---------------|--------|
| **Shared** | Result<T>, Money, PhoneNumber, ICurrentUser, IPaymentProvider, INotificationChannel, INotificationDispatcher, IStorageProvider | ✅ Done |
| **Identity** | OTP login + 2FA (TOTP), JWT (10-min TTL), refresh tokens, RBAC, multi-tenant RLS, device binding, Redis rate limiting | ✅ Done |
| **Billing** | Monthly bill generation, Razorpay payment initiation + webhook verify, late-fee rules | ✅ Done |
| **Visitor** | Visitor pre-approval, guard QR scan (signed JWT, 2-min TTL), entry/exit log, SOS, offline sync | ✅ Done |
| **Complaint** | Raise complaint, MinIO pre-signed URL for images, assign to staff, status transitions | ✅ Done |
| **Communication** | Post/pin/expire notices, SignalR `SocietyHub`, Expo push + MSG91 SMS, fallback dispatcher | ✅ Done |
| **Social** | Society Feed, reactions, comments, groups, marketplace listings, polls, resident directory, moderation | ✅ Done |
| **Accounting** | Double-entry ledger, expense management, P&L reports, society wallet corpus fund | ✅ Done |
| **Facility** | Amenity inventory, slot booking with conflict detection, capacity management | ✅ Done |
| **Parking** | Slot allocation (car/bike/EV), visitor parking nav QR, floor plan overlay, ANPR hook | ✅ Done |

---

## Mobile App — Role-Based Screens

| Role | Screens |
|------|---------|
| **Admin** | Dashboard, Billing, Complaints, Members, Settings |
| **Resident** | Home, Bills, Complaints, Visitors, Notices, Social Feed, Profile |
| **Guard** | Gate, Visitor Log, Delivery, SOS |
| **Staff** | Tasks, Profile |

All screens use WatermelonDB for offline-first data. Sync runs on app foreground with cursor-based pull.

---

## CI/CD Pipeline

Every push to `main` automatically:

1. **Backend Release** — `dotnet restore` + `dotnet publish` → builds Docker image → pushes to `ghcr.io/masterdeepak15/digital-societies-api:latest` (and `:sha`) via GHCR
2. **Android APK Release** — `expo prebuild` → `gradlew assembleRelease` with keystore secrets → uploads signed APK artifact

The production server only needs `docker compose pull && docker compose up -d` to deploy a new build.

### Secrets required in GitHub repository settings

| Secret | Used by |
|--------|---------|
| `ANDROID_KEYSTORE_BASE64` | APK signing |
| `ANDROID_KEYSTORE_PASSWORD` | APK signing |
| `ANDROID_KEY_ALIAS` | APK signing |
| `ANDROID_KEY_PASSWORD` | APK signing |

---

## SOLID Principles Applied

| Principle | How |
|-----------|-----|
| **S**ingle Responsibility | Each vertical (Billing, Visitor, Complaint…) is its own .NET project/assembly. Nothing crosses module boundaries except domain events. |
| **O**pen/Closed | `IPaymentProvider` → add Cashfree without touching billing domain. `INotificationChannel` → add WhatsApp without touching any consumer. |
| **L**iskov Substitution | All `I*` contracts have test fakes in xUnit tests; production providers are drop-in. |
| **I**nterface Segregation | `ICommandRepository<T>` and `IQueryRepository<T>` are separate. No fat interfaces. `INotificationDispatcher` in Shared avoids circular dep between Visitor and Communication modules. |
| **D**ependency Inversion | API host depends on abstractions; concrete Razorpay/MinIO/MSG91/Expo registered by config via .NET DI. Visitor module depends on `INotificationDispatcher` (Shared), not on Communication module. |

---

## Security

| Threat | Mitigation |
|--------|-----------|
| OTP takeover | BCrypt-hashed OTP storage, device binding, Redis rate limit per IP + phone |
| Visitor QR replay | Signed JWT with 2-min TTL + single-use nonce |
| Cross-tenant data leak | PostgreSQL Row-Level Security on `society_id` from JWT claim — enforced at DB level |
| SQL injection | EF Core parameterized queries; raw SQL forbidden by analyzer |
| Mass-assignment | DTO-in/DTO-out separation; no request-body → entity binding |
| IDOR on bills/complaints | Opaque UUIDs; authorization policy per resource |
| Leaked files | MinIO pre-signed URLs only; no public buckets |
| Stolen device | SQLCipher for mobile SQLite (WatermelonDB); keyed by OS keystore |
| Stale admin role | 10-min JWT TTL + Redis allow-list; role changes invalidate tokens immediately |
| Payment webhook spoofing | HMAC signature verification + 5-min replay window |

---

## Stack

| Layer | Technology |
|-------|-----------|
| Mobile | React Native 0.74 + Expo SDK 51 + TypeScript 5.3 |
| Web Admin | Next.js 14 App Router + @tanstack/react-query v5 + Tailwind CSS + recharts |
| Local DB | WatermelonDB + SQLCipher (offline-first SQLite) |
| Backend | ASP.NET Core 8 Minimal APIs + MediatR + FluentValidation |
| Server DB | PostgreSQL 16 with Row-Level Security |
| Cache | Redis 7 (rate limiting, refresh token allow-list) |
| File Storage | MinIO (self-host) / S3-compatible (SaaS) |
| Real-time | SignalR (`SocietyHub`) |
| Payments | Razorpay (primary) + Cashfree (failover) |
| Push Notifications | Expo Push (mobile) with SMS fallback via MSG91 |
| SMS / OTP | MSG91 |
| Maps | MapLibre GL JS (visitor parking nav, floor plan overlay) |
| Observability | OpenTelemetry → OTLP Collector → Grafana Tempo (traces) + Prometheus (metrics) + Grafana dashboards |
| Reverse Proxy | Caddy 2 (automatic HTTPS via Let's Encrypt) |
| Container Registry | GitHub Container Registry (GHCR) |
| CI/CD | GitHub Actions |

---

## Development Phases

| Phase | Scope | Status |
|-------|-------|--------|
| **P0 — Foundation** | Mono-repo, .NET 8 skeleton, Identity (OTP + JWT + RBAC), multi-tenant Postgres + RLS, React Native scaffold, Docker Compose | ✅ Complete |
| **P1 — MVP** | Billing + Razorpay, Visitor management + QR, Complaints + image upload, Notices + SignalR, all wired into API + mobile screens | ✅ Complete |
| **P2 — Accounting + Social** | Accounting module, Member/family management, Expo push + SMS fallback (INotificationDispatcher), guard offline-first (WatermelonDB + 7-day PII wipe), **Private Social Network** (Feed, Marketplace, Polls, Directory) | ✅ Complete |
| **P3 — Parking + Geomap** | Parking slot management (car/bike/EV), visitor parking nav URL, EV charger badge, ANPR hook, MapLibre outdoor map + indoor floor plan raster overlay | ✅ Complete |
| **P4 — Observability + Web Admin** | OpenTelemetry → Grafana Tempo + Prometheus + custom dashboards; Next.js 14 web-admin (13 pages: billing, members, complaints, visitors, notices, accounting, social, facilities, parking, marketplace, wallet, settings, setup); CI Dockerfile for web-admin | ✅ Complete |
| **P5 — 2FA + Demo Mode** | TOTP-based 2FA for admin/resident login (mobile + web), demo-mode seeding on first-run setup wizard | 🔄 In Progress |
| **P6 — Enterprise** | White-label, SSO (SAML/OIDC), AI/MCP server (query_bills, route_complaint, anomaly_detect), LiveKit/Jitsi calling, indoor Bluetooth beacons, builder portfolio dashboard | 📋 Planned |

---

## API Base URL

Production: `https://societies.athomes.space/api/v1`

Health check: `GET https://societies.athomes.space/health`

---

*Built with SOLID principles. Self-host in one `docker compose up`.*
