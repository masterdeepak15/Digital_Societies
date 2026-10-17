# UI redesign (web + mobile) and mobile server address — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Ship phase 1 of the redesign: a dynamic HTTPS server address on the mobile sign-in screen, role-based mobile themes with a 4-tab shell, and a new web admin shell, sign-in and overview — matching the approved mockups.

**Architecture:** One `serverConfig` module on mobile owns the server origin and derives API/SignalR URLs; all call sites use it. Mobile gets typed theme tokens (Ledger / Courtyard / Control Room) chosen by role plus shared `src/ui` primitives. Web gets Ledger Tailwind tokens, rebuilt `components/ui` (same export names), a new `AppShell`/`Sidebar`, and rebuilt `/login` and `/dashboard`.

**Tech Stack:** Expo 51 / React Native 0.74 / jest-expo, `expo-secure-store`, `expo-font` + `@expo-google-fonts/*`, `@expo/vector-icons` (Feather), `@react-navigation/stack`; Next.js 14, Tailwind, `@fontsource-variable/plus-jakarta-sans`, lucide-react, recharts.

**Spec:** `docs/superpowers/specs/2026-10-17-ui-redesign-design.md` (mockups: Design canvas "Digital Societies UI Directions").

## Global Constraints

- Server address is **HTTPS only**; `http://` and scheme-less input are rejected; Android cleartext stays disabled.
- No file under `apps/mobile/src` or `apps/mobile/app` may contain a literal server URL, `localhost:`, or read `EXPO_PUBLIC_API_URL` except `src/config/serverConfig.ts`.
- Free tooling only; no paid service or account is required to run or test.
- Touch targets ≥ 44 pt (mobile) / ≥ 40 px (web); visible focus ring on every interactive element; text contrast ≥ 4.5:1 (≥ 3:1 for 24 px+ and UI borders).
- Existing exports of `apps/web-admin/src/components/ui/*` keep their names and props so un-migrated pages compile.
- Never push, never merge to `main`. Never commit `Instructions.md`. Stage by explicit path (untracked `.claude/`, `.mcp.json`, `AGENTS.md`, `CLAUDE.md`, `apps/web-admin/next-env.d.ts` are not part of this work).
- Mobile gate: `cd apps/mobile && CI=1 npx jest` green and zero `tsc` errors in files this plan touches (≈70 older errors elsewhere are out of scope). Web gate: `cd apps/web-admin && npx tsc --noEmit && npx next build`.
- Spec deviations decided while planning (carry into the ledger as rulings): warning text color is `#8A5200` (the spec's `#B26A00` fails 4.5:1); web chrome omits the mockup's search box and bell (no working feature behind them); web font ships via `@fontsource-variable/plus-jakarta-sans` (works offline in Docker builds) instead of `next/font/google`; mobile Home shows real data from the API, never the mockup's sample figures.

## Review Focus

- `https://Example.COM:8443/api/v1/` , `https://192.168.1.20:8443`, `https://[::1]:8443` normalise to a clean origin; `http://x`, `x.com` (no scheme), `https://`, `https://x:99999` are rejected with the right reason — Task 1.
- Saving an address does not require a successful connection test (user may be offline); saving a different origin clears tokens, active society and the auth store; saving the same origin does not — Task 5.
- With no server configured the sign-in sheet opens automatically and the email form cannot be submitted — Task 5.
- A server whose certificate the phone rejects shows the certificate message, not a generic one — Task 1, 5.
- Unknown or null role resolves to a theme without crashing (null → Ledger, unknown → Courtyard like `RoleRouter`) — Task 3.
- A font that fails to load falls back to the system font and the app still renders — Task 3.
- Web sidebar collapses behind a menu button below 1024 px and stays keyboard-operable — Task 9.

---

### Task 1: Server config module (pure logic + storage)

**Files:**
- Create: `apps/mobile/src/config/serverConfig.ts`, `apps/mobile/src/config/useHubUrl.ts`
- Test: `apps/mobile/src/config/serverConfig.test.ts`

**Interfaces:**
- Produces (`serverConfig.ts`):
  - `type NormalizeResult = { ok: true; origin: string } | { ok: false; reason: 'empty' | 'invalid' | 'not_https' | 'bad_port' }`
  - `normalizeServerUrl(raw: string): NormalizeResult`
  - `class ServerNotConfiguredError extends Error`
  - `getServerOrigin(): Promise<string | null>` (SecureStore key `ds_server_url`, in-memory cache, falls back to the origin of `process.env.EXPO_PUBLIC_API_URL` when set); `setServerOrigin(origin: string): Promise<void>`; `clearServerOrigin(): Promise<void>`
  - `getApiBase(): Promise<string>` → `${origin}/api/v1`; `getHubUrl(): Promise<string>` → `${origin}/hubs/society`; both throw `ServerNotConfiguredError`
  - `type ConnectionResult = { ok: true } | { ok: false; kind: 'timeout' | 'network' | 'certificate' | 'http'; status?: number }`
  - `classifyFetchError(e: unknown): 'timeout' | 'network' | 'certificate'`
  - `testConnection(origin: string, fetchImpl?: typeof fetch): Promise<ConnectionResult>` — `GET ${origin}/health`, 8 s abort timeout.
- Produces (`useHubUrl.ts`): `useHubUrl(): string | null` — resolves `getHubUrl()` in an effect, `null` until ready or when unconfigured.

- [ ] **Step 1: Write failing tests** (`jest.mock('expo-secure-store')` with an in-memory map): normalize accepts `https://a.com`, `https://a.com:8443`, `https://192.168.1.20:8443`, `https://[::1]:8443`, ` HTTPS://Example.COM/ `, `https://a.com/api/v1/`, `https://a.com/some/path?q=1#x` → origins `https://a.com`, `https://a.com:8443`, `https://192.168.1.20:8443`, `https://[::1]:8443`, `https://example.com`, `https://a.com`, `https://a.com`; rejects `''` / `'   '` → `empty`, `http://a.com` → `not_https`, `a.com` and `a.com:8443` → `not_https`, `https://` and `https://a b` → `invalid`, `https://a.com:0` and `https://a.com:99999` → `bad_port`. Storage: `getApiBase` rejects with `ServerNotConfiguredError` when nothing stored; after `setServerOrigin('https://a.com:8443')` it resolves `https://a.com:8443/api/v1` and `getHubUrl` resolves `https://a.com:8443/hubs/society`; the env fallback is used when nothing is stored. `classifyFetchError`: `AbortError` → `timeout`; message containing `certificate`/`SSL`/`TLS`/`trust anchor` → `certificate`; anything else → `network`. `testConnection` with a stub `fetchImpl`: 200 → `{ok:true}`; 503 → `{ok:false,kind:'http',status:503}`; throw → classified kind; hits `https://a.com/health`.
- [ ] **Step 2: Run** `cd apps/mobile && CI=1 npx jest src/config/serverConfig.test.ts`. Expected: FAIL (module missing).
- [ ] **Step 3: Implement** the signatures above with the WHATWG `URL` parser (add `react-native-url-polyfill` only if jest/Hermes lacks IPv6 support; record in ledger). `useHubUrl` is a 10-line hook.
- [ ] **Step 4: Run** the same command. Expected: PASS.
- [ ] **Step 5: Commit** the three files; message `feat(mobile): server config module`.

---

### Task 2: Route every network call through serverConfig

**Files:**
- Modify: `apps/mobile/src/services/api/apiClient.ts`, `src/screens/admin/ParkingManagementScreen.tsx`, `src/screens/resident/{MarketplaceScreen,ParkingScreen,SosScreen,VideoCallScreen}.tsx` (each: remove `const API_BASE`, use `${await getApiBase()}${path}` inside the existing async fetch helper), `src/screens/resident/{FeedScreen,NoticesScreen,VisitorsScreen}.tsx` (SignalR: `const hubUrl = useHubUrl()`; effect returns early when `!accessToken || !activeSocietyId || !hubUrl`; `.withUrl(`${hubUrl}?access_token=${accessToken}`, …)`; add `hubUrl` to the dependency array), `src/types/globals.d.ts` stays.
- Test: `apps/mobile/src/config/noHardcodedServer.test.ts`

**Interfaces:**
- Consumes: `getApiBase`, `useHubUrl` (Task 1).
- Produces: `apiClient` sets `config.baseURL = await getApiBase()` in its request interceptor, uses `getApiBase()` for the refresh call, and exports the same names as before (`apiClient`, `TokenKeys`).

- [ ] **Step 1: Write failing test** `noHardcodedServer.test.ts`: walks `src/` and `app/` for `.ts/.tsx` files excluding `*.test.*` and `src/config/serverConfig.ts`; fails listing any file containing `localhost:`, `athomes.space`, `EXPO_PUBLIC_API_URL`, or the regex `/\bAPI_BASE\s*=/`.
- [ ] **Step 2: Run** `CI=1 npx jest src/config/noHardcodedServer.test.ts`. Expected: FAIL listing the 9 files above.
- [ ] **Step 3: Implement** the edits listed; keep behavior otherwise identical.
- [ ] **Step 4: Run** `CI=1 npx jest` and `npx tsc --noEmit 2>&1 | grep -E "apiClient|ParkingManagement|Marketplace|ParkingScreen|SosScreen|VideoCall|FeedScreen|NoticesScreen|VisitorsScreen"`. Expected: all tests pass, no tsc lines.
- [ ] **Step 5: Commit** the modified files and the test; message `refactor(mobile): single source of truth for server URL`.

---

### Task 3: Theme tokens, role theme selection, fonts

**Files:**
- Create: `apps/mobile/src/theme/themes.ts`, `apps/mobile/src/theme/ThemeProvider.tsx`
- Modify: `apps/mobile/app/_layout.tsx` (wrap in `ThemeProvider`, load fonts, keep splash until ready or failed), `apps/mobile/src/theme/colors.ts` (keep exports; no change required beyond a comment), `apps/mobile/package.json` (via `npx expo install expo-font @expo-google-fonts/plus-jakarta-sans @expo-google-fonts/figtree @expo-google-fonts/manrope @expo/vector-icons`)
- Test: `apps/mobile/src/theme/themes.test.ts`

**Interfaces:**
- Produces (`themes.ts`):
  - `interface Theme { name: 'ledger' | 'courtyard' | 'control'; dark: boolean; colors: { ground; surface; surfaceAlt; primary; onPrimary; accent; onAccent; line; text; muted; success; warning; danger }; fonts: { regular; medium; semibold; bold; extrabold }; radius: { control: number; card: number; pill: number } }`
  - `ledger`, `courtyard`, `controlRoom: Theme` with the spec's values; `warning` = `#8A5200` in Ledger and Courtyard; Courtyard tints exported as `courtyardTints = { mint, sky, peach, lilac }` each `{ bg; fg }`.
  - `themeForRole(role: string | null): Theme` — guard → `controlRoom`; admin / accountant / staff / `null` → `ledger`; resident, tenant, family and any other string → `courtyard`.
  - `contrastRatio(fg: string, bg: string): number` (WCAG 2.x).
- Produces (`ThemeProvider.tsx`): `ThemeProvider({ children })` (reads `activeRole` from `useAuthStore`), `useTheme(): Theme`.

- [ ] **Step 1: Write failing tests**: `themeForRole` table (`'guard'`→control, `'admin'|'accountant'|'staff'|null`→ledger, `'resident'|'tenant'|'family'|'zzz'`→courtyard); for each theme `contrastRatio` ≥ 4.5 for text/ground, text/surface, muted/ground, muted/surface, onPrimary/primary, onAccent/accent, danger/surface, warning/surface, success/surface; ≥ 3 for primary/ground and line/ground is not asserted; `contrastRatio('#000000','#ffffff')` ≈ 21 (±0.01); each `courtyardTints` pair ≥ 4.5.
- [ ] **Step 2: Run** `CI=1 npx jest src/theme/themes.test.ts`. Expected: FAIL.
- [ ] **Step 3: Implement** `themes.ts` and `ThemeProvider.tsx`. If a token pair fails the contrast test, darken the *foreground* token minimally until it passes and ledger the change. Root layout: `useFonts({...})` for the three families' 400/500/600/700/800 weights; render children when `loaded || error` (error → theme `fonts` entries fall back to `'System'` via a `fontsReady` flag in context); hide the splash after.
- [ ] **Step 4: Run** `CI=1 npx jest` and `npx tsc --noEmit` filtered to `theme|_layout`. Expected: pass / no lines.
- [ ] **Step 5: Commit** the files; message `feat(mobile): role themes, contrast-checked tokens, fonts`.

---

### Task 4: Shared UI primitives

**Files:**
- Create: `apps/mobile/src/ui/{Button,Card,StatusPill,TextField,ScreenHeader,BottomSheet,Icon}.tsx`, `apps/mobile/src/ui/statusTone.ts`, `apps/mobile/src/ui/index.ts`
- Test: `apps/mobile/src/ui/statusTone.test.ts`

**Interfaces:**
- Consumes: `useTheme` (Task 3).
- Produces: `statusTone(status: string): 'good' | 'warn' | 'bad' | 'neutral'` (`paid|approved|resolved|entered|inside|connected` → good; `pending|waiting|due|inprogress|open` → warn; `overdue|rejected|denied|failed|sos` → bad; else neutral; case-insensitive, ignores spaces/underscores); `Button({ title, onPress, variant?: 'primary'|'secondary'|'danger', loading?, disabled?, icon? })` (min height 52, accessibilityRole button); `Card({ children, tint? })`; `StatusPill({ label, tone? })` (tone defaults to `statusTone(label)`); `TextField({ label, error?, ...TextInputProps })` (label linked via `accessibilityLabel`, 56 pt high); `ScreenHeader({ title, subtitle?, right? })`; `BottomSheet({ visible, onClose, title, children })` (scrim + sheet, `accessibilityViewIsModal`); `Icon({ name: keyof typeof Feather.glyphMap, size?, color? })` (default color `theme.colors.text`).

- [ ] **Step 1: Write failing test** for `statusTone` over the mapping above including `'In Progress'` → warn, `'OVERDUE'` → bad, `'Left'` → neutral, `''` → neutral.
- [ ] **Step 2: Run** `CI=1 npx jest src/ui/statusTone.test.ts`. Expected: FAIL.
- [ ] **Step 3: Implement** `statusTone` first, then the components (presentational; styles from the theme; no hardcoded colors). `index.ts` re-exports all.
- [ ] **Step 4: Run** `CI=1 npx jest` and `npx tsc --noEmit 2>&1 | grep "src/ui"`. Expected: pass / no lines.
- [ ] **Step 5: Commit**; message `feat(mobile): themed UI primitives`.

---

### Task 5: Server sheet + sign-in screen

**Files:**
- Create: `apps/mobile/src/ui/ServerSheet.tsx`, `apps/mobile/src/config/applyServerChange.ts`
- Modify: `apps/mobile/src/screens/auth/LoginScreen.tsx`
- Test: `apps/mobile/src/config/applyServerChange.test.ts`

**Interfaces:**
- Consumes: `normalizeServerUrl`, `getServerOrigin`, `setServerOrigin`, `testConnection` (Task 1); `BottomSheet`, `TextField`, `Button`, `Icon` (Task 4); `authService.clearTokens`, `useAuthStore.logout`.
- Produces: `applyServerChange(origin: string, deps?: { clearTokens: () => Promise<void>; logout: () => void }): Promise<{ changed: boolean }>` — if `origin` differs from the stored origin: `setServerOrigin`, `clearTokens()`, `logout()`, `{changed:true}`; if equal: no-op `{changed:false}`.
- `ServerSheet({ visible, onClose, onSaved })`: field prefilled with the stored origin; example chips (`https://society.example.com`, `https://192.168.1.20:8443`) fill the field; **Test connection** (states idle / testing / ok / error with the message for `kind`: timeout "The server did not answer in 8 seconds.", network "Could not reach the server. Check the address and your connection.", certificate "This phone does not trust the server's certificate.", http "The server answered with an error (status N)."); **Save** enabled when `normalizeServerUrl` is ok; validation messages: `not_https` "Start with https://", `invalid` "That does not look like a web address.", `bad_port` "Port must be between 1 and 65535.", `empty` "Enter your society's address."
- `LoginScreen`: top-right globe `Icon` button and bottom "Server" row (shows host of the stored origin, or "Not set") both open the sheet; when no origin is stored the sheet opens on mount and **Send code** is disabled; email field unchanged in behavior (Task from the email-login work stays).

- [ ] **Step 1: Write failing tests** for `applyServerChange` (inject fakes): different origin → set + clearTokens + logout called once, `changed:true`; same origin → none called, `changed:false`; first-ever save (no stored origin) → set called, tokens cleared, `changed:true`; the stored origin equals the saved one after the call.
- [ ] **Step 2: Run** `CI=1 npx jest src/config/applyServerChange.test.ts`. Expected: FAIL.
- [ ] **Step 3: Implement** `applyServerChange`, `ServerSheet` and the `LoginScreen` changes (restyle with the ledger theme from `useTheme()`, as in the mockup: navy header band with brand mark, "Sign in" heading, email field, primary button, server row).
- [ ] **Step 4: Run** `CI=1 npx jest` and `npx tsc --noEmit 2>&1 | grep -E "ServerSheet|applyServerChange|LoginScreen"`. Expected: pass / no lines.
- [ ] **Step 5: Commit**; message `feat(mobile): server address sheet on sign-in`.

---

### Task 6: Navigation shell (resident 4 tabs, guard 4 tabs)

**Files:**
- Modify: `apps/mobile/src/navigation/ResidentTabs.tsx` (becomes a stack: `Tabs` + detail screens), `GuardTabs.tsx`, `AdminTabs.tsx` and `StaffTabs.tsx` (themed colors/icons only), `apps/mobile/src/navigation/RoleRouter.tsx` (wrap in nothing new; keep switch)
- Create: `apps/mobile/src/navigation/tabBar.tsx` (themed tab bar renderer + icon map), `apps/mobile/src/navigation/routes.ts`
- Test: `apps/mobile/src/navigation/routes.test.ts`

**Interfaces:**
- Produces (`routes.ts`): `RESIDENT_TABS = ['Home','Bills','Community','Me'] as const`; `RESIDENT_DETAIL = ['Visitors','Complaints','Notices','Facilities','Parking','Marketplace','Wallet','VideoCall','Sos'] as const`; `GUARD_TABS = ['Gate','Log','Sos','Me'] as const`; `type ResidentStackParams`, `type GuardTabParams`.
- Resident stack: `Tabs` (Home → `HomeScreen`, Bills → `BillsScreen`, Community → `FeedScreen`, Me → `ProfileScreen`) and the nine detail screens reusing the existing components (`FacilityBookingScreen` for `Facilities`) with a themed header (title, back button). Guard tabs: Gate (`GateScreen`), Log (`LogScreen`), Sos (`SOSScreen`), Me (a guard `ProfileScreen`: reuse the resident `ProfileScreen`); `DeliveryScreen` moves out of the tab bar and is opened from `GateScreen` later (phase 2 — leave it registered as a hidden screen so nothing breaks).

- [ ] **Step 1: Write failing test** `routes.test.ts`: `RESIDENT_TABS` has exactly 4 entries, `GUARD_TABS` exactly 4, no name appears in both `RESIDENT_TABS` and `RESIDENT_DETAIL`, and `RESIDENT_DETAIL` contains every screen the old resident tab bar offered (`Visitors, Complaints, Notices, Parking, Marketplace, Wallet, VideoCall, Sos`) plus `Facilities`.
- [ ] **Step 2: Run** `CI=1 npx jest src/navigation/routes.test.ts`. Expected: FAIL.
- [ ] **Step 3: Implement** `routes.ts`, `tabBar.tsx` (labels visible, active color from theme, 44 pt targets) and the navigators using `@react-navigation/bottom-tabs` + `@react-navigation/stack`; admin/staff tab sets keep their tabs but use `tabBar.tsx` and Ledger colors.
- [ ] **Step 4: Run** `CI=1 npx jest` and `npx tsc --noEmit 2>&1 | grep "src/navigation"`. Expected: pass / no lines.
- [ ] **Step 5: Commit**; message `feat(mobile): role navigation shell`.

---

### Task 7: Resident Home, guard Gate and Profile screens

**Files:**
- Modify: `apps/mobile/src/screens/resident/HomeScreen.tsx`, `apps/mobile/src/screens/resident/ProfileScreen.tsx`, `apps/mobile/src/screens/guard/GateScreen.tsx`
- Test: `apps/mobile/src/screens/resident/homeModel.test.ts` (new pure helper `apps/mobile/src/screens/resident/homeModel.ts`)

**Interfaces:**
- Produces (`homeModel.ts`): `greetingFor(date: Date): 'Good morning' | 'Good afternoon' | 'Good evening'` (before 12 / before 17 / else); `summariseBills(items: { amountRupees?: number; status: string; dueDate?: string }[], now: Date): { due: { amount: number; dueDate: string; overdueDays: number } | null }` — picks the earliest-due unpaid bill; `overdueDays` = whole days past due (0 when not overdue).
- `HomeScreen` (Courtyard): greeting header with name and "{flat} · {society}" from `useAuthStore` memberships, bell `Icon`; maintenance card from `GET /billing/my` (shape per `API.md` §3 — read it first and map in `summariseBills`; skeleton while loading; "You are all paid up" when no unpaid bill; **no hardcoded amounts or names**); 2×2 tiles (Visitors, Complaints, Book, Notices) using `courtyardTints` that `navigation.navigate(...)` to the detail routes from Task 6 (not `router.push` paths, which do not exist); the "Needs your answer" card from `GET /visitors?status=Pending&page=1&pageSize=1` with **Let in** / **Not expecting** calling the existing approve / reject endpoints used by `VisitorsScreen`; SOS reachable from a tile row.
- `GateScreen` (Control Room): keep every behavior of the current form and offline queue; restyle with the primitives, show the connectivity chip and pending-sync count (existing data), and a "Waiting / Inside now" count row from `GET /visitors?status=Pending|Entered` only if the guard role is authorised for it per `API.md` §4 — if not, omit the counts and ledger the ruling.
- `ProfileScreen`: restyle the existing name + optional phone form with the primitives and Courtyard/Ledger theme; add a **Server** row showing the saved host (read-only; changing it is a sign-in-screen action) and **Sign out**.

- [ ] **Step 1: Write failing tests** for `homeModel`: `greetingFor` at 06:00 → morning, 12:00 → afternoon, 16:59 → afternoon, 17:00 → evening, 23:30 → evening; `summariseBills` with two unpaid bills picks the earlier `dueDate`, computes `overdueDays` 7 for a bill due 10 Oct at `now` 17 Oct, 0 for a future due date, returns `{ due: null }` when every bill is paid or the list is empty, and ignores bills without a due date unless none has one.
- [ ] **Step 2: Run** `CI=1 npx jest src/screens/resident/homeModel.test.ts`. Expected: FAIL.
- [ ] **Step 3: Implement** `homeModel.ts`, then the three screens as described.
- [ ] **Step 4: Run** `CI=1 npx jest` and `npx tsc --noEmit 2>&1 | grep -E "HomeScreen|ProfileScreen|GateScreen|homeModel"`. Expected: pass / no lines.
- [ ] **Step 5: Commit**; message `feat(mobile): resident home, guard gate, profile restyle`.

---

### Task 8: APK build configuration and docs

**Files:**
- Create: `apps/mobile/eas.json`
- Modify: `apps/mobile/app.json` (splash/adaptive-icon background `#12203B`; keep package ids), `README.md` (new "Build the APK" and "Pointing the app at your server" sections)

- [ ] **Step 1:** `eas.json` with profiles `development` (`developmentClient: true`, `distribution: internal`), `preview` (`distribution: internal`, `android.buildType: "apk"`), `production` (`android.buildType: "app-bundle"`).
- [ ] **Step 2:** README: EAS route (`npm i -g eas-cli`, `eas login`, `eas build -p android --profile preview`), local route (`npx expo prebuild -p android`, then in `android/`: `./gradlew assembleRelease`, output path `android/app/build/outputs/apk/release/`), and the server-address section (HTTPS only; IP:port needs a certificate the phone trusts; how to install a private CA on Android).
- [ ] **Step 3: Verify** `cd apps/mobile && node -e "JSON.parse(require('fs').readFileSync('eas.json','utf8')); JSON.parse(require('fs').readFileSync('app.json','utf8')); console.log('json ok')"`. Expected: `json ok`.
- [ ] **Step 4: Commit**; message `chore(mobile): EAS apk profile and build docs`.

---

### Task 9: Web foundation — tokens, font, components, shell

**Files:**
- Modify: `apps/web-admin/tailwind.config.ts`, `src/app/globals.css`, `src/app/layout.tsx`, `src/components/ui/{Card,Badge,Table,EmptyState,PageHeader}.tsx`, `src/components/layout/Sidebar.tsx`, `src/app/(dashboard)/layout.tsx`, `package.json` (`npm i @fontsource-variable/plus-jakarta-sans`)
- Create: `src/components/ui/{Button,Input,StatStrip,StatusPill}.tsx`, `src/components/layout/AppShell.tsx`

**Interfaces:**
- Tailwind: `brand` scale becomes a navy ramp (50 `#EEF2F8`, 100 `#DDE5F0`, 200 `#BCCBE0`, 300 `#93A9CB`, 400 `#5E7CA8`, 500 `#2B4170`, 600 `#1E3157`, 700 `#12203B`, 800 `#0D1830`, 900 `#08101F`); add `paper #F4F6F9`, `line #DCE2EA`, `mute #5B6B82`, `saffron { DEFAULT #E58F1A, dark #8A5200 }`; `fontFamily.sans = ['"Plus Jakarta Sans Variable"', 'system-ui', 'sans-serif']`; the Google `@import` is removed and the fontsource CSS imported in `layout.tsx`; body `bg-paper text-brand-700`, `font-variant-numeric: tabular-nums`; global `:focus-visible` ring in saffron.
- Components (all accept `className`): `Button({ variant?: 'primary'|'secondary'|'ghost'|'danger', loading?, ...ButtonHTMLAttributes })` (min height 40); `Input` (forwardRef, `invalid?` boolean); `StatusPill({ label, tone?: 'good'|'warn'|'bad'|'neutral' })` with the same tone mapping as mobile `statusTone` (colors: good `#E3F4EA/#1E7F4F`, warn `#FFF1D6/#8A5200`, bad `#FDECEA/#B3261E`, neutral `#E8ECF2/#41526B`); `Badge` renders `StatusPill` (same props as today); `StatStrip({ items: { label: string; value: string | number; hint?: string; tone?: 'neutral'|'good'|'warn'|'bad' }[] })` — one bordered panel, 1/2/4 columns responsive, hairline dividers; `Card` = white, 1px `line` border, `rounded-xl`, no shadow, `StatCard` unchanged API; `Table`/`Th`/`Td`/`Tr`/`Thead`/`Tbody` restyled (header `bg-[#F9FAFC]`, `Th` 12 px sentence-case `text-mute` — no uppercase/tracking); `EmptyState` unchanged API, copy-friendly layout; `PageHeader` unchanged API.
- `Sidebar`: 236 px navy (`bg-brand-700`), society block (name from `getUser()`/settings fallback "Digital Societies"), nav grouped **Overview / Money (Billing, Accounting, Wallet) / People (Members, Visitors) / Operations (Complaints, Notices, Facilities, Parking, Social Feed, Marketplace, Settings)**, active item has a saffron left bar, user block with name + role and **Sign out** (existing `logout()` flow preserved). `AppShell({ children })` (client): fixed sidebar ≥ 1024 px; below it a top bar with a menu button toggles the sidebar as an overlay (Escape and link click close it; focus returns to the button). `(dashboard)/layout.tsx` keeps its cookie redirect and renders `<AppShell>`.

- [ ] **Step 1: Implement** tokens/font/globals, then `StatusPill`/`Badge`, `Button`, `Input`, `StatStrip`, `Card`, `Table`, `EmptyState`.
- [ ] **Step 2: Implement** `Sidebar` and `AppShell`; update the dashboard layout.
- [ ] **Step 3: Verify** `cd apps/web-admin && npx tsc --noEmit && npx next build`. Expected: no errors; build succeeds (existing pages still compile).
- [ ] **Step 4: Visual check** (start API + Mailpit per the README dev stack, sign in as `admin@demo.society`): open `/dashboard` and `/members` at 1440 px and 390 px wide; sidebar collapses at 390 px; Tab reaches the menu button and every nav link with a visible ring. Record what was seen in the ledger.
- [ ] **Step 5: Commit** the files above (not `next-env.d.ts`); message `feat(web): Ledger tokens, components, app shell`.

---

### Task 10: Web sign-in and overview pages

**Files:**
- Modify: `apps/web-admin/src/app/login/page.tsx`, `apps/web-admin/src/app/(dashboard)/dashboard/page.tsx`

**Interfaces:**
- Consumes: `Button`, `Input`, `StatStrip`, `StatusPill`, `Card`, `Table*`, `PageHeader`, `EmptyState` (Task 9).
- `/login`: two-panel layout — left navy panel (brand mark, "Digital Societies", one line of value copy, hidden below 1024 px), right form panel; the email → code → TOTP flow, resend countdown, toasts and role guard from the email-login work are unchanged; copy in sentence case; every input has a `<label>`.
- `/dashboard`: `PageHeader` (title "Overview", today's date, primary action **Generate bills** linking to `/billing`), `StatStrip` of four items (Collected this month, Pending bills, Open complaints, Visitors today) from the existing `fetchDashboard()` data (no new endpoints), a collections chart (recharts, `ink` for collected, light grey for billed, saffron for the current month), "Bills needing follow-up" table and the two side lists (At the gate, Open complaints) built from the data the page already loads; empty states say what to do next; the `demo()` fallback stays as is.

- [ ] **Step 1: Implement** both pages.
- [ ] **Step 2: Verify** `npx tsc --noEmit && npx next build`. Expected: clean.
- [ ] **Step 3: Visual + behavior check** in Chrome against the running stack: sign in with a Mailpit code, wrong code shows the server message (no page reload), dashboard renders real values, 390 px width has no horizontal page scroll; compare with the Ledger mockups and note differences in the ledger.
- [ ] **Step 4: Commit**; message `feat(web): redesigned sign-in and overview`.

---

### Task 11: Final verification

- [ ] **Step 1:** `cd apps/mobile && CI=1 npx jest` (all green) and `npx tsc --noEmit 2>&1 | grep -E "src/(config|theme|ui|navigation)|LoginScreen|HomeScreen|GateScreen|ProfileScreen|apiClient"` → no lines.
- [ ] **Step 2:** `cd apps/web-admin && npx tsc --noEmit && npx next build` → clean.
- [ ] **Step 3:** `cd services && dotnet test ../tests/DigitalSocieties.Identity.Tests` → still 103 passing (no backend change expected).
- [ ] **Step 4:** Produce `docs/superpowers/ui-manual-checklist.md` for the user's device testing: sheet opens on first launch; invalid / http / wrong-port messages; Test connection against a good and a bad host; Save then sign in; change server while signed in → signed out; each role's theme and tabs; offline gate form still saves; APK build commands. Commit it; message `docs: UI manual test checklist`.
