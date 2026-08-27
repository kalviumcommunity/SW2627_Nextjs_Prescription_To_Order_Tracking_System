# MedEasy: Prescription-to-Order Tracking System

## Project Description
MedEasy is a role-based prescription-to-order tracking system designed to streamline communication and tracking across Doctors, Pharmacies, Patients, and Admins.

## Stack
- **Framework:** Next.js App Router
- **Language:** TypeScript
- **Authentication:** Auth.js / NextAuth.js
- **ORM:** Prisma
- **Database:** PostgreSQL
- **Containerization:** Docker
- **CI/CD:** GitHub Actions
- **Infrastructure:** GCP Cloud Run, GCP Cloud Storage

## Local Setup
1. Clone the repository.
2. Ensure you have **Node.js 20+** and **Docker Desktop** installed.
3. Copy `.env.example` to `.env` and fill in your local values:
   ```bash
   cp .env.example .env
   ```
4. Start the PostgreSQL database container:
   ```bash
   docker compose up -d
   ```
5. Install dependencies:
   ```bash
   npm install
   ```
6. Run database migrations:
   ```bash
   npm run db:migrate
   ```
7. Seed the database with initial test data:
   ```bash
   npm run db:seed
   ```
8. Start the development server:
   ```bash
   npm run dev
   ```

## Database Development Workflow

Standardized npm scripts are available for managing the local development database:

| Command | Action | Description |
|---|---|---|
| `npm run db:migrate` | Apply migrations | Creates & applies schema migrations to your local database and regenerates the Prisma client. |
| `npm run db:seed` | Seed database | Seeds the database with baseline test data, roles, users, and prescription scenarios. |
| `npm run db:reset` | Reset database | **Destructive (Local Dev Only)** Drops all tables, re-applies migrations from scratch, and re-seeds data. |
| `npm run db:studio` | Visual data browser | Launches Prisma Studio UI at `http://localhost:5555` to inspect and edit database records. |
| `npm run db:generate` | Generate client | Generates the Prisma Client TypeScript types based on `schema.prisma`. |
| `npm run db:validate` | Validate schema | Validates the syntax and relations within `schema.prisma`. |

### Step-by-Step Developer Workflow

1. **Start PostgreSQL Container**
   ```bash
   docker compose up -d
   ```
2. **Apply Migrations**
   ```bash
   npm run db:migrate
   ```
3. **Seed the Database**
   ```bash
   npm run db:seed
   ```
4. **Inspect Data in Prisma Studio**
   ```bash
   npm run db:studio
   ```
5. **Reset the Development Database (When Needed)**
   > ⚠️ **CAUTION: LOCAL DEVELOPMENT ONLY**
   > `npm run db:reset` completely destroys and recreates the local database schema. All local records will be deleted. Never use reset in production or staging environments.
   ```bash
   npm run db:reset
   ```
6. **Re-seed Data**
   `npm run db:reset` automatically triggers seeding upon completing migration reset. You can also re-run seeding manually at any point:
   ```bash
   npm run db:seed
   ```

## Database Setup (Docker)
We use Docker Compose to provide a consistent PostgreSQL environment for local development.

**Docker Commands:**
- `docker compose up -d`: Start the database in the background.
- `docker compose ps`: Check the status of the database container.
- `docker compose logs`: View database logs.
- `docker compose down`: Stop and remove the database container (data is preserved in a volume).

*To stop the database without removing the container, you can run `docker stop medeasy_db` (or stop it from Docker Desktop).*
*To restart it, run `docker start medeasy_db`.*

## Development Commands
- `npm run dev`: Start the local development server.
- `npm run build`: Build the application for production.
- `npm start`: Start the production server locally.
- `npm run lint`: Run ESLint checks.

## Team Workflow
1. Create a feature branch off `main` (e.g., `feature/short-description`).
2. Make your changes and commit with clear, descriptive messages.
3. Open a Pull Request targeting the `main` branch.
4. Fill out the Pull Request template entirely.
5. Ensure all CI checks (lint, build) pass.
6. Request a review from team members before merging.