# Email-first login, optional SMS, and bug fixes — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace phone/SMS OTP login with email OTP login on the .NET backend, Next.js web admin and Expo mobile app, make SMS optional, and fix the bugs found in review.

**Architecture:** Email becomes the user identity (`identity.users.email` required + unique); phone becomes a nullable profile field. A new `SmtpEmailChannel : INotificationChannel` (MailKit) delivers codes; `Msg91SmsChannel` is registered only when configured. OTP, 2FA and JWT flows keep their structure; only the identifier changes from phone to email.

**Tech Stack:** .NET 8 / EF Core 8 / Npgsql / MediatR / FluentValidation / xUnit + FluentAssertions + NSubstitute, MailKit, Next.js 14 + zod + react-hook-form, Expo 51 / React Native 0.74 / jest, Docker Compose + Mailpit.

**Spec:** `docs/superpowers/specs/2026-10-17-email-login-design.md`

## Global Constraints

- Everything runs on free tooling; no paid service is required by default docker-compose.
- Email stored trimmed and lowercased; unique; max 250 chars.
- Phone nullable; unique only `WHERE phone IS NOT NULL`; validated as E.164, no verification step.
- Send responses are identical for known and unknown emails (no account enumeration).
- Per-address OTP rate limit stays 3 sends/hour, keyed on the normalised email; per-IP limits in `appsettings.json` unchanged.
- OTP: 6 digits, BCrypt-hashed, 10-minute TTL, 3 attempts, single use.
- SMS OTP login is removed, not kept as an option.
- No SMS code path outside notifications; API must boot and all auth flows must work with no SMS config.
- Never commit `Instructions.md`. Stage files by explicit path only (untracked `.claude/`, `.mcp.json`, `AGENTS.md`, `CLAUDE.md` are not part of this work).
- Backend commands run from `D:\ClaudeWorkspace\Digital_Societies\services` unless a path is given; tests are in `tests/DigitalSocieties.Identity.Tests`.

## Review Focus

- Email in mixed case, with surrounding spaces, or with `+tag` resolves to one account (case/space only normalised; `+tag` is kept as distinct) — Task 1, 4.
- Submitting the same correct OTP twice: the second attempt fails and does not consume attempts — Task 3.
- SMTP down or unconfigured: send returns 503 with a stable code, never 500, and never echoes the OTP — Task 4, 5.
- A user with no phone appears in member lists, profile and 2FA label without null crashes — Task 4, 6.
- Email longer than 250 chars or with invalid shape is rejected at validation, not by the database — Task 1, 4.
- `GET /auth/me` must not serialise entity secrets (`TwoFactorSecret`, `Pending2FaSecret`) — Task 4.
- Resend on mobile while rate-limited shows the server message and keeps the countdown — Task 9.

---

### Task 1: Email value object and E.164 phone

**Files:**
- Create: `services/DigitalSocieties.Shared/Domain/ValueObjects/Email.cs`
- Modify: `services/DigitalSocieties.Shared/Domain/ValueObjects/PhoneNumber.cs`
- Test: `tests/DigitalSocieties.Identity.Tests/Domain/EmailTests.cs`, `tests/DigitalSocieties.Identity.Tests/Domain/PhoneNumberTests.cs`

**Interfaces:**
- Produces: `public sealed record Email { string Value; static Result<Email> Create(string? raw); override string ToString(); }` in `DigitalSocieties.Shared.Domain.ValueObjects`. Error codes `EMAIL.REQUIRED`, `EMAIL.INVALID`.
- Produces: `PhoneNumber.Create` accepts any `+` E.164 number (`^\+[1-9]\d{7,14}$`); input without `+` still defaults to `+91` and must match the Indian pattern.

