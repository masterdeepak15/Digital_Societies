# 📊 Digital Societies — Development Status

> Living document. Updated as phases complete.
> Last updated: 2026-04-26 (P5 complete)

---

## Phase Summary

| Phase | Name | Status | What's Done |
|-------|------|--------|-------------|
| P0 | Foundation | ✅ **Complete** | Mono-repo, Identity, Docker, mobile scaffold |
| P1 | MVP | ✅ **Complete** | Billing, Visitor, Complaints, Notices, API wiring, mobile screens |
| P2 | Accounting + Social + Facility | ✅ **Complete** | Social, Accounting, Facility, Push notifications, Family management |
| P3 | Parking + Geomap | ✅ **Complete** | Parking module complete; Geomap deferred to P6 |
| P4 | AI / MCP + A/V | ✅ **Complete** | MCP server (6 tools), LiveKit+Jitsi calling, SOS broadcast, video callback |
| P5 | Marketplace + Wallet | ✅ **Complete** | Service marketplace, commission engine, pre-paid wallet, Razorpay top-up |
| P6 | Enterprise | 📋 Planned | — |

---

## P0 — Foundation ✅ Complete

### Backend (`services/`)

| Item | File(s) | Status |
|------|---------|--------|
| Mono-repo structure | `/` | ✅ |
| Solution file | `services/DigitalSocieties.sln` | ✅ |
| Shared kernel — Result<T>, GuardClauses | `DigitalSocieties.Shared/Results/`, `Extensions/` | ✅ |
| Domain primitives — Money, PhoneNumber | `DigitalSocieties.Shared/Domain/ValueObjects/` | ✅ |
| SOLID contracts — IPaymentProvider, INotificationChannel, IStorageProvider, IUnitOfWork | `DigitalSocieties.Shared/Contracts/` | ✅ |
| Domain entities — AggregateRoot, AuditableEntity | `DigitalSocieties.Shared/Domain/Entities/` | ✅ |
| Identity module — OTP, JWT, RBAC, multi-tenant | `DigitalSocieties.Identity/` | ✅ |
| OTP (BCrypt-hashed, Redis rate-limited) | `Infrastructure/Services/OtpService.cs` | ✅ |
| JWT service (10-min access + refresh rotation) | `Infrastructure/Security/JwtService.cs` | ✅ |
| Device binding + step-up auth | `Domain/Entities/UserDevice.cs` | ✅ |
| EF Core Identity DbContext + RLS | `Infrastructure/Persistence/IdentityDbContext.cs` | ✅ |
| EF Core migrations (InitialCreate) | `Infrastructure/Persistence/Migrations/` | ✅ |
| API host — minimal APIs + MediatR | `DigitalSocieties.Api/Program.cs` | ✅ |
| Middleware — JWT current user, tenant resolution, global exception handler | `DigitalSocieties.Api/Middleware/` | ✅ |
| MinIO storage provider | `DigitalSocieties.Api/Infrastructure/Storage/` | ✅ |
| Identity endpoints (send-otp, verify-otp) | `DigitalSocieties.Api/Endpoints/Identity/` | ✅ |

### Infrastructure

| Item | File(s) | Status |
|------|---------|--------|
| Docker Compose (full local stack) | `infra/docker/docker-compose.yml` | ✅ |
| Docker Compose dev (infra-only) | `infra/docker/docker-compose.dev.yml` | ✅ |
| Docker Compose production (pulls GHCR image) | `infra/docker/docker-compose.prod.yml` | ✅ |
| Caddyfile production (API + auto-HTTPS) | `infra/docker/Caddyfile.prod` | ✅ |
| .env example (dev) | `infra/docker/.env.example` | ✅ |
| .env example (prod) | `infra/docker/.env.prod.example` | ✅ |
| PostgreSQL RLS bootstrap SQL | `infra/docker/postgres-init/01-rls.sql` | ✅ |
| Full PostgreSQL schema reference | `infra/postgres/schema.sql` | ✅ |
| API Dockerfile (multi-stage Alpine) | `services/DigitalSocieties.Api/Dockerfile` | ✅ |

### Mobile (`apps/mobile/`)

