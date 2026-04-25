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
# 1. Start infrastructure (Postgres + Redis + MinIO)
cd infra/docker
docker compose -f docker-compose.dev.yml up -d postgres redis minio

# 2. Run the API
cd services
dotnet restore DigitalSocieties.sln
dotnet run --project DigitalSocieties.Api

# API is live at http://localhost:8080
# Swagger UI at http://localhost:8080/swagger

# 3. Run the mobile app
cd apps/mobile
npm install --legacy-peer-deps
npx expo start
# Scan QR with Expo Go, or press 'a' for Android emulator

# 4. Run tests
cd services
dotnet test DigitalSocieties.sln
```

---

## Architecture

```
Digital_Societies/
├── apps/
│   └── mobile/                          # React Native + Expo (iOS + Android)
│       ├── src/screens/                 # admin / resident / guard / staff screens
│       ├── src/database/                # WatermelonDB models + offline sync
│       ├── src/services/api/            # REST client (production URL baked in)
│       └── src/navigation/             # role-based tab navigation
├── services/                            # .NET 8 backend (mono-repo)
│   ├── DigitalSocieties.Shared/         # SOLID contracts, domain primitives, Result<T>
│   ├── DigitalSocieties.Identity/       # OTP auth, JWT, RBAC, multi-tenant
│   ├── DigitalSocieties.Billing/        # Maintenance bills + Razorpay payments
│   ├── DigitalSocieties.Visitor/        # Visitor approval + QR + guard gate
│   ├── DigitalSocieties.Complaint/      # Complaints + MinIO image upload
│   ├── DigitalSocieties.Communication/  # Notices + SignalR real-time hub
│   ├── DigitalSocieties.Social/         # Society Feed, Marketplace, Polls, Directory
│   └── DigitalSocieties.Api/            # Minimal API host, middleware, Dockerfile
├── infra/
│   ├── docker/
│   │   ├── docker-compose.prod.yml      # production stack (pulls from GHCR)
│   │   ├── docker-compose.dev.yml       # local infra only (no API)
│   │   ├── docker-compose.yml           # full local stack
│   │   ├── Caddyfile.prod               # API-only reverse proxy + auto-HTTPS
│   │   ├── .env.prod.example            # secret template
│   │   └── postgres-init/01-rls.sql     # Row-Level Security bootstrap
│   └── postgres/schema.sql              # full schema reference
├── tests/
│   └── DigitalSocieties.Identity.Tests/ # xUnit domain tests
└── .github/workflows/ci.yml             # CI: Docker push to GHCR + Android APK
```

---

## Backend Modules

Each module is its own .NET project — no cross-module dependencies except through `DigitalSocieties.Shared` contracts.

| Module | Responsibility | Status |
|--------|---------------|--------|
| **Shared** | Result<T>, domain primitives, SOLID contracts (IPaymentProvider, INotificationChannel, IStorageProvider) | ✅ Done |
| **Identity** | OTP (BCrypt-hashed), JWT (10-min TTL), refresh tokens, RBAC, multi-tenant RLS, device binding, Redis rate limiting | ✅ Done |
| **Billing** | Monthly bill generation, Razorpay payment initiation + webhook verify, late-fee rules | ✅ Done |
| **Visitor** | Visitor pre-approval, guard QR scan (signed JWT, 2-min TTL), entry/exit log, SOS | ✅ Done |
| **Complaint** | Raise complaint, MinIO pre-signed URL for images, assign to staff, status updates | ✅ Done |
| **Communication** | Post/pin/expire notices, SignalR hub `SocietyHub`, MSG91 SMS channel | ✅ Done |
| **Social** | Society Feed, reactions, comments, groups, marketplace listings, polls, resident directory, moderation | ✅ Done |

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
| **O**pen/Closed | `IPaymentProvider` → add Cashfree without touching billing domain. `INotificationChannel` → add WhatsApp without touching Identity. |
| **L**iskov Substitution | All `I*` contracts have test fakes in xUnit tests; production providers are drop-in. |
| **I**nterface Segregation | `ICommandRepository<T>` and `IQueryRepository<T>` are separate. No fat interfaces. |
| **D**ependency Inversion | API host depends on abstractions; concrete Razorpay/MinIO/MSG91 registered by config via .NET DI. |

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
| Local DB | WatermelonDB + SQLCipher (offline-first SQLite) |
| Backend | ASP.NET Core 8 Minimal APIs + MediatR + FluentValidation |
| Server DB | PostgreSQL 16 with Row-Level Security |
| Cache | Redis 7 (rate limiting, refresh token allow-list) |
| File Storage | MinIO (self-host) / S3-compatible (SaaS) |
| Real-time | SignalR (`SocietyHub`) |
| Payments | Razorpay (primary) + Cashfree (failover) |
| SMS / OTP | MSG91 |
| Reverse Proxy | Caddy 2 (automatic HTTPS via Let's Encrypt) |
| Container Registry | GitHub Container Registry (GHCR) |
| CI/CD | GitHub Actions |

---

## Development Phases

| Phase | Scope | Status |
|-------|-------|--------|
| **P0 — Foundation** | Mono-repo, .NET 8 skeleton, Identity (OTP + JWT + RBAC), multi-tenant Postgres + RLS, React Native scaffold, Docker Compose | ✅ Complete |
| **P1 — MVP** | Billing + Razorpay, Visitor management + QR, Complaints + image upload, Notices + SignalR, all wired into API + mobile screens | ✅ Complete |
| **P2 — Accounting + Social** | Accounting module, Member/family management, push notifications, guard offline-first, **Private Social Network** (Feed, Marketplace, Polls, Directory) | 🔄 Social module built; Accounting + Push = next |
| **P3 — Parking + Geomap** | Parking slot management, visitor parking nav URL, EV charger booking, ANPR hook, MapLibre outdoor + indoor floor plan | 📋 Planned |
| **P4 — AI / MCP + A/V** | MCP server (query_bills, route_complaint, summarize_notices, anomaly_detect), LiveKit/Jitsi integration | 📋 Planned |
| **P5 — Marketplace + Wallet** | Local services marketplace with commissions, Society Wallet (pre-paid ledger) | 📋 Planned |
| **P6 — Enterprise** | White-label, SSO (SAML/OIDC), indoor Bluetooth beacons, builder portfolio dashboard | 📋 Planned |

---

## API Base URL

Production: `https://societies.athomes.space/api/v1`

Health check: `GET https://societies.athomes.space/health`

---

*Built with SOLID principles. Self-host in one `docker compose up`.*