- [ ] **Step 1: Write failing tests** in `EmailTests.cs`: `Create_TrimsAndLowercases` (`"  Ann@Example.COM "` → `"ann@example.com"`); `Create_KeepsPlusTag` (`a+b@x.io` unchanged); `Create_Rejects` theory over `null`, `""`, `"   "`, `"no-at"`, `"a@b"`, `"a b@c.io"`, and a 251-char address → failure with code `EMAIL.REQUIRED` or `EMAIL.INVALID`. In `PhoneNumberTests.cs` add `Create_AcceptsInternationalE164` (`+14155552671`) and `Create_RejectsTooShortInternational` (`+1234`).
- [ ] **Step 2: Run** `dotnet test ../tests/DigitalSocieties.Identity.Tests --filter "EmailTests|PhoneNumberTests"`. Expected: FAIL (type missing / assertions).
- [ ] **Step 3: Implement** `Email` mirroring the shape of `PhoneNumber` (private ctor, `Result<Email>`); shape check `^[^@\s]+@[^@\s]+\.[^@\s]+$`, length ≤ 250 after trim. Relax `PhoneNumber` as above, keeping the existing Indian-pattern behaviour for bare numbers.
- [ ] **Step 4: Run** the same command. Expected: PASS.
- [ ] **Step 5: Commit** `git add` the five paths above; message `feat(shared): Email value object, E.164 phone`.

---

### Task 2: Identity domain, persistence and migration

**Files:**
- Modify: `services/DigitalSocieties.Identity/Domain/Entities/User.cs`, `OtpRequest.cs`, `Domain/Events/IdentityEvents.cs`, `Infrastructure/Persistence/Configurations/UserConfiguration.cs`, `OtpRequestConfiguration.cs`, `Infrastructure/Persistence/IUserRepository.cs`, `UserRepository.cs`
- Create: new EF migration `*_EmailLogin` under `Infrastructure/Persistence/Migrations/`
- Modify: `infra/postgres/schema.sql` (identity.users, identity.otp_requests)
- Test: `tests/DigitalSocieties.Identity.Tests/Domain/UserTests.cs`, `OtpRequestTests.cs`

**Interfaces:**
- Consumes: `Email`, `PhoneNumber` (Task 1).
- Produces:
  - `User.Create(Email email, string name, PhoneNumber? phone = null) : User`; `string Email { get; }`, `string? Phone { get; }`; `void SetPhone(PhoneNumber phone)`; `void ClearPhone()`; `void Rename(string name)`.
  - `OtpRequest.Create(string email, string hashedOtp, string purpose)`; `string Email { get; }` (replaces `Phone`); `public const int MaxAttempts = 3`.
  - `IUserRepository.FindByEmailAsync(string email, CancellationToken ct = default) : Task<User?>` (replaces `FindByPhoneAsync`; includes `Devices`).
  - `UserCreatedEvent(Guid UserId, string Email)`.

- [ ] **Step 1: Write failing tests**: `UserTests.Create_SetsEmailAndNullPhone`, `SetPhone_ThenClearPhone_NullsPhone`, `Rename_RejectsBlank`; update `OtpRequestTests` to the `email` parameter and add `Verify_OnUsedOtp_ReturnsFalseWithoutIncrementingAttempts`.
- [ ] **Step 2: Run** `dotnet test ../tests/DigitalSocieties.Identity.Tests --filter "UserTests|OtpRequestTests"`. Expected: FAIL (compile errors).
- [ ] **Step 3: Implement** the entity/event/repository changes above. `UserConfiguration`: `Email` required, max 250, unique index; `Phone` max 20 nullable, unique index with `.HasFilter("phone IS NOT NULL")`. `OtpRequestConfiguration`: `Email` max 250, index `(Email, Purpose)`. Compile errors elsewhere in the solution are fixed in Tasks 4 and 6, so build only the Identity project and test project here.
- [ ] **Step 4: Generate the migration** with `dotnet ef migrations add EmailLogin --project DigitalSocieties.Identity --startup-project DigitalSocieties.Api`, then hand-edit `Up` in this order: (a) `migrationBuilder.Sql` DO block that `RAISE EXCEPTION 'Users without email exist; set emails before migrating'` if any `identity.users.email IS NULL OR trim(email) = ''`; (b) `UPDATE` lowercasing/trimming email; (c) make `email` NOT NULL + unique index; (d) make `phone` nullable and replace its unique index with the filtered one; (e) `DELETE FROM identity.otp_requests`, rename `phone`→`email`, widen to 250. Write a matching `Down`. Mirror the end state in `infra/postgres/schema.sql`.
- [ ] **Step 5: Run** the filter from Step 2 and `dotnet build DigitalSocieties.Identity`. Expected: PASS / 0 errors.
- [ ] **Step 6: Commit** the touched paths; message `feat(identity): email identity, nullable phone, migration`.

