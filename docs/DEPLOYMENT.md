# Deployment Guide

Complete guide for environment setup, Docker configuration, and production deployment.

## Table of Contents

1. [Environment Setup](#1-environment-setup)
2. [Docker Configuration](#2-docker-configuration)
3. [Production Deployment](#3-production-deployment)
4. [CI/CD Pipeline](#4-cicd-pipeline)
5. [Troubleshooting](#5-troubleshooting)

---

## 1. Environment Setup

### 1.1 Local Development (.env)

**Step 1:** Copy the example file:

```bash
cp .env.example .env
```

**Step 2:** Configure required values:

| Variable | Description | Example |
|----------|-------------|---------|
| `NEXT_PUBLIC_SITE_URL` | Local dev URL | `http://localhost:5175` |
| `NEXT_PUBLIC_SITE_EMAIL` | Support email | `hello@example.com` |
| `DATABASE_URL` | PostgreSQL connection | `postgresql://user:pass@localhost:5432/db` |
| `AUTH_SECRET` | Session secret (32+ chars) | `openssl rand -base64 32` |
| `AUTH_GOOGLE_ID` | Google OAuth client ID | From Google Cloud Console |
| `AUTH_GOOGLE_SECRET` | Google OAuth secret | From Google Cloud Console |
| `QDRANT_URL` | Vector DB endpoint | `http://localhost:6333` |
| `OPENAI_API_KEY` | OpenAI API key | `sk-...` |
| `ANTHROPIC_API_KEY` | Anthropic API key | `sk-ant-...` |

**Step 3:** Generate secrets:

```bash
# AUTH_SECRET
openssl rand -base64 32

# Or with Bun
bun -e "console.log(crypto.randomBytes(32).toString('base64'))"
```

**Step 4:** Start local services (optional - uses local Docker stack):

```bash
docker compose up -d postgres qdrant infinity inngest
```

**Step 5:** Run development server:

```bash
bun install
bun run dev
```

---

### 1.2 Production (.env.production)

**Step 1:** Copy production template:

```bash
cp .env.production.example .env.production
```

**Step 2:** Configure production values:

```bash
# Site configuration
COMPOSE_SITE_URL="https://yourdomain.com"
COMPOSE_SITE_EMAIL="hello@yourdomain.com"

# Database (local PostgreSQL container)
POSTGRES_USER="aikc"
POSTGRES_PASSWORD="<STRONG_PASSWORD>"
POSTGRES_DB="aikc"

# Authentication
AUTH_SECRET="<RANDOM_SECRET_32_CHARS>"
AUTH_GOOGLE_ID="<YOUR_GOOGLE_CLIENT_ID>"
AUTH_GOOGLE_SECRET="<YOUR_GOOGLE_CLIENT_SECRET>"

# AI Providers
OPENAI_API_KEY="sk-..."
ANTHROPIC_API_KEY="sk-ant-..."
GOOGLE_GENERATIVE_AI_API_KEY="..."
ALIBABA_API_KEY="..."

# External Services
FIRECRAWL_API_KEY="fc-..."
RESEND_API_KEY="re_..."
SCREENSHOTONE_ACCESS_KEY="..."

# Amazon S3
S3_BUCKET="your-bucket-name"
S3_REGION="us-east-1"
S3_ACCESS_KEY="..."
S3_SECRET_ACCESS_KEY="..."

# Qdrant
QDRANT_API_KEY="<QDRANT_API_KEY>"

# Optional: Analytics & Payments
# NEXT_PUBLIC_PLAUSIBLE_DOMAIN="..."
# STRIPE_SECRET_KEY="sk_live_..."
```

**Security checklist:**

- [ ] All passwords are strong and unique
- [ ] AUTH_SECRET is at least 32 random characters
- [ ] API keys have minimal required permissions
- [ ] S3 bucket has proper CORS and IAM policies
- [ ] Database is not exposed to public internet

---

## 2. Docker Configuration

### 2.1 Architecture Overview

```
┌─────────────────────────────────────────────────────────────┐
│                    Docker Compose Stack                      │
├─────────────────────────────────────────────────────────────┤
│  ┌──────────┐  ┌──────────┐  ┌──────────┐  ┌─────────────┐ │
│  │   Caddy  │  │   App    │  │  Inngest │  │  PostgREST  │ │
│  │  :80/:443│  │  :5175   │  │  :8288   │  │   :3000     │ │
│  └────┬─────┘  └────┬─────┘  └────┬─────┘  └──────┬──────┘ │
│       │             │             │                │        │
│       └─────────────┴─────────────┴────────────────┘        │
│                              │                                │
│  ┌──────────┐  ┌──────────┐  │  ┌──────────┐                │
│  │ Postgres │  │  Qdrant  │──┘  │ Infinity │                │
│  │  :5432   │  │  :6333   │     │  :7997   │                │
│  └──────────┘  └──────────┘     └──────────┘                │
└─────────────────────────────────────────────────────────────┘
```

### 2.2 Services

| Service | Image | Port | Purpose |
|---------|-------|------|---------|
| `app` | Custom (Dockerfile) | 5175 | Next.js application |
| `caddy` | caddy:2-alpine | 80 | Reverse proxy |
| `postgres` | postgres:17-alpine | 5432 | Primary database |
| `qdrant` | qdrant/qdrant:v1.16.1 | 6333 | Vector search |
| `infinity` | michaelf34/infinity | 7997 | Local embeddings |
| `inngest` | inngest/inngest | 8288 | Background jobs |
| `postgrest` | postgrest/postgrest | 3000 | REST API layer |
| `migrate` | Custom (build stage) | - | Prisma migrations |

### 2.3 Build the Stack

**Development (local rebuilds):**

```bash
docker compose build
```

**Production (clean build):**

```bash
docker compose build --no-cache
```

**Start all services:**

```bash
docker compose up -d
```

**View logs:**

```bash
# All services
docker compose logs -f

# Specific service
docker compose logs -f app
```

### 2.4 Dockerfile Stages

The `Dockerfile` uses multi-stage builds:

1. **deps** - Install dependencies
2. **builder** - Build Next.js application
3. **runner** - Minimal production image

```dockerfile
# Stage 1: Dependencies
FROM oven/bun:1 AS deps
# Installs bun packages

# Stage 2: Builder
FROM oven/bun:1 AS builder
# Builds Next.js with standalone output

# Stage 3: Runner
FROM oven/bun:1-slim AS runner
# Minimal production runtime
```

---

## 3. Production Deployment

### 3.1 VPS Requirements

| Requirement | Specification |
|-------------|---------------|
| OS | Ubuntu 22.04 or 24.04 |
| CPU | 2+ cores (4+ recommended) |
| RAM | 4GB minimum (8GB recommended) |
| Storage | 40GB+ SSD |
| Network | Public IP, ports 80/443 open |

### 3.2 Server Setup

**Install dependencies:**

```bash
sudo apt update
sudo apt install -y ca-certificates curl gnupg git ufw

# Docker
sudo install -m 0755 -d /etc/apt/keyrings
curl -fsSL https://download.docker.com/linux/ubuntu/gpg | \
  sudo gpg --dearmor -o /etc/apt/keyrings/docker.gpg
sudo chmod a+r /etc/apt/keyrings/docker.gpg

echo "deb [arch=$(dpkg --print-architecture) signed-by=/etc/apt/keyrings/docker.gpg] \
  https://download.docker.com/linux/ubuntu \
  $(. /etc/os-release && echo "$VERSION_CODENAME") stable" | \
  sudo tee /etc/apt/sources.list.d/docker.list > /dev/null

sudo apt update
sudo apt install -y docker-ce docker-ce-cli containerd.io docker-compose-plugin
sudo systemctl enable --now docker

# Add user to docker group
sudo usermod -aG docker $USER
```

**Configure firewall:**

```bash
sudo ufw allow OpenSSH
sudo ufw allow 80/tcp
sudo ufw allow 443/tcp
sudo ufw enable
```

### 3.3 Repository Setup

**Clone repository:**

```bash
sudo adduser deploy
sudo usermod -aG docker deploy
sudo mkdir -p /srv/stukit/app /srv/stukit/shared
sudo chown -R deploy:deploy /srv/stukit

sudo su - deploy
git clone git@github.com:<org>/<repo>.git /srv/stukit/app
```

**Generate deploy key:**

```bash
ssh-keygen -t ed25519 -C "stukit-vps" -f ~/.ssh/id_ed25519_github
cat ~/.ssh/id_ed25519_github.pub
# Add to GitHub: Settings → Deploy keys
```

### 3.4 Database Bootstrap

**One-time migration from cloud PostgreSQL:**

```bash
# Set environment file
export COMPOSE_ENV_FILE=/srv/stukit/shared/.env.production

cd /srv/stukit/app

# Bootstrap (drops and recreates database)
bash ./scripts/bootstrap-postgres.sh vps

# Verify import
bash ./scripts/bootstrap-postgres.sh verify
```

### 3.5 Deploy Script

Create `/srv/stukit/deploy.sh`:

```bash
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
```

**Initial deploy:**

```bash
chmod +x /srv/stukit/deploy.sh
/srv/stukit/deploy.sh
```

**Verify deployment:**

```bash
curl http://127.0.0.1/healthz
docker compose logs --tail=100 app
```

---

## 4. CI/CD Pipeline

### 4.1 GitHub Actions Setup

**Create workflow file** `.github/workflows/deploy.yml`:

```yaml
name: Deploy to VPS

on:
  push:
    branches: [main]
  workflow_dispatch:

jobs:
  validate:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: oven-sh/setup-bun@v2
      - run: bun install --frozen-lockfile
      - run: bun x ultracite check
      - run: docker build --target runner -t stukit:${{ github.sha }} .

  deploy:
    runs-on: ubuntu-latest
    needs: validate
    steps:
      - uses: appleboy/ssh-action@v1.2.0
        with:
          host: ${{ secrets.VPS_HOST }}
          username: ${{ secrets.VPS_USER }}
          port: ${{ secrets.VPS_PORT }}
          key: ${{ secrets.VPS_SSH_KEY }}
          script: |
            cd /srv/stukit
            ./deploy.sh
```

### 4.2 GitHub Secrets

Configure these in repository settings:

| Secret | Description | Example |
|--------|-------------|---------|
| `VPS_HOST` | Server IP/hostname | `192.168.1.1` |
| `VPS_PORT` | SSH port | `22` |
| `VPS_USER` | SSH username | `deploy` |
| `VPS_SSH_KEY` | SSH private key | Contents of key file |

### 4.3 Cloudflare Integration

**DNS Configuration:**

| Type | Name | Content | Proxy |
|------|------|---------|-------|
| A | @ | `<VPS_IP>` | Proxied |
| A | www | `<VPS_IP>` | Proxied |

**SSL/TLS Settings:**

1. Go to Cloudflare Dashboard → SSL/TLS
2. Select **Full** or **Full (strict)**
3. Enable **Always Use HTTPS**

---

## 5. Troubleshooting

### Common Issues

| Issue | Solution |
|-------|----------|
| Container won't start | Check `docker compose logs <service>` |
| Database connection failed | Verify `DATABASE_URL` in `.env.production` |
| Build fails with OOM | Increase VPS RAM or add swap |
| SSH deploy fails | Verify `authorized_keys` and SSH key permissions |
| 502 Bad Gateway | Check Caddy config and backend health |

### Useful Commands

```bash
# Check service status
docker compose ps

# Restart specific service
docker compose restart app

# Rebuild and restart
docker compose up -d --build

# View resource usage
docker stats

# Access database
docker compose exec postgres psql -U $POSTGRES_USER -d $POSTGRES_DB

# Clear all containers and volumes (destructive!)
docker compose down -v
```

### Rollback

```bash
cd /srv/stukit/app
git log --oneline -5
git checkout <previous-commit>
./deploy.sh
```

---

## Quick Reference

### Environment Files

| File | Purpose |
|------|---------|
| `.env` | Local development |
| `.env.example` | Template for developers |
| `.env.production` | Production secrets (on VPS only) |
| `.env.production.example` | Production template |

### Ports

| Service | Port | External |
|---------|------|----------|
| Caddy | 80/443 | Yes |
| App | 5175 | No |
| PostgreSQL | 5432 | Optional |
| Qdrant | 6333 | No |
| Inngest | 8288 | No |

### Health Endpoints

- `/healthz` - Application health
- `/cdn-cgi/trace` - Cloudflare proxy check
