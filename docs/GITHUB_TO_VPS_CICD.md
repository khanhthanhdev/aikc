# GitHub to VPS CI/CD Deployment Guide

This guide sets up automatic deployment for this repository from GitHub to a VPS.

It is written for the current stack in this repo:

- Next.js 16 app
- Bun runtime
- Docker + Docker Compose
- Caddy reverse proxy
- PostgreSQL, Qdrant, Infinity, and PostgREST running in the same Compose stack
- Prisma schema sync handled by the `migrate` service during deploy
- One-time PostgreSQL bootstrap handled by `scripts/bootstrap-postgres.sh`

## 1. Deployment flow

This guide has two distinct phases: the one-time VPS cutover and the normal GitHub-driven deploy loop after cutover.

Initial VPS cutover:

1. Prepare the VPS host.
2. Clone the repo onto the VPS.
3. Create the production env file on the VPS.
4. Bootstrap the bundled VPS PostgreSQL from the current cloud PostgreSQL source.
5. Verify the imported PostgreSQL data and rebuilt Qdrant state.
6. Point production traffic at the VPS stack.

Steady-state deploy loop after cutover:

1. Push code to the `main` branch on GitHub.
2. GitHub Actions runs basic checks.
3. GitHub Actions connects to the VPS over SSH.
4. The VPS pulls the latest code from GitHub.
5. The VPS runs `docker compose up -d --build`.
6. Docker rebuilds the app image and restarts the stack.
7. The `migrate` service runs `prisma db push --skip-generate` before the app starts.

This is the simplest setup that matches the existing `Dockerfile` and [`docker-compose.yml`](/home/thanhkt/code/stukit/docker-compose.yml).

## 2. Important repo-specific notes

- The app container listens on port `5175`.
- Caddy forwards port `80` traffic to the app container.
- The current [`Caddyfile`](/home/thanhkt/code/stukit/Caddyfile) is set up for local HTTP and has `auto_https off`.
- For real production HTTPS, update the Caddy config to use your domain and allow TLS, or terminate TLS with another reverse proxy in front of this stack.
- This guide assumes the bundled VPS PostgreSQL becomes the primary production database and the current cloud PostgreSQL source is used only for the one-time bootstrap.
- The repository includes a dormant `pg-tools` Compose service with `pg_dump` and `pg_restore`, so you do not need host-installed PostgreSQL client tools on the VPS.

## 3. Prepare the VPS

Use Ubuntu 22.04 or 24.04 if you want the easiest path.

Install the required packages:

```bash
sudo apt update
sudo apt install -y ca-certificates curl gnupg git ufw
```

Install Docker Engine and the Compose plugin:

```bash
sudo install -m 0755 -d /etc/apt/keyrings
curl -fsSL https://download.docker.com/linux/ubuntu/gpg | \
  sudo gpg --dearmor -o /etc/apt/keyrings/docker.gpg
sudo chmod a+r /etc/apt/keyrings/docker.gpg

echo \
  "deb [arch=$(dpkg --print-architecture) signed-by=/etc/apt/keyrings/docker.gpg] \
  https://download.docker.com/linux/ubuntu \
  $(. /etc/os-release && echo "$VERSION_CODENAME") stable" | \
  sudo tee /etc/apt/sources.list.d/docker.list > /dev/null

sudo apt update
sudo apt install -y docker-ce docker-ce-cli containerd.io docker-buildx-plugin docker-compose-plugin
sudo systemctl enable --now docker
```

Create a non-root deploy user:

```bash
sudo adduser deploy
sudo usermod -aG docker deploy
sudo mkdir -p /srv/stukit/app /srv/stukit/shared
sudo chown -R deploy:deploy /srv/stukit
```

Open the required firewall ports:

```bash
sudo ufw allow OpenSSH
sudo ufw allow 80/tcp
sudo ufw allow 443/tcp
sudo ufw enable
```

If you are not serving HTTPS from this VPS yet, `80/tcp` is enough for the current Caddy setup.

## 4. Let the VPS pull from GitHub

The VPS needs read access to the repository so it can run `git pull` during deploy.

Log in as the `deploy` user:

```bash
sudo su - deploy
```

Generate a read-only deploy key for the repo:

```bash
mkdir -p ~/.ssh
chmod 700 ~/.ssh
ssh-keygen -t ed25519 -C "stukit-vps" -f ~/.ssh/id_ed25519_github
cat ~/.ssh/id_ed25519_github.pub
```

Add that public key in GitHub:

