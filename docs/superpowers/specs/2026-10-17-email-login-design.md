# Email-first login, optional SMS, and bug fixes — design

Date: 2026-10-17
Status: draft, awaiting user review

## 1. Goal

Replace phone/SMS OTP login with **email OTP login** across the backend (.NET), the web admin (Next.js) and the mobile app (Expo/React Native, Android + iOS). Everything must run on free tooling. SMS becomes **optional**: it is used only when an operator configures a provider, and login never depends on it. Known bugs found in review are fixed as part of the work.

### Success criteria
- A user can sign in on web and mobile with email + emailed 6-digit code, with no SMS provider configured.
- With no SMS credentials the API starts and every auth flow works.
- With SMS credentials present, SMS notifications (visitor/payment fallback) work as before.
- Phone number is optional on the user profile.
- No paid service is required anywhere in the default docker-compose stack.
- Listed bugs are fixed and covered by tests.

### Out of scope
- SMS OTP login (removed, not kept as an option).
- Magic links, social login, passkeys.
- New features unrelated to auth or the listed bugs.

## 2. Current state (from review)

- Identity is the phone number: `identity.users.phone` is `NOT NULL UNIQUE`; `OtpRequest.Phone` is the OTP key; `UserRepository.FindByPhoneAsync` is used by `VerifyOtpCommandHandler`.
- `SendOtpCommandHandler` resolves the `"sms"` channel with `First(...)`, so it throws if no SMS channel is registered. The only SMS channel is `Msg91SmsChannel`.
- Phone validation is India-only (`^(\+91)?[6-9]\d{9}$`); both clients hardcode `+91`.
- `User.Email` exists (optional, unused). `InitializeSocietyCommand` accepts SMTP settings but nothing sends mail.
- 2FA (TOTP), JWT issuance and refresh are independent of the OTP channel and are kept.

## 3. Design

### 3.1 Data model
- `identity.users.email`: `VARCHAR(250) NOT NULL`, stored trimmed and lowercased, unique index.
- `identity.users.phone`: nullable; unique index applies only `WHERE phone IS NOT NULL`.
- `identity.otp_requests`: key column changes from `phone` to `email`.
- EF migration backfills email for existing rows. Seed data (demo admin and demo users) gets emails. No placeholder emails are invented: if any row still lacks an email after seeding, the migration fails with a clear message, and an admin must set those emails before applying it.
- `User.Create` takes an `Email` value object (format validation, normalisation). `PhoneNumber` stays for the optional profile field; its India-only rule is relaxed to E.164.

### 3.2 Backend auth API
- `POST /auth/otp/send` body `{ email, purpose }` → `{ maskedEmail, expiresInSeconds }`.
- `POST /auth/otp/verify` body `{ email, otp, purpose, deviceId?, deviceName?, platform? }` → unchanged `AuthTokenResponse` (profile exposes `email`, `phone?`).
- 2FA, refresh, logout, `/auth/me` unchanged apart from profile shape.
- Rate limits: keep per-IP limits in `appsettings.json`; the per-address limiter (3 sends/hour) is keyed on the normalised email.
- Responses for unknown vs known email are identical on send (no account enumeration). New emails are created on first successful verify, as today.
- Phone management: `PUT /auth/me/phone` sets or clears the optional phone (E.164 validated, no verification step, since there is no free verification channel).

### 3.3 Email delivery (free)
- New `SmtpEmailChannel : INotificationChannel` with `ChannelName = "email"`, built on MailKit.
- Config section `Notification:Email` (host, port, security mode, username, password, from address and name). All values come from environment variables.
- docker-compose gains a **Mailpit** service for dev (web UI on a local port) so codes are readable without any account. Docs describe Gmail app password and Brevo free tier for production.
- `SendOtpCommandHandler` looks up its channel with `channels.FirstOrDefault(c => c.ChannelName == "email")`. If email is not configured, startup logs an error and `/auth/otp/send` returns a clear 503 `EMAIL_NOT_CONFIGURED`; in Development the code is also logged.

### 3.4 Optional SMS
- `AddCommunicationModule` registers `Msg91SmsChannel` only when `Msg91:AuthKey` is a non-empty value (not an unexpanded `${...}` placeholder).
- `FallbackNotificationDispatcher` already degrades push → SMS; it is updated to skip SMS when the channel is absent and to only SMS users who have a phone.
- No code path outside notifications references the SMS channel.

### 3.5 Web admin
- `login/page.tsx`: phone step becomes an email step (zod `email()`), OTP step shows the email; add resend with cooldown. Admin/accountant role guard stays.
- `AdminUser` gains `email`; `phone` becomes optional. Any phone-based display updates accordingly.
- `setup/page.tsx` fixes its wrong `/auth/send-otp` call and uses email.

### 3.6 Mobile
- `LoginScreen.tsx`: email input instead of phone; `authService.sendOtp/verifyOtp` use email; resend actually calls send again after the countdown; keyboard type `email-address`, autocapitalisation off.
- Profile screen gets an optional phone field.
- Types (`MeResponse`, `AuthTokenResponse`) gain `email`.

### 3.7 Bug fixes
1. `OtpService.VerifyAsync`: reject already-used OTPs, check expiry/used before consuming an attempt, and take the latest unused request.
2. `GenerateOtp`: use `RandomNumberGenerator.GetInt32(0, 1_000_000)` (removes `Math.Abs(int.MinValue)` crash and modulo bias).
3. Environment variable names: align `JWT_SECRET` / `JWT_SECRET_KEY` and `MSG91_*` between `.env.example`, compose files and `appsettings.json`, so the JWT secret is never silently empty.
4. Upgrade `OpenTelemetry.Exporter.OpenTelemetryProtocol` past GHSA-4625-4j76-fww9.
5. Mobile resend button behaviour (3.6).
6. Web-admin API mismatches from `AUDIT-WEB-ADMIN.md` (wrong paths/methods, paginated envelope handled as `{ items }`, base-URL convention, removal of silent `DEMO_*` fallback on real errors). Fixed module by module; items that need a missing backend endpoint are listed and either implemented or the UI control is removed.
7. New-user onboarding: after first login with the default name, prompt for name.

## 4. Testing
- Backend: unit tests for `Email` value object, `OtpService` (reuse, expiry, attempts, latest-request), `SendOtpCommandHandler` (email channel missing, rate limit), and `VerifyOtpCommandHandler` (new vs existing user, 2FA gate). Integration check that the API boots with no `Msg91` config.
- Web: type-check and lint; component tests for the login flow if a test runner exists, otherwise a manual run against Mailpit.
- Mobile: type-check after dependency install; manual run against Mailpit.
- End-to-end smoke: docker compose up, request code, read it in Mailpit, sign in on web and mobile.

## 5. Delivery order
1. Backend: data model + migration, Email value object, OTP fixes, email channel, optional SMS, tests.
2. Config/compose: env names, Mailpit, OpenTelemetry upgrade, docs.
3. Web admin login and setup.
4. Mobile login and profile.
5. Audit-driven API fixes, module by module.

Each stage builds and passes tests before the next starts.

## 6. Risks and open points
- Existing rows without an email block the migration by design; the seed data covers demo accounts.
- Gmail SMTP needs an app password; Brevo free tier is limited to roughly 300 emails/day. Neither is a code concern but the docs must say so.
- Removing phone as an identity means phone-only users cannot sign in until an admin sets their email.
