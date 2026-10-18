# Run your own society from this PC

Everything below uses Docker Desktop. All data lives in one folder (default `D:\ClaudeWorkspace\ds-data`):

| Folder | What it holds |
|---|---|
| `postgres\` | the database (residents, bills, visitors, complaints, posts) |
| `minio\` | uploaded pictures (stored once per identical file) |
| `redis\` | short-lived sign-in state |
| `backups\` | database copies made by `backup.ps1` |
| `selfhost.env` | passwords and the email account. **Never put this in git or share it.** |

## First time

1. Copy `infra\docker\selfhost.env.example` to `ds-data\selfhost.env` and fill every empty value.
   For sign-in emails with Gmail, create an *App password* (Google Account, Security, 2-Step Verification, App passwords) and put it in `SMTP_PASSWORD`.
2. `infra\selfhost\start.ps1` — builds and starts the server (first build takes a few minutes).
3. `infra\selfhost\tunnel.ps1` — prints a public `https://….trycloudflare.com` address for the phone app.
4. Create the society and its admin (see "Create the society" below).

## Every day

- Start: `start.ps1` (data is still there). Stop: `stop.ps1` (nothing is deleted).
- Phone address: run `tunnel.ps1` again. The free tunnel gets a **new address each time it starts**, so re-enter it in the app (Server screen). A fixed address needs your own domain (a named Cloudflare tunnel or any reverse proxy).
- `tunnel.ps1 -Stop` closes the public address.
- Backup: `backup.ps1` writes a dated `.sql` file into `ds-data\backups`. Copy that folder somewhere safe now and then.

## Create the society

The server starts empty. Open the sign-in code flow once to create your society and admin: the app or web console's setup screen asks for the society name, address, registration number, number of flats and your name and email, then emails you a 6-digit code to confirm the address.

## Moving to another PC

Copy the whole `ds-data` folder and this repository, install Docker Desktop, run `start.ps1`.

## Good to know

- Only this PC can reach the server directly (`127.0.0.1:8080`); the database and cache are not exposed at all.
- Change the email account or password in `selfhost.env`, then run `start.ps1` again.