1. Open the repository on GitHub.
2. Go to `Settings` -> `Deploy keys`.
3. Click `Add deploy key`.
4. Paste the public key.
5. Keep `Allow write access` disabled.

Create an SSH config entry on the VPS:

```bash
cat > ~/.ssh/config <<'EOF'
Host github.com
  HostName github.com
  User git
  IdentityFile ~/.ssh/id_ed25519_github
  IdentitiesOnly yes
EOF

chmod 600 ~/.ssh/config
ssh-keyscan github.com >> ~/.ssh/known_hosts
chmod 600 ~/.ssh/known_hosts
```

Clone the repo:

```bash
git clone git@github.com:<your-org-or-user>/<your-repo>.git /srv/stukit/app
cd /srv/stukit/app
git checkout main
```

## 5. Create the production environment file on the VPS

Keep production secrets outside the repo.

Create `/srv/stukit/shared/.env.production`:

```bash
nano /srv/stukit/shared/.env.production
```

Start from [`.env.production.example`](/home/thanhkt/code/stukit/.env.production.example), then fill in real production values.

At minimum, review these values carefully:

- `NODE_ENV=production`
- `COMPOSE_SITE_URL=https://your-domain.com`
- `COMPOSE_SITE_EMAIL=hello@your-domain.com`
- `AUTH_SECRET=...`
- `AUTH_GOOGLE_ID=...`
- `AUTH_GOOGLE_SECRET=...`
- `POSTGRES_USER=...`
- `POSTGRES_PASSWORD=...`
- `POSTGRES_DB=...`
- `SYNC_SOURCE_DATABASE_URL=postgresql://...`
- `OPENAI_API_KEY=...`
- `ANTHROPIC_API_KEY=...`
- `GOOGLE_GENERATIVE_AI_API_KEY=...`
- `ALIBABA_API_KEY=...`
- `FIRECRAWL_API_KEY=...`
- `RESEND_API_KEY=...`
- `S3_BUCKET=...`
- `S3_REGION=...`
- `S3_ACCESS_KEY=...`
- `S3_SECRET_ACCESS_KEY=...`
- `QDRANT_API_KEY=...`

Notes:

- The current Compose file creates a local PostgreSQL container, so `POSTGRES_*` values matter on the VPS.
- The app environment in Compose points `DATABASE_URL` to the internal `postgres` service by default.
- `COMPOSE_SITE_URL` and `COMPOSE_SITE_EMAIL` are the production values that flow into the container build args and runtime app environment.
- `DATABASE_URL` and `DATABASE_URL_UNPOOLED` only matter if you change the Compose file to use an external database instead of the bundled PostgreSQL service.
- `SYNC_SOURCE_DATABASE_URL` is only needed until the one-time cloud-to-VPS bootstrap is complete and your rollback window closes.

## 6. Bootstrap PostgreSQL from cloud on the VPS

The first production cutover is manual. Run it on the VPS before enabling the GitHub Actions deploy loop.

This bootstrap is a one-time operator task. Do not add it to the normal GitHub Actions deploy script, because it recreates the target PostgreSQL database.

Before you run it:

1. Confirm `/srv/stukit/shared/.env.production` contains valid `POSTGRES_*` values and a valid `SYNC_SOURCE_DATABASE_URL`.
2. Confirm the repo checkout on the VPS is already at the commit you want to cut over with.
3. If you are re-running this against a VPS database you care about, take a backup first because the script drops and recreates the target database.

From the repo checkout on the VPS:

```bash
cd /srv/stukit/app
COMPOSE_ENV_FILE=/srv/stukit/shared/.env.production bash ./scripts/bootstrap-postgres.sh vps
COMPOSE_ENV_FILE=/srv/stukit/shared/.env.production bash ./scripts/bootstrap-postgres.sh verify
```

If you want an explicit preflight before the bootstrap, run:

```bash
cd /srv/stukit/app
docker compose --env-file /srv/stukit/shared/.env.production config >/dev/null
docker compose --env-file /srv/stukit/shared/.env.production --profile ops build pg-tools
docker compose --env-file /srv/stukit/shared/.env.production build migrate app
```

What this does:

- recreates the bundled VPS PostgreSQL database
- imports cloud PostgreSQL into it with `pg_dump` and `pg_restore`
- verifies schema and data parity
- reapplies the PostgREST grants
- runs `prisma db push --skip-generate`
- rebuilds local Qdrant against the imported PostgreSQL data
- starts the app, PostgREST, and Caddy services

Verify the stack immediately after bootstrap:

