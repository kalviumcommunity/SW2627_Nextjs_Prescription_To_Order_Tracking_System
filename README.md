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
2. Ensure you have Node.js 20+ installed.
3. Copy `.env.example` to `.env.local` and populate it with your local development variables.
4. Run `npm install` to install dependencies.
5. (Database setup instructions to be added in future PRs).

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