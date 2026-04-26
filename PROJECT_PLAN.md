# 🏢 Digital Societies — Master Project Plan

**Project codename:** Digital Societies
**Repo:** https://github.com/masterdeepak15/Digital_Societies.git
**Tagline:** *The Digital Operating System for Housing Societies — self-hosted or managed, secure by default.*
**Document version:** v1.0 · 2026-04-19
**Owner:** Deepak

---

## 1. Executive Summary

Digital Societies is a role-based mobile + web platform that runs the day-to-day operations of Indian housing societies: maintenance billing, visitor management, complaints, communication, accounting, parking, and a private social layer for residents. It ships in **two deployment modes** so we can capture both ends of the market:

1. **Digital Societies Cloud (SaaS)** — managed multi-tenant service, per-flat monthly subscription.
2. **Digital Societies Self-Hosted** — a Dockerized one-command install for societies or RWAs who want data sovereignty and a flat annual license.

Revenue is a **layer cake**: a low subscription floor keeps adoption easy, and we stack paid modules (payment processing, marketplace commissions, A/V calling minutes, AI add-ons, premium analytics, white-label) on top.

The backend is **.NET Core 8** with **SQLite** for the mobile app's offline cache and **PostgreSQL** for the server (SQLite as a server DB will not scale past a single small society — this is a correction to the original spec). The mobile app is **React Native**. Everything is Dockerized, SOLID, secure-by-default, and extensible through **MCP** so we can plug AI in progressively.

---

## 2. Market & Competitive Landscape

### Who is already in this market

| Player | Position | Weakness we exploit |
|---|---|---|
| **MyGate** | Market leader, 25,000+ societies, strong in visitor/security. Pricing typically ₹20–₹50/flat/month. | Closed, cloud-only, no self-host, data goes to third party, expensive add-ons. |
| **NoBrokerHood** | Broad feature set, bundled with NoBroker ecosystem. | Upsell-heavy, privacy concerns, data used for NoBroker funnels. |
| **ADDA (ApartmentADDA)** | Strong in accounting and large communities. | Custom pricing, complex onboarding, weaker guard app UX. |
| **ApnaComplex** (ANAROCK) | Strong with builders / new handovers. | Feels dated, limited AI, limited offline. |
| **Society123 / AppSociety / SocietyNotebook** | Budget tier. | Feature-thin, poor mobile UX. |
| **Open source (SocietyRun, E-Society on GitHub)** | Free, niche. | Not production-grade, no mobile-first, no active maintenance. |

### The gap we fill

1. **No credible self-hosted option** — Indian societies that care about privacy (a growing segment, esp. gated communities of IT professionals and cooperative societies with data-protection obligations under the DPDP Act 2023) have no modern, Dockerized self-host.
2. **Hidden costs** — incumbents charge heavily for A/V calling, extra SMS, accounting modules. We bundle transparently and keep the floor low.
3. **AI is bolt-on everywhere** — we build MCP in from day one, so AI assistants (complaint routing, bill queries, society chatbot) are a feature not a future promise.
4. **Guard app is neglected** — we treat it as a first-class product with offline-first sync, large-tap UI, and a visitor navigation helper.
5. **Parking is a pain everyone ignores** — nobody has solved "how does my Swiggy guy find my parking slot." We will, with a geomap (see §8).

---

## 3. Product Strategy: Dual-Mode

### 3a. SaaS (Digital Societies Cloud)

- Multi-tenant, region-sharded (India data stays in India — ap-south-1).
- Target: 90% of societies. Zero ops burden for the RWA.
- Onboarding in <15 minutes via a self-serve wizard.

### 3b. Self-Hosted (Digital Societies Server)