---

### Task 3: OtpService fixes (email-keyed)

**Files:**
- Modify: `services/DigitalSocieties.Identity/Infrastructure/Services/IOtpService.cs`, `OtpService.cs`
- Test: `tests/DigitalSocieties.Identity.Tests/Services/OtpServiceTests.cs` (uses `Microsoft.EntityFrameworkCore.InMemory` with `IdentityDbContext`)

**Interfaces:**
- Consumes: `OtpRequest.Create(email, hash, purpose)`, `OtpRequest.MaxAttempts` (Task 2).
- Produces: `IOtpService.CreateAsync(string email, string purpose, CancellationToken ct) : Task<OtpCreateResult>`; `IOtpService.VerifyAsync(string email, string otp, string purpose, CancellationToken ct) : Task<Result>`; `public static string OtpService.GenerateOtp()`.
- Error codes: `OTP.NOT_FOUND`, `OTP.EXPIRED`, `OTP.MAXED_OUT`, `OTP.INVALID`.

- [ ] **Step 1: Write failing tests**: `GenerateOtp_Is6Digits` (1000 iterations match `^\d{6}$`); `Verify_CorrectOtp_Succeeds`; `Verify_SameOtpTwice_SecondFailsNotFound` and attempts of the used row stay unchanged; `Verify_Expired_ReturnsExpired` (set `ExpiresAt` via a second context write); `Verify_WrongOtp_ReportsRemainingAttempts` (`"2 attempt(s) remaining"` after first miss); `Verify_AfterThreeMisses_ReturnsMaxedOut`; `Create_ReplacesPreviousPendingOtp`; `Verify_UsesLatestUnusedRequest`.
- [ ] **Step 2: Run** `dotnet test ../tests/DigitalSocieties.Identity.Tests --filter OtpServiceTests`. Expected: FAIL.
- [ ] **Step 3: Implement.** `GenerateOtp` uses `RandomNumberGenerator.GetInt32(0, 1_000_000).ToString("D6")`. `VerifyAsync` selects only `!IsUsed` requests for `(email, purpose)` ordered by `CreatedAt` desc; none → `OTP.NOT_FOUND`; then check expiry, then max attempts, then verify; persist after every outcome; remaining attempts = `OtpRequest.MaxAttempts - Attempts`.
- [ ] **Step 4: Run** the filter. Expected: PASS.
- [ ] **Step 5: Commit**; message `fix(identity): OTP reuse, attempt order, unbiased generation`.

---

### Task 4: Send/verify commands, profile, endpoints

**Files:**
- Modify: `Identity/Application/Commands/SendOtpCommand.cs`, `VerifyOtpCommand.cs`, `TwoFactorCommands.cs` (label uses email; `Profile` shape), `Identity/Infrastructure/Security/JwtService.cs` (claim `email` replaces `phone`; grep consumers of the `"phone"` claim and update), `services/DigitalSocieties.Api/Endpoints/Identity/IdentityEndpoints.cs`
- Create: `Identity/Application/Commands/ProfileCommands.cs` (`SetPhoneCommand`, `SetNameCommand`)
- Test: `tests/DigitalSocieties.Identity.Tests/Application/SendOtpCommandTests.cs`, `VerifyOtpCommandTests.cs`, `ProfileCommandTests.cs`

**Interfaces:**
- Consumes: `IOtpService` (Task 3), `IUserRepository.FindByEmailAsync`, `User.*` (Task 2), `Email` (Task 1), `INotificationChannel` (`ChannelName == "email"`, `IsEnabled`).
- Produces:
  - `SendOtpCommand(string Email, string Purpose)` → `Result<SendOtpResponse>`; `SendOtpResponse(string MaskedEmail, int ExpiresInSeconds)` (mask like `a***@example.com`).
  - `VerifyOtpCommand(string Email, string Otp, string Purpose, string? DeviceId, string? DeviceName, string? Platform)`.
  - `UserProfile(Guid UserId, string Name, string Email, string? Phone, IReadOnlyList<MembershipInfo> Memberships)`.
  - `SetPhoneCommand(string? Phone)` (null/blank clears; invalid → `PHONE.INVALID`), `SetNameCommand(string Name)`; both resolve the user via `ICurrentUser`.
  - Routes: `PUT /auth/me/phone`, `PUT /auth/me/name` (authorized). `GET /auth/me` returns `UserProfile`, not the entity.
  - Endpoint status mapping: `EMAIL.NOT_CONFIGURED` and `EMAIL.SEND_FAILED` → 503; `OTP.RATE_LIMITED` → 429; other send failures 400; verify failures 401.

