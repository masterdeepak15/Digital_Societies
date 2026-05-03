# Digital Societies — REST API & MCP Reference

> Backend: `services/DigitalSocieties.Api` (.NET 8 Minimal APIs + MediatR + EF Core + SignalR)
> Base URL: `https://{host}/api/v1`
> SignalR Hub: `wss://{host}/hubs/society?access_token={jwt}`
> MCP Server: registered in `DigitalSocieties.Mcp` (HTTP/SSE transport, P6+)

---

## Table of Contents

1. [Conventions](#conventions)
2. [Auth & Identity](#1-auth--identity-apiv1auth)
3. [Setup / Bootstrap](#2-setup--bootstrap-apiv1setup)
4. [Billing](#3-billing-apiv1billing)
5. [Visitors](#4-visitors-apiv1visitors)
6. [Complaints](#5-complaints-apiv1complaints)
7. [Notices / Communication](#6-notices--communication-apiv1notices)
8. [Social (Feed, Polls, Directory)](#7-social-apiv1social)
9. [Accounting](#8-accounting-apiv1accounting)
10. [Facilities](#9-facilities-apiv1facilities)
11. [Members & Family](#10-members--family-apiv1members)
12. [Parking](#11-parking-apiv1parking)
13. [Calling (LiveKit A/V)](#12-calling-apiv1calling)
14. [Marketplace](#13-marketplace-apiv1marketplace)
15. [Wallet](#14-wallet-apiv1wallet)
16. [Settings](#15-settings-apiv1settings)
17. [SignalR Hub](#16-signalr-hub-hubssociety)
18. [MCP Tools](#17-mcp-tools-ai-agent-surface)
19. [System Endpoints](#18-system-endpoints)
20. [Common Models](#common-models)

---

## Conventions

### Authentication
- **Bearer JWT** in `Authorization: Bearer {accessToken}` header.
- Tokens are issued by `/api/v1/auth/otp/verify`, `/api/v1/auth/refresh`, `/api/v1/auth/2fa/verify`, and `/api/v1/setup/*`.
- For SignalR, the JWT is passed via `?access_token=` query string.

### Authorization Policies
| Policy | Allowed Roles |
|---|---|
| `AdminOnly` | `admin` |
| `ResidentOrAdmin` | `resident`, `admin` |
| `GuardOnly` | `guard` |
| `GuardOrAdmin` | `guard`, `admin` |

Endpoints marked `RequireAuthorization` accept any authenticated user. Endpoints marked `AllowAnonymous` are public.

### Multi-Tenancy
Every authenticated request resolves a `societyId` claim from the JWT. PostgreSQL Row-Level Security (RLS) enforces tenant isolation transparently — clients never pass `societyId` for read-side queries that target the current society.

### Response Envelope
Successful 2xx responses return JSON payloads as documented per endpoint.
Error responses use **RFC 7807 Problem Details**:

```json
{
  "type": "https://digital-societies/errors/NOT_FOUND",
  "title": "NotFound",
  "status": 404,
  "detail": "Bill 4f8b... not found",
  "code": "BILL_NOT_FOUND",
  "traceId": "00-abcdef..."
}
```

| Status | Meaning |
|---|---|
| 200 | OK |
| 201 | Created (Location header included) |
| 204 | No Content |
| 400 | Validation failure / bad request |
| 401 | Unauthenticated or token invalid |
| 403 | Authenticated but role/policy denied |
| 404 | Entity not found |
| 409 | Conflict (duplicate, slot taken, already paid) |
| 422 | Domain rule violation |
| 429 | Rate limited (default fixed window: 60/min) |
| 500 | Unhandled exception |

### Money Representation
- Internal storage: **paise** (long integer, smallest INR unit).
- Wire format: `decimal` rupees in DTOs unless the field is named `*Paise`.
- Conversion: `rupees = paise / 100m` (use `Money.CreateInr(rupees)` server-side).

### Common Types
- `Guid` → 36-char UUID string (`"4f8b0c4d-..."`).
- `DateOnly` → `"YYYY-MM-DD"`.
- `TimeOnly` → `"HH:mm"` or `"HH:mm:ss"`.
- `DateTimeOffset` → ISO-8601 with offset (`"2026-05-01T10:30:00+05:30"`).
- `Money` → `{ "currency": "INR", "amount": 1500.00 }` or plain decimal in legacy DTOs.

### Pagination
Endpoints returning lists accept `page` (1-based) and `pageSize` (or `limit`). Response shape:

```json
{
  "items": [ ... ],
  "total": 137,
  "page": 1,
  "pageSize": 20
}
```

---

## 1. Auth & Identity (`/api/v1/auth`)

### POST `/auth/otp/send`
Send OTP to phone via SMS (MSG91). Rate-limited 3/hour per phone.

**Auth:** `AllowAnonymous`
**Command:** `SendOtpCommand`

**Request:**
```json
{
  "phone": "+919876543210",
  "purpose": "login"
}
```
- `phone` (string, required) — Indian format `+91XXXXXXXXXX` or 10-digit starting 6-9.
- `purpose` (string, required) — `"login" | "register" | "step_up"`.

**Response 200:**
```json
{
  "maskedPhone": "+91XXXXXX3210",
  "expiresInSeconds": 600
}
```

**Errors:** 400 `INVALID_PHONE`, 429 rate-limit exceeded.

---

### POST `/auth/otp/verify`
Verify the 6-digit OTP and issue an access + refresh token. If 2FA is enabled, returns `requiresTwoFactor: true` and a `pendingUserId`.

**Auth:** `AllowAnonymous`
**Command:** `VerifyOtpCommand`

**Request:**
```json
{
  "phone": "+919876543210",
  "otp": "482913",
  "purpose": "login",
  "deviceId": "device-uuid",
  "deviceName": "Pixel 7",
  "platform": "android"
}
```

**Response 200:**
```json
{
  "accessToken": "eyJhbGciOiJIUzI1...",
  "refreshToken": "rt_8f7a...",
  "expiresIn": 3600,
  "isNewUser": false,
  "requiresTwoFactor": false,
  "pendingUserId": null,
  "profile": {
    "userId": "4f8b...",
    "name": "Deepak Sharma",
    "phone": "+919876543210",
    "memberships": [
      {
        "societyId": "1a2b...",
        "societyName": "Sunshine Heights",
        "role": "admin",
        "flatId": "9c8d...",
        "flatDisplay": "A-1204"
      }
    ]
  }
}
```

**Errors:** 401 `OTP_INVALID`, 401 `OTP_EXPIRED`.

---

### POST `/auth/refresh`
Exchange a valid refresh token for a new access token (and a rotated refresh token).

**Auth:** `AllowAnonymous`

**Request:** `{ "refreshToken": "rt_8f7a..." }`

**Response 200:**
```json
{
  "accessToken": "...",
  "refreshToken": "...",
  "expiresIn": 3600
}
```

**Errors:** 401 `TOKEN_INVALID`, 401 `TOKEN_REUSED` (token reuse detection).

---

### POST `/auth/logout`
Revoke the supplied refresh token from the Redis allow-list.

**Auth:** Bearer
**Request:** `{ "refreshToken": "rt_8f7a..." }`
**Response:** 204 No Content.

---

### GET `/auth/me`
Return the current user's profile and membership list.

**Auth:** Bearer

**Response 200:**
```json
{
  "id": "4f8b...",
  "phone": "+919876543210",
  "name": "Deepak Sharma",
  "verified": true,
  "twoFactorEnabled": false,
  "memberships": [
    { "societyId": "1a2b...", "role": "admin", "flatId": "9c8d...", "flatDisplay": "A-1204" }
  ]
}
```

---

### POST `/auth/2fa/enroll`
Generate a TOTP secret + QR for an authenticator app.

**Auth:** Bearer
**Request:** `{}`

**Response 200:**
```json
{
  "secret": "JBSWY3DPEHPK3PXP",
  "qrUri": "otpauth://totp/DigitalSocieties:Deepak?secret=JBSWY...&issuer=DigitalSocieties",
  "scratchCodes": ["12345678", "87654321", "..."]
}
```

---

### POST `/auth/2fa/confirm`
Confirm enrollment by submitting the first valid TOTP code.

**Auth:** Bearer
**Request:** `{ "totpCode": "123456" }`
**Response 200:** `{ "twoFactorEnabled": true }`

---

### POST `/auth/2fa/verify`
Second-factor verification after `/otp/verify` returned `requiresTwoFactor`.

**Auth:** `AllowAnonymous`
**Request:** `{ "pendingUserId": "...", "totpCode": "123456" }`
**Response 200:** Same `AuthTokenResponse` as `/otp/verify`.

---

### POST `/auth/2fa/disable`
Disable 2FA after re-confirming with a TOTP code.

**Auth:** Bearer
**Request:** `{ "totpCode": "123456" }`
**Response 200:** `{ "twoFactorEnabled": false }`

---

## 2. Setup / Bootstrap (`/api/v1/setup`)

### POST `/setup/initialize`
First-run wizard. Creates the society, the admin user, and (optionally) writes integration secrets to `appsettings.Production.json`. Issues an admin JWT immediately.

**Auth:** `AllowAnonymous` (only succeeds while DB is unseeded)

**Request:**
```json
{
  "society": {
    "name": "Sunshine Heights",
    "address": "Plot 21, MG Road, Pune",
    "registrationNumber": "MH/PUN/CHS/2024/0042",
    "totalFlats": 120
  },
  "admin": {
    "phone": "+919876543210",
    "name": "Deepak Sharma",
    "otp": "482913"
  },
  "smtp":     { "host": "...", "port": 587, "user": "...", "password": "...", "from": "..." },
  "razorpay": { "keyId": "rzp_live_...", "keySecret": "..." },
  "msg91":    { "apiKey": "..." },
  "minio":    { "endpoint": "http://minio:9000", "accessKey": "...", "secretKey": "...", "bucket": "society-assets" }
}
```

**Response 200:** `SetupResponse`
```json
{
  "accessToken": "eyJ...",
  "user": {
    "userId": "4f8b...",
    "name": "Deepak Sharma",
    "phone": "+919876543210",
    "roles": ["admin"],
    "societyId": "1a2b..."
  }
}
```

**Errors:** 409 `ALREADY_INITIALIZED`, 400 validation.

---

### POST `/setup/demo`
One-click seed for evaluators. Creates a sample society, ~20 flats, demo bills/visitors/notices, and returns an admin token.

**Auth:** `AllowAnonymous`
**Request:** `{}`
**Response 200:** Same shape as `/setup/initialize`.
**Errors:** 409 `DEMO_SEED_FAILED`, 500 `DEMO_TOKEN_FAILED`.

---

## 3. Billing (`/api/v1/billing`)

### GET `/billing/bills`
Admin listing of all bills in the current society.

**Auth:** `AdminOnly`

**Query:** `?status=Pending&search=A-1204&page=1&limit=20`
- `status`: `"all" | "Pending" | "Paid" | "Overdue"` (default `all`).
- `search`: free-text on description / period.

**Response 200:**
```json
{
  "total": 240,
  "page": 1,
  "limit": 20,
  "items": [
    {
      "id": "b1...",
      "flatId": "9c8d...",
      "period": "2026-05",
      "amountRupees": 2500.00,
      "dueDate": "2026-05-15",
      "status": "Pending"
    }
  ]
}
```

---

### GET `/billing/dashboard`
KPIs for the current month.

**Auth:** `AdminOnly`

**Response 200:**
```json
{
  "period": "2026-05",
  "total": 120,
  "paid": 87,
  "pending": 28,
  "overdue": 5,
  "totalAmountRupees": 300000.00,
  "collectedRupees": 217500.00,
  "pendingRupees": 82500.00
}
```

---

### POST `/billing/generate`
Generate monthly maintenance bills for every flat in the society. Idempotent on `(societyId, period, flatId)`.

**Auth:** `AdminOnly`
**Command:** `GenerateMonthlyBillsCommand`

**Request:**
```json
{
  "societyId": "1a2b...",
  "period": "2026-05",
  "amountPerFlat": 2500.00,
  "description": "May 2026 Maintenance",
  "dueDate": "2026-05-15"
}
```

**Response 200:**
```json
{
  "generated": { "billsCreated": 118, "billsSkipped": 2, "period": "2026-05" }
}
```

---

### GET `/billing/summary`
Period-level summary with defaulter list.

**Auth:** `AdminOnly`
**Query:** `?societyId={guid}&year=2026&month=5`

**Response 200:**
```json
{
  "period": "2026-05",
  "total": 120,
  "paid": 87,
  "pending": 28,
  "overdue": 5,
  "defaulters": [
    { "flatId": "9c8d...", "flatNumber": "B-302", "amount": 2500.00 }
  ]
}
```

---

### GET `/billing/my`
Resident's own bill history.

**Auth:** `ResidentOrAdmin`
**Query:** `?page=1&pageSize=20`

**Response 200:**
```json
{
  "items": [
    {
      "id": "b1...",
      "period": "2026-05",
      "amount": 2500.00,
      "lateFee": 0.00,
      "totalDue": 2500.00,
      "status": "Pending",
      "dueDate": "2026-05-15",
      "paidAt": null,
      "paymentId": null,
      "description": "May 2026 Maintenance"
    }
  ],
  "total": 12,
  "page": 1,
  "pageSize": 20
}
```

---

### POST `/billing/{billId}/pay`
Initiate Razorpay payment for an unpaid bill.

**Auth:** `ResidentOrAdmin`
**Path:** `billId: Guid`
**Command:** `InitiatePaymentCommand`

**Response 200:**
```json
{
  "orderId": "order_NaBd...",
  "paymentUrl": null,
  "amountPaise": 250000,
  "currency": "INR",
  "key": "rzp_live_..."
}
```

**Errors:** 404 `BILL_NOT_FOUND`, 409 `ALREADY_PAID`.

---

### POST `/billing/webhook/razorpay`
Razorpay → server callback. HMAC-verified via `X-Razorpay-Signature`. Always returns 200 (idempotent).

**Auth:** `AllowAnonymous` (signature-verified)
**Headers:** `X-Razorpay-Signature: <hmac>`

**Request body:** Razorpay's `payment.captured` webhook payload (verbatim).

**Response 200:** `{}` or `{ "warning": "..." }`.

---

## 4. Visitors (`/api/v1/visitors`)

### POST `/visitors`
Guard creates a visitor entry; pushes "approval needed" to the resident.

**Auth:** `GuardOrAdmin`
**Command:** `AddVisitorCommand`

**Request:**
```json
{
  "societyId": "1a2b...",
  "flatId": "9c8d...",
  "name": "Ramesh Kumar",
  "phone": "+919876543210",
  "purpose": "Delivery",
  "vehicleNumber": "MH12AB1234",
  "photoUrl": "https://minio/.../v1.jpg",
  "hostPhone": "+919800000001"
}
```
- `purpose`: `"Guest" | "Delivery" | "Service" | "Cab" | "Vendor" | "Other"`.

**Response 201:** `Location: /api/v1/visitors/{visitorId}`
```json
{ "visitorId": "v1..." }
```

---

### POST `/visitors/{visitorId}/approve`
Resident approves; server returns a 2-minute QR token the guard scans.

**Auth:** `ResidentOrAdmin`
**Response 200:** `{ "qrToken": "eyJ..." }`

---

### POST `/visitors/{visitorId}/reject`
**Auth:** `ResidentOrAdmin`
**Request:** `{ "reason": "Not expecting anyone" }` (optional)
**Response 200:** `{}`

---

### POST `/visitors/enter`
Guard scans QR and marks visitor as entered.

**Auth:** `GuardOrAdmin`
**Request:** `{ "qrToken": "eyJ..." }`
**Response 200:** `{ "visitorId": "v1..." }`
**Errors:** 401 `QR_INVALID`, 401 `QR_EXPIRED`.

---

### POST `/visitors/{visitorId}/exit`
Mark visitor as exited.

**Auth:** `GuardOrAdmin`
**Response 200:** `{}`

---

### GET `/visitors`
List visitors with filtering.

**Auth:** Bearer
**Query:** `?flatId={guid}&status=Approved&page=1&pageSize=20`
- `status`: `"Pending" | "Approved" | "Rejected" | "Entered" | "Exited"`.

**Response 200:**
```json
{
  "items": [
    {
      "id": "v1...",
      "name": "Ramesh Kumar",
      "phone": "+919876543210",
      "purpose": "Delivery",
      "status": "Entered",
      "entryTime": "2026-05-01T10:30:00+05:30",
      "exitTime": null,
      "vehicleNumber": "MH12AB1234"
    }
  ],
  "total": 14,
  "page": 1,
  "pageSize": 20
}
```

---

## 5. Complaints (`/api/v1/complaints`)

### POST `/complaints`
Raise a complaint. Returns a friendly ticket number.

**Auth:** `ResidentOrAdmin`
**Command:** `RaiseComplaintCommand`

**Request:**
```json
{
  "societyId": "1a2b...",
  "flatId": "9c8d...",
  "title": "Lift not working",
  "description": "Lift on B-wing has been stuck since morning.",
  "category": "Lift",
  "priority": "High",
  "imageUrls": ["https://minio/.../c1.jpg"]
}
```
- `category`: `"Plumbing" | "Electrical" | "Housekeeping" | "Security" | "Lift" | "Parking" | "Noise" | "Other"`.
- `priority`: `"Low" | "Medium" | "High" | "Urgent"`.
- `imageUrls`: max 5 entries.

**Response 201:** `Location: /api/v1/complaints/{complaintId}`
```json
{ "complaintId": "c1...", "ticketNumber": "C-2026-0042" }
```

---

### POST `/complaints/{complaintId}/upload-url`
Get a 15-minute presigned MinIO PUT URL for an evidence image.

**Auth:** `ResidentOrAdmin`
**Request:** `{ "fileName": "photo.jpg" }`
**Response 200:**
```json
{ "uploadUrl": "https://minio/...?X-Amz-...", "objectKey": "complaints/c1/photo.jpg" }
```

---

### POST `/complaints/{complaintId}/assign`
**Auth:** `AdminOnly`
**Request:** `{ "assigneeId": "u1...", "note": "Please attend ASAP" }`
**Response 200:** `{}`

---

### PUT `/complaints/{complaintId}/status`
**Auth:** Bearer (assignee/admin/raiser depending on transition)
**Request:** `{ "status": "Resolved", "note": "Fixed by 11am" }`
- `status`: `"InProgress" | "Resolved" | "Closed" | "Reopened"`.
**Response 200:** `{}`

---

### GET `/complaints/my`
Resident's own complaints.

**Auth:** `ResidentOrAdmin`
**Query:** `?status=InProgress&page=1&pageSize=20`

**Response 200:**
```json
{
  "items": [
    {
      "id": "c1...",
      "ticketNumber": "C-2026-0042",
      "title": "Lift not working",
      "description": "...",
      "category": "Lift",
      "priority": "High",
      "status": "InProgress",
      "createdAt": "2026-05-01T09:00:00+05:30"
    }
  ],
  "total": 3
}
```

---

### GET `/complaints`
Admin listing of all society complaints.

**Auth:** `AdminOnly`
**Query:** `?status=Open&category=Lift&page=1&pageSize=20`
**Response 200:** Same shape as `/complaints/my`.

---

### GET `/complaints/{complaintId}`
Full detail with timeline.

**Auth:** Bearer

**Response 200:**
```json
{
  "id": "c1...",
  "ticketNumber": "C-2026-0042",
  "title": "Lift not working",
  "description": "...",
  "category": "Lift",
  "priority": "High",
  "status": "Resolved",
  "createdAt": "2026-05-01T09:00:00+05:30",
  "updates": [
    { "timestamp": "2026-05-01T09:30:00+05:30", "status": "InProgress", "note": "Technician en route" },
    { "timestamp": "2026-05-01T11:00:00+05:30", "status": "Resolved",  "note": "Fixed" }
  ]
}
```

---

## 6. Notices / Communication (`/api/v1/notices`)

### POST `/notices`
**Auth:** `AdminOnly`
**Command:** `PostNoticeCommand`

**Request:**
```json
{
  "societyId": "1a2b...",
  "title": "Water supply maintenance",
  "body": "Water will be off from 10am-12pm on May 5.",
  "type": "Notice",
  "expiresAt": "2026-05-05T13:00:00+05:30"
}
```
- `type`: `"Notice" | "Emergency" | "Event" | "Circular"`.

**Response 201:** `{ "noticeId": "n1..." }`

---

### PUT `/notices/{noticeId}/pin`
**Auth:** `AdminOnly`
**Request:** `{ "isPinned": true }`
**Response 200:** `{}`

---

### DELETE `/notices/{noticeId}`
Soft-expire a notice.

**Auth:** `AdminOnly`
**Response:** 204 No Content.

---

### GET `/notices`
**Auth:** Bearer
**Query:** `?type=Notice&page=1&pageSize=20`

**Response 200:**
```json
{
  "items": [
    {
      "id": "n1...",
      "title": "Water supply maintenance",
      "body": "...",
      "type": "Notice",
      "isPinned": true,
      "createdAt": "2026-05-01T08:00:00+05:30",
      "expiresAt": "2026-05-05T13:00:00+05:30"
    }
  ],
  "total": 24,
  "page": 1,
  "pageSize": 20
}
```

---

### GET `/notices/{noticeId}`
**Auth:** Bearer
**Response 200:** Single `NoticeDto` with full body.

---

## 7. Social (`/api/v1/social`)

### GET `/social/posts`
Society feed (paginated, optionally filtered).

**Auth:** Bearer
**Query:** `?groupId={guid}&category=Discussion&page=1&pageSize=20`

**Response 200:**
```json
{
  "items": [
    {
      "id": "p1...",
      "authorUserId": "u1...",
      "authorName": "Deepak Sharma",
      "body": "Anyone interested in a Sunday cleanup drive?",
      "category": "Discussion",
      "createdAt": "2026-05-01T07:00:00+05:30",
      "isPinned": false,
      "isLocked": false,
      "imageCount": 0,
      "commentCount": 4,
      "reactionsCount": 12
    }
  ],
  "total": 87
}
```

---

### GET `/social/posts/{postId}`
Full post with images, comments tree, reactions, poll, and listing details (when applicable).

**Auth:** Bearer

**Response 200:**
```json
{
  "id": "p1...",
  "author": { "userId": "u1...", "name": "Deepak Sharma" },
  "body": "...",
  "category": "Poll",
  "images": [{ "url": "https://minio/.../1.jpg" }],
  "comments": [
    {
      "id": "cm1...",
      "authorName": "Anita",
      "body": "Count me in!",
      "replies": [{ "id": "cm2...", "authorName": "Deepak", "body": "Great!" }]
    }
  ],
  "reactions": [{ "type": "thumbsup", "count": 12 }],
  "poll": {
    "question": "Best cleanup time?",
    "options": [
      { "text": "Saturday 9am", "votes": 18 },
      { "text": "Sunday 9am",   "votes": 24 }
    ],
    "userVote": "Sunday 9am"
  },
  "marketplace": null
}
```

---

### POST `/social/posts`
**Auth:** Bearer
**Command:** `CreatePostCommand`

**Request:**
```json
{
  "societyId": "1a2b...",
  "authorUserId": "u1...",
  "authorFlatId": "9c8d...",
  "category": "Poll",
  "body": "Pick the best slot.",
  "groupId": null,
  "imageUrls": [],
  "pollQuestion": "Best cleanup time?",
  "pollOptions": ["Saturday 9am", "Sunday 9am"],
  "pollEndsAt": "2026-05-04T23:59:00+05:30",
  "pollAllowMultiple": false,
  "listingPricePaise": null,
  "listingCondition": null
}
```
- `category`: `"General" | "Discussion" | "Announcement" | "Emergency" | "Poll" | "ForSale" | "LookingFor"`. `"Emergency"` is admin-only.
- `pollOptions`: required and min 2 if `category="Poll"`.
- `listingPricePaise` & `listingCondition`: required if `category="ForSale"` (`"New" | "LikeNew" | "Good" | "Fair"`).

**Response 201:** `{ "postId": "p1...", "category": "Poll" }`

---

### POST `/social/posts/upload-url`
Presigned PUT for post images. Allowed extensions: `.jpg .jpeg .png .webp`. 15-min expiry.

**Auth:** Bearer
**Request:** `{ "fileName": "photo.jpg" }`
**Response 200:** `{ "uploadUrl": "...", "objectKey": "posts/.../photo.jpg" }`

---

### DELETE `/social/posts/{postId}`
Author or admin only.
**Auth:** Bearer
**Response:** 204.

---

### PUT `/social/posts/{postId}/pin`
**Auth:** `AdminOnly`
**Request:** `{ "isPinned": true }`
**Response 200:** `{}`

---

### PUT `/social/posts/{postId}/lock`
Lock comments thread.
**Auth:** `AdminOnly`
**Request:** `{ "isLocked": true }`
**Response 200:** `{}`

---

### POST `/social/posts/{postId}/react`
**Auth:** Bearer
**Request:** `{ "type": "thumbsup" }` — `"helpful" | "thanks" | "thumbsup"`.
**Response 200:** `{}`

### DELETE `/social/posts/{postId}/react`
Remove the user's reaction.
**Auth:** Bearer
**Response:** 204.

---

### POST `/social/posts/{postId}/comments`
**Auth:** Bearer
**Request:** `{ "body": "Count me in!", "parentCommentId": null }`
- One reply level deep only.
**Response 201:** `{ "commentId": "cm1..." }`

### DELETE `/social/posts/{postId}/comments/{commentId}`
Author or admin only.
**Auth:** Bearer
**Response:** 204.

---

### POST `/social/posts/{postId}/report`
**Auth:** Bearer
**Request:** `{ "reason": "Off-topic" }` (optional)
**Response 200:** `{}`

---

### POST `/social/polls/{pollId}/vote`
**Auth:** Bearer
**Request:** `{ "optionIds": ["opt-uuid-1"] }`
- Multi-select polls accept >1 element.
**Response 200:** `{}`

---

### GET `/social/directory`
Searchable resident directory (visibility honoured per user's preferences).

**Auth:** Bearer
**Query:** `?search=anita`

**Response 200:**
```json
{
  "entries": [
    {
      "userId": "u1...",
      "displayName": "Anita Sharma",
      "phone": "+919876543210",
      "email": "anita@example.com",
      "bio": "Yoga instructor",
      "flatNumber": "B-302"
    }
  ]
}
```

---

### PUT `/social/directory/me`
Update own directory entry.
**Auth:** Bearer
**Request:**
```json
{ "displayName": "Anita S.", "showPhone": true, "showEmail": false, "bio": "Yoga instructor" }
```
**Response 200:** `{}`

---

## 8. Accounting (`/api/v1/accounting`)

### GET `/accounting/entries`
Ledger listing.

**Auth:** `ResidentOrAdmin`
**Query:** `?type=Expense&category=Lift&month=5&year=2026&page=1&pageSize=50&pendingOnly=false`

**Response 200:**
```json
{
  "items": [
    {
      "id": "le1...",
      "entryDate": "2026-05-01",
      "type": "Expense",
      "category": "Lift Maintenance",
      "description": "Quarterly AMC",
      "amountPaise": 1200000,
      "status": "Approved"
    }
  ],
  "total": 17
}
```

---

### POST `/accounting/entries`
Post a ledger entry (defaults to `PendingApproval`).

**Auth:** `AdminOnly`
**Command:** `PostLedgerEntryCommand`

**Request:**
```json
{
  "entryDate": "2026-05-01",
  "type": "Expense",
  "category": "Lift Maintenance",
  "description": "Quarterly AMC",
  "amountPaise": 1200000,
  "referenceDoc": "INV-1042",
  "attachmentUrl": "https://minio/.../inv.pdf"
}
```
**Response 201:** `{ "id": "le1..." }`

---

### POST `/accounting/entries/{id}/approve`
**Auth:** `AdminOnly` — must be a different admin from the poster (4-eyes principle).
**Response 200:** `{}`

---

### POST `/accounting/entries/{id}/reject`
**Auth:** `AdminOnly`
**Request:** `{ "rejectionReason": "Missing invoice" }`
**Response 200:** `{}`

---

### GET `/accounting/report`
Monthly P&L.

**Auth:** `AdminOnly`
**Query:** `?month=5&year=2026`

**Response 200:**
```json
{
  "period": "2026-05",
  "totalIncome":  300000.00,
  "totalExpense": 175000.00,
  "netProfit":    125000.00,
  "expenseBreakdown": [
    { "category": "Lift Maintenance", "amount": 12000.00 },
    { "category": "Housekeeping",     "amount": 60000.00 }
  ],
  "pendingApprovals": 3
}
```

---

## 9. Facilities (`/api/v1/facilities`)

### GET `/facilities`
**Auth:** Bearer
**Query:** `?activeOnly=true`

**Response 200:**
```json
{
  "facilities": [
    { "id": "f1...", "name": "Clubhouse", "type": "Indoor", "capacity": 50, "availableSlots": 6, "rate": 500.00 }
  ]
}
```

---

### GET `/facilities/bookings`
Admin view of all bookings.

**Auth:** `AdminOnly`
**Query:** `?date=2026-05-05`

**Response 200:**
```json
{
  "items": [
    {
      "id": "fb1...",
      "facilityId": "f1...",
      "facilityName": "Clubhouse",
      "bookingDate": "2026-05-05",
      "startTime": "18:00",
      "endTime":   "22:00",
      "status": "Confirmed",
      "flatId": "9c8d...",
      "bookedBy": "Deepak Sharma"
    }
  ]
}
```

---

### GET `/facilities/{id}/slots`
Available time slots on a date.

**Auth:** Bearer
**Query:** `?date=2026-05-05`

**Response 200:**
```json
{
  "slots": [
    { "startTime": "08:00", "endTime": "10:00", "isAvailable": true },
    { "startTime": "10:00", "endTime": "12:00", "isAvailable": false }
  ]
}
```

---

### POST `/facilities/{id}/book`
**Auth:** `ResidentOrAdmin`
**Command:** `BookFacilityCommand`

**Request:**
```json
{
  "facilityId": "f1...",
  "bookingDate": "2026-05-05",
  "startTime": "18:00",
  "endTime":   "22:00",
  "purpose": "Birthday party"
}
```
**Response 201:** `{ "bookingId": "fb1...", "confirmationNumber": "FB-2026-0042" }`
**Errors:** 409 `SLOT_CONFLICT`.

---

### DELETE `/facilities/bookings/{bookingId}`
Hard-cancel by admin.
**Auth:** `AdminOnly`
**Response:** 204.

### POST `/facilities/bookings/{bookingId}/cancel`
Resident-initiated cancel with reason.
**Auth:** Bearer
**Request:** `{ "reason": "Plan changed" }`
**Response 200:** `{}`

---

### GET `/facilities/bookings/mine`
**Auth:** Bearer
**Query:** `?upcomingOnly=true`

**Response 200:**
```json
{
  "bookings": [
    { "id": "fb1...", "facilityName": "Clubhouse", "bookingDate": "2026-05-05", "startTime": "18:00", "endTime": "22:00", "status": "Confirmed" }
  ]
}
```

---

## 10. Members & Family (`/api/v1/members`)

### GET `/members`
**Auth:** `AdminOnly`
**Query:** `?role=resident&wing=A&page=1&pageSize=50`

**Response 200:**
```json
{
  "items": [
    { "userId": "u1...", "name": "Deepak Sharma", "phone": "+919876543210", "role": "admin", "flatId": "9c8d...", "flatNumber": "A-1204", "wing": "A" }
  ],
  "total": 120
}
```

---

### GET `/members/flat/{flatId}`
Flat occupants (residents + family).
**Auth:** Bearer (own flat or admin only)

**Response 200:**
```json
{
  "members": [
    { "userId": "u1...", "name": "Deepak Sharma", "phone": "+919876543210", "relation": "Self",   "isMainResident": true },
    { "userId": "u2...", "name": "Anita Sharma",  "phone": "+919800000001", "relation": "Spouse", "isMainResident": false }
  ]
}
```

---

### POST `/members/family`
Add a family member to the resident's flat.
**Auth:** `ResidentOrAdmin`
**Command:** `AddFamilyMemberCommand`

**Request:**
```json
{ "flatId": "9c8d...", "name": "Anita Sharma", "phone": "+919800000001", "relation": "Spouse" }
```
- `relation`: `"Spouse" | "Child" | "Parent" | "Sibling" | "Other"`.

**Response 201:** `{ "userId": "u2..." }`

---

### DELETE `/members/family/{userId}`
**Auth:** `ResidentOrAdmin`
**Response 200:** `{}`

---

### POST `/members/push-token`
Register an Expo push token.
**Auth:** Bearer
**Request:** `{ "token": "ExponentPushToken[xxxxxxxxxxxxxxxxxxxxxx]" }`
**Response 200:** `{}`

### DELETE `/members/push-token`
**Auth:** Bearer
**Query:** `?token=ExponentPushToken[...]`
**Response 200:** `{}`

---

## 11. Parking (`/api/v1/parking`)

### GET `/parking/levels`
**Auth:** `AdminOnly`

**Response 200:**
```json
{
  "levels": [
    { "id": "pl1...", "name": "Level 1", "totalSlots": 60, "occupiedSlots": 42 }
  ]
}
```

---

### POST `/parking/levels`
**Auth:** `AdminOnly`
**Command:** `CreateParkingLevelCommand`

**Request:** `{ "societyId": "1a2b...", "name": "Level 2", "totalSlots": 60 }`
**Response 201:** `{ "id": "pl2..." }`

---

### GET `/parking/levels/{levelId}/slots`
**Auth:** `AdminOnly`

**Response 200:**
```json
{
  "slots": [
    { "id": "ps1...", "number": "A-01", "status": "Assigned", "assignedFlatId": "9c8d...", "assignedVehicle": "MH12AB1234" }
  ]
}
```

---

### POST `/parking/slots`
**Auth:** `AdminOnly`
**Request:** `{ "levelId": "pl1...", "slotNumber": "A-02", "slotType": "Covered" }`
- `slotType`: `"Covered" | "Open"`.
**Response 201:** `{ "id": "ps2..." }`

---

### POST `/parking/slots/{slotId}/assign`
**Auth:** `AdminOnly`
**Request:**
```json
{ "flatId": "9c8d...", "vehicleNumber": "MH12AB1234", "vehicleType": "Car" }
```
- `vehicleType`: `"Car" | "Bike" | "Scooter"`.
**Response 200:** `{}`
**Errors:** 409 `SLOT_OCCUPIED`.

### POST `/parking/slots/{slotId}/unassign`
**Auth:** `AdminOnly`
**Response 200:** `{}`

---

### POST `/parking/slots/{slotId}/visitor-pass`
Issue a temporary parking pass for a visitor.
**Auth:** `GuardOrAdmin`
**Request:** `{ "visitorId": "v1...", "expiresAt": "2026-05-01T22:00:00+05:30" }`
**Response 200:** `{}`

---

### GET `/parking/nav/{token}`
Public, token-gated navigation hint for arriving visitors (used by the QR landing page).

**Auth:** `AllowAnonymous`
**Response 200:** `{ "level": "Level 1", "availableSlots": 4, "mapUrl": "https://..." }`

---

### GET `/parking/my`
**Auth:** Bearer

**Response 200:**
```json
{
  "slots": [
    { "levelName": "Level 1", "slotNumber": "A-01", "vehicleNumber": "MH12AB1234", "vehicleType": "Car" }
  ]
}
```

---

### GET `/parking/my/vehicles`
**Auth:** Bearer

**Response 200:**
```json
{
  "vehicles": [
    { "id": "vh1...", "number": "MH12AB1234", "type": "Car", "registeredAt": "2025-09-10T08:00:00+05:30" }
  ]
}
```

### POST `/parking/my/vehicles`
**Auth:** Bearer
**Request:** `{ "number": "MH12AB1234", "type": "Car" }`
**Response 201:** `{ "id": "vh1..." }`
**Errors:** 409 `VEHICLE_ALREADY_REGISTERED`.

---

## 12. Calling (`/api/v1/calling`)

LiveKit/Jitsi A/V rooms with short-lived participant tokens.

### POST `/calling/visitor/{visitorId}`
Start a video call with a visitor at the gate (resident ↔ guard intercom).

**Auth:** Bearer
**Response 200:**
```json
{
  "roomId": "rm1...",
  "token": "eyJ...",          // LiveKit JWT
  "serverUrl": "wss://livekit.example.com"
}
```

---

### POST `/calling/sos`
SOS broadcast — opens a room and pages every emergency-contact user.

**Auth:** Bearer
**Response 200:**
```json
{
  "roomId": "rm2...",
  "token": "eyJ...",
  "serverUrl": "wss://livekit.example.com",
  "broadcastedTo": ["Security Desk", "Committee Chair", "Vice Chair"]
}
```

---

### POST `/calling/{roomId}/join`
**Auth:** Bearer
**Response 200:** `{ "token": "...", "serverUrl": "...", "participants": 2 }`
**Errors:** 409 `ROOM_CLOSED`.

### POST `/calling/{roomId}/end`
Host-only.
**Auth:** Bearer
**Response 200:** `{}`
**Errors:** 403 `NOT_HOST`.

---

## 13. Marketplace (`/api/v1/marketplace`)

Local service-provider listings + bookings.

### GET `/marketplace/listings`
**Auth:** Bearer
**Query:** `?category=Plumbing&page=1&pageSize=20`

**Response 200:**
```json
{
  "items": [
    { "id": "ml1...", "providerName": "Quick Fix", "title": "Tap & pipe repairs", "category": "Plumbing", "price": 250.00, "rating": 4.6, "isActive": true }
  ],
  "total": 18
}
```

---

### GET `/marketplace/my/bookings`
**Auth:** Bearer
**Query:** `?status=Pending`

**Response 200:**
```json
{
  "items": [
    { "id": "mb1...", "listing": { "title": "Tap & pipe repairs" }, "status": "Pending", "bookedAt": "2026-05-01T10:00:00+05:30", "completedAt": null }
  ]
}
```

### GET `/marketplace/provider/bookings`
Same shape, viewed from the provider's side.
**Auth:** Bearer

---

### POST `/marketplace/listings`
**Auth:** Bearer
**Command:** `CreateListingCommand`

**Request:**
```json
{
  "title": "Tap & pipe repairs",
  "category": "Plumbing",
  "description": "Same-day fixes for leaks and clogs",
  "pricePerUnit": 250.00,
  "unit": "visit",
  "availability": ["Mon-Sat 9am-7pm"],
  "contactPhone": "+919800000001",
  "imageUrls": []
}
```
- `category`: `"Cleaning" | "Plumbing" | "Electrical" | "Painting" | "Gardening" | "Repairs" | "Other"`.
- `unit`: `"hour" | "visit" | "service"`.

**Response 201:** `{ "id": "ml1..." }`

---

### POST `/marketplace/bookings`
**Auth:** Bearer
**Request:**
```json
{
  "listingId": "ml1...",
  "scheduledDate": "2026-05-03",
  "scheduledTime": "10:00",
  "quantity": 1,
  "notes": "Kitchen sink leaking"
}
```
**Response 201:** `{ "id": "mb1...", "estimatedCost": 250.00 }`

---

### POST `/marketplace/bookings/{bookingId}/confirm`
Provider confirms.
**Auth:** Bearer
**Response 200:** `{}`

### POST `/marketplace/bookings/{bookingId}/complete`
Provider marks complete; specifies final amount.
**Auth:** Bearer
**Request:** `{ "finalAmountRupees": 300.00 }`
**Response 200:** `{}`

### POST `/marketplace/bookings/{bookingId}/cancel`
**Auth:** Bearer
**Request:** `{ "reason": "Provider unavailable" }`
**Response 200:** `{}`

### POST `/marketplace/bookings/{bookingId}/review`
**Auth:** Bearer
**Request:** `{ "rating": 5, "comment": "Quick and clean!" }`
- `rating`: 1–5.
**Response 200:** `{ "reviewId": "mr1..." }`

---

## 14. Wallet (`/api/v1/wallet`)

Pre-paid wallet topped up via Razorpay; used for marketplace bookings.

### POST `/wallet/ensure`
Idempotent; creates wallet if missing.
**Auth:** Bearer
**Response 200:** `{ "walletId": "w1..." }`

### GET `/wallet/balance`
**Auth:** Bearer
**Response 200:** `{ "balance": 1500.00, "currency": "INR", "lastUpdated": "2026-05-01T10:00:00+05:30" }`

### GET `/wallet/transactions`
**Auth:** Bearer
**Query:** `?page=1&pageSize=30`

**Response 200:**
```json
{
  "items": [
    { "id": "wt1...", "type": "Credit", "amount": 1000.00, "description": "Top-up via Razorpay", "refTransactionId": null, "timestamp": "2026-05-01T09:30:00+05:30" },
    { "id": "wt2...", "type": "Debit",  "amount":  250.00, "description": "Plumber booking",      "refTransactionId": "mb1...", "timestamp": "2026-05-01T10:30:00+05:30" }
  ],
  "total": 12
}
```

### POST `/wallet/topup/initiate`
**Auth:** Bearer
**Request:** `{ "amountRupees": 1000.00 }`
**Response 200:** `{ "orderId": "order_NaBd...", "amount": 1000.00, "currency": "INR", "key": "rzp_live_..." }`

### POST `/wallet/topup/verify`
HMAC-verified Razorpay callback from the client SDK.
**Auth:** Bearer
**Request:** `{ "orderId": "...", "paymentId": "...", "signature": "..." }`
**Response 200:** `{}`
**Errors:** 400 `SIGNATURE_INVALID`.

---

## 15. Settings (`/api/v1/settings`)

### GET `/settings`
Society profile.
**Auth:** `AdminOnly`

**Response 200:**
```json
{
  "id": "1a2b...",
  "name": "Sunshine Heights",
  "address": "Plot 21, MG Road, Pune",
  "registrationNumber": "MH/PUN/CHS/2024/0042",
  "tier": "Standard",
  "isActive": true,
  "totalFlats": 120
}
```

### PATCH `/settings`
**Auth:** `AdminOnly`
**Request:** `{ "name": "Sunshine Heights CHS", "address": "..." }` (all optional)
**Response 200:** `{ "updated": true }`

---

## 16. SignalR Hub (`/hubs/society`)

Real-time push channel. Connect via:

```
wss://{host}/hubs/society?access_token={accessToken}
```

The server places each connection into groups based on the JWT claims:
- `society:{societyId}` — broadcast notices, polls, emergencies.
- `flat:{flatId}` — visitor approvals, complaint updates.
- `user:{userId}` — direct DMs / alerts.

### Server → Client Events

| Event Name | Payload | Sent When |
|---|---|---|
| `VisitorApprovalRequested` | `{ visitorId, name, purpose, photoUrl }` | New visitor entry needs approval |
| `VisitorApproved` | `{ visitorId, qrToken }` | Resident approved |
| `VisitorRejected` | `{ visitorId, reason }` | Resident rejected |
| `VisitorEntered` | `{ visitorId, enteredAt }` | Guard scanned QR |
| `NoticePosted` | `{ noticeId, title, type, isPinned }` | Admin posted notice |
| `ComplaintStatusChanged` | `{ complaintId, status, note }` | Workflow transition |
| `EmergencyBroadcast` | `{ message, by, at }` | SOS triggered |
| `WalletCredited` | `{ amount, balance }` | Top-up succeeded |

### Client → Server Methods

| Method | Args | Description |
|---|---|---|
| `JoinFlatGroup` | `flatId: Guid` | Subscribe to flat-scoped events |
| `LeaveFlatGroup` | `flatId: Guid` | Unsubscribe |

> Final hub method names should be confirmed against `Communication.Infrastructure.Hubs.SocietyHub`.

---

## 17. MCP Tools (AI Agent Surface)

The `DigitalSocieties.Mcp` module registers a Model Context Protocol server. Each tool is an MCP function the connected agent (e.g. Claude) may call. All tools execute under the **caller's JWT identity** — they cannot escalate beyond what a normal HTTP request could do.

> Transport: HTTP/SSE (requires `ModelContextProtocol >= 0.2.0`, planned in P6). Tools are registered today via `services.AddMcpModule(config)`.

Each tool can be individually toggled via `McpSettings` flags in `appsettings.json`.

### `society.get_bills`
- **Source:** `BillingTools`
- **Toggle:** `McpSettings.EnableGetBills`
- **Auth:** Caller must have a flat context (resident).
- **Parameters:** `month: string?` (`YYYY-MM` filter, optional).
- **Returns:** Markdown-formatted summary of the caller's bills + outstanding balance.
- **Backed by:** `GetFlatBillsQuery`.

### `society.summarize_notices`
- **Source:** `NoticeTools`
- **Toggle:** `McpSettings.EnableSummarizeNotices`
- **Auth:** Society context required.
- **Parameters:** `count: int (1-20, default 10)`.
- **Returns:** Bulleted summary of pinned + most recent notices.
- **Backed by:** `GetSocietyNoticesQuery`.

### `society.draft_notice`
- **Source:** `NoticeTools`
- **Toggle:** `McpSettings.EnableDraftNotice`
- **Auth:** `AdminOnly`.
- **Parameters:**
  - `topic: string` — what the notice is about.
  - `tone: string` — `"Formal" | "Friendly" | "Urgent"` (default `"Formal"`).
- **Returns:** A draft notice the admin reviews before posting (no DB write).
- **Note:** Posting is a separate explicit step (HTTP `POST /notices`).

### `society.file_complaint`
- **Source:** `ComplaintTools`
- **Toggle:** `McpSettings.EnableFileComplaint`
- **Auth:** Resident context required.
- **Parameters:**
  - `title: string` (≤120 chars)
  - `description: string`
  - `category: string` — `"Maintenance" | "Plumbing" | "Electrical" | "Lift" | "Security" | "Housekeeping" | "Noise" | "Other"`.
- **Returns:** Confirmation message with the issued ticket number.
- **Backed by:** `RaiseComplaintCommand`.

### `society.route_complaint`
- **Source:** `ComplaintTools`
- **Toggle:** `McpSettings.EnableRouteComplaint`
- **Auth:** Bearer.
- **Parameters:** `description: string`.
- **Returns:** Suggested category + priority + responsible department (rule-based, no DB write).

### `society.expense_anomaly`
- **Source:** `AccountingTools`
- **Toggle:** `McpSettings.EnableExpenseAnomaly`
- **Auth:** `AdminOnly`.
- **Parameters:**
  - `months: int (1-12, default 3)` — recent months window.
  - `minAmount: decimal (default 1000)` — exclude entries below this rupee threshold.
- **Returns:** Markdown table of flagged expenses (z-score > 2.0 per category) + pending approvals + monthly totals.
- **Backed by:** `GetLedgerEntriesQuery`.

---

## 18. System Endpoints

| Endpoint | Method | Auth | Description |
|---|---|---|---|
| `/health` | GET | Public | Liveness/readiness — returns `200 OK` JSON when healthy |
| `/metrics` | GET | Public | Prometheus scrape target (OpenTelemetry → Prometheus exporter) |
| `/hubs/society` | WebSocket | Bearer (`?access_token=`) | SignalR hub |

---

## Common Models

### `Result<T>` (handler return type)
```csharp
class Result<T>
{
  bool   IsSuccess;
  T?     Value;
  Error? Error;     // { Code: string, Message: string }
}
```
Wire-mapped at the endpoint boundary: success → 2xx with `Value`; failure → RFC 7807 with `Error.Code` as the `code` field.

### `Money`
- Always INR; storage = paise (long); DTO = decimal rupees.
- Construction: `Money.CreateInr(decimal rupees) → Result<Money>`.

### `PhoneNumber`
- Indian format (`+91XXXXXXXXXX` or 10 digits starting 6-9).
- Construction: `PhoneNumber.Create(string?) → Result<PhoneNumber>`.

### `ICurrentUser`
Server-side claims principal — surfaced from JWT by `JwtCurrentUser` middleware:
```csharp
Guid?  UserId;
Guid?  SocietyId;
Guid?  FlatId;
string? Phone;
IReadOnlyList<string> Roles;
bool   IsAuthenticated;
bool   IsInRole(string role);
```

### `INotificationChannel`
Pluggable transport (Email, SMS, Push, SignalR):
```csharp
string ChannelName;
bool   IsEnabled;
Task<bool> SendAsync(NotificationMessage msg, CancellationToken ct);
// NotificationMessage(Recipient, Subject, Body, TemplateId?, Data?)
```

### `PagedResult<T>`
```json
{ "items": [], "total": 0, "page": 1, "pageSize": 20 }
```

### Rate Limiting
- Default policy `default`: fixed window, 60 req/min per IP.
- `/auth/otp/send`: 3 req/hour per phone.
- 429 response on rejection.

---

## Module → Endpoint Map (cross-reference)

| Module Project | Route Prefix | Endpoint Class |
|---|---|---|
| `DigitalSocieties.Identity` | `/api/v1/auth` | `IdentityEndpoints.cs` |
| (bootstrap) | `/api/v1/setup` | `SetupEndpoints.cs` |
| `DigitalSocieties.Billing` | `/api/v1/billing` | `BillingEndpoints.cs` |
| `DigitalSocieties.Visitor` | `/api/v1/visitors` | `VisitorEndpoints.cs` |
| `DigitalSocieties.Complaint` | `/api/v1/complaints` | `ComplaintEndpoints.cs` |
| `DigitalSocieties.Communication` | `/api/v1/notices` | `NoticeEndpoints.cs` |
| `DigitalSocieties.Social` | `/api/v1/social` | `SocialEndpoints.cs` |
| `DigitalSocieties.Accounting` | `/api/v1/accounting` | `AccountingEndpoints.cs` |
| `DigitalSocieties.Facility` | `/api/v1/facilities` | `FacilityEndpoints.cs` |
| (Identity helper) | `/api/v1/members` | `MemberEndpoints.cs` |
| `DigitalSocieties.Parking` | `/api/v1/parking` | `ParkingEndpoints.cs` |
| `DigitalSocieties.Calling` | `/api/v1/calling` | `CallingEndpoints.cs` |
| `DigitalSocieties.Marketplace` | `/api/v1/marketplace` | `MarketplaceEndpoints.cs` |
| `DigitalSocieties.Wallet` | `/api/v1/wallet` | `WalletEndpoints.cs` |
| (Identity helper) | `/api/v1/settings` | `SettingsEndpoints.cs` |
| `DigitalSocieties.Mcp` | (MCP transport) | tool classes per module |

---

*Document generated from source: `D:\Claude\Society-App\society-app-spec\services\` — last refresh 2026-05-01.*