```bash
docker compose --env-file /srv/stukit/shared/.env.production logs --tail=100 postgres migrate app caddy
curl http://127.0.0.1/healthz
curl http://127.0.0.1/postgrest/
```

Also verify the database from inside the PostgreSQL container:

```bash
docker compose --env-file /srv/stukit/shared/.env.production exec -T postgres sh -ec '
  export PGPASSWORD="$POSTGRES_PASSWORD"
  psql -U "$POSTGRES_USER" -d "$POSTGRES_DB" -c "SELECT current_database(), current_user;"
  psql -U "$POSTGRES_USER" -d "$POSTGRES_DB" -c "\\dt"
'
```

Once the VPS stack is healthy and traffic is switched over, keep the old cloud PostgreSQL and Vercel deployment around only for a short rollback window. After that, remove `SYNC_SOURCE_DATABASE_URL` from the production env file and decommission the old services.

## 7. Create the deploy script on the VPS

Create `/srv/stukit/deploy.sh`:

```bash
cat > /srv/stukit/deploy.sh <<'EOF'
#!/usr/bin/env bash
set -Eeuo pipefail

APP_DIR="/srv/stukit/app"
ENV_FILE="/srv/stukit/shared/.env.production"
BRANCH="main"

cd "$APP_DIR"

git fetch origin
git checkout "$BRANCH"
git pull --ff-only origin "$BRANCH"

docker compose --env-file "$ENV_FILE" up -d --build --remove-orphans
docker compose --env-file "$ENV_FILE" ps
docker image prune -f
EOF

chmod +x /srv/stukit/deploy.sh
```

Run the first deploy manually after the database bootstrap in section 6 is complete:

```bash
/srv/stukit/deploy.sh
```

Verify the stack:

```bash
docker compose --env-file /srv/stukit/shared/.env.production logs --tail=100 migrate app caddy
curl http://127.0.0.1/healthz
```

If DNS already points to the VPS, also test:

```bash
curl http://your-domain.com/healthz
```

## 8. Add the GitHub Actions SSH key

GitHub Actions needs a different SSH key so it can connect to the VPS.

On your local machine, generate a new key pair:

```bash
ssh-keygen -t ed25519 -C "stukit-github-actions" -f stukit-github-actions
```

Append the public key to the VPS user:

```bash
cat stukit-github-actions.pub
```

Then on the VPS as `deploy`:

```bash
mkdir -p ~/.ssh
chmod 700 ~/.ssh
nano ~/.ssh/authorized_keys
chmod 600 ~/.ssh/authorized_keys
```

Paste the public key into `authorized_keys`.

Add these GitHub repository secrets:

- `VPS_HOST`: your server IP or hostname
- `VPS_PORT`: usually `22`
- `VPS_USER`: `deploy`
- `VPS_SSH_KEY`: the private key content from `stukit-github-actions`

## 9. Add the GitHub Actions workflow

Create [`.github/workflows/deploy.yml`](/home/thanhkt/code/stukit/.github/workflows/deploy.yml) with this content:

```yaml
name: Deploy to VPS

on:
  push:
    branches:
      - main
  workflow_dispatch:

jobs:
  validate:
    runs-on: ubuntu-latest

    steps:
      - name: Checkout
        uses: actions/checkout@v4

      - name: Setup Bun
        uses: oven-sh/setup-bun@v2
        with:
          bun-version: latest

      - name: Install dependencies
        run: bun install --frozen-lockfile

      - name: Run Ultracite checks
        run: bun x ultracite check

      - name: Verify Docker build
        run: docker build --target runner -t stukit:${{ github.sha }} .

  deploy:
    runs-on: ubuntu-latest
    needs: validate
    if: github.ref == 'refs/heads/main'

    steps:
      - name: Deploy over SSH
        uses: appleboy/ssh-action@v1.2.0
        with:
          host: ${{ secrets.VPS_HOST }}
          username: ${{ secrets.VPS_USER }}
          port: ${{ secrets.VPS_PORT }}
          key: ${{ secrets.VPS_SSH_KEY }}
          script_stop: true
          script: |
            set -Eeuo pipefail
            cd /srv/stukit
            ./deploy.sh
```

Commit and push the workflow:

```bash
git add .github/workflows/deploy.yml
git commit -m "Add VPS deployment workflow"
git push origin main
```

After that, every push to `main` triggers a deploy.

Keep the PostgreSQL bootstrap outside this workflow. The workflow should only update code and restart services against the already-bootstrapped VPS database.