- [ ] **Step 1: Write failing tests** (NSubstitute for `IOtpService`, `IRateLimiter`, channel, repository): `Send_NoEmailChannel_FailsEmailNotConfigured`; `Send_ChannelReturnsFalse_FailsSendFailedAndBodyNotInError`; `Send_RateLimited_FailsRateLimited`; `Send_NormalisesEmailForRateKeyAndOtp` (`" A@X.io "` → `"a@x.io"`); `Send_UnknownAndKnownEmail_ResponsesEqual`; `Send_RejectsInvalidAndOver250CharEmail` (validator); `Verify_NewEmail_CreatesUserNamedNewUser_IsNewUserTrue`; `Verify_ExistingEmail_ReturnsTokens`; `Verify_TwoFactorEnabled_ReturnsPendingNoTokens`; `SetPhone_Valid_Persists`, `SetPhone_Null_Clears`, `SetPhone_Invalid_Fails`.
- [ ] **Step 2: Run** `dotnet test ../tests/DigitalSocieties.Identity.Tests --filter "Application"`. Expected: FAIL.
- [ ] **Step 3: Implement** the commands/validators/endpoints per the interfaces. `SendOtpCommandHandler` takes `IEnumerable<INotificationChannel>` and uses `FirstOrDefault(c => c.ChannelName == "email" && c.IsEnabled)` (no constructor-time `First`). Email body: `"Your Digital Societies code is {otp}. Valid for 10 minutes. Do not share it."`, subject `"Your sign-in code"`. `GET /auth/me` builds `UserProfile` from `FindWithMembershipsAsync`.
- [ ] **Step 4: Run** the filter, then `dotnet build DigitalSocieties.Api` (expect remaining errors only in files owned by Task 6; if so, finish Task 6 before this build gate).
- [ ] **Step 5: Commit**; message `feat(auth): email OTP commands, profile endpoints, safe /auth/me`.

---

### Task 5: Email channel and optional SMS

**Files:**
- Create: `services/DigitalSocieties.Communication/Infrastructure/Channels/SmtpEmailChannel.cs` (includes `EmailSettings`)
- Modify: `DigitalSocieties.Communication.csproj` (add `MailKit`), `Infrastructure/CommunicationServiceExtensions.cs`, `Infrastructure/Channels/Msg91SmsChannel.cs` (`Msg91Settings.IsConfigured`), `Infrastructure/FallbackNotificationDispatcher.cs`, `services/DigitalSocieties.Api/appsettings.json`
- Modify: `tests/DigitalSocieties.Identity.Tests/DigitalSocieties.Identity.Tests.csproj` (add Communication project reference)
- Test: `tests/DigitalSocieties.Identity.Tests/Communication/ChannelConfigTests.cs`

**Interfaces:**
- Produces: `EmailSettings` bound from `Notification:Email` (`Host`, `Port = 587`, `Security = "StartTls"` | `"SslOnConnect"` | `"None"`, `Username`, `Password`, `FromAddress`, `FromName = "Digital Societies"`); `bool EmailSettings.IsConfigured` (Host and FromAddress non-blank and not starting `${`).
- Produces: `SmtpEmailChannel : INotificationChannel` with `ChannelName == "email"`; `IsEnabled == settings.IsConfigured || env.IsDevelopment()`; when unconfigured in Development, `SendAsync` logs the body at Information and returns `true`; otherwise failures return `false` and are logged without the body.
- Produces: `bool Msg91Settings.IsConfigured` (ApiKey non-blank, not starting `${`). SMS channel registered in DI only when true.

