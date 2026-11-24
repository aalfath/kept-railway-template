# Deploy and Host Kept on Railway

Kept is a self-hosted inventory of everything you own and where it is: rooms, shelves and boxes nested as deep as you like, photos, receipts, warranties and manuals per item, printable QR labels, and a built-in AI assistant and MCP server that answer "where did I put the drill?" from your own data.

## About Hosting Kept

This template runs Kept 1.14.7 from the official image (pinned by digest) with three parts wired over Railway's private network: the Kept service (web app, API, background jobs and MCP server), PostgreSQL 18 with pgvector on a volume, and a Railway Bucket for photos and documents. Every start runs Kept's own database bootstrap and migrations before the server opens, so the stack comes up in the right order. All passwords, both encryption keys and the first-run setup code are generated for your deployment, so there is nothing to fill in. It fits Railway's Free plan: one volume, one bucket, 0.5 GB per service.

## Common Use Cases

* Home inventory for insurance: photos, purchase prices, serial numbers and receipts per item
* Finding things: search by name or place, or ask the AI assistant where something is
* Storage and moving boxes: print QR labels and scan a box to see what is inside
* Warranties, maintenance reminders and manuals kept with the item they belong to
* Letting your own AI client (Claude, ChatGPT or any MCP client) read and update your inventory

## Dependencies for Kept Hosting

* Kept service: built from [aalfath/kept-railway-template](https://github.com/aalfath/kept-railway-template) (official `ghcr.io/keptinventory/kept` image plus a small start script)
* Postgres: PostgreSQL 18 with pgvector (`pgvector/pgvector` image, pinned), data on a volume
* Bucket: a Railway Bucket (S3-compatible) holding uploaded photos and files

### Deployment Dependencies

* Kept source and releases: https://github.com/keptinventory/kept/releases
* Kept documentation: https://keptinventory.info/
* Railway Buckets: https://docs.railway.com/reference/buckets

### Implementation Details

**First login.** When the Kept service turns green, open its Variables tab and copy `KEPT_SETUP_CODE` (six characters; the deploy logs also print it as `KEPT SETUP CODE`). Open your Kept URL, enter the code and create your admin account. Only someone holding the code can create the first admin, so the URL is never open to whoever finds it first. Afterwards, sign-up for other people is set in Admin settings.

**Back up your keys.** `KEPT_SECRET_KEY` and `KEPT_AUTH_SECRET` on the Kept service encrypt stored secrets such as AI provider keys. Keep a copy: if they are lost or changed, those values can't be read.

**AI assistant and MCP.** Add a provider (OpenAI, Anthropic, Google, Groq, OpenRouter or any OpenAI-compatible server) under Settings, AI, with your own API key. Without one, everything except the assistant and photo extraction works. For outside AI apps, turn on "Connect ChatGPT or Claude" under Location settings, What to track, then make a personal token under Settings, Connections and give your MCP client:

```text
Server address   https://YOUR-DOMAIN/mcp
Authorization    Bearer kpt_YOUR-TOKEN
```

Apps that support OAuth connectors can connect to the same address without a token.

**Optional settings** (add them to the Kept service, then redeploy): `KEPT_SMTP_URL` and `KEPT_SMTP_FROM` for invite and password-reset mail; `KEPT_OIDC_ISSUER`, `KEPT_OIDC_CLIENT_ID`, `KEPT_OIDC_CLIENT_SECRET` or `KEPT_GOOGLE_CLIENT_ID`, `KEPT_GOOGLE_CLIENT_SECRET` for single sign-on. With a custom domain, set `KEPT_PUBLIC_URL` to `https://YOUR-DOMAIN` so links and QR labels use it.

**Updates.** The Kept service builds from a public GitHub repo, so when the template moves to a new Kept release Railway shows you an update in your project; apply it when you're ready, and migrations run on the next start. The repo's CHANGELOG lists each version, breaking changes first. Don't change the Postgres image's major version: PostgreSQL major upgrades are a dump and restore.

**Resources.** Idle, Kept uses about 150 MB and Postgres about 80 MB; resizing a 12-megapixel photo peaked near 220 MB in our 0.5 GB test, so the Free plan's 0.5 GB per service is enough for a household.

## Why Deploy Kept on Railway?

<!-- Recommended: Keep this section as shown below -->
Railway is a singular platform to deploy your infrastructure stack. Railway will host your infrastructure so you don't have to deal with configuration, while allowing you to vertically and horizontally scale it.

By deploying Kept on Railway, you are one step closer to supporting a complete full-stack application with minimal burden. Host your servers, databases, AI agents, and more on Railway.
<!-- End recommended section -->
