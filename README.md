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
   npx prisma migrate dev
   ```
7. Start the development server:
   ```bash
   npm run dev
   ```

## Database Setup (Local)
We use Docker Compose to provide a consistent PostgreSQL environment for local development.

**Commands:**
- `docker compose up -d`: Start the database in the background.
- `docker compose ps`: Check the status of the database container.
- `docker compose logs postgres`: View database logs.
- `docker compose down`: Stop and remove the database container (data is preserved in a volume).
- `npx prisma migrate dev`: Apply all pending migrations.
- `npx prisma studio`: Open Prisma visual data browser.

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