- [ ] **Step 1: Write failing tests**: `EmailSettings_IsConfigured` theory (blank host, `${SMTP_HOST}` placeholder, host without from address → false; both set → true); `Msg91Settings_IsConfigured` theory (empty, `${MSG91_API_KEY}`, real key); `Dispatcher_SkipsSms_WhenNoSmsChannel` and `Dispatcher_SkipsSms_WhenUserHasNoPhone` using `FallbackNotificationDispatcher` with NSubstitute channels.
- [ ] **Step 2: Run** `dotnet test ../tests/DigitalSocieties.Identity.Tests --filter ChannelConfigTests`. Expected: FAIL.
- [ ] **Step 3: Implement.** MailKit `SmtpClient`: connect with the secure-socket option mapped from `Security`, authenticate only if `Username` non-blank, send plain-text `MimeMessage`, disconnect; catch exceptions → log (no body) → `false`. In `AddCommunicationModule` register `EmailSettings`/`SmtpEmailChannel` always, `Msg91SmsChannel` only if `config.GetSection(Msg91Settings.SectionName).Get<Msg91Settings>()?.IsConfigured == true`. Update the dispatcher to look up SMS optionally and skip null/blank recipients. In `appsettings.json` replace the unused top-level `Msg91` block and `Notification.Sms.Provider` with `Notification:Email` placeholders matching the settings keys; leave `Notification:Sms:ApiKey` for the compose env override.
- [ ] **Step 4: Run** the filter, then `dotnet build DigitalSocieties.Api`. Expected: PASS / 0 errors (after Task 6).
- [ ] **Step 5: Commit**; message `feat(comms): SMTP email channel, SMS only when configured`.

---

### Task 6: Remaining phone-based call sites

**Files:**
- Modify: `Identity/Application/Commands/AddFamilyMemberCommand.cs`, `InitializeSocietyCommand.cs` (admin OTP verified by email; `AdminInput` gains `Email`, `Phone` optional), `Identity/Application/Queries/GetFlatMembersQuery.cs` (add `Email`, `Phone` nullable in both DTOs), `services/DigitalSocieties.Api/Infrastructure/Seeding/DataSeeder.cs` (every seeded user gets an email, e.g. `resident1@demo.society`, admin `admin@demo.society`; phones kept as optional), other `.Phone` usages in `Marketplace/*`, `Visitor/*` found by `search_symbols`/`find_usages` (they may be their own projections; only change ones that read `identity.users.phone`)
- Test: `tests/DigitalSocieties.Identity.Tests/Application/AddFamilyMemberCommandTests.cs`

**Interfaces:**
- Consumes: `User.Create(Email, string, PhoneNumber?)`, `IUserRepository.FindByEmailAsync`.
- Produces: `AddFamilyMemberCommand(..., string Email, string? Phone, ...)` replaces the required `Phone` parameter; family member lookup/creation keys on email.

- [ ] **Step 1: Write failing test**: `AddFamilyMember_NewEmail_CreatesUser`, `AddFamilyMember_ExistingEmail_ReusesUser`, `GetFlatMembers_UserWithoutPhone_DoesNotThrow` (InMemory db).
- [ ] **Step 2: Run** `dotnet test ../tests/DigitalSocieties.Identity.Tests`. Expected: FAIL / compile errors.
- [ ] **Step 3: Implement** the call-site changes above.
- [ ] **Step 4: Run** `dotnet build DigitalSocieties.Api` and the full test project. Expected: 0 errors, all tests pass.
- [ ] **Step 5: Commit**; message `refactor(identity): move remaining call sites to email identity`.

---

### Task 7: Config, compose, Mailpit, vulnerable package, docs

**Files:**
- Modify: `infra/docker/.env.example`, `infra/docker/.env.prod.example`, `infra/docker/docker-compose.yml`, `docker-compose.dev.yml`, `docker-compose.prod.yml`, `services/**/*.csproj` that reference `OpenTelemetry.Exporter.OpenTelemetryProtocol`, `README.md`, `API.md` (auth section)

