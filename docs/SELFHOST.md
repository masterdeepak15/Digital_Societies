# Run your own society server

One Docker image holds everything: the API, the admin website, MinIO (pictures), Postgres, Redis and the web proxy. It also carries the Android app, which people download from the sign-in page. All data lives in one folder.

Image: `ghcr.io/masterdeepak15/digital-societies:latest` (rebuilt on every push to `main`, after the tests pass).

## Quick start

With Docker only:

```bash
docker run -d --name societies -p 8080:8080 -v ds-data:/data \
  -e SMTP_USERNAME=you@gmail.com -e SMTP_PASSWORD="your app password" \
  ghcr.io/masterdeepak15/digital-societies:latest
```

With Compose (recommended, keeps the settings in a file):

```bash
cd infra/docker/allinone
cp .env.example .env        # fill in the email settings
docker compose up -d
```

Then open <http://localhost:8080>. The first visit shows the setup screen, where you create your society and the first admin (a 6-digit code is emailed to confirm the address). After that the setup screen never appears again; everything is changed later from **Settings**, **Flats**, **Members**.

## What you get

| Where | What |
|---|---|
| `http://localhost:8080` | Admin website (sign in with an email code) |
| `http://localhost:8080/download/digital-societies.apk` | Android app. The sign-in page shows a "Get the Android app" link when the file is present |
| `http://localhost:8080/api/v1/...` | The API the phone app uses |

On the phone, open the app, choose **Server**, and enter the HTTPS address of this server.

## Your data

Everything that must survive is in the `/data` volume:

| Folder / file | What it holds |
|---|---|
| `postgres/` | the database (residents, bills, visitors, complaints, posts) |
| `minio/` | uploaded pictures, stored once per identical file |
| `config/secrets.env` | passwords and keys, generated on the first start (keep private) |
| `backups/` | database copies made by `ds-backup` |

Use a folder you can find instead of a named volume by setting `DS_DATA_DIR` (Compose) or `-v /path/on/your/pc:/data` (docker run).

Updating is safe: `docker compose pull && docker compose up -d`. The database is upgraded automatically and your data stays.

### Backup and restore

```bash
docker exec societies ds-backup                                   # writes /data/backups/ds-<date>.sql.gz
docker exec societies ds-restore /data/backups/ds-<date>.sql.gz   # replaces the database with that copy
docker restart societies
```

Copy the `backups/` folder somewhere safe now and then. Moving to another computer means copying the whole data folder (or restoring a backup) and starting the image there.

## Settings (environment variables)

| Variable | Meaning |
|---|---|
| `SMTP_HOST`, `SMTP_PORT`, `SMTP_SECURITY`, `SMTP_USERNAME`, `SMTP_PASSWORD`, `SMTP_FROM_ADDRESS`, `SMTP_FROM_NAME` | The email account that sends sign-in codes. For Gmail use an App Password |
| `DS_PUBLIC_URL` | The address people open the site at, for example `https://societies.example.com` |
| `DS_SITE` | Your domain, to get automatic HTTPS (see below). Default: plain HTTP on 8080 |
| `DS_PORT` | Port on your computer (Compose only). Default 8080 |
| `JITSI_SERVER_URL` | Video calls server. Default `https://meet.jit.si` (free) |
| `POSTGRES_PASSWORD`, `JWT_SECRET_KEY`, `QR_TOKEN_SECRET_KEY`, `MINIO_ACCESS_KEY`, `MINIO_SECRET_KEY` | Normally left empty: they are generated once and kept in `config/secrets.env` |

## Reaching it from a phone

- **No domain (free):** `docker compose --profile tunnel up -d tunnel`, then `docker compose logs tunnel | grep trycloudflare` prints a public HTTPS address. It changes every time the tunnel starts, so re-enter it in the app's Server screen. Close it with `docker compose stop tunnel`. While it runs, anyone with the address can reach your server.
- **Your own domain:** point the domain at the computer, set `DS_SITE=societies.example.com` and `DS_PUBLIC_URL=https://societies.example.com`, and publish ports 80 and 443 (`-p 80:80 -p 443:443`). The certificate is fetched automatically.

## About the Android app

CI builds the app and puts it inside the image. Without your own signing key it is signed with the standard debug key, which installs fine but cannot be updated in place by an app signed with a different key. To sign with your own key, add the repository secrets `ANDROID_KEYSTORE_BASE64`, `ANDROID_KEYSTORE_PASSWORD`, `ANDROID_KEY_ALIAS`, `ANDROID_KEY_PASSWORD`. To change the server the app starts with, set the repository variable `API_BASE_URL`. iPhone apps cannot be built this way (they need a Mac and an Apple developer account).

## Building the image yourself

```bash
mkdir -p apk && cp /path/to/your.apk apk/digital-societies.apk      # optional: enables the download link
docker build -f infra/docker/allinone/Dockerfile -t digital-societies .
```

## Good to know

- Only port 8080 is open. The database, cache and file store are inside the container and are not reachable from outside.
- It is one container: if you stop it, everything stops. Use `restart: unless-stopped` (already in the Compose file) so it comes back after a reboot.
- The image is for one society on one server. It is not a high-availability setup.

## Windows helper scripts

`infra\selfhost\` has small PowerShell scripts for a Windows PC. They read your private settings from `<data folder>llinone.env` (outside the repo; copy `infra\dockerllinone\.env.example` there and set `DS_DATA_DIR` to the folder that should hold your data).

| Script | What it does |
|---|---|
| `start.ps1` | pulls the newest image and starts (or updates) the server |
| `stop.ps1` | stops everything; data stays |
| `tunnel.ps1` / `tunnel.ps1 -Stop` | opens / closes a free public HTTPS address and prints it |
| `backup.ps1` | saves a database copy into `<data folder>ackups` |

## Older multi-container setup

`infra/docker/docker-compose.yml` and `docker-compose.prod.yml` run the parts as separate containers and build them from this repo. The separate `digital-societies-api` and `digital-societies-web-admin` images are no longer published.