| Item | File(s) | Status |
|------|---------|--------|
| Expo SDK 51 app scaffold | `app.json`, `package.json` | ✅ |
| TypeScript config (bundler, decorators) | `tsconfig.json` | ✅ |
| WatermelonDB models (User, Society, Bill, Visitor, Complaint, Notice, Membership) | `src/database/models/` | ✅ |
| WatermelonDB schema + sync service | `src/database/schema.ts`, `SyncService.ts` | ✅ |
| Role-based navigation (Admin, Resident, Guard, Staff tabs) | `src/navigation/` | ✅ |
| Expo Router layouts (app + auth) | `app/` | ✅ |
| Auth store (Zustand) | `src/store/authStore.ts` | ✅ |
| API client + auth service | `src/services/api/` | ✅ |
| Design tokens (colors, spacing, typography) | `src/theme/` | ✅ |
| Global TypeScript declarations (process.env) | `src/types/globals.d.ts` | ✅ |
| App assets (icon, splash, adaptive-icon, alert.wav) | `assets/` | ✅ |

### CI/CD

| Item | File(s) | Status |
|------|---------|--------|
| GitHub Actions workflow | `.github/workflows/ci.yml` | ✅ |
| Backend: dotnet publish + GHCR Docker push | `ci.yml` — job `backend-release` | ✅ |
| Android: expo prebuild + gradlew assembleRelease | `ci.yml` — job `apk-release` | ✅ |
| Docker image auto-tagged `:latest` + `:sha` | GHCR | ✅ |

### Tests

| Item | File(s) | Status |
|------|---------|--------|
| Money value object tests | `tests/.../Domain/MoneyTests.cs` | ✅ |
| OtpRequest domain tests | `tests/.../Domain/OtpRequestTests.cs` | ✅ |
| PhoneNumber value object tests | `tests/.../Domain/PhoneNumberTests.cs` | ✅ |

---

## P1 — MVP ✅ Complete

### Billing Module (`DigitalSocieties.Billing/`)

| Item | Status |
|------|--------|
| Domain entities — Bill, Payment | ✅ |
| Domain events — BillingEvents | ✅ |
| Command — GenerateMonthlyBillsCommand | ✅ |
| Command — InitiatePaymentCommand (Razorpay order creation) | ✅ |
| Command — VerifyPaymentCommand (Razorpay webhook HMAC verify) | ✅ |
| Query — GetFlatBillsQuery | ✅ |
| Query — GetSocietyBillSummaryQuery | ✅ |
| Infrastructure — RazorpayProvider | ✅ |
| Infrastructure — BillingDbContext + EF configurations | ✅ |
| API endpoints — `/api/v1/billing/*` | ✅ |
| Mobile screen — BillingScreen (admin) + BillsScreen (resident) | ✅ |

### Visitor Module (`DigitalSocieties.Visitor/`)

| Item | Status |
|------|--------|
| Domain entity — Visitor (with status state machine) | ✅ |
| Domain events — VisitorEvents | ✅ |
| Command — AddVisitorCommand | ✅ |
| Command — ApproveVisitorCommand | ✅ |
| Command — RejectVisitorCommand | ✅ |
| Command — MarkVisitorEnteredCommand | ✅ |
| Command — MarkVisitorExitedCommand | ✅ |
| Query — GetVisitorsQuery | ✅ |
| Infrastructure — QrTokenService (signed JWT, 2-min TTL) | ✅ |
| Infrastructure — VisitorDbContext | ✅ |
| API endpoints — `/api/v1/visitors/*` | ✅ |
| Mobile screens — GateScreen + LogScreen (guard), VisitorsScreen (resident) | ✅ |

### Complaint Module (`DigitalSocieties.Complaint/`)

| Item | Status |
|------|--------|
| Domain entity — Complaint | ✅ |
| Domain events — ComplaintEvents | ✅ |
| Command — RaiseComplaintCommand | ✅ |
| Command — AssignComplaintCommand | ✅ |
| Command — UpdateComplaintStatusCommand | ✅ |
| Command — GetComplaintUploadUrlCommand (MinIO pre-signed) | ✅ |
| Query — GetMyComplaintsQuery | ✅ |
| Query — GetComplaintDetailQuery | ✅ |
| Query — GetSocietyComplaintsQuery | ✅ |
| Infrastructure — ComplaintDbContext | ✅ |
| API endpoints — `/api/v1/complaints/*` | ✅ |
| Mobile screens — ComplaintsScreen (admin + resident) | ✅ |