- One `docker compose up` deploy on any ₹1,000/mo VPS (Hetzner, DigitalOcean BLR, Contabo, or even a mini-PC inside the society's clubhouse).
- Perpetual license with annual support/updates contract.
- Target: privacy-conscious societies, large gated townships (1,000+ flats) where per-flat SaaS gets expensive, and societies in places with patchy internet that want local-first.
- Same codebase as SaaS, gated by a license key that unlocks premium modules.

### Why both?

SaaS maximizes reach; self-host maximizes ARPU and trust. Critically, the **same Docker image** runs in both modes — we flip a flag. This keeps engineering costs low.

---

## 4. Monetization & Pricing

### 4a. SaaS Tiers (per flat, per month, India pricing)

| Tier | Price | Who it's for | What's included |
|---|---|---|---|
| **Free** | ₹0 | Societies <25 flats, or trial | Maintenance bills, notices, complaints, visitor log — manual only. Branded. 30-day history. |
| **Starter** | **₹15/flat/mo** | Small societies 25–100 flats | Everything in Free + online payments (surcharge passed through), visitor approval push, member directory, 1 year history. |
| **Standard** | **₹29/flat/mo** (Recommended) | 100–500 flats | + Accounting module, facility booking, polls/voting, events, parking, staff management, branded notices, 3 years history. |
| **Pro** | **₹49/flat/mo** | 500+ flats / premium | + AI complaint routing (MCP), A/V calling (500 min/flat/mo pool), advanced analytics, audit logs export, priority support, custom domain. |
| **Enterprise** | Custom | Multi-society / builder portfolios | + White-label, SSO, dedicated CSM, SLA 99.9%, on-prem bridge. |

**Billing guardrail:** Minimum ₹500/mo per society so a 20-flat society still gets paid support.

### 4b. Self-Hosted License

| Plan | Price | What you get |
|---|---|---|
| **Community** | **Free** (AGPL) | Core modules. Community support only. Branded "Powered by Digital Societies." No AI, no A/V, no marketplace. |
| **Society License** | **₹24,999/year** flat, <500 flats | Pro modules, white-label, email support, 12 months of updates. |
| **Township License** | **₹59,999/year** flat, <2000 flats | All modules, phone support, 24h SLA, remote install assistance. |
| **Lifetime + Support** | **₹1,49,999** one-time + ₹19,999/yr support | For RWAs that prefer capex over opex. |

### 4c. Usage-Based Paid Services (applies to both SaaS and Self-Hosted)

These are the real margin drivers. The subscription gets us in the door; these earn the money.

| Service | How we charge | Expected margin |
|---|---|---|
| **Payment processing** (Razorpay/UPI passthrough + our cut) | 0.4% of transaction value, on top of gateway fee | High volume × thin margin. Big at scale. |
| **SMS/WhatsApp OTP + notices** | ₹0.15/SMS, ₹0.45/WhatsApp utility message, bought in packs | ~40% margin on resold Twilio/Gupshup |
| **A/V calling minutes** (resident ↔ guard, remote AGM) | ₹0.50/participant-minute over plan pool | Built on LiveKit/Jitsi — ~60% margin |
| **Local Services Marketplace** (plumber, electrician, maid, laundry, grocery) | 8–12% commission on verified jobs + ₹199/mo listing for providers | Highest growth vector |
| **Society Wallet** | 0.5–1% float/breakage + UPI handle fees | Passive once live |
| **AI add-ons (MCP skills)** — complaint router, legal-doc summarizer, accounting anomaly detector, bill Q&A chatbot | ₹5/flat/mo per skill, or included in Pro | Land-and-expand |
| **Document / e-stamp / e-sign** (rent agreements, NOC, AGM minutes) | ₹49–₹249/doc | Regulated revenue |
| **Cameras & IoT integration** (ANPR for gate, smoke sensors, water tank IoT) | ₹999 setup + ₹99/device/mo | Sticky, hardware pulls software |
| **Premium analytics & benchmarks** ("your society spends 22% more on housekeeping than similar societies") | ₹999/mo society-level | Differentiator for Pro |
| **White-label for builders** | ₹50,000 setup + ₹20/flat/mo | Target real-estate developers handing over projects |

### 4d. Unit economics snapshot

A **200-flat society on Standard (₹29/flat/mo) = ₹5,800/mo base**. Add payments (₹20L/mo collection × 0.4% = ₹8,000), SMS (~₹600), marketplace commissions (~₹4,000). **Realistic ARPU: ₹18,000–₹22,000/mo per 200-flat society. ₹2.2–₹2.6 lakh/year.** If we get to 1,000 such societies that's a ₹25 Cr/yr business.

---

## 5. Cost-Effectiveness for Societies

A typical 200-flat society currently collects ₹3,000/flat/mo maintenance = ₹6 lakh/mo. Spending ₹6,000–₹10,000/mo on software is <2% of collection — an easy sell **only if** the software pays for itself. We justify it by:

1. **Dues recovery** — online + reminders + late-fee automation typically lifts on-time collection by 8–15%. For a ₹6L/mo society that's ₹48k–₹90k/mo of recovered cashflow.
2. **Reduced pilferage** — digitized expense approval + audit logs shrink "ghost bills" (a real problem in RWAs).
3. **Time saved by MC members** — MC members are unpaid residents. Saving them 20 hrs/mo is the real product.
4. **Cheaper than MyGate** at Standard tier for equivalent features, with optional self-host that removes recurring cost entirely.

We will publish a **ROI calculator** on the landing page: "Enter flats + monthly maintenance → see payback in months."

---

## 6. Technical Architecture (Refined)

### 6a. Stack decisions

| Layer | Choice | Why |
|---|---|---|
| **Mobile app** | React Native (single codebase iOS+Android), Expo EAS for builds | Spec requirement; faster than native for our feature scope |
| **Local DB (mobile)** | SQLite via `op-sqlite` or WatermelonDB | Spec requirement; WatermelonDB gives us sync-friendly reactivity |
| **Web admin** | Next.js 14 (App Router) | Committee/accountant desktop workflows; SSR for SEO on public pages |
| **Backend** | **.NET Core 8** (ASP.NET minimal APIs + MediatR + FluentValidation) | Spec requirement; SOLID-friendly |
| **Server DB** | **PostgreSQL 16** (not SQLite) | SQLite on server = single-writer bottleneck; Postgres scales and has row-level security |
| **Realtime** | SignalR (built into .NET 8) | Push for visitor approvals, notices, chat |
| **Cache/Queue** | Redis 7 + .NET `MassTransit` over RabbitMQ (or Redis Streams in single-node self-host) | Background jobs: reminders, bill gen, SMS |
| **A/V calling** | **LiveKit** (self-hostable WebRTC SFU) for SaaS/Enterprise; **Jitsi Meet** for self-host default | Open, cheap, works offline-LAN |
| **Storage** | S3-compatible (MinIO in self-host, AWS S3 in SaaS) | Complaint images, docs, CCTV clips |
| **Maps** | **OpenStreetMap + MapLibre GL JS / react-native-maplibre-gl** | Free tiles, no per-request fees like Google Maps |
| **Payments** | Razorpay (primary) + Cashfree (failover) + direct UPI intents | UPI is the dominant rail |
| **Auth** | OTP via MSG91/Gupshup + JWT + refresh rotation; WebAuthn optional for admins | Spec requirement |
| **Observability** | OpenTelemetry → Grafana + Loki + Prometheus | Self-hostable, Grafana Cloud for SaaS |
| **CI/CD** | GitHub Actions → GHCR Docker images → Portainer/Coolify on VPS | Simple, cheap |
| **AI / MCP** | MCP server exposing tools: `query_bills`, `route_complaint`, `summarize_notices`, `anomaly_detect_expenses` | Model-agnostic; plug Claude/OpenAI/Ollama |

### 6b. SOLID applied

- **S** — each vertical slice (Billing, Visitor, Complaint, Parking, Wallet, Marketplace) is its own project/assembly. Nothing crosses boundaries except via domain events.
- **O** — new payment gateways via `IPaymentProvider`; new notification channels via `INotificationChannel` (SMS/WA/Push/Email). Drop-in plugins.
- **L** — tests for every `I*` contract; fakes used in integration tests.
- **I** — no fat `IRepository`; split by query/command (CQRS-lite with MediatR).
- **D** — modules depend on abstractions registered via .NET DI; concrete providers swapped by config per deployment.

### 6c. Project structure (mono-repo)

```
Digital_Societies/
├── apps/
│   ├── mobile/              # React Native (residents, guard, staff, admin-lite)
│   └── web-admin/           # Next.js committee console
├── services/
│   ├── DigitalSocieties.Api/            # ASP.NET host
│   ├── DigitalSocieties.Billing/
│   ├── DigitalSocieties.Visitor/
│   ├── DigitalSocieties.Complaint/
│   ├── DigitalSocieties.Parking/
│   ├── DigitalSocieties.Communication/  # notices, chat, A/V sessions
│   ├── DigitalSocieties.Marketplace/
│   ├── DigitalSocieties.Wallet/
│   ├── DigitalSocieties.Accounting/
│   ├── DigitalSocieties.Identity/       # OTP, RBAC, tenants
│   ├── DigitalSocieties.Mcp/            # MCP server, AI tools
│   └── DigitalSocieties.Shared/
├── infra/
│   ├── docker/
│   │   ├── docker-compose.yml            # one-command self-host
│   │   ├── docker-compose.dev.yml
│   │   └── .env.example
│   ├── k8s/                              # SaaS deploy
│   └── terraform/
├── docs/
└── tests/
```

### 6d. One-command self-host (`docker compose up`)

Services in compose: `api`, `web-admin`, `postgres`, `redis`, `minio`, `jitsi`, `otel-collector`, `caddy` (auto-HTTPS via Let's Encrypt). A config wizard at `https://<host>/setup` on first boot captures society name, admin phone, SMTP, payment keys. **No CLI required for the RWA.**

### 6e. Configuration

Everything is `appsettings.json` + env-var override (.NET's standard). Nothing is hard-coded. A **Connectors** admin page lets the society toggle: Razorpay / Cashfree / MSG91 / Gupshup / Twilio / LiveKit / Jitsi / S3 / MinIO / CCTV NVR / Google Maps fallback. Plug-and-play.

---

## 7. Security — "Think Like an Attacker"

Explicit per spec: *"think as hacker for security vulnerability patch"* and *"ensure the backend database is secure and protected against compromise."*

### 7a. Threat model (concrete, not hand-wavy)

| Threat | Mitigation |
|---|---|
| **Stolen admin phone → OTP takeover** | Device binding (public key pinned on login), step-up MFA (PIN) for destructive ops, session fingerprinting, alert on new device. |
| **Guard replays a visitor QR from yesterday** | QR is a signed JWT with 2-min TTL + nonce; visitor-approval tokens single-use. |
| **Resident sees other society's data** | Postgres **Row-Level Security** policies keyed on `society_id` from JWT claim. Tenant isolation enforced at DB, not app. |
| **SQL injection** | EF Core parameterized queries + analyzer rules forbidding raw SQL outside whitelisted modules. |
| **Mass-assignment of `role=admin`** | DTO-in / DTO-out separation, no binding from request body to entities. |
| **IDOR on bill URLs** | Opaque UUIDs, authorization policy per resource, not per endpoint. |
| **Leaky S3** | Pre-signed URLs only, never public buckets; server-side encryption with KMS (SaaS) or age-encrypted volumes (self-host). |
| **Backup compromise** | Backups encrypted with `restic` + off-site B2/Wasabi; rotation; test restores monthly (automated). |
| **Insider abuse by MC member** | Immutable audit log (append-only, hash-chained daily), anomalous-action alerts, dual-approval for cashouts > ₹10,000. |
| **Supply-chain (npm/NuGet)** | SBOM via `syft`, `dependabot`, `dotnet list package --vulnerable` in CI. |
| **WebSocket flooding** | Rate limiting via `AspNetCoreRateLimit` + SignalR group caps. |
| **Phone-number enumeration on OTP** | Constant-time responses, captcha after 3 failed attempts, per-IP + per-phone throttles. |
| **Stolen device with offline data** | SQLCipher for the mobile SQLite DB, keyed by OS keystore; auto-wipe after 7 days offline. |
| **Ransomware on self-host VPS** | Daily encrypted off-site backup to object storage, documented restore runbook. |
| **CSRF / XSS on web admin** | Strict CSP, SameSite=Strict cookies, antiforgery tokens, sanitized rich text via DOMPurify. |
| **Privilege escalation via stale role cache** | Role changes invalidate JWTs via a short access-token TTL (10 min) + Redis allow-list. |
| **Payment webhook spoofing** | HMAC verification, idempotency keys, replay window ≤ 5 min. |

### 7b. Compliance

- **DPDP Act 2023** — data minimization, purpose limitation, consent flows, DPO contact visible, right-to-delete endpoint.
- **PCI scope** — we never touch raw card data; all tokens.
- **RBI PA-PG** — we integrate with licensed aggregators, not hold funds directly (wallet is pre-paid with operator escrow).

### 7c. Security program

- SAST (`SonarCloud` or free `semgrep`) + DAST (`ZAP`) in CI.
- Quarterly external pentest starting at 1,000 SaaS flats.
- Bug bounty on HackerOne (starts with ₹500–₹25,000 rewards) once GA.

---

## 8. Parking Management + Geomap (Dedicated Section)

This is the section you specifically asked for.

### 8a. Problem we're solving

- **Residents**: can't find their assigned slot in a new society; double-parking fights.
- **Visitors / delivery agents**: no idea where to park; guards wave them around.
- **Committee**: no inventory of who owns which slot; EV chargers now getting retrofitted and cables tangle.

### 8b. Features

1. **Society parking map** — committee uploads a floor plan PNG/DXF per level (basement 1, basement 2, surface, visitor, two-wheeler). Admin paints polygons on the map to define slots. Each slot has: slot_id, type (car/bike/EV), owner_flat_id (nullable), dimensions, near-pillar tag.
2. **Slot assignment** — drag-drop resident → slot; history preserved. Rent-a-slot marketplace (residents with empty slots can rent to other residents).
3. **Visitor parking navigation** —
   - When a visitor is approved by a resident, the app issues a **parking pass** with a specific visitor slot assigned (auto-chosen based on availability).
   - The pass contains:
     - A **QR code** the guard scans to release a boom barrier (optional IoT).
     - A **geomap URL** (`https://<society>.digitalsocieties.app/park/v/<token>`) that opens in the visitor's phone browser — no app install needed for the visitor.
     - The URL shows:
       - An **outdoor map pin** (OpenStreetMap + MapLibre) to the correct **gate** of the society (critical: many gated communities have 3–5 gates and Google Maps picks the wrong one).
       - A **turn-by-turn breadcrumb** once they enter: gate → ramp → basement level → slot number, rendered on the society's uploaded floor plan.
       - **Offline fallback**: static SVG directions cached.
4. **Indoor navigation (advanced, Pro tier)** — optional **Bluetooth beacons** (₹300–₹800 each, ~20 per basement) for actual indoor positioning. We use `react-native-beacons-manager` + trilateration → "you are here" dot moves on the floor plan. Nobody in India offers this today.
5. **Resident self-find** — "where's my slot?" button shows the path from nearest gate. Cached after first load.
6. **EV charger booking** — chargers are scarce; residents book 30-min slots, first-come. Future: integrate with OCPP charger APIs.
7. **Vehicle records + ANPR** — ANPR camera at gate auto-opens boom for known plates; alerts on unknown. Integrates via RTSP → OpenALPR → our API.
8. **Parking violation reporting** — resident taps "report blocker", snaps photo, the offending plate's owner gets a push.
9. **Analytics for committee** — peak occupancy, visitor slot turnover, "flat 204 has 3 cars in a 2-slot allocation."

### 8c. Map technology stack (cost-effective)

| Concern | Choice | Why not Google Maps |
|---|---|---|
| Base tiles (outdoor) | **OpenStreetMap** via MapTiler free tier or self-hosted tile server | Google Maps SDK pricing for Indian societies at scale is brutal; OSM is free + good Indian coverage now |
| Vector rendering (mobile) | **MapLibre GL Native** (via `@maplibre/maplibre-react-native`) | Open-source fork of Mapbox, no API key, no usage caps |
| Vector rendering (web) | **MapLibre GL JS** or **Leaflet** + `leaflet-indoor` for levels | Free, battle-tested |
| Indoor floor plans | Uploaded as **GeoJSON polygons** over a georeferenced raster (floor plan PNG). Editor built with `Leaflet.draw`. | Simple, no proprietary formats |
| Indoor positioning (Pro) | **Bluetooth beacons** (iBeacon/Eddystone) + device IMU | Works without GPS, inexpensive |
| Geofencing (auto-detect "arrived at society") | `react-native-background-geolocation` | Triggers guard pre-alert; reduces gate wait |
| Routing | Outdoor: **OSRM** self-hosted or public. Indoor: custom A* over our slot graph. | OSRM is free, ours is trivial over <1000 nodes |

### 8d. Data model (parking)

```text
parking_level     (id, society_id, name, order, base_image_url, bounds_geojson)
parking_slot      (id, level_id, code, type[car|bike|ev|visitor|disabled], polygon_geojson,
                   owner_flat_id?, monthly_rent?, charger_id?, status)
parking_assignment(id, slot_id, flat_id, starts_at, ends_at?)       -- history
parking_visitor_pass(id, visit_id, slot_id, qr_jwt, issued_at, expires_at, used_at?)
vehicle           (id, flat_id, plate, make, model, color, is_ev, rfid_tag?, photo_url?)
ev_booking        (id, charger_id, vehicle_id, starts_at, ends_at, kwh?, amount?)
parking_event     (id, slot_id, vehicle_id, event[arrive|depart|violation], source[anpr|qr|manual], at)
```

### 8e. Why this is a differentiator (not just a feature)

No incumbent does visitor-parking navigation. Swiggy/Zomato drivers waste 3–7 minutes per delivery hunting slots in large societies; every committee has heard complaints. Even a basic version ("here's the gate, here's a slot number, here's a picture of the pillar") is a wow moment at demos. Beacons tier is the moat.

---

## 9. AI via MCP (Progressive)

Per spec: *"in this add MCP, so in future can be possible to integrate AI also."*

We ship an MCP server from day one, even if AI is off by default. It exposes tools any LLM (Claude, GPT, local Ollama) can call:

| MCP tool | Use case |
|---|---|
| `society.get_bills(flat_id, range)` | Resident chatbot: "When is my next maintenance due?" |
| `society.file_complaint(text, images, category?)` | Resident speaks a complaint; AI categorizes + files |
| `society.route_complaint(complaint_id)` | AI picks best staff based on past resolution time |
| `society.summarize_notices(range)` | "What happened at the last AGM?" |
| `society.expense_anomaly(period)` | Accounting AI flags unusual vendor payments |
| `society.search_contacts(query)` | "plumber who fixed 3rd floor leak last month" |
| `society.draft_notice(topic, tone)` | Committee drafts a water-cut notice |

Admins toggle which tools are enabled and which models are allowed (local-only for privacy-sensitive societies). **AI is an add-on, not a dependency** — turning it off leaves a fully functional app.

---

## 10. Audio / Video Calling

Per spec: *"add audio video calling feature also."*

- **Resident ↔ Guard video callback** — when a guard taps "verify visitor," the resident can optionally video-call to see the person before approval. Huge for flats where kids/elderly answer.
- **Committee meetings / AGM online voting** — video room with voting widget; self-hostable via Jitsi in Community tier.
- **Staff dispatch** — admin can jump on a quick call with a plumber to explain the issue before they visit.
- **SOS video** — panic button opens one-way video to guards + designated neighbors.

Stack: **LiveKit Cloud** for SaaS (cheap: ~$0.0015/participant-minute), **Jitsi Meet** embedded for self-host. Both support React Native.

---

## 11. Offline Strategy

Per spec: *"mobile App can work offline so use there sqlitedb"* — especially important for the guard.

- **WatermelonDB** on top of SQLCipher-encrypted SQLite.
- **Sync protocol**: pull-based, cursor-driven, conflict resolution = last-write-wins with a server audit trail of overridden records.
- **Guard-critical flows offline**: add visitor, accept delivery, log entry/exit, panic button (SMS fallback via device SIM when data is dead).
- **Resident-usable offline**: view last bill, view notices, view directory, see approved-visitor history. Posting complaints queues and sends when online.
- **Admin offline-read**: dashboards snapshot cached; writes require connectivity.

---

## 12. Multi-Role & Family Accounts

Per spec: *"One user can have multiple roles"* and *"will be used by society members, their families, and management, so roles should be designed accordingly."*

- A `user` is global (phone-verified). A `membership` row links `user_id` ↔ `society_id` ↔ `role` ↔ `flat_id?`.
- One user can have: admin in Society A, resident in Society B (second home), and guard employment in Society C. The app shows a society switcher.
- **Family accounts** — a flat has one primary resident + up to N family members. Family members have scoped permissions (can pay bills, can approve visitors, but can't vote or change ownership). Helps with retired parents, kids, spouse.
- **Tenant vs owner** — different rights around voting, selling the flat, AGM participation.
- **Full management control** (spec): admins can suspend, re-assign, force-logout, and export any resident's data.

---

## 13. Development Roadmap

| Phase | Duration | Deliverable | Outcome |
|---|---|---|---|
| **P0 — Foundation** | Weeks 1–3 | Mono-repo, .NET 8 skeleton, auth (OTP + JWT), multi-tenant Postgres + RLS, RN app scaffold, Docker Compose self-host works on a laptop | Dev loop is tight |
| **P1 — MVP (spec Phase 1)** | Weeks 4–10 | Maintenance billing + payments (Razorpay), visitor management, complaints with images, basic notices | First pilot society |
| **P2 — Accounting + Member mgmt + Social (spec Phase 2)** | Weeks 11–16 | Accounting module, member/family/tenant records, push + SMS notifications, guard offline-first, facility booking, **Private Social Network (Society Feed, Marketplace, Polls, Directory)** | 5 paying societies |
| **P3 — Parking + Geomap** | Weeks 17–21 | Parking module per §8 (no beacons yet), visitor nav URL, EV booking, ANPR hook | Demo-worthy differentiator |
| **P4 — AI/MCP + A/V calling** | Weeks 22–26 | MCP server live, 4 AI tools, LiveKit/Jitsi integration | Unlocks Pro tier |
| **P5 — Marketplace + Wallet** | Weeks 27–32 | Local services marketplace, Society Wallet, commissions | Unit economics turn positive |
| **P6 — Enterprise + Beacons** | Weeks 33–40 | White-label, SSO (SAML/OIDC), indoor beacons Pro, builder portfolio dashboard | Win first township deal |

---

## 14. Go-to-Market

1. **Beachhead: Pune + Bengaluru IT-dense societies.** These MC members are technically literate, price-sensitive, and privacy-aware — our self-host pitch lands hardest here.
2. **Founder-led sales first 20 societies** — personally onboard, extract testimonials, build case studies.
3. **Builder partnerships** — offer white-label free for the handover period (first 6 months); RWAs keep us when they take over.
4. **Facility managers as channel** — companies like MyHomeApp's managers can white-label.
5. **Content + SEO** — ROI calculator, "MyGate alternative" landing page (honest comparison), DPDP compliance guide for RWAs.
6. **Referral** — 2 months free for each referred society that onboards.

---

## 15. Risks & Mitigations

| Risk | Mitigation |
|---|---|
| MyGate slashes price to crush us | We have self-host; they can't follow without cannibalizing core. Lean ops = we survive lower ARPU. |
| Payment regulation changes (RBI on wallets) | Partner with a licensed PA-PG; don't hold funds directly. |
| Self-host support burden explodes | Gate heavy support behind paid tier; community self-serves via docs; remote-assist add-on. |
| Committee elections change the decision-maker every year | Make onboarding + data export painless so renewal is a non-event; make residents love it so committees face pushback if they switch. |
| Data breach kills trust | Encrypted at rest + in transit, RLS, pentests, bug bounty, incident response runbook. |
| A/V calling cost runaway | Pooled minutes per tier + clear overage pricing; Jitsi fallback. |

---

## 16. Open Questions (need your input before build starts)

1. **Geography**: India-first we assume. Do we explicitly want Middle East (UAE) or SEA later? (Affects i18n/RTL + currency at the schema level.)
2. **Languages**: English + Hindi at MVP is obvious. Marathi, Tamil, Kannada, Telugu for P2?
3. **Wallet**: do we want to be a licensed PPI (tough, regulated) or a pre-paid credit ledger settled via Razorpay? Recommended: ledger first.
4. **Open-source posture**: Community tier under **AGPL-3.0** (keeps forks open) or a source-available **BSL** (lets us keep commercial leverage)? Recommended: AGPL for self-host adoption, commercial modules dual-licensed.
5. **Indoor beacons** — ship with official hardware we resell (₹15k kit), or BYO?

---

## 17. Corrections to the Original Spec

Three items in the current spec I'd change, in order of importance:

1. **Server DB: SQLite → PostgreSQL.** SQLite is great on mobile (kept as-is) but wrong on the server — single-writer, no RLS, poor for multi-tenant. This is non-negotiable for SaaS scale and for self-host societies >100 flats. Keep the rest of the stack.
2. **Backend: "Node.js/Django" mentioned in `society-app-spec.md` contradicts `.NET Core 8` in `AppBuildInfo.md`.** Instructions.md and AppBuildInfo are newer; **.NET 8 wins**. I'll update `society-app-spec.md` to match when you approve.
3. **"Guard large buttons, minimal text" UI spec** is right but needs to go further: offline-first, loud haptics, stays on lockscreen, one-tap SOS. I've baked this into P1.

---

## 18. Next Actions (what I need from you)

- ✅ Approve the dual-mode monetization (SaaS + Self-Host) and the tier structure.
- ✅ Confirm PostgreSQL for server DB (SQLite stays on mobile).
- ✅ Pick an open-source license (AGPL recommended) for Community tier.
- ✅ Answer the five open questions in §16.
- ✅ Then I scaffold the repo — .NET 8 solution + RN app + Docker Compose self-host + the first vertical slice (Identity/OTP) — as our P0 deliverable.

---

---

## 19. Private Social Network — "Society Feed"

### 19a. Concept

The Society Feed is a **walled-garden social layer** visible only to verified residents of a society. It replaces the fragmented, admin-less WhatsApp groups every society already has — with identity-verified, moderated, structured interaction that lives inside the app. No external sharing. No ads. No algorithm. Chronological by default.

Management retains **full control**: they can moderate posts, mute members, pin content, and broadcast-only lock the feed during sensitive periods. This satisfies the spec requirement: *"Full control will be with the management."*

### 19b. Feature List

| Feature | Who can use | Notes |
|---|---|---|
| **Feed / Posts** | All verified residents | Text + up to 4 photos; categories: General, Lost & Found, Help Wanted, For Sale, Recommendation, Warning |
| **Reactions** | All verified residents | Helpful · Thanks · 👍 — no dislike; prevents toxicity |
| **Comments** | All verified residents | Threaded, one level deep; admin can lock comments on any post |
| **Groups / Circles** | Auto-created + resident-created | Auto: wing groups (A Wing, B Wing…), floor groups; Manual: Pet Owners, EV Owners, Carpool, etc. |
| **Community Marketplace** | All verified residents | Buy / Sell / Give-Away items within the society; price optional; no commission (P2) |
| **Quick Polls** | Residents + Admin | Informal polls ("Dog park — yes/no?"); separate from formal AGM voting |
| **Events** | Residents + Admin | Post events with date/time/venue + RSVP count; admin can feature-pin |
| **Resident Directory** | Opted-in residents only | Name, flat, optional phone/email; opt-in per field; admin can force-hide any entry |
| **Help Requests** | All verified residents | "Collect my parcel today?" / "Carpooling to Whitefield 9am?" — expires in 24h automatically |
| **Emergency Wall** | Admin only (broadcast) | Read-only, pinned at top, loud push notification to all; cannot be hidden by residents |
| **Post Reporting** | All residents | Flag inappropriate content → admin review queue |
| **Admin Moderation** | Admin / Accountant | Remove posts, mute members (7d/30d/permanent), lock feed to read-only, export report |

### 19c. Privacy Rules (non-negotiable)

1. **Society boundary** — posts are visible only to verified members of that society. Zero cross-society leakage.
2. **No public indexing** — feed content is never served without a valid JWT. No SEO, no sharing URLs.
3. **Flat-verified identity** — every post shows flat number + first name. Anonymous posts forbidden. Builds accountability.
4. **Photo moderation** — uploaded images pass through a content hash check (PhotoDNA / perceptual hash against known-bad library). CSAM or known-violent content rejected before storage.
5. **Data portability** — residents can export their own posts + comments in JSON (DPDP Act compliance).
6. **Right to delete** — resident deletes own post; soft-delete with content replaced by "[deleted]"; admin hard-deletes.
7. **No cross-promotion** — marketplace listings within the app only; no linking to external storefronts without admin approval.

### 19d. RBAC on Social Module

| Action | Admin | Resident | Family | Guard | Staff |
|---|---|---|---|---|---|
| Post to feed | ✅ | ✅ | ✅ (family scoped to flat's group) | ❌ | ❌ |
| Comment | ✅ | ✅ | ✅ | ❌ | ❌ |
| React | ✅ | ✅ | ✅ | ❌ | ❌ |
| Post Emergency Wall | ✅ | ❌ | ❌ | ❌ | ❌ |
| Create group | ✅ | ✅ | ❌ | ❌ | ❌ |
| Moderate (remove/mute) | ✅ | ❌ | ❌ | ❌ | ❌ |
| View directory | ✅ | ✅ (opted-in only) | ✅ (opted-in only) | ❌ | ❌ |
| Post marketplace listing | ✅ | ✅ | ❌ | ❌ | ❌ |

### 19e. Data Model

```text
-- Core social schema
social.posts
  id uuid PK
  society_id uuid FK → identity.societies   -- RLS key
  author_user_id uuid FK → identity.users
  author_flat_id uuid FK → identity.flats
  category  text  CHECK IN ('general','lost_found','help_wanted','for_sale','recommendation','warning','event','poll','emergency')
  body      text  NOT NULL  -- max 1000 chars
  image_urls jsonb DEFAULT '[]'
  group_id  uuid? FK → social.groups
  is_pinned bool DEFAULT false
  is_locked bool DEFAULT false           -- comments disabled
  expires_at timestamptz?                -- for help_wanted; auto-expire
  is_deleted bool DEFAULT false
  created_at timestamptz DEFAULT now()
  updated_at timestamptz DEFAULT now()

social.post_reactions
  id uuid PK
  post_id uuid FK → social.posts
  user_id uuid FK → identity.users
  reaction text CHECK IN ('helpful','thanks','thumbsup')
  UNIQUE(post_id, user_id)               -- one reaction per user per post

social.comments
  id uuid PK
  post_id uuid FK → social.posts
  parent_id uuid?                        -- one level deep; NULL = top-level
  author_user_id uuid FK → identity.users
  author_flat_id uuid FK → identity.flats
  body text NOT NULL                     -- max 500 chars
  is_deleted bool DEFAULT false
  created_at timestamptz DEFAULT now()

social.groups
  id uuid PK
  society_id uuid FK → identity.societies
  name text NOT NULL
  type text CHECK IN ('auto_wing','auto_floor','manual')
  created_by_user_id uuid?
  created_at timestamptz DEFAULT now()

social.group_members
  group_id uuid FK → social.groups
  user_id  uuid FK → identity.users
  joined_at timestamptz DEFAULT now()
  PRIMARY KEY (group_id, user_id)

social.marketplace_listings
  id uuid PK
  post_id uuid FK → social.posts          -- listing IS a post
  price_paise bigint?                     -- NULL = free / give-away
  condition text CHECK IN ('new','like_new','good','fair')
  is_sold bool DEFAULT false
  sold_to_user_id uuid?

social.polls
  id uuid PK
  post_id uuid FK → social.posts
  question text NOT NULL
  options jsonb NOT NULL                  -- [{id, text}]
  ends_at timestamptz?
  allow_multiple bool DEFAULT false

social.poll_votes
  poll_id uuid FK → social.polls
  user_id uuid FK → identity.users
  option_ids jsonb NOT NULL              -- [optionId, ...]
  voted_at timestamptz DEFAULT now()
  PRIMARY KEY (poll_id, user_id)

social.reports
  id uuid PK
  post_id uuid FK → social.posts
  reported_by uuid FK → identity.users
  reason text
  status text CHECK IN ('pending','reviewed','dismissed','actioned')
  created_at timestamptz DEFAULT now()

social.directory_entries
  user_id uuid FK → identity.users  PK
  society_id uuid FK → identity.societies
  display_name text                       -- resident controls
  show_phone bool DEFAULT false
  show_email bool DEFAULT false
  bio text?                               -- max 150 chars
  updated_at timestamptz DEFAULT now()
```

**RLS policies:** `society_id = current_setting('app.current_society_id')::uuid` on `posts`, `groups`, `group_members`, `directory_entries`. All enforced at DB level, same pattern as other modules.

### 19f. API Endpoints (planned)

```
POST   /api/v1/social/posts              — create post (any category)
GET    /api/v1/social/posts              — feed (paginated, filter by group/category)
GET    /api/v1/social/posts/{id}         — single post with comments
DELETE /api/v1/social/posts/{id}         — soft-delete own post
POST   /api/v1/social/posts/{id}/react   — add/change reaction
DELETE /api/v1/social/posts/{id}/react   — remove reaction
POST   /api/v1/social/posts/{id}/comments       — add comment
DELETE /api/v1/social/posts/{id}/comments/{cid} — delete own comment
POST   /api/v1/social/posts/{id}/report  — report post
POST   /api/v1/social/posts/{id}/pin     — admin: pin/unpin
POST   /api/v1/social/posts/{id}/lock    — admin: lock/unlock comments
GET    /api/v1/social/groups             — list groups for society
POST   /api/v1/social/groups             — create group
POST   /api/v1/social/groups/{id}/join   — join/leave group
GET    /api/v1/social/marketplace        — list active marketplace listings
GET    /api/v1/social/polls/{id}/results — poll results
POST   /api/v1/social/polls/{id}/vote    — cast vote
GET    /api/v1/social/directory          — opted-in directory
PUT    /api/v1/social/directory/me       — update own directory entry
GET    /api/v1/social/admin/reports      — admin: pending report queue
PUT    /api/v1/social/admin/reports/{id} — admin: action report
```

### 19g. Real-time (SignalR)

New SignalR events added to `SocietyHub`:

| Event | Target group | When |
|---|---|---|
| `NewFeedPost` | `society_{id}` | Any new post on the main feed |
| `NewGroupPost` | `group_{id}` | New post in a specific group |
| `NewComment` | `post_subscribers_{postId}` (opt-in) | Comment on a post you authored or commented on |
| `PostReaction` | `post_author_{userId}` | Someone reacted to your post |
| `EmergencyPost` | `society_{id}` | Admin posts to Emergency Wall — triggers loud push |
| `PollClosed` | `society_{id}` | Poll ends — sends results |

### 19h. Mobile Screens (planned)

- **FeedScreen** — scrollable post card list; filter bar (All / Wing / Groups / Marketplace); FAB to create post
- **CreatePostScreen** — category picker, body input, image picker (up to 4), group selector, optional poll/event fields
- **PostDetailScreen** — full post + threaded comments; react strip
- **GroupsScreen** — list + join/leave; your groups highlighted
- **MarketplaceScreen** — grid of listings with condition badge + price chip
- **DirectoryScreen** — opted-in residents; search by name or flat
- **AdminModerationScreen** — report queue + recent moderation actions

### 19i. Phase Placement

This module is added to **P2** (Weeks 11–16), alongside Accounting and Member Management, because:
- It depends on Identity (verified flat memberships) — ✅ done in P0
- It depends on Communication (SignalR hub, push notifications) — ✅ done in P1
- It is a strong **activation feature**: once residents have social + billing + visitors, daily active usage climbs and churn drops
- Marketplace listings set the foundation for the full Local Services Marketplace in P5

### 19j. Why this beats WhatsApp groups

| Problem with WhatsApp | How Society Feed solves it |
|---|---|
| Anyone can add outsiders | Membership is flat-verified only |
| No moderation tools | Admin can remove posts, mute, lock |
| Phone number exposed to all | Directory is opt-in per field |
| Forwarded misinformation floods | Reports queue + admin review |
| Lost in 200-message chaos | Categorised + searchable |
| No accountability for posts | Every post tied to a flat number |
| MC can't broadcast without noise | Emergency Wall is read-only, pinned |
| WhatsApp owns your data | Data stays in your society (self-host) or DS servers only |

---

*End of plan. Living document — edit directly; I'll track changes against this as we build.*
