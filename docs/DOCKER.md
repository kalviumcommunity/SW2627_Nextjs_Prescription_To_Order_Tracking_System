# MedEasy — Docker Operations Guide

This document covers the full Docker setup for MedEasy local development and production deployment. For a quick-start, see the [README](../README.md).

---

## Table of Contents

- [Architecture](#architecture)
- [Services](#services)
- [Volume Management](#volume-management)
- [Environment Configuration](#environment-configuration)
- [Common Workflows](#common-workflows)
- [Database Operations](#database-operations)
- [Production Build](#production-build)
- [Troubleshooting](#troubleshooting)

---

## Architecture

```
┌─────────────────────────────────────────────────────────┐
│  docker compose (local development)                     │
│                                                         │
│  ┌─────────────────┐        ┌──────────────────────┐   │
│  │  app (Next.js)  │──────▶ │  db (PostgreSQL 15)  │   │
│  │  port: 3000     │        │  port: 5432          │   │
│  │  hot-reload     │        │  volume: postgres_data│   │
│  └─────────────────┘        └──────────────────────┘   │
└─────────────────────────────────────────────────────────┘
```

The `app` service depends on `db` being healthy before it starts. The `db` service uses a named Docker volume (`postgres_data`) so data is never lost on normal `docker compose down`.

---

## Services

### `db` — PostgreSQL 15

| Setting | Value |
|---|---|
| Image | `postgres:15-alpine` |
| Container | `medeasy_db` |
| Port | `5432:5432` |
| Volume | `postgres_data` (named, persistent) |
| Health check | `pg_isready` every 5s, 5 retries |
| Restart | `unless-stopped` |

Default credentials (set via `.env` or docker-compose defaults):
```
User:     medeasy_dev
Password: medeasy_password  (change in .env for your local setup)
Database: medeasy_db
```

### `app` — Next.js 14

| Setting | Value |
|---|---|
| Build target | `dev` (Dockerfile stage 4) |
| Container | `medeasy_app` |
| Port | `3000:3000` |
| Mode | Development (hot-reload via bind mount) |
| Depends on | `db` health check passing |
| Restart | `unless-stopped` |

The app source code is bind-mounted into the container (`- .:/app`), so any file changes on your host are immediately reflected inside the container, enabling Next.js hot-reload.

---

## Volume Management

### Named volume: `postgres_data`

All PostgreSQL data is stored in the `postgres_data` Docker named volume. This volume is managed by Docker and persists independently of containers.

```bash
# List all Docker volumes
docker volume ls

# Inspect the postgres_data volume
docker volume inspect sw2627_nextjs_prescription_to_order_tracking_system_postgres_data

# View volume disk usage
docker system df -v
```

### ⚠️ Safe vs. Destructive commands

| Command | Effect on Data |
|---|---|
| `docker compose up -d` | Starts services, data is untouched |
| `docker compose stop` | Stops containers, data preserved |
| `docker compose down` | Removes containers, **data preserved** ✅ |
| `docker compose down -v` | Removes containers + volumes, **data DELETED** ❌ |
| `docker volume rm <name>` | Deletes a specific volume, **data DELETED** ❌ |

**Always use `docker compose down` (without `-v`) for normal teardown.**

---

## Environment Configuration

### Required `.env` variables for Docker

When running via Docker Compose, the `app` service reads from your `.env` file. The `DATABASE_URL` is automatically overridden inside the compose file to use the `db` service hostname instead of `localhost`.

```env
# .env — for docker compose (app connects to db via hostname "db")
POSTGRES_USER=medeasy_dev
POSTGRES_PASSWORD=change_me_local_dev_only
POSTGRES_DB=medeasy_db
DATABASE_URL=postgresql://medeasy_dev:change_me_local_dev_only@localhost:5432/medeasy_db?schema=public

NEXTAUTH_URL=http://localhost:3000
NEXTAUTH_SECRET=<output of: openssl rand -base64 32>
```

> The `DATABASE_URL` in your `.env` uses `localhost` for running Prisma CLI tools (migrations, seed) on your host machine. The docker-compose `app` service overrides it to `db:5432` internally.

---

## Common Workflows

### First-time setup

```bash
# 1. Copy and configure environment
cp .env.example .env
# Edit .env — set NEXTAUTH_SECRET (openssl rand -base64 32)

# 2. Start all services
docker compose up -d

# 3. Wait for db to be healthy, then migrate
docker compose exec app npm run db:migrate

# 4. Seed test data
docker compose exec app npm run db:seed

# 5. Open the app
open http://localhost:3000
```

### Daily development start

```bash
docker compose up -d
# App is ready at http://localhost:3000
```

### Daily development stop

```bash
docker compose down        # Stops containers, data preserved
```

### After pulling new migrations

```bash
docker compose up -d
docker compose exec app npm run db:migrate
```

### Rebuilding the app image

Run this after changes to `package.json`, `Dockerfile`, or `prisma/schema.prisma`:

```bash
docker compose build app
docker compose up -d
```

Or using the npm alias:
```bash
npm run docker:build
npm run docker:up
```

---

## Database Operations

All `prisma` CLI commands can be run either:
1. **On your host** — with the `db` container running and `DATABASE_URL=postgresql://...@localhost:5432/...`
2. **Inside the `app` container** — with `docker compose exec app <command>`

### Migrations

```bash
# Apply pending migrations (creates tables if they don't exist)
npm run db:migrate
# or inside container:
docker compose exec app npm run db:migrate
```

### Seeding

```bash
# Insert baseline test data
npm run db:seed
# or inside container:
docker compose exec app npm run db:seed
```

### Reset (local dev only — DESTRUCTIVE)

```bash
# Drops all tables, re-applies all migrations from scratch, re-seeds
# ⚠️ ALL LOCAL DATA WILL BE DELETED
npm run db:reset
```

### Connecting directly to PostgreSQL

```bash
# Open psql in the running container
docker compose exec db psql -U medeasy_dev -d medeasy_db

# One-off query
docker compose exec db psql -U medeasy_dev -d medeasy_db -c "SELECT COUNT(*) FROM \"User\";"
```

### Prisma Studio (visual browser)

```bash
npm run db:studio
# Opens at http://localhost:5555
```

---

## Production Build

The production Dockerfile uses a multi-stage build to produce a minimal image:

```
Stage 1: base    — Node.js 20-slim + OpenSSL
Stage 2: deps    — npm ci (all dependencies)
Stage 3: builder — Prisma generate + Next.js build
Stage 4: runner  — Minimal runtime image (non-root user)
Stage 5: dev     — Local development (used by docker-compose)
```

### Build and run production image

```bash
# Build (uses the 'runner' target)
docker build -t medeasy:prod --target runner .

# Run with runtime secrets
docker run \
  -p 3000:3000 \
  -e NODE_ENV=production \
  -e DATABASE_URL="postgresql://user:pass@your-db-host:5432/medeasy?schema=public" \
  -e NEXTAUTH_URL="https://your-production-domain.com" \
  -e NEXTAUTH_SECRET="your-production-secret-at-least-32-chars" \
  -e GCP_PROJECT_ID="your-gcp-project" \
  -e GCP_CLIENT_EMAIL="your-service-account@project.iam.gserviceaccount.com" \
  -e GCP_STORAGE_BUCKET="your-bucket-name" \
  medeasy:prod
```

> **Never bake production secrets into the Docker image.** Always pass them at runtime via `-e`, Docker secrets, or your orchestrator's secret manager (e.g., GCP Secret Manager, Kubernetes Secrets).

### Next.js standalone output

The production image uses Next.js `output: 'standalone'` mode. Ensure your `next.config.*` has:

```js
// next.config.js or next.config.ts
const nextConfig = {
  output: 'standalone',
  // ...
};
```

If this is not set, the `runner` stage (`CMD ["node", "server.js"]`) will not work. Use `CMD ["npm", "start"]` as a fallback.

---

## Troubleshooting

### PostgreSQL container fails to start

```bash
# Check container logs
docker compose logs db

# Common cause: port 5432 already in use by a local PostgreSQL install
# Fix: stop the local service or change the host port mapping in docker-compose.yml
#   ports:
#     - "5433:5432"   # use host port 5433 instead
# Then update DATABASE_URL in .env to use port 5433
```

### "Cannot connect to database" from Next.js

```bash
# Check db is healthy
docker compose ps

# If status is not "healthy", check logs
docker compose logs db

# Verify the DATABASE_URL matches the db service
# Inside docker compose the hostname must be "db", not "localhost"
docker compose exec app printenv DATABASE_URL
```

### Prisma client is out of date

```bash
npm run db:generate
# or inside container:
docker compose exec app npm run db:generate
```

### Hot-reload not working in Docker

The `app` service mounts your source code via `- .:/app`. If hot-reload breaks:

```bash
# Restart just the app service
docker compose restart app

# Or rebuild and restart
docker compose up -d --build app
```

### Completely reset the local environment

```bash
# ⚠️ DESTRUCTIVE — removes all containers AND the postgres_data volume
docker compose down -v

# Then start fresh
docker compose up -d
docker compose exec app npm run db:migrate
docker compose exec app npm run db:seed
```

### View resource usage

```bash
docker stats medeasy_app medeasy_db
```