### Communication Module (`DigitalSocieties.Communication/`)

| Item | Status |
|------|--------|
| Domain entity — Notice | ✅ |
| Domain events — CommunicationEvents | ✅ |
| Command — PostNoticeCommand | ✅ |
| Command — PinNoticeCommand | ✅ |
| Command — ExpireNoticeCommand | ✅ |
| Query — GetSocietyNoticesQuery | ✅ |
| Query — GetNoticeDetailQuery | ✅ |
| Infrastructure — `SocietyHub` (SignalR hub) | ✅ |
| Infrastructure — Msg91SmsChannel | ✅ |
| Infrastructure — CommunicationDbContext | ✅ |
| API endpoints — `/api/v1/notices/*` | ✅ |
| Mobile screens — NoticesScreen (resident), DashboardScreen (admin) | ✅ |

---

## P2 — Accounting + Social + Facility ✅ Complete

### Social Module (`DigitalSocieties.Social/`) ✅

| Item | Status |
|------|--------|
| Domain entities — SocialPost, PostComment, PostReaction, PostReport | ✅ |
| Domain entities — SocialGroup, SocialPoll, DirectoryEntry, MarketplaceListing | ✅ |
| Domain enums — PostCategory | ✅ |
| Domain events — SocialEvents | ✅ |
| Command — CreatePostCommand | ✅ |
| Command — ReactToPostCommand | ✅ |
| Command — CommentOnPostCommand | ✅ |
| Command — ModeratePostCommand | ✅ |
| Command — VotePollCommand | ✅ |
| Command — UpsertDirectoryEntryCommand | ✅ |
| Query — GetFeedQuery | ✅ |
| Query — GetPostDetailQuery | ✅ |
| Query — GetDirectoryQuery | ✅ |
| Infrastructure — SocialDbContext | ✅ |
| Infrastructure — ISocialHubNotifier (SignalR events) | ✅ |
| API endpoints — `/api/v1/social/*` | ✅ |
| Mobile screen — FeedScreen (resident) | ✅ |

### Accounting Module (`DigitalSocieties.Accounting/`) ✅

| Item | Status |
|------|--------|
| Domain entity — LedgerEntry (Income/Expense aggregate root) | ✅ |
| Auto-approval logic: expenses >₹10,000 → PendingApproval | ✅ |
| Domain events — LedgerEntryPostedEvent, ApprovedEvent, RejectedEvent | ✅ |
| Command — PostLedgerEntryCommand | ✅ |
| Command — ApproveLedgerEntryCommand | ✅ |
| Command — RejectLedgerEntryCommand | ✅ |
| Query — GetLedgerEntriesQuery (paginated, filterable by type/category/status) | ✅ |
| Query — GetMonthlyReportQuery (P&L summary + category breakdown + pending count) | ✅ |
| Infrastructure — AccountingDbContext (schema: `accounting`) | ✅ |
| Infrastructure — AccountingServiceExtensions | ✅ |
| EF Core migration — InitialCreate + RLS policy | ✅ |
| API endpoints — `/api/v1/accounting/*` | ✅ |
| Mobile screen — AccountingScreen (admin): P&L tab, Ledger tab, Pending Approvals tab | ✅ |

### Facility Booking Module (`DigitalSocieties.Facility/`) ✅

