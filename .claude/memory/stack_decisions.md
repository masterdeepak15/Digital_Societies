---
name: Stack and Architecture Decisions
description: Rationale for technology choices in Digital Societies
type: project
---

**Backend:** .NET Core 8 minimal APIs + MediatR + FluentValidation
- Why: SOLID-friendly, fast, DI baked-in, EF Core with Postgres RLS

**Server DB:** PostgreSQL 16 (NOT SQLite)
- Why: Row-Level Security for multi-tenant isolation; SQLite has single-writer bottleneck
- RLS: SET LOCAL app.current_society_id per request; policies filter all tenant tables

**Mobile DB:** WatermelonDB (SQLite via op-sqlite) + SQLCipher encryption
- Why: Offline-first for guard app; lazy-loaded, reactivity, sync protocol

**Auth:** OTP (BCrypt hashed, 6-digit, 10min TTL, 3 attempts) + JWT (10min access + 30d refresh allow-list)
- Security: device binding, step-up MFA, role invalidation via short token TTL

**Payments:** IPaymentProvider interface → Razorpay concrete (Cashfree as failover)
- Webhook HMAC verification, idempotency keys

**Notifications:** INotificationChannel interface → SMS (MSG91), WhatsApp, Push (Expo), Email
- OCP: new channels = new class, no existing code changes

**Storage:** IStorageProvider → MinIO (self-host) or S3 (SaaS), pre-signed URLs only

**Docker:** Caddy (auto-TLS), one-command `docker compose up`
**CI:** GitHub Actions → GHCR Docker images
