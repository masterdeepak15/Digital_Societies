# UI redesign — manual test checklist (phone and browser)

The automated checks (jest, vitest, `tsc`, `next build`) cannot run the mobile app. Work through this on a real Android phone or emulator. Tick each line; note the phone model and Android version.

## Setup
- [ ] Backend running and reachable over **HTTPS** from the phone (a domain with a normal certificate is easiest).
- [ ] APK built: `eas build -p android --profile preview` (or the local Gradle route in the README) and installed.
- [ ] A demo society seeded (`POST /api/v1/setup/demo`) so `admin@demo.society`, `resident01@demo.society` and a guard account exist; SMTP configured or Mailpit reachable so you can read the sign-in code.

## Server address (sign-in screen)
- [ ] First launch with no server saved: the **Server address** sheet opens by itself, and **Send code** is disabled until a server is saved.
- [ ] Typing `http://example.com` shows "Start with https://"; `example.com` shows the same; an empty field shows "Enter your society's address."; `https://example.com:99999` shows the port message.
- [ ] Tapping an example chip fills the field.
- [ ] **Test connection** against your real server shows "Connected." and against `https://does-not-exist.invalid` shows the network message (which mentions self-signed certificates).
- [ ] **Test connection** against an address with a certificate the phone does not trust shows a connection error (not "Connected.").
- [ ] **Save** works even right after a failed test (saving does not require a successful test).
- [ ] After Save, the "Server" row at the bottom shows the host, and sign-in works against that server.
- [ ] Sign in, then sign out, reopen the sheet and save a **different** server: you are signed out and the old session is gone. Saving the **same** address again changes nothing.
- [ ] Force-close and reopen the app: the saved server is remembered.
- [ ] An IP address with a port (`https://192.168.x.x:8443`) works when its certificate is trusted by the phone.

## Appearance
- [ ] Sheet and Me screen both show Light / Dark / System; the choice applies immediately and survives an app restart.
- [ ] **System** follows the phone's dark-mode setting live (toggle it in Android quick settings with the app open).
- [ ] Check all three role themes in both light and dark: resident (Courtyard), guard (Control Room), admin/staff (Ledger). Text is readable everywhere and nothing is white-on-white or black-on-black.

## Resident
- [ ] Four tabs only: Home, Bills, Community, Me.
- [ ] Home shows the real next bill (or "You are all paid up"), never sample figures.
- [ ] Tiles open Visitors, Complaints, Book (facilities) and Notices with a back button; SOS opens the SOS screen.
- [ ] A pending visitor appears under "Needs your answer"; **Let in** and **Not expecting** both work and the card disappears.
- [ ] Me: change name and optional phone, save, sign out; sign out returns to the sign-in screen.
- [ ] Parking, Marketplace, Wallet, Call and SOS screens load data (they used to call the API without logging in).

## Guard
- [ ] Four tabs: Gate, Log, SOS, Me; text is large and buttons are easy to hit one-handed.
- [ ] Gate form saves a visitor with the network off (shows "Offline", pending-sync count goes up) and syncs when the network returns.
- [ ] Waiting / Inside counts appear when online; if they never appear for a guard, note it (the server may not allow guards to read `/visitors`).

## Web admin (browser)
- [ ] Sign-in: wrong code shows the server message without reloading the page; resend countdown works.
- [ ] Overview matches the mockup; Light / Dark / System toggle in the sidebar footer; reload in dark mode shows no light flash.
- [ ] Pages not redesigned yet (Billing, Members, Visitors, Settings…) are readable in dark mode.
- [ ] At phone width the sidebar hides behind the menu button; Escape closes it and focus returns to the button.