| Item | Status |
|------|--------|
| Domain entity — Facility (amenity, open/close times, slot duration) | ✅ |
| Domain entity — FacilityBooking (time slot, conflict detection) | ✅ |
| Command — CreateFacilityCommand (admin setup) | ✅ |
| Command — BookFacilityCommand (conflict check + per-flat advance booking limit) | ✅ |
| Command — CancelBookingCommand (resident cancels own; admin can cancel any) | ✅ |
| Query — GetFacilitiesQuery (active facilities list) | ✅ |
| Query — GetMyBookingsQuery (resident's own bookings) | ✅ |
| Infrastructure — FacilityDbContext (schema: `facility`) | ✅ |
| Infrastructure — FacilityServiceExtensions | ✅ |
| EF Core migration — InitialCreate + RLS policies on both tables | ✅ |
| API endpoints — `/api/v1/facilities/*` | ✅ |
| Mobile screen — FacilityBookingScreen (resident): browse + book + cancel + history | ✅ |

### Push Notifications ✅

| Item | Status |
|------|--------|
| IPushTokenStore abstraction | ✅ |
| PostgresPushTokenStore (unique index on expo_push_token) | ✅ |
| ExpoPushChannel — implements INotificationChannel via Expo Push API | ✅ |
| push_tokens table in CommunicationDbContext | ✅ |
| HttpClient("expo") registered in DI | ✅ |
| API endpoints — `POST /members/push-tokens` (register), `DELETE /members/push-tokens` (unregister) | ✅ |

### Member & Family Management ✅

| Item | Status |
|------|--------|
| AddFamilyMemberCommand (admin adds family/tenant to a flat) | ✅ |
| RemoveMemberCommand (admin revokes membership) | ✅ |
| GetFlatMembersQuery (flat-level member list) | ✅ |
| GetSocietyMembersQuery (admin, filterable by role/wing, paginated) | ✅ |
| API endpoints — `/api/v1/members/*` | ✅ |
| Mobile screen — MembersScreen (admin): search, role filter, flat grouping, add family modal | ✅ |

### Guard Offline-First Hardening — 📋 Deferred to P3

| Item | Status |
|------|--------|
| Offline visitor add + sync queue | 📋 |
| SMS fallback when no data (via device SIM) | 📋 |
| Auto-wipe after 7 days offline | 📋 |

---

## P3 — Parking + Geomap 🔄 In Progress

### Parking Module (`DigitalSocieties.Parking/`) ✅

| Item | Status |
|------|--------|
| Domain entity — ParkingLevel (name, level number, floor plan URL) | ✅ |
| Domain entity — ParkingSlot (SlotType: Car/Bike/Heavy, SlotStatus, EV charger flag) | ✅ |
| Domain entity — Vehicle (registration number, make/model, color, RC doc URL) | ✅ |
| Domain events — SlotAssignedEvent, SlotUnassignedEvent, VehicleRegisteredEvent | ✅ |
| Command — CreateParkingLevelCommand (admin creates a level/zone) | ✅ |
| Command — AddParkingSlotCommand (admin adds slot to a level) | ✅ |
| Command — AssignSlotCommand (assign slot to flat + vehicle) | ✅ |
| Command — UnassignSlotCommand (clear slot → Available) | ✅ |
| Command — RegisterVehicleCommand (resident registers own vehicle) | ✅ |
| Command — IssueVisitorPassCommand (guard issues temp visitor parking) | ✅ |
| Query — GetParkingLevelsQuery (admin — all levels with slot counts) | ✅ |
| Query — GetLevelSlotsQuery (admin — slot grid for a level) | ✅ |
| Query — GetMyParkingQuery (resident — assigned slot + vehicle info) | ✅ |
| Query — GetMyVehiclesQuery (resident — registered vehicles list) | ✅ |
| Infrastructure — ParkingDbContext (schema: `parking`, 3 tables) | ✅ |
| Infrastructure — ParkingServiceExtensions (`AddParkingModule`) | ✅ |
| EF Core migration — InitialCreate (all tables + RLS policies + unique indexes) | ✅ |
| API endpoints — `/api/v1/parking/*` (admin + resident routes) | ✅ |
| Wired into Program.cs, Api.csproj, Dockerfile, solution | ✅ |
| Mobile screen — ParkingScreen (resident): slot card, EV badge, vehicle list, add vehicle modal | ✅ |
| Mobile screen — ParkingManagementScreen (admin): level tabs, slot grid, assign/unassign actions | ✅ |
| Nav — Parking tab added to ResidentTabs + AdminTabs | ✅ |

### Geomap Features — 📋 Deferred to P4

| Item | Status |
|------|--------|
| Floor plan image upload + GeoJSON polygon editor | 📋 |
| Visitor parking nav URL (no app needed for visitor) | 📋 |
| MapLibre outdoor gate map | 📋 |
| Indoor floor plan breadcrumb nav | 📋 |
| ANPR API hook | 📋 |
| Guard offline-first hardening (deferred from P2) | 📋 |

---

## P4 — AI / MCP + A/V Calling ✅ Complete

### MCP Server (`DigitalSocieties.Mcp/`) ✅

| Item | Status |
|------|--------|
| `DigitalSocieties.Mcp.csproj` — references Billing, Complaint, Communication, Accounting | ✅ |
| `McpSettings` — master enable/disable + per-tool toggles + model selection | ✅ |
| `McpServiceExtensions.AddMcpModule()` — registers all tools via MCP HTTP transport | ✅ |
| MCP endpoint — `GET /mcp` (SSE transport for Claude + other AI clients) | ✅ |
| Tool: `society.get_bills` — resident's bills with outstanding total | ✅ |
| Tool: `society.file_complaint` — files complaint via MediatR, returns ref number | ✅ |
| Tool: `society.route_complaint` — keyword-based dept/priority routing (z-score ready) | ✅ |
| Tool: `society.summarize_notices` — fetches + summarizes recent notices (pinned first) | ✅ |
| Tool: `society.draft_notice` — template-driven notice draft (admin only) | ✅ |
| Tool: `society.expense_anomaly` — z-score anomaly detection across ledger categories | ✅ |

### A/V Calling Module (`DigitalSocieties.Calling/`) ✅

| Item | Status |
|------|--------|
| `IVideoCallProvider` abstraction — OCP: swap providers via config, zero code change | ✅ |
| `LiveKitProvider` — JWT token generation + REST room management (HMAC-SHA256) | ✅ |
| `JitsiProvider` — Jitsi Meet JWT (self-hosted fallback, rooms auto-close when empty) | ✅ |
| `CallingSettings` — `Provider` key selects LiveKit vs JitsiMeet at startup | ✅ |
| Domain entity — `CallRoom` (VisitorCallback / SOS / AdHoc, state machine) | ✅ |
| Domain entity — `CallParticipant` (role: Host / Participant / Observer) | ✅ |
| Command — `CreateVisitorCallCommand` (resident initiates callback to guard) | ✅ |
| Command — `CreateSosCallCommand` (one-way broadcast; resident publishes, guards observe) | ✅ |
| Command — `JoinCallCommand` (guard / neighbor gets observer token) | ✅ |
| Command — `EndCallCommand` (host terminates room on provider + marks DB ended) | ✅ |
| `CallingDbContext` — `call_rooms` + `call_participants` tables in `calling` schema | ✅ |
| EF Core migration — InitialCreate + RLS on `call_rooms` | ✅ |
| API endpoints — `POST /calling/visitor/:id`, `/calling/sos`, `/:id/join`, `/:id/end` | ✅ |
| Mobile screen — `VideoCallScreen.tsx` (resident↔guard, mute/camera controls, PiP) | ✅ |
| Mobile screen — `SosScreen.tsx` (3s countdown, one-way broadcast, observer count) | ✅ |
| Nav — VideoCall + SOS screens registered in ResidentTabs (hidden from tab bar) | ✅ |

---

## P5 — Marketplace + Wallet ✅ Complete

### Marketplace Module (`DigitalSocieties.Marketplace/`) ✅

| Item | Status |
|------|--------|
| Domain entity — `ServiceListing` (10 categories: Plumber/Electrician/Carpenter/Painter/Cleaner/Pest/Security/Mover/IT/Other) | ✅ |
| Domain entity — `ServiceBooking` state machine (Requested → Confirmed → Completed / Cancelled) | ✅ |
| Domain entity — `ServiceReview` (rating 1-5, comment ≤1000 chars, one per completed booking) | ✅ |
| Commission engine — `ServiceListing.CommissionPct` (8–12%); `ProviderPayout()` computes net | ✅ |
| Command — `CreateListingCommand` (provider registers with category + base rate) | ✅ |
| Command — `BookServiceCommand` (resident books with date/time/notes + quoted amount snapshot) | ✅ |
| Command — `ConfirmBookingCommand` (provider confirms own bookings; admin can confirm any) | ✅ |
| Command — `CompleteBookingCommand` (final amount captured; money locked from quote) | ✅ |
| Command — `CancelBookingCommand` (cancellation reason recorded) | ✅ |
| Command — `ReviewServiceCommand` (one review per completed booking; live average recalculated) | ✅ |
| Query — `GetListingsQuery` (paginated, filterable by category + society) | ✅ |
| Query — `GetMyBookingsQuery` (N+1-safe via pre-fetched reviewed IDs HashSet; `CanReview` flag) | ✅ |
| Query — `GetProviderBookingsQuery` (provider sees own incoming bookings) | ✅ |
| `MarketplaceDbContext` — 3 tables in `marketplace` schema; Money as owned entity | ✅ |
| EF Core migration — unique index on `service_reviews.booking_id`; RLS on all 3 tables | ✅ |
| `MarketplaceServiceExtensions.AddMarketplaceModule()` | ✅ |
| API endpoints — full CRUD at `/api/v1/marketplace/*` (9 routes) | ✅ |
| Wired into Program.cs, Api.csproj, Dockerfile, solution | ✅ |
| Mobile screen — `MarketplaceScreen.tsx` (Browse tab: category filter, listing cards, BookModal; My Bookings tab: status badges, cancel, ReviewModal with star picker) | ✅ |
| Nav — Marketplace tab added to ResidentTabs | ✅ |

### Wallet Module (`DigitalSocieties.Wallet/`) ✅

| Item | Status |
|------|--------|
| Domain entity — `WalletAccount` (balance as `long BalancePaise` to avoid decimal rounding) | ✅ |
| Domain entity — `WalletTransaction` (Credit / Debit, ReferenceId for idempotency) | ✅ |
| Balance projection — `Money Balance => Money.CreateInr(BalancePaise / 100m).Value!` | ✅ |
| Guard — `Debit()` rejects if balance would go negative | ✅ |
| Command — `EnsureWalletCommand` (idempotent; creates wallet if not exists, returns id) | ✅ |
| Command — `InitiateTopUpCommand` (₹10–₹50,000 range; creates Razorpay order) | ✅ |
| Command — `VerifyTopUpCommand` (HMAC-SHA256 signature check; idempotency via `ReferenceId`) | ✅ |
| Command — `SpendFromWalletCommand` (calls `Debit()`; used by Billing, Facility, Marketplace) | ✅ |
| Command — `RefundToWalletCommand` (admin can refund to any flatId) | ✅ |
| `WalletDbContext` — unique index on `(society_id, flat_id)` enforces one wallet per flat | ✅ |
| EF Core migration — RLS on both tables | ✅ |
| `WalletServiceExtensions.AddWalletModule()` | ✅ |
| API endpoints — `/api/v1/wallet/*` (ensure, balance, transactions, topup/initiate, topup/verify) | ✅ |
| Wired into Program.cs, Api.csproj, Dockerfile, solution | ✅ |
| Mobile screen — `WalletScreen.tsx` (balance card with dark blue gradient, quick-amount chips, custom amount input, paginated transaction history with Credit/Debit color coding, TopUp modal with Razorpay order flow) | ✅ |
| Nav — Wallet tab added to ResidentTabs | ✅ |

---

## P6 — Enterprise 📋 Planned

| Item | Status |
|------|--------|
| White-label (custom logo + domain) | 📋 |
| SSO via SAML / OIDC | 📋 |
| Indoor Bluetooth beacon Pro tier | 📋 |
| Builder portfolio multi-society dashboard | 📋 |
| Advanced analytics + benchmarks | 📋 |

---

## Known Gaps / Tech Debt

| Item | Priority | Notes |
|------|----------|-------|
| EF Core migrations for Billing, Visitor, Complaint, Communication, Social modules | High | Accounting + Facility now have migrations; older P1 modules still use implicit `EnsureCreated` |
| Mobile `package-lock.json` | Medium | Deleted in CI to avoid arborist semver bug; should regenerate cleanly on Ubuntu |
| TypeScript strict mode `any` suppressions | Low | A few implicit `any` remain in older screens; tsc passes but with strict bypass |
| `appsettings.Production.json` | High | Must be created on the server (gitignored); env-var override is the path for Docker |
| Web Admin (`apps/web-admin/`) | Medium | Next.js scaffold not yet created; admin workflows are mobile-only for now |
| OpenTelemetry / Grafana | Low | Planned for P4; commented out of docker-compose for now |
| AccountingScreen/FacilityBookingScreen theme alias | Low | Use local alias `const colors = Colors` for compatibility; refactor to direct `Colors.*` in future |

---

*End of status document. Edit directly as work progresses.*
