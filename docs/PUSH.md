# Notifications that ring when the app is closed

## What works with no setup
While the app is running (open, or just in the background), a **visitor at the gate rings and vibrates**
the phones of every resident of that flat, an **emergency** does the same, and **chat** gives a softer alert.
This comes over the live connection the app keeps to your server, so it costs nothing and needs no account.

## What needs a one-time setup: alerts when the app is fully closed
Android does not let a closed app listen, so a phone-maker's push service has to wake it. That service
(Google's Firebase Cloud Messaging, reached through Expo's free push relay) needs two free accounts that only you
can create. Nothing else changes: the server already sends the push, to every resident of the flat, on the loud
`visitors` channel, and the app already registers the phone once a project id exists.

1. Make a free account at <https://expo.dev> and run `npx eas-cli init` inside `apps/mobile`.
   It writes the project id into `app.json` (`expo.extra.eas.projectId`). Until a real id is there the app skips push quietly.
2. Make a free Firebase project at <https://console.firebase.google.com>, add an Android app with the package name
   `app.digitalsocieties.mobile`, and download `google-services.json` into `apps/mobile`.
3. In `app.json` set `expo.android.googleServicesFile` to `./google-services.json`.
4. In the Firebase project settings create a service-account key and upload it to Expo
   (`npx eas-cli credentials` > Android > Google Service Account Key for push notifications).
5. Push the change; GitHub builds the new APK. Sign in once on the phone and allow notifications.

Sending is free, and so is receiving.

## How the ring is decided
Each kind of alert has an Android *channel* (see `apps/mobile/src/services/notifications/notificationModel.ts`):

| Channel | Used for | Sound and vibration |
|---------|----------|---------------------|
| `visitors` | someone at the gate | loud ring, four long buzzes |
| `emergency` | SOS and emergency notices | loud ring, five long buzzes |
| `chat` | messages | phone default, short buzz |
| `general` | everything else | phone default |

A phone on silent or Do Not Disturb follows the person's own settings: the app does not override them.
