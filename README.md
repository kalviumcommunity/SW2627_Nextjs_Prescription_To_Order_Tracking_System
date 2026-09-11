# MedEasy: Prescription-to-Order Tracking System

MedEasy is a role-based prescription-to-order tracking system designed to streamline communication and tracking across Doctors, Pharmacies, Patients, and Admins.

## Stack

| Layer | Technology |
|---|---|
| Framework | Next.js 14 (App Router) |
| Language | TypeScript |
| Authentication | Auth.js / NextAuth.js v4 |
| ORM | Prisma |
| Database | PostgreSQL 15 |
| Containerization | Docker / Docker Compose |
| CI/CD | GitHub Actions |
| Infrastructure | GCP Cloud Run, GCP Cloud Storage |

---

## Prerequisites

Before starting, ensure you have the following installed:

- **Node.js 20+** — [nodejs.org](https://nodejs.org)
- **npm 10+** (bundled with Node 20)
- **Docker Desktop** — [docs.docker.com/get-docker](https://docs.docker.com/get-docker/)
- **Git**

---

## Environment Variables

Copy the example file and fill in your local values:

```bash
cp .env.example .env
```

| Variable | Description | Example |
|---|---|---|
| `NODE_ENV` | Runtime environment | `development` |
| `POSTGRES_USER` | PostgreSQL username | `medeasy_dev` |
| `POSTGRES_PASSWORD` | PostgreSQL password | `change_me_local_dev_only` |
| `POSTGRES_DB` | PostgreSQL database name | `medeasy_db` |
| `DATABASE_URL` | Prisma connection string | `postgresql://...@localhost:5432/medeasy_db` |
| `NEXTAUTH_URL` | Full URL of your application | `http://localhost:3000` |
| `NEXTAUTH_SECRET` | Random secret for JWT signing | Run `openssl rand -base64 32` |
| `GCP_PROJECT_ID` | GCP project (leave empty locally) | — |
| `GCP_CLIENT_EMAIL` | GCP service account email | — |
| `GCP_PRIVATE_KEY` | GCP private key | — |
| `GCP_STORAGE_BUCKET` | GCP storage bucket name | — |

> **Generate `NEXTAUTH_SECRET`:**
> ```bash
> openssl rand -base64 32
> ```

---

## Docker Setup

Docker Compose provides a consistent local environment. The setup includes:
- **`db`** — PostgreSQL 15 (persists data in the `postgres_data` named volume)
- **`app`** — Next.js development server with hot-reload

### Starting and stopping

```bash
# Start all services (database + Next.js app) in the background
docker compose up -d

# Start only the database (run Next.js on host with npm run dev)
docker compose up -d db

# View live logs
docker compose logs -f

# View logs for a specific service
docker compose logs -f app
docker compose logs -f db

# Check service status
docker compose ps

# Stop all services (data is PRESERVED in the postgres_data volume)
docker compose down
```

> ⚠️ **WARNING — Data destruction:**
> `docker compose down` alone is **safe** — it stops containers but keeps the `postgres_data` volume intact.
> Only run the command below if you intentionally want to **wipe all database data**:
> ```bash
> docker compose down -v   # DESTRUCTIVE — deletes the postgres_data volume
> ```

### Convenience npm aliases

```bash
npm run docker:up      # docker compose up -d
npm run docker:down    # docker compose down
npm run docker:logs    # docker compose logs -f
npm run docker:build   # docker compose build
```

---

## Database Setup

These commands assume PostgreSQL is running (via Docker or locally).

### Prisma scripts reference

| Command | Action | Notes |
|---|---|---|
| `npm run db:migrate` | Apply migrations | Creates & applies schema migrations; regenerates Prisma client |
| `npm run db:seed` | Seed database | Inserts baseline roles, users, and prescription scenarios |
| `npm run db:reset` | Reset database | ⚠️ **Destructive (local dev only)** — drops all tables, re-migrates, re-seeds |
| `npm run db:studio` | Prisma Studio | Opens visual DB browser at `http://localhost:5555` |
| `npm run db:generate` | Generate client | Regenerates Prisma Client TypeScript types |
| `npm run db:validate` | Validate schema | Validates `schema.prisma` syntax and relations |

### Step-by-step first-time setup

```bash
# 1. Start the database
docker compose up -d db

# 2. Apply all migrations
npm run db:migrate

# 3. Seed with test data
npm run db:seed

# 4. (Optional) Inspect data in Prisma Studio
npm run db:studio
```

### Resetting the database (local dev only)

> ⚠️ **CAUTION — LOCAL DEVELOPMENT ONLY**
> The reset command drops all tables, re-applies migrations from scratch, and re-seeds. All local records will be deleted. **Never run reset in production or staging.**

```bash
npm run db:reset
```

---

## Local Development

### Option A: Host Next.js + Docker database (recommended)

Best for day-to-day development with the fastest hot-reload:

```bash
# 1. Start PostgreSQL
docker compose up -d db

# 2. Install dependencies
npm install

# 3. Apply migrations & seed (first time or after schema changes)
npm run db:migrate
npm run db:seed

# 4. Start Next.js on your host
npm run dev
```

App is available at **http://localhost:3000**

### Option B: Full stack via Docker Compose

Runs both Next.js and PostgreSQL in containers. Requires a `.env` file in the project root.

```bash
# 1. Ensure .env exists
cp .env.example .env   # then edit NEXTAUTH_SECRET

# 2. Start all services
docker compose up -d

# 3. Run migrations against the containerized database
docker compose exec app npm run db:migrate

# 4. Seed data
docker compose exec app npm run db:seed
```

App is available at **http://localhost:3000**

---

## Running Tests

MedEasy uses custom integration test scripts located in the `scripts/` directory. Run them with a live database.

```bash
# Authentication flows
npm run test:auth
npm run test:authz

# API error handling
npm run test:api-errors

# Doctor APIs
npm run test:doctor
npm run test:doctor:create
npm run test:doctor:analytics
npm run test:doctor-integration

# Pharmacy APIs
npm run test:pharmacy
npm run test:pharmacy-fulfillment
npm run test:pharmacy-day13
npm run test:pharmacy-integration

# Patient & Admin APIs
npm run test:patient
npm run test:admin
npm run test:admin:frontend

# Navigation & UI
npm run test:nav
npm run test:day9
npm run test:day16-ui
npm run test:day16-regression
```

> All test scripts require the database to be running and seeded. Run `npm run db:seed` first.

---

## Production Docker Build

```bash
# Build the production image
docker build -t medeasy:prod --target runner .

# Run the production container
docker run \
  -p 3000:3000 \
  -e DATABASE_URL="postgresql://user:pass@host:5432/medeasy_db?schema=public" \
  -e NEXTAUTH_URL="https://your-domain.com" \
  -e NEXTAUTH_SECRET="your-production-secret" \
  medeasy:prod
```

> Production secrets must be passed at runtime via `-e` flags or an orchestrator secrets manager. Never bake secrets into the image.

---

## Application Commands

```bash
npm run dev      # Start local development server
npm run build    # Build for production
npm start        # Start production server locally
npm run lint     # Run ESLint checks
```

---

## Team Workflow

1. Create a feature branch off `main` (e.g., `feature/short-description`).
2. Make your changes and commit with clear, descriptive messages.
3. Open a Pull Request targeting the `main` branch.
4. Fill out the Pull Request template entirely.
5. Ensure all CI checks (lint, build) pass.
6. Request a review from team members before merging.

For detailed Docker operations and troubleshooting, see [docs/DOCKER.md](docs/DOCKER.md).
For Google Cloud Run production deployment, see [docs/deployment/cloud-run.md](docs/deployment/cloud-run.md).
