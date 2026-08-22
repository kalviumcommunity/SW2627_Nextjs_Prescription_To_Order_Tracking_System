# MedEasy Prescription-to-Order Tracking System

MedEasy is a web application for managing prescriptions, converting approved prescriptions into medicine orders, and tracking each order through fulfilment.

## Tech Stack

- Next.js (App Router)
- TypeScript
- Auth.js / NextAuth.js
- Prisma
- PostgreSQL
- Docker
- GitHub Actions
- Google Cloud Run
- Google Cloud Storage

## Local Setup

1. Clone the repository and enter the project directory:

   ```bash
   git clone https://github.com/kalviumcommunity/SW2627_Nextjs_Prescription_To_Order_Tracking_System.git
   cd SW2627_Nextjs_Prescription_To_Order_Tracking_System
   ```

2. Install dependencies:

   ```bash
   npm install
   ```

3. Create your local environment file and update its values as needed:

   ```bash
   cp .env.example .env.local
   ```

4. Start the development server:

   ```bash
   npm run dev
   ```

## Development Commands

```bash
npm run dev
npm run lint
npm run build
npm start
```

## Team Workflow

1. Pull the latest changes from `main`.
2. Create a focused branch for the assigned task.
3. Implement only the changes required for that task.
4. Run lint and production build checks locally.
5. Commit with a clear, conventional message.
6. Push the branch and open a pull request targeting `main`.
7. Merge only after review and all CI checks pass.
