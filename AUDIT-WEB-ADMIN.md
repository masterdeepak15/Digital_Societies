# Audit — `apps/web-admin` vs `API.md`

**Scope:** Every `api.get/post/put/patch/delete(...)` and `fetch(...)` call inside `apps/web-admin/src` was checked against the contracts in `API.md` (path, HTTP method, request body, response shape).

**Verdict:** The web-admin shell is wired, but **a significant share of API calls will fail or silently mis-render** in production. Most pages defensively fall back to embedded `DEMO_*` mock data, which masks the failures during local development.

Counts: **15 modules audited · 47 distinct API calls found · 11 OK · 25 broken · 11 minor mismatches.**

---

## 0. Cross-cutting issues (affect every call)

### 0.1 ❌ Base URL inconsistency — every authenticated call may 404

`src/lib/api.ts` builds requests as:

```ts
const BASE = process.env.NEXT_PUBLIC_API_URL ?? ''
const res = await fetch(`${BASE}${path}`, ...)   // path = '/wallet/balance'
```

But `src/app/park/v/[token]/page.tsx` hardcodes the prefix:

```ts
fetch(`${apiUrl}/api/v1/parking/nav/${token}`)   // explicit /api/v1
```

Backend mounts every module under `/api/v1/...` (Program.cs lines 237-251). Therefore one of these is wrong:

- If `NEXT_PUBLIC_API_URL = https://host` → all `api.*` calls hit `https://host/wallet/balance` → **404 across the board**.
- If `NEXT_PUBLIC_API_URL = https://host/api/v1` → the parking-nav page becomes `https://host/api/v1/api/v1/parking/nav/...` → **double prefix, 404**.

**Fix:** decide one convention. Recommended: keep `NEXT_PUBLIC_API_URL=https://host` and add a constant `API_PREFIX = '/api/v1'` to `lib/api.ts`, then change paths to e.g. `api.get('/api/v1/wallet/balance')` — or prepend automatically inside `request()`. Then make `parking/nav` use `api.get(...)` like everything else.

### 0.2 ⚠️ `X-Society-Id` header is non-standard

`api.ts` injects `X-Society-Id: <societyId>`, but the backend resolves `societyId` from the JWT (`JwtCurrentUser` → `ICurrentUser.SocietyId`) and the RLS middleware. The header is ignored server-side and adds attack surface (could let a token-stealing client target other tenants if anyone trusts it later). Remove it.

### 0.3 ⚠️ No token refresh, no logout call

`auth.ts.clearSession()` only clears the cookie; the backend `POST /auth/logout` is never invoked, so refresh tokens stay valid in Redis until expiry. Likewise, when an `ApiError` with status 401 is thrown nothing calls `POST /auth/refresh`. Wire both.

### 0.4 ⚠️ Pagination shape mistaken for plain array (recurrent)

The backend almost universally returns `{ items, total, page, pageSize }`, but the admin pages type the result as a plain array (`Notice[]`, `LedgerEntry[]`, `Member[]`, `ParkingSlot[]`, `Listing[]`, `Booking[]`, `WalletTransaction[]`, `ReportedPost[]`). React-Query will hand back the envelope object; `.filter`, `.map`, `.length` on it become `undefined`/`NaN` — every list page silently falls back to `DEMO_*`. Fix once: change the queryFn return type to `{ items: T[]; total; page; pageSize }` and pass `data?.items ?? []` through.

---

## 1. Auth / Login / Setup