- [ ] **Step 1: Env names.** `.env.example` and `.env.prod.example` use the names compose reads: `JWT_SECRET_KEY` (not `JWT_SECRET`), `MSG91_API_KEY` (optional, commented "leave empty to disable SMS"), and new `SMTP_HOST`, `SMTP_PORT`, `SMTP_SECURITY`, `SMTP_USERNAME`, `SMTP_PASSWORD`, `SMTP_FROM_ADDRESS`, `SMTP_FROM_NAME`.
- [ ] **Step 2: Compose.** In the API service add `Notification__Email__Host: ${SMTP_HOST:-}` and the sibling keys; make `Notification__Sms__ApiKey: ${MSG91_API_KEY:-}`. In `docker-compose.dev.yml` add a `mailpit` service (`axllent/mailpit`, ports `1025` SMTP, `8025` UI) and point dev API at `mailpit:1025` with `Security=None`.
- [ ] **Step 3: Package.** Run `dotnet list ../services/DigitalSocieties.Api package --vulnerable --include-transitive`; raise the OpenTelemetry exporter to the patched version it names, then `dotnet build` and confirm the NU1902 warning is gone.
- [ ] **Step 4: Docs.** README "Email setup" section: Mailpit for dev, Gmail app password and Brevo free tier (~300/day) for production, SMS optional via `MSG91_API_KEY`; `API.md` auth section updated to `{ email }` bodies and the new `/auth/me/phone`, `/auth/me/name` routes.
- [ ] **Step 5: Verify** `docker compose -f infra/docker/docker-compose.dev.yml config` parses; `dotnet build` shows no NU1902.
- [ ] **Step 6: Commit**; message `chore: email config, Mailpit, OTel upgrade, docs`.

---

### Task 8: Web admin login and setup

**Files:**
- Modify: `apps/web-admin/src/app/login/page.tsx`, `apps/web-admin/src/lib/auth.ts` (`AdminUser`: add `email: string`, `phone?: string`), `apps/web-admin/src/app/setup/page.tsx` (replace `/auth/send-otp` + phone with `POST /auth/otp/send { email, purpose: 'register' }`), any component that renders `user.phone` (find with `find_usages` on `AdminUser`)

**Interfaces:**
- Consumes: backend `POST /auth/otp/send { email, purpose }` → `{ maskedEmail, expiresInSeconds }`; `POST /auth/otp/verify { email, otp, purpose }`.

- [ ] **Step 1:** `login/page.tsx`: `emailSchema = z.object({ email: z.string().trim().toLowerCase().email().max(250) })`; step id `'phone'` becomes `'email'`; copy "Enter your registered email"; `Mail` icon replaces `Phone`; OTP step shows the email and gains a "Resend code" button disabled for 60 s after each send; role guard and TOTP step unchanged. Surface server error `detail` in the toast.
- [ ] **Step 2:** Update `AdminUser` and every reader of `phone` to handle `undefined`.
- [ ] **Step 3:** Fix `setup/page.tsx` as above; admin block collects `email` and optional `phone`.
- [ ] **Step 4: Verify** `cd apps/web-admin && npm ci && npx tsc --noEmit && npm run lint`. Expected: no errors.
- [ ] **Step 5: Manual check** with `docker compose -f infra/docker/docker-compose.dev.yml up -d`: request a code, read it at `http://localhost:8025`, sign in with the demo admin email.
- [ ] **Step 6: Commit**; message `feat(web): email login and setup`.

---

### Task 9: Mobile login and profile

**Files:**
- Modify: `apps/mobile/src/screens/auth/LoginScreen.tsx`, `apps/mobile/src/services/api/authService.ts` (`SendOtpParams { email; purpose? }`, `VerifyOtpParams { email; otp; ... }`, `sendOtp` response `{ maskedEmail; expiresInSeconds }`, `profile` and `MeResponse` gain `email`, `phone?`; add `setPhone(phone: string | null)`, `setName(name: string)`), `apps/mobile/src/screens/resident/ProfileScreen.tsx` (currently a stub: name + optional phone fields, saves via the new service methods)
- Create: `apps/mobile/src/utils/email.ts` (`normalizeEmail(raw: string): string`, `isValidEmail(raw: string): boolean`), test `apps/mobile/src/utils/email.test.ts`

