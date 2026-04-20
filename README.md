# 🏢 Digital Societies

> **The Digital Operating System for Housing Societies**  
> Role-based · Offline-first · Self-hostable · SOLID · MCP-ready

---

## Quick Start (Self-Host)

```bash
# 1. Clone
git clone https://github.com/masterdeepak15/Digital_Societies.git
cd Digital_Societies

# 2. Configure
cp infra/docker/.env.example infra/docker/.env
# Edit infra/docker/.env — set DOMAIN, POSTGRES_PASSWORD, JWT_SECRET_KEY, etc.

# 3. Launch  (Postgres + Redis + MinIO + API + Web Admin + Caddy)
cd infra/docker
docker compose up -d

# 4. First-run setup wizard
open https://<your-domain>/setup
```

That's it. TLS is automatic via Let's Encrypt (Caddy).

---

## Local Development

```bash
# Backend (.NET 8)
cd services
docker compose -f ../infra/docker/docker-compose.yml \
               -f ../infra/docker/docker-compose.dev.yml up -d postgres redis minio
dotnet run --project DigitalSocieties.Api

# Mobile (React Native + Expo)
cd apps/mobile
npm install
npx expo start

# Run tests
cd services
dotnet test DigitalSocieties.sln
```

---

## Architecture

```
Digital_Societies/
├── services/                        # .NET Core 8 backend (mono-repo)
│   ├── DigitalSocieties.Shared/     # SOLID contracts, domain primitives, Result<T>
│   ├── DigitalSocieties.Identity/   # OTP auth, JWT, RBAC, multi-tenant
│   └── DigitalSocieties.Api/        # Minimal API host, middleware
├── apps/
│   ├── mobile/                      # React Native + Expo (iOS + Android)
│   └── web-admin/                   # Next.js 14 (committee console)
├── infra/docker/                    # docker-compose + Caddyfile + .env.example
├── infra/postgres/                  # Schema reference + RLS policies
└── tests/                           # xUnit domain tests
```

### SOLID Applied

| Principle | Where |
|-----------|-------|
| **S**ingle Responsibility | Each module (Identity, Billing, Visitor…) is its own project |
| **O**pen/Closed | `IPaymentProvider`, `INotificationChannel` — new providers via new classes, not edits |
| **L**iskov Substitution | All `I*` contracts have test fakes; production providers are drop-in |
| **I**nterface Segregation | `ICommandRepository<T>` ≠ `IQueryRepository<T>` — no fat interfaces |
| **D**ependency Inversion | API host depends on abstractions; concrete Razorpay/MinIO/MSG91 registered by config |

### Security (Defence-in-Depth)

- OTP stored as BCrypt hash — plain text never persisted
- JWT access tokens: 10-min TTL; refresh tokens: allow-list in Postgres
- PostgreSQL Row-Level Security enforces tenant isolation at DB level
- Device binding: new device triggers step-up verification
- Visitor QR: signed JWT with 2-min TTL, single-use nonce
- Rate limiting: IP + phone-level via Redis

---

## Development Phases

| Phase | Features |
|-------|----------|
| **P0** (done ✅) | Mono-repo, .NET 8 skeleton, Identity (OTP+JWT), RN scaffold, Docker |
| **P1** | Maintenance billing + Razorpay, Visitor management, Complaints, Notices |
| **P2** | Accounting, Member/family management, Push notifications, Guard offline |
| **P3** | Parking + Geomap + Visitor parking navigation |
| **P4** | MCP server + AI tools, LiveKit/Jitsi A/V calling |
| **P5** | Marketplace, Society Wallet |

---

## Stack

| Layer | Tech |
|-------|------|
| Mobile | React Native + Expo EAS |
| Local DB | WatermelonDB + SQLCipher (SQLite) |
| Web Admin | Next.js 14 (App Router) |
| Backend | ASP.NET Core 8 Minimal APIs + MediatR |
| Server DB | PostgreSQL 16 with RLS |
| Cache/Queue | Redis 7 |
| Storage | MinIO (self-host) / S3 (SaaS) |
| Payments | Razorpay + Cashfree |
| SMS/OTP | MSG91 / Gupshup |
| A/V | LiveKit (SaaS) / Jitsi (self-host) |
| Reverse Proxy | Caddy (auto-HTTPS) |
| Observability | OpenTelemetry → Grafana |

---

*Built with SOLID principles. Self-host in one command.*