## 10. Cloudflare Integration (DDoS, CDN, SSL)

The current [`Caddyfile`](/home/thanhkt/code/stukit/Caddyfile) is configured for Cloudflare proxy mode.

### Step 10.1: Cloudflare DNS Setup

In Cloudflare Dashboard for `aikc.vn`:

1. Go to **DNS** → **Records**
2. Add A records:

| Type | Name | Content | Proxy Status |
|------|------|---------|--------------|
| A | `@` | `<VPS_IP>` | **Proxied** (orange cloud) |
| A | `www` | `<VPS_IP>` | **Proxied** (orange cloud) |

**Proxy enabled (orange cloud) means:**
- Cloudflare handles SSL/TLS termination
- Cloudflare CDN caches static assets
- Cloudflare DDoS protection is active
- VPS receives HTTP traffic (port 80 only)

### Step 10.2: Firewall Configuration

With Cloudflare proxy, only port 80 needs to be open on VPS:

```bash
sudo ufw allow 80/tcp
sudo ufw deny 443/tcp  # Cloudflare handles HTTPS
```

### Step 10.3: Caddyfile Configuration

The included `Caddyfile` is already configured for Cloudflare:

```caddy
{
	auto_https off
	admin off
}

:80 {
	# Block direct IP access (only allow domain requests)
	@blocked {
		not header_regexp Host ^aikc\.vn$
		not header_regexp Host ^www\.aikc\.vn$
	}
	respond @blocked 444

	# Cloudflare proxy health check
	respond /cdn-cgi/trace 200

	# Main app
	handle {
		reverse_proxy app:5175
	}
}
```

### Step 10.4: Enable Cloudflare SSL/TLS

In Cloudflare Dashboard:

1. Go to **SSL/TLS** → **Overview**
2. Select **Full** or **Full (strict)** mode
   - **Full**: Encrypts between Cloudflare and VPS (self-signed cert OK)
   - **Full (strict)**: Requires valid cert on VPS (Caddy can auto-provision)
3. Enable **Always Use HTTPS** under **SSL/TLS** → **Edge Certificates**

### Step 10.5: Recommended Cloudflare Settings

**Speed** → **Optimization**:
- Enable **Auto Minify** for HTML, CSS, JS
- Enable **Brotli** compression

**Caching** → **Configuration**:
- Set **Caching Level** to **Standard** or **Aggressive**
- Enable **Development Mode** during active development (bypasses cache)

**Security** → **WAF**:
- Enable **Managed Rulesets** for common attacks
- Add rate limiting rules if needed

**Network** → **Protection**:
- Enable **gRPC** if using gRPC services
- Enable **HTTP/2** (default enabled)
- Enable **HTTP/3 (with QUIC)** for better performance

## 11. Rollback procedure

If a bad deploy reaches production:

```bash
sudo su - deploy
cd /srv/stukit/app
git log --oneline -n 5
git checkout <previous-good-commit>
docker compose --env-file /srv/stukit/shared/.env.production up -d --build --remove-orphans
```

If you want cleaner rollback later, move to release tags or GHCR images with immutable tags.

## 12. Troubleshooting

### Workflow can SSH but deploy fails

Check:

- `docker` works for the `deploy` user
- `/srv/stukit/deploy.sh` is executable
- the repo exists at `/srv/stukit/app`
- the repo on the VPS has no local uncommitted changes blocking `git pull`

### Container build fails in production

Check:

- Docker disk space with `df -h`
- Compose logs with `docker compose --env-file /srv/stukit/shared/.env.production logs`
- app logs with `docker compose --env-file /srv/stukit/shared/.env.production logs app`

### App starts but returns runtime env errors

Check:

- `/srv/stukit/shared/.env.production`
- missing required values from [`env.ts`](/home/thanhkt/code/stukit/env.ts)
- public URL values such as `NEXT_PUBLIC_SITE_URL` and `COMPOSE_SITE_URL`

### Site is reachable on HTTP but not HTTPS

Check:

- DNS points to the correct VPS IP
- your Caddy config uses the real domain, not `:80`
- ports `80` and `443` are open
- `auto_https off` is not still present in production

## 13. Recommended next improvements

After the basic pipeline is working, the next upgrades worth making are:

1. Push Docker images to GHCR instead of building on the VPS.
2. Use tagged releases for clean rollback.
3. Add health checks and fail the workflow if `/healthz` does not return `200`.
4. Split staging and production into separate branches or environments.
5. Back up the PostgreSQL volume before schema changes.