- [ ] **Step 1: Write failing jest test** `email.test.ts`: `normalizeEmail("  A@X.io ")` → `"a@x.io"`; `isValidEmail` false for `"a@b"`, `""`, 251-char string, true for `"a+b@x.io"`.
- [ ] **Step 2: Run** `cd apps/mobile && npm install && npx jest src/utils/email.test.ts`. Expected: FAIL.
- [ ] **Step 3: Implement** `email.ts` with the same rules as the backend `Email` value object.
- [ ] **Step 4: LoginScreen.** Step `'phone'` → `'email'`; input `keyboardType="email-address"`, `autoCapitalize="none"`, `autoCorrect={false}`; use `normalizeEmail`/`isValidEmail`; the "Resend" link calls `handleSendOtp` again once `countdown === 0` (it must not just return to the first step); on `429` show the server `detail` and restart the countdown at 60. After login when `data.isNewUser` is true, show a name prompt that calls `authService.setName`.
- [ ] **Step 5: Verify** `npx jest` and `npx tsc --noEmit` pass.
- [ ] **Step 6: Manual check** against dev stack with Expo; code read from Mailpit.
- [ ] **Step 7: Commit**; message `feat(mobile): email login, resend, profile phone`.

---

### Task 10: Web-admin API contract fixes (from `AUDIT-WEB-ADMIN.md`)

**Files:**
- Modify: `apps/web-admin/src/lib/api.ts` plus the pages named in `AUDIT-WEB-ADMIN.md` sections 0–end; `apps/web-admin/src/app/park/v/[token]/page.tsx`
- Create: `apps/web-admin/src/lib/pagination.ts` (`export interface Page<T> { items: T[]; total: number; page: number; pageSize: number }`)
- Modify: `AUDIT-WEB-ADMIN.md` (mark each item fixed / deferred with reason)

Work the audit one section per sub-step, each ending with `npx tsc --noEmit` and a commit `fix(web): <module> API contract`. Executor reads the audit's per-section tables; decisions fixed here:

- [ ] **Step 1 (cross-cutting, §0):** `API_PREFIX` convention: `NEXT_PUBLIC_API_URL` is the full base including `/api/v1` (matches compose default `/api/v1`); `park/v/[token]` uses `api.get` without a hardcoded prefix. Remove the `X-Society-Id` header. Add 401 → `POST /auth/refresh` retry once, then `clearSession()`; `logout()` already calls `/auth/logout`. Types for list endpoints use `Page<T>` and pages read `data?.items ?? []`.
- [ ] **Step 2 (silent demo data):** `DEMO_*` fallback only when `process.env.NODE_ENV === 'development'` and the request failed with a network error; real HTTP errors surface as a toast. Dashboard stops pretending `/billing/dashboard` is overview data: show the billing summary it actually returns.
- [ ] **Step 3 (paths/methods/bodies, one commit per module):** Billing `POST /billing/generate` body `{ societyId, period, amountPerFlat, description, dueDate }`; Visitors reject via `POST /visitors/{id}/reject`, status filter PascalCase and omitted for "all"; Complaints `PUT /complaints/{id}/status` body `{ status, note? }`, PascalCase; Notices `PUT /notices/{id}/pin`, create body `{ societyId, title, body, type }` then pin separately; Accounting reject sends `{ rejectionReason }` via a required reason input; Social mute button removed (no endpoint); Facilities and Marketplace buttons that call non-existent `PATCH`/`DELETE` endpoints are removed and listed in the audit as deferred; Parking and Facilities read their `{ levels }`/`{ slots }`/`{ facilities }` wrappers; remaining sections (Members, Wallet, others) per the audit tables.
- [ ] **Step 4:** Update `AUDIT-WEB-ADMIN.md` summary counts; run `npm run lint && npx tsc --noEmit`.

---

### Task 11: End-to-end verification

- [ ] **Step 1:** `docker compose -f infra/docker/docker-compose.dev.yml up -d --build`; confirm API `/health` ok with no `MSG91_API_KEY` set.
- [ ] **Step 2:** Web: sign in as `admin@demo.society` using the code from Mailpit; reload and confirm `/auth/me` response contains no `twoFactorSecret`.
- [ ] **Step 3:** Mobile: sign in as a seeded resident, resend a code, set and clear a phone number.
- [ ] **Step 4:** Reuse a code a second time → rejected; request 4 codes in an hour → 429 shown in both clients.
- [ ] **Step 5:** Set `MSG91_API_KEY` to a dummy value and restart: API boots, SMS channel registered (log line), login unaffected.
- [ ] **Step 6:** `dotnet test ../tests/DigitalSocieties.Identity.Tests`, `npx tsc --noEmit` in both apps, all pass. Report results with the actual output.