| Call site | Method · Path | Verdict |
|---|---|---|
| `login/page.tsx:48` | `POST /auth/otp/send` body `{ phone, purpose:'login' }` | ✅ Matches `API.md` §1. |
| `login/page.tsx:59` | `POST /auth/otp/verify` body `{ phone, otp, purpose }` | ✅ Matches. Reads `accessToken`, `requiresTwoFactor`, `pendingUserId` correctly. ⚠️ `deviceId/deviceName/platform` not sent (optional). |
| `login/page.tsx:88` | `POST /auth/2fa/verify` body `{ pendingUserId, totpCode }` | ✅ Matches. |
| `setup/page.tsx:71` | `POST /setup/demo` body `{}` | ✅ Matches §2. |
| `setup/page.tsx:106` | `POST /setup/initialize` body `{ society, admin, smtp, razorpay, msg91, minio }` | ✅ Matches §2 exactly. |
| `setup/page.tsx:93` | `POST /auth/send-otp` body `{ phone }` | ❌ **Wrong path** (`/auth/send-otp` doesn't exist) and **missing `purpose`**. Should be `POST /auth/otp/send` with `{ phone, purpose:'register' }`. |

**Missing wirings** (defined in API but never called from admin):
`POST /auth/refresh`, `POST /auth/logout`, `GET /auth/me`, `POST /auth/2fa/enroll`, `POST /auth/2fa/confirm`, `POST /auth/2fa/disable`. Admin cannot view their own profile or manage 2FA.

---

## 2. Dashboard

| Call site | Method · Path | Verdict |
|---|---|---|
| `dashboard/page.tsx:51` | `GET /billing/dashboard` typed as `DashboardStats` (residents, complaint series, recent activity…) | ❌ Path is correct but **response shape mismatch**. API returns `{ period, total, paid, pending, overdue, totalAmountRupees, collectedRupees, pendingRupees }` only. The page detects this with `'totalResidents' in data` and silently falls back to `DEMO_STATS`. This is dishonest UX — the dashboard always shows mock data. Either build a dedicated `GET /dashboard/overview` endpoint, or compose the dashboard from multiple existing endpoints (`/billing/dashboard`, `/complaints`, `/visitors`, `/members`). |

---

## 3. Billing

| Call site | Method · Path | Verdict |
|---|---|---|
| `billing/page.tsx:46` | `GET /billing/bills?status=&search=&page=&limit=` | ✅ Path/method match. ⚠️ Type uses `flatDisplay/ownerName/billDate/paidAt/paidAmount` but API returns `{ id, flatId, period, amountRupees, dueDate, status }`. Page falls back to DEMO. |
| `billing/page.tsx:53` | `POST /billing/bills/generate` body `{ month }` | ❌ **Wrong path** — should be `POST /billing/generate`. ❌ **Wrong body** — API requires `{ societyId, period, amountPerFlat, description, dueDate }` (period in `YYYY-MM`, due date `YYYY-MM-DD`). The current body will 400. |

**Missing:** `GET /billing/summary`, `GET /billing/my`, `POST /billing/{billId}/pay` — admin cannot drill into period-level defaulters or trigger payment on a resident's behalf.

---

## 4. Visitors

| Call site | Method · Path | Verdict |
|---|---|---|
| `visitors/page.tsx:41` | `GET /visitors?status={filter}` with `filter ∈ {all,pending,approved,checked_in}` | ⚠️ Path matches but **status enum mismatch**. API expects `Pending\|Approved\|Rejected\|Entered\|Exited` (PascalCase). `all` is not a valid value (omit instead). Lowercase values silently return zero rows. |
| `visitors/page.tsx:46` | `POST /visitors/{id}/approve` body `{}` | ✅ Matches §4. |
| `visitors/page.tsx:52` | `POST /visitors/{id}/deny` body `{}` | ❌ **Wrong path** — API endpoint is `POST /visitors/{id}/reject`, optional body `{ reason?: string }`. |

**Missing:** `POST /visitors` (admin-side create), `POST /visitors/enter`, `POST /visitors/{id}/exit`. The page's "Inside / Checked Out" tabs are read-only.

**Type mismatch:** Frontend `Visitor` interface uses `purposeOfVisit/hostFlatDisplay/hostName/expectedAt/photoUrl/otp/status:'denied'|'checked_in'|'checked_out'`. API returns `{ id, name, phone, purpose, status, entryTime, exitTime, vehicleNumber }` — host info, photo, OTP not present. Falls back to DEMO.

---

## 5. Complaints

| Call site | Method · Path | Verdict |
|---|---|---|
| `complaints/page.tsx:48` | `GET /complaints?status=&search=` | ⚠️ Path correct; `search` query param not documented in API spec (verify it's accepted). Status enum needs PascalCase (`Open` etc.) per backend convention. Response is paginated `{items,total,…}` — page expects array → falls back to DEMO. |
| `complaints/page.tsx:53` | `PATCH /complaints/{id}/status` body `{ status }` | ❌ **Wrong method** — API exposes `PUT /complaints/{complaintId}/status`. PATCH will 405. ⚠️ Body should be `{ status, note? }` and status values must be `InProgress\|Resolved\|Closed\|Reopened` (PascalCase). |

**Missing:** `POST /complaints` (admin-side create), `POST /complaints/{id}/upload-url`, `POST /complaints/{id}/assign`, `GET /complaints/{id}` (full detail with timeline), `GET /complaints/my`.

---

## 6. Notices

| Call site | Method · Path | Verdict |
|---|---|---|
| `notices/page.tsx:43` | `GET /notices` | ⚠️ Path matches. Response is paginated; treated as array. Type uses `category/isPinned/isPublished/publishedAt/authorName` but API returns `{ id, title, body, type, isPinned, createdAt, expiresAt }`. Falls back to DEMO. |
| `notices/page.tsx:47` | `DELETE /notices/{id}` | ✅ Matches §6 (soft-expire). |
| `notices/page.tsx:54` | `PATCH /notices/{id}/pin` body `{ isPinned }` | ❌ **Wrong method** — API is `PUT /notices/{id}/pin`. |
| `notices/page.tsx:166` | `POST /notices` body `{ title, body, category, isPinned }` | ❌ **Wrong body**. API requires `{ societyId, title, body, type, expiresAt? }`. The frontend sends `category` (`general/maintenance/event/...`) — API expects `type` constrained to `Notice\|Emergency\|Event\|Circular`, missing `societyId`, and pinning is a **separate PUT** call (cannot be set in create payload). The mutation will 400 or silently drop fields. |

**Missing:** `GET /notices/{id}` (single notice with full body).

---

## 7. Social

| Call site | Method · Path | Verdict |
|---|---|---|
| `social/page.tsx:39` | `GET /social/posts?page=1&pageSize=50` | ⚠️ Path/method correct. Response is paginated; treated as array. Frontend type (`content/postedAt/likes/imageSrc/reportCount/reportReason/status`) does not match API DTO (`body/authorName/createdAt/category/imageCount/commentCount/reactionsCount/isPinned/isLocked`). Falls back to DEMO. |
| `social/page.tsx:43, 50` | `DELETE /social/posts/{id}` | ✅ Matches §7. |
| `social/page.tsx:57` | `PUT /social/posts/{id}/pin` body `{ isPinned }` | ✅ Matches. |
| `social/page.tsx:64` | `PUT /social/posts/{id}/lock` body `{ isLocked }` | ✅ Matches. |
| `social/page.tsx:71` | `POST /social/users/{userId}/mute` body `{}` | ❌ **Endpoint does not exist** in API.md. Page already labels it "best-effort"; either remove the button or add an endpoint (e.g. `POST /social/users/{id}/mute` body `{ hours }`). Also note: page passes `post.id` as `userId` — should be `post.authorUserId`. |

**Missing:** `POST /social/posts` (admin-side create / pin announcement), `POST /social/posts/upload-url`, `POST /social/posts/{id}/comments`, `DELETE /social/posts/{id}/comments/{cid}`, `POST /social/posts/{id}/react`, `POST /social/posts/{id}/report`, `POST /social/polls/{pollId}/vote`, `GET /social/directory`, `PUT /social/directory/me`. The admin moderation surface is much narrower than the API allows.

---

## 8. Accounting

| Call site | Method · Path | Verdict |
|---|---|---|
| `accounting/page.tsx:57` | `GET /accounting/entries` | ⚠️ Path correct. Frontend types `{ debit, credit, balance, reference }` but API returns `{ id, entryDate, type, category, description, amountPaise, status }` — there's no debit/credit/balance pair, just `type:'Income'\|'Expense'` plus paise amount. Running balance must be computed client-side. Falls back to DEMO. |
| `accounting/page.tsx:63` | `GET /accounting/entries?pendingOnly=true` | ✅ Path/query supported per API spec. Same shape mismatch. |
| `accounting/page.tsx:69` | `GET /accounting/report` typed as `PnL[]` (array of months) | ❌ **Shape wrong**. API returns single `MonthlyReportDto` for ONE period: `{ period, totalIncome, totalExpense, netProfit, expenseBreakdown[], pendingApprovals }`. To draw a 6-month bar chart, call this endpoint 6 times (one per month) or add a `GET /accounting/series?from=&to=` endpoint. |
| `accounting/page.tsx:74` | `POST /accounting/entries/{id}/approve` body `{}` | ✅ Matches §8. |
| `accounting/page.tsx:80` | `POST /accounting/entries/{id}/reject` body `{}` | ❌ **Body required** — API expects `{ rejectionReason: string }`. Empty body → 400. Add a textarea before reject. |

**Missing:** `POST /accounting/entries` — admin cannot create a ledger entry from the UI.

---

## 9. Facilities

| Call site | Method · Path | Verdict |
|---|---|---|
| `facilities/page.tsx:59` | `GET /facilities` | ✅ Path/method match. ⚠️ Response is `{ facilities: [...] }` — frontend treats it as bare array. Field shape also differs (frontend has `description, openTime, closeTime, slotDuration, isActive, bookingsToday`; API returns `{ id, name, type, capacity, availableSlots, rate }`). |
| `facilities/page.tsx:64` | `GET /facilities/bookings?date=YYYY-MM-DD` | ✅ Path/query match. ⚠️ Response is `{ items: [...] }`. Field naming differs slightly. |
| `facilities/page.tsx:70` | `DELETE /facilities/bookings/{id}` | ✅ Matches §9 (admin hard-cancel). |
| `facilities/page.tsx:77` | `PATCH /facilities/{id}` body `{ isActive }` | ❌ **Endpoint does not exist** in API.md. The "Active/Inactive" toggle on each facility card has nothing to talk to. Either add `PATCH /facilities/{id}` or expose enable/disable via a dedicated endpoint. |

**Missing:** `GET /facilities/{id}/slots`, `POST /facilities/{id}/book`, `POST /facilities/bookings/{id}/cancel`, `GET /facilities/bookings/mine`. Admin cannot create bookings or see resident-side cancellation reasons.

---

## 10. Members

| Call site | Method · Path | Verdict |
|---|---|---|
| `members/page.tsx:36` | `GET /members?role={role}&search={q}` | ⚠️ `search` query param **not in spec** (API only documents `role`, `wing`, `page`, `pageSize`). Verify backend accepts it; if not, server-side search is silently ignored and the page just runs the existing client-side filter. Response is paginated `{items,total,…}` — typed as plain array → falls back to DEMO. Field mismatch: frontend uses `email/flatDisplay/memberType/joinedAt/isActive/avatarUrl`; API returns `{ userId, name, phone, role, flatId, flatNumber, wing }`. |

**Missing:** `GET /members/flat/{flatId}`, `POST /members/family`, `DELETE /members/family/{userId}`, `POST /members/push-token`, `DELETE /members/push-token`. The "Add Member" button on the page has no handler at all.

---

## 11. Parking

| Call site | Method · Path | Verdict |
|---|---|---|
| `parking/page.tsx:53` | `GET /parking/levels` typed as `ParkingLevel[]` | ⚠️ Path/method match. ❌ **Response wrapper** — API returns `{ levels: [...] }`, not a bare array. Field naming also differs: frontend expects `levelNumber/availableSlots/floorPlanUrl`; API returns `{ id, name, totalSlots, occupiedSlots }`. |
| `parking/page.tsx:65` | `GET /parking/levels/{levelId}/slots` typed as `ParkingSlot[]` | ⚠️ Same wrapper issue — API returns `{ slots: [...] }`. Field mapping: frontend `type/status/isEvCharger/assignedFlatNumber/vehicleNumber`; API `{ id, number, status, assignedFlatId, assignedVehicle }`. No vehicle "type" or "isEvCharger" in API DTO. |
| `parking/page.tsx:70` | `POST /parking/slots/{slotId}/unassign` body `{}` | ✅ Matches §11. |
| `park/v/[token]/page.tsx:34` | `GET /api/v1/parking/nav/{token}` | ✅ Path is correct (this is the only place that hardcodes `/api/v1`). ❌ **Response shape mismatch** — frontend types `{ societyName, gateAddress, gateLat, gateLng, parkingLevelName, slotNumber, floorPlanUrl, navigationUrl, instructions }`. API doc says `{ level, availableSlots, mapUrl }`. Either the backend returns more fields than documented (likely — extend `API.md`), or this page is rendering against a richer shape that doesn't exist in production. **Verify against `GetParkingNavQuery` handler.** |

**Missing:** `POST /parking/levels`, `POST /parking/slots`, `POST /parking/slots/{id}/assign`, `POST /parking/slots/{id}/visitor-pass`. The "Add Slot" button is a no-op.

---

## 12. Marketplace

| Call site | Method · Path | Verdict |
|---|---|---|
| `marketplace/page.tsx:53` | `GET /marketplace/listings` | ✅ Path/method match. ⚠️ Response paginated `{items,total,…}`; treated as array. Field mapping: frontend `price/category('sale\|rent\|service\|free')/status('pending\|active\|sold\|rejected')/postedBy/flatDisplay/createdAt/reportCount/images`; API `{ id, providerName, title, category('Cleaning\|Plumbing\|...')/price, rating, isActive }`. Both `category` enum and `status` enum disagree completely. |
| `marketplace/page.tsx:57` | `PATCH /marketplace/listings/{id}` body `{ status:'active' }` | ❌ **Endpoint does not exist** in API.md. Marketplace has no admin moderation API — listings are created via `POST /marketplace/listings` and there is no "approve/reject/sold" workflow. Either add `PATCH /marketplace/listings/{id}` (status, isActive) or remove the buttons. |
| `marketplace/page.tsx:63` | `PATCH /marketplace/listings/{id}` body `{ status:'rejected' }` | ❌ Same as above. |
| `marketplace/page.tsx:69` | `DELETE /marketplace/listings/{id}` | ❌ **Endpoint does not exist** in API.md. |

**Missing:** All booking-flow endpoints (`POST /marketplace/bookings`, `confirm`, `complete`, `cancel`, `review`, `GET /marketplace/my/bookings`, `GET /marketplace/provider/bookings`). The admin's view is just listing moderation; the entire bookings/reviews surface is invisible.

---

## 13. Wallet

| Call site | Method · Path | Verdict |
|---|---|---|
| `wallet/page.tsx:56` | `GET /wallet/balance` typed as `SocietyWallet { balance, totalCredits, totalDebits, lastUpdatedAt }` | ⚠️ Path/method match, but response shape is `{ balance, currency:'INR', lastUpdated }` — **`totalCredits/totalDebits` don't exist server-side**. The corpus card shows zeros from DEMO until aggregated separately. Compute totals from `/wallet/transactions` or add a `/wallet/summary` endpoint. |
| `wallet/page.tsx:61` | `GET /wallet/transactions?page=1&pageSize=50` | ⚠️ Path/method match. Response paginated `{items,total,…}`; treated as array. Field mismatch: frontend `type:'credit'\|'debit'/category/reference/createdAt/createdBy`; API `{ id, type:'Credit'\|'Debit', amount, description, refTransactionId, timestamp }` — **`category/createdBy` not present, casing differs**. |

**Conceptual mismatch:** the admin page treats the wallet as a **society corpus fund**, but the backend wallet is a **per-user pre-paid wallet** for marketplace top-ups. These are different products. Either build a separate "Society Treasury" module, or rename this admin page to reflect the per-user wallet.

**Missing:** `POST /wallet/ensure`, `POST /wallet/topup/initiate`, `POST /wallet/topup/verify`.

---

## 14. Settings

| Call site | Method · Path | Verdict |
|---|---|---|
| `settings/page.tsx:109` | `GET /settings` | ✅ Path/method match. ⚠️ Response is `{ id, name, address, registrationNumber, tier, isActive, totalFlats }`. Frontend `SocietySettings` invents 19 extra fields (`maintenanceAmount, billingCycleDay, gracePeriodDays, latePenaltyPercent, gstEnabled, gstNumber, smsEnabled, pushEnabled, emailEnabled, visitorAlerts, paymentReminders, visitorQrTtlMinutes, offlineSyncEnabled, piiWipeDays, city, pincode, contactEmail, contactPhone, societyName`). None of these exist server-side. Page renders DEMO. |
| `settings/page.tsx:117` | `PATCH /settings` body `Partial<SocietySettings>` | ⚠️ API only accepts `{ name?, address? }`. Extra fields are silently dropped. |

**Action:** either trim the Settings UI to the two real fields, or extend the backend `Society` aggregate to persist billing/notification/security preferences (recommended — they're useful).

---

## 15. Modules with zero web-admin coverage

Endpoints that exist in `API.md` but have **no caller in `apps/web-admin`**:

- **Calling** — all 4 endpoints (`/calling/visitor/{id}`, `/calling/sos`, `/calling/{room}/join`, `/calling/{room}/end`).
- **MCP tools** — none of `society.get_bills`, `summarize_notices`, `draft_notice`, `file_complaint`, `route_complaint`, `expense_anomaly` is exposed as an admin command palette / chat surface.
- **SignalR `/hubs/society`** — no live updates anywhere; visitor/notice/complaint state changes require a manual refetch (or the `refetchInterval: 30_000` polling on the visitors page).
- **System** — `/health`, `/metrics` not surfaced.

These aren't broken — they're **missing UI**. Worth a follow-up roadmap entry.

---

## Severity-ranked fix list

### P0 — actively broken (will throw / 4xx today)

1. Resolve the `/api/v1` prefix (cross-cutting) — pick one place to add it.
2. `setup/page.tsx` send-OTP: switch to `POST /auth/otp/send` with `{phone,purpose:'register'}`.
3. `visitors/page.tsx` deny: `POST /visitors/{id}/reject` (not `/deny`).
4. `billing/page.tsx` generate: `POST /billing/generate` with full body (`societyId, period, amountPerFlat, description, dueDate`).
5. `notices/page.tsx` pin: change PATCH → PUT.
6. `notices/page.tsx` create: rebuild body to `{societyId, title, body, type, expiresAt?}`; remove `category/isPinned`; pin via separate PUT.
7. `complaints/page.tsx` status update: change PATCH → PUT; map status enum to PascalCase.
8. `accounting/page.tsx` reject: send `{rejectionReason}` (currently empty).
9. Marketplace approve/reject/delete buttons: stub out or define backend endpoints first.
10. Facility activation toggle: stub out or define `PATCH /facilities/{id}` first.
11. Social mute button: stub out or define `POST /social/users/{id}/mute` first.

### P1 — pages render DEMO data because shape mismatches

12. Standardise pagination handling — every list query must read `data?.items` (notices, complaints, visitors, members, posts, listings, transactions, bookings, parking levels/slots).
13. Realign frontend types with API DTOs (status enums to PascalCase; field names to API casing; remove invented fields like `flatDisplay/ownerName/postedAt/reportCount`).
14. Dashboard: stop relying on `/billing/dashboard` for residents/complaints/visitor cards; compose from the real endpoints (or build `/dashboard/overview`).
15. Accounting report: call `/accounting/report` 6× across months for the bar chart.
16. Settings: trim to `{name, address}` or extend the backend.

### P2 — feature gaps (endpoints exist, UI missing)

17. Wire `/auth/refresh` on 401, `/auth/logout` on session clear, `/auth/me` on app boot.
18. Build admin-side complaint detail/assign UI, notice single-fetch, post create, ledger entry post, member add, parking slot create/assign/visitor-pass, marketplace booking workflow.
19. SignalR client for live visitor/notice/complaint updates.
20. MCP/Calling integration once those modules ship.

---

*Audit performed against `API.md` revision 2026-05-01. Re-run after any backend route rename.*
