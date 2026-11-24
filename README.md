[![Deploy on Railway](https://railway.com/button.svg)](https://railway.com/new/template/kept-1?utm_medium=integration&utm_source=button&utm_campaign=kept)

# Kept on Railway

One-click [Railway](https://railway.com) template for [Kept](https://github.com/keptinventory/kept), the self-hosted inventory of everything you own and where it is (AGPL-3.0).

**Version:** Kept 1.14.7, official image `ghcr.io/keptinventory/kept:1.14.7@sha256:e346925dc007d16e2eaab91a20e1c5313734957acb54eeec456d40d5cf813ab3`.

## What it deploys

| Service | What it is | State |
|---|---|---|
| **Kept** | Built from this repo: the official image plus `railway-start.sh`, which runs Kept's own `kept bootstrap` (database logins and extensions) and `kept migrate` before the server. Web app, API, background jobs and the MCP server at `/mcp`. Health check `/readyz`. | none (stateless) |
| **Postgres** | `pgvector/pgvector:0.8.7-pg18-bookworm` (pinned by digest), PostgreSQL 18 with pgvector | volume at `/var/lib/postgresql` |
| **Bucket** | A Railway Bucket (S3-compatible) | photos, receipts, documents and their thumbnails |

One volume plus one bucket, so it fits Railway's Free plan. Measured with every service limited to 0.5 GB RAM / 1 vCPU: Kept idles around 150–180 MB and peaked at about 370 MB while resizing a 12-megapixel photo; Postgres stays near 100–200 MB.

## Variables

Nothing to fill in. All are generated or referenced:

| Variable (Kept service) | Value |
|---|---|
| `KEPT_PUBLIC_URL` | `https://${{RAILWAY_PUBLIC_DOMAIN}}` (change it if you add a custom domain) |
| `KEPT_SETUP_CODE` | generated 6-character code: enter it on first visit to create the admin |
| `KEPT_SECRET_KEY`, `KEPT_AUTH_SECRET` | generated 64-hex keys that encrypt stored secrets and sign sessions. Back them up |
| `KEPT_DB_OWNER/APP/AUTH/SYSTEM_PASSWORD` | generated passwords for Kept's four database logins (re-applied on every start) |
| `KEPT_DB_HOST`, `KEPT_DB_SUPERUSER_PASSWORD` | references to the Postgres service (the superuser is used only by the bootstrap step) |
| `KEPT_STORAGE=s3`, `KEPT_S3_*` | references to the Railway Bucket |
| `KEPT_TRUSTED_PROXIES` | `100.64.0.0/10`, Railway's proxy range, so rate limits see each visitor's real address |
| `PORT` | `8080` |

Optional extras (SMTP mail, OIDC or Google sign-in, AI providers) are described in the template overview and in [Kept's docs](https://keptinventory.info/).

## Updates

Railway notifies everyone who deployed this template when `main` changes here. Bumping Kept is a one-line change of the `FROM` pin in `Dockerfile`, with an entry in [CHANGELOG.md](CHANGELOG.md) (breaking changes first). Migrations run automatically on the next start. Kept refuses to start an older image on a newer database, so don't roll back across a migration without a backup.

## Repo layout

- `Dockerfile`: the pinned official image, small thread caps for a 1 vCPU / 0.5 GB service, and the start script as entrypoint.
- `railway-start.sh`: builds the database URLs, runs `kept bootstrap` (waits up to 5 minutes for Postgres) and `kept migrate`, then starts Kept. Any failure exits non-zero so Railway's restart policy retries.
- `overview.md`: the marketplace overview.
- `test/`: the local Compose stack (RustFS standing in for the Railway Bucket) and `e2e.mjs`, the end-to-end check used on every release (first-run setup, sign-in, a thing with a photo, fetched back from storage).
