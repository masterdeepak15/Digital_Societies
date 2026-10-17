# UI redesign (web + mobile) and mobile server address — design

Date: 2026-10-17
Status: draft, awaiting user review
Mockups: Design canvas "Digital Societies UI Directions" (https://claude.ai/artifact/XRWcEw6ZAsmqZnGUDVwEaa, private)

## 1. Goal

Make the web admin and the mobile app look and feel professional instead of basic, and let the mobile app be pointed at any server (`https://domain.com` or `https://ip:port`) from its sign-in screen. Work is delivered in phases; this spec covers **phase 1** (foundation + key screens). Nothing is pushed or merged as part of this work.

### Decisions already made with the user
- Phasing: foundation and key screens first; remaining pages and screens in phase 2.
- Visual direction by role: **web admin = Ledger**, **resident mobile = Courtyard**, **guard mobile = Control Room**; admin/staff mobile use Ledger. One shared logo and one shared server sheet tie them together.
- Server address: **HTTPS only**. An `https://ip:port` address works only when the phone trusts that server's certificate; plain `http://` is rejected and cleartext traffic stays disabled in the APK.
- Free tooling only (EAS free tier or a local Gradle build for the APK; Google Fonts; `@expo/vector-icons`).

### Success criteria
- The mobile sign-in screen has a server button; saving a valid HTTPS address makes every API call and live-update (SignalR) connection use it, with no rebuild.
- No screen in the mobile app still contains a hardcoded server URL.
- Phase-1 screens match the approved mockups: web sign-in, web overview, mobile sign-in + server sheet, resident home, guard gate, app navigation shell.
- Resident navigation shows 4 tabs, guard 4 tabs; other screens stay reachable.
- Text and key UI colors meet WCAG AA contrast (4.5:1 body, 3:1 large text/UI), checked by an automated test over the theme tokens.

### Out of scope (phase 2)
Restyling the remaining web pages (billing, members, visitors, complaints, notices, accounting, facilities, parking, marketplace, social, wallet, settings, setup) and the remaining mobile screens beyond the shell; dark mode for web; iOS build; Play Store listing. Phase-2 pages keep working in phase 1; they pick up the new tokens/components gradually.

## 2. Current state (from review)

- **Web** (`apps/web-admin`): Tailwind with a blue `brand` scale and Inter loaded by CSS `@import`; a dark 56-wide sidebar (`components/layout/Sidebar.tsx`); six small shared components in `components/ui` (Badge, Card/StatCard, EmptyState, PageHeader, Table); pages style themselves inline.
- **Mobile** (`apps/mobile`): theme tokens in `src/theme` (navy/emerald/amber, one global set), StyleSheet styling, emoji used as icons, role tab navigators in `src/navigation` (resident has 12 tabs), root layout `app/_layout.tsx`, auth guard `app/(app)/_layout.tsx`.
- **Server URL** is not configurable: `src/services/api/apiClient.ts` reads `EXPO_PUBLIC_API_URL` with a built-in default, and **eight screens bypass it** with their own constants: `ParkingManagementScreen`, `MarketplaceScreen`, `ParkingScreen`, `SosScreen`, `VideoCallScreen` (`http://localhost:8080/api/v1`) and `FeedScreen`, `NoticesScreen`, `VisitorsScreen` (`EXPO_PUBLIC_API_URL ?? 'http://localhost:5000'` for the SignalR hub).

## 3. Design

### 3.1 Design tokens (from the mockups)

| Token | Ledger (web admin, mobile admin/staff) | Courtyard (resident) | Control Room (guard) |
|---|---|---|---|
| Ground | `#F4F6F9` | `#F2F7F4` | `#0E1624` |
| Surface | `#FFFFFF` | `#FFFFFF` | `#16213A` |
| Primary / ink | `#12203B` | `#0E5A4C` | `#35D0C5` |
| Accent | `#E58F1A` | `#F5B82E` | `#FFB020` |
| Line | `#DCE2EA` | `#DCE8E1` | `#2A3A5C` |
| Text | `#12203B` | `#0B2B26` | `#E6ECF7` |
| Muted text | `#5B6B82` | `#41635B` | `#93A3C0` |
| Success / warning / danger | `#1E7F4F` / `#B26A00` / `#B3261E` | same | `#4ADE80` / `#FFB020` / `#FF6B5E` |
| Font | Plus Jakarta Sans | Figtree | Manrope |
| Shape | 8-10px radii, hairline borders | 20-28px radii, tinted tiles | 12-16px radii, status accents |

Courtyard module tints: mint `#DCEFE5`, sky `#DCEBFA`, peach `#FDE6D3`, lilac `#E8E3FA` (text on each uses the darker tone from the mockup). Numerals use tabular figures everywhere.

### 3.2 Mobile: server address

New module `src/config/serverConfig.ts` (single source of truth):
- `normalizeServerUrl(raw: string): { ok: true; origin: string } | { ok: false; reason: 'empty' | 'invalid' | 'not_https' | 'bad_port' }` — pure. Trims, accepts `https://host`, `https://host:port`, IPv4 and IPv6 hosts; lowercases the host; keeps only the origin (drops path, query, fragment, trailing slashes, and a pasted `/api/v1` suffix); rejects `http://`, missing scheme is *not* guessed (error text: "Start with https://").
- `getServerOrigin(): Promise<string | null>`, `setServerOrigin(origin: string): Promise<void>` — stored in `expo-secure-store` under `ds_server_url`, cached in memory. First read falls back to `EXPO_PUBLIC_API_URL` (origin only) when set.
- `getApiBase()` → `${origin}/api/v1`; `getHubUrl()` → `${origin}/hubs/society`. Both throw `ServerNotConfiguredError` when no server is set.
- `testConnection(origin): Promise<{ ok: true; society?: string } | { ok: false; kind: 'timeout' | 'network' | 'certificate' | 'http'; status?: number }>` — `GET ${origin}/health`, 8 s timeout.

Consumers:
- `apiClient.ts`: a request interceptor sets `config.baseURL = await getApiBase()` per request; the refresh call uses `getApiBase()`. The module-level `BASE_URL` constant is removed.
- The eight screens above stop using their constants: REST calls go through `apiClient` (or `getApiBase()`), SignalR uses `getHubUrl()`.
- Component `ServerSheet` (`src/ui/ServerSheet.tsx`): bottom sheet with the address field, example chips, **Test connection** and **Save**. States: idle, testing, ok ("Connected."), error with a specific message per `kind` (e.g. certificate: "This phone does not trust the server's certificate."). Save is enabled only for a valid normalized address; saving a *different* origin clears tokens, active society and the auth store (the old session belongs to the old server).
- `LoginScreen` shows the globe button (top right) and a "Server" row (bottom) that both open the sheet; with no server configured the sheet opens automatically and the email form is disabled until one is saved.
- No change to Android cleartext settings (`usesCleartextTraffic` stays default-off).

### 3.3 Mobile: theming, icons, navigation

- `src/theme/themes.ts`: the three token sets above as typed objects; `src/theme/ThemeProvider.tsx` + `useTheme()` choose the theme from `activeRole` (resident/tenant/family → Courtyard; guard → Control Room; admin/accountant/staff → Ledger; signed-out screens → Ledger). `colors.ts` is kept as a thin compatibility export so untouched screens still compile and are migrated in phase 2.
- Fonts via `expo-font` + `@expo-google-fonts/plus-jakarta-sans`, `/figtree`, `/manrope`; the root layout waits for fonts (splash stays up) before rendering.
- `src/ui/` primitives: `Button`, `Card`, `StatusPill`, `TextField`, `ScreenHeader`, `BottomSheet`, `Icon` (Feather set from `@expo/vector-icons`, replacing emoji). All take colors from `useTheme()`; touch targets ≥ 44 pt; visible focus/pressed states.
- Navigation: `ResidentTabs` becomes 4 tabs (Home, Bills, Community, Me); Visitors, Complaints, Notices, Facilities, Parking, Marketplace, Wallet, SOS, Video call become stack screens opened from Home tiles (the existing screen components are reused as-is). `GuardTabs` becomes Gate, Log, SOS, Me. Admin/Staff tab sets are re-themed only.
- Phase-1 screens rebuilt: `LoginScreen` (+ server sheet), resident `HomeScreen`, guard `GateScreen`, resident `ProfileScreen` (restyled).

### 3.4 Web

- Tailwind: replace the `brand` blue scale with Ledger tokens (`ink`, `paper`, `line`, `saffron`, status colors); load Plus Jakarta Sans with `next/font/google` (removes the render-blocking CSS `@import`); focus ring uses the accent.
- Components in `src/components/ui` rebuilt or added: `Button`, `Input`, `StatStrip` (one panel with hairline dividers instead of separate cards), `StatusPill` (replaces/wraps `Badge`), `Card`, `Table` (sticky header, horizontal scroll box), `EmptyState` (explains what to do next), `PageHeader`. Existing exports keep their names/props so un-migrated pages compile.
- Layout: `Sidebar` rebuilt (navy, grouped Money / People / Operations, current-page marker, user block) and a new `Topbar` (page title, date, search, notifications, primary action). Below 900 px the sidebar collapses behind a menu button.
- Pages rebuilt: `/login` (email step, code step with resend countdown, 2FA step, in the new style) and `/dashboard` (stat strip, collections chart, bills needing follow-up table, at-the-gate and open-complaints lists, wired to the same endpoints as today; no behavior change).

### 3.5 APK build

- `apps/mobile/eas.json` with `development`, `preview` (`android.buildType: "apk"`) and `production` profiles; `app.json` gets the new splash/background color and keeps `android.package`.
- README section "Build the APK": (a) EAS: `eas build -p android --profile preview` (free tier, queued); (b) local: `npx expo prebuild -p android` then `./gradlew assembleRelease` with the Android SDK. The agent cannot produce an APK here; the commands are for the user's machine.

## 4. Testing

- Mobile (jest): `normalizeServerUrl` (accepts domain, domain+port, IPv4+port, IPv6, trailing slash, pasted `/api/v1`; rejects http, empty, bad port, bare host); `getApiBase`/`getHubUrl` string building; `testConnection` error classification with a mocked transport; theme-token contrast test (WCAG ratios for text/ground, text/surface, primary/ground, muted/ground in each theme); a source test that fails if any file under `src/` still contains `localhost:` or a literal `/api/v1` base outside `serverConfig.ts`.
- Web: `tsc --noEmit`, `next build`, then a real browser pass (sign-in with Mailpit code, overview) with screenshots compared to the mockups.
- Mobile UI cannot be run on a device or emulator in this environment: verification is jest + `tsc` on touched files + a manual checklist handed to the user (sheet open/save/test, wrong address error, switching servers logs out, each role's theme and tabs).

## 5. Risks and open points

- Self-signed or private-CA servers: Android shows a TLS failure; the sheet explains it, but trusting the certificate is a device setting outside the app.
- Eight screens change their networking call sites; each gets a smoke check via the source test, but only manual device testing proves live behavior.
- Fonts add three packages and a startup wait; acceptable for the visual gain, falls back to the system font if loading fails.
- The ~70 existing type errors in untouched mobile screens remain; phase 1 only guarantees zero new errors in touched files.
