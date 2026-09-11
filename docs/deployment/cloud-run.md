# MedEasy — Google Cloud Run Production Deployment Guide (Day 19)

This runbook details the end-to-end production deployment process for the **MedEasy Prescription-to-Order Tracking System** to **Google Cloud Run** using **Artifact Registry**, **Cloud SQL for PostgreSQL 15**, and **Google Cloud Secret Manager**.

---

## Table of Contents

1. [GCP Architecture Overview](#1-gcp-architecture-overview)
2. [Prerequisites & GCP Resources](#2-prerequisites--gcp-resources)
3. [Artifact Registry Setup & Image Naming](#3-artifact-registry-setup--image-naming)
4. [Container Image Build & Verification](#4-container-image-build--verification)
5. [Database Architecture & Cloud SQL](#5-database-architecture--cloud-sql)
6. [Secrets Management (Secret Manager)](#6-secrets-management-secret-manager)
7. [Runtime Environment Variables](#7-runtime-environment-variables)
8. [Prisma Production Migration Strategy](#8-prisma-production-migration-strategy)
9. [Deploying to Google Cloud Run](#9-deploying-to-google-cloud-run)
10. [Cloud Run Authentication & RBAC Boundary](#10-cloud-run-authentication--rbac-boundary)
11. [Production Health & Smoke Verification](#11-production-health--smoke-verification)
12. [Rollback & Redeployment Runbook](#12-rollback--redeployment-runbook)

---

## 1. GCP Architecture Overview

```
                               ┌────────────────────────────────────────────────────────────┐
                               │                    Google Cloud Platform                   │
                               │                                                            │
[End Users / Care Team]        │  ┌──────────────────────────────────────────────────────┐  │
          │                    │  │                   Cloud Run Service                  │  │
          │ HTTPS (Port 443)   │  │   ┌──────────────────────────────────────────────┐   │  │
          ▼                    │  │   │   MedEasy Production Container               │   │  │
┌──────────────────────────┐   │  │   │   • Node 20 Debian Slim (non-root 'nextjs')  │   │  │
│ Cloud Run URL            │───┼──┼──▶│   • Next.js Standalone (node server.js)      │   │  │
│ https://[SERVICE].run.app│   │  │   │   • Listens on dynamic $PORT (default 8080)  │   │  │
└──────────────────────────┘   │  │   └──────────────────────▲───────────────────────┘   │  │
                               │  └──────────┬───────────────┼───────────────────────────┘  │
                               │             │               │                              │
                               │             │ VPC /         │ Secrets Injection            │
                               │             │ Cloud SQL Auth│ at boot                      │
                               │             ▼               ▼                              │
                               │  ┌────────────────────┐   ┌─────────────────────────────┐  │
                               │  │ Cloud SQL          │   │ Secret Manager              │  │
                               │  │ • PostgreSQL 15    │   │ • DATABASE_URL              │  │
                               │  │ • Managed Storage  │   │ • NEXTAUTH_SECRET           │  │
                               │  │ • Automated Backup │   │ • GCP Service Account Keys  │  │
                               │  └────────────────────┘   └─────────────────────────────┘  │
                               └────────────────────────────────────────────────────────────┘
```

---

## 2. Prerequisites & GCP Resources

### Required GCP Services & APIs

Enable the required GCP APIs before starting deployment:

```bash
gcloud services enable \
  run.googleapis.com \
  artifactregistry.googleapis.com \
  secretmanager.googleapis.com \
  sqladmin.googleapis.com \
  cloudbuild.googleapis.com
```

### Resource Inventory

| Resource Type | Name / Identifier | Purpose |
|---|---|---|
| **Artifact Registry** | `medeasy-repo` | Container image repository |
| **Cloud Run Service** | `medeasy-prod` | Serverless container hosting |
| **Cloud SQL Instance**| `medeasy-db-prod` | External managed PostgreSQL 15 |
| **Secret Manager**    | `medeasy-db-url`, `medeasy-auth-secret` | Encrypted production credentials |
| **Cloud Storage**     | `medeasy-rx-documents-[PROJECT_ID]` | Prescription document PDF/image storage |
| **Service Account**   | `medeasy-run-sa@[PROJECT_ID].iam.gserviceaccount.com` | Least-privilege runtime identity |

---

## 3. Artifact Registry Setup & Image Naming

Artifact Registry replaces Google Container Registry (GCR) and provides secure, regional image storage.

### Standard Image Path Format

```
LOCATION-docker.pkg.dev/PROJECT_ID/REPOSITORY/IMAGE:TAG
```

- **`LOCATION`**: Target GCP region (e.g., `us-central1`, `asia-south1`, `europe-west1`).
- **`PROJECT_ID`**: Your active GCP Project ID.
- **`REPOSITORY`**: The Artifact Registry repository name (`medeasy-repo`).
- **`IMAGE`**: Image identifier (`medeasy`).
- **`TAG`**: Immutable deployment tag (e.g., Git commit SHA `fc29c75` or semver `v1.0.0`).

### Repository Creation & Docker Authentication

```bash
# Set your environment variables
export PROJECT_ID="your-gcp-project-id"
export REGION="us-central1"
export REPO="medeasy-repo"
export IMAGE="medeasy"
export TAG="$(git rev-parse --short HEAD)"

# 1. Create Docker repository in Artifact Registry (if not already existing)
gcloud artifacts repositories create $REPO \
  --repository-format=docker \
  --location=$REGION \
  --description="MedEasy Production Container Repository"

# 2. Configure Docker client authentication
gcloud auth configure-docker ${REGION}-docker.pkg.dev
```

---

## 4. Container Image Build & Verification

MedEasy uses a multi-stage `Dockerfile` with the `runner` stage optimized for Cloud Run:
- **Base image**: `node:20-slim` with OpenSSL.
- **User**: Hardened non-root user (`nextjs:nodejs`, UID 1001).
- **Execution**: Standalone Next.js server (`node server.js`).
- **Port handling**: Listens on `PORT=8080` by default and dynamically honors `$PORT` injected by Cloud Run.

### Step 1: Build the Production Image

```bash
# Build image targeting the production 'runner' stage
docker build \
  --target runner \
  -t ${REGION}-docker.pkg.dev/${PROJECT_ID}/${REPO}/${IMAGE}:${TAG} \
  -t ${REGION}-docker.pkg.dev/${PROJECT_ID}/${REPO}/${IMAGE}:latest \
  .
```

### Step 2: Push Image to Artifact Registry

```bash
docker push ${REGION}-docker.pkg.dev/${PROJECT_ID}/${REPO}/${IMAGE}:${TAG}
docker push ${REGION}-docker.pkg.dev/${PROJECT_ID}/${REPO}/${IMAGE}:latest
```

---

## 5. Database Architecture & Cloud SQL

> [!IMPORTANT]
> **PostgreSQL MUST be external to Cloud Run.**
> Cloud Run instances are stateless and ephemeral. Containers scale to zero and recycle automatically. Never run a database engine inside Cloud Run.

### Cloud SQL Instance Setup

```bash
# Create PostgreSQL 15 instance
gcloud sql instances create medeasy-db-prod \
  --database-version=POSTGRES_15 \
  --tier=db-custom-2-7680 \
  --region=$REGION \
  --storage-auto-increase \
  --backup-start-time=02:00

# Create production database
gcloud sql databases create medeasy_prod --instance=medeasy-db-prod

# Create application database user
gcloud sql users create medeasy_app_user \
  --instance=medeasy-db-prod \
  --password="GENERATE_STRONG_DATABASE_PASSWORD"
```

### Connection String Formats

1. **Via Cloud SQL Unix Socket (Recommended for Cloud Run)**:
   ```
   postgresql://medeasy_app_user:DB_PASSWORD@localhost/medeasy_prod?host=/cloudsql/PROJECT_ID:REGION:medeasy-db-prod
   ```
2. **Via Private IP / VPC Connector**:
   ```
   postgresql://medeasy_app_user:DB_PASSWORD@10.x.x.x:5432/medeasy_prod?schema=public
   ```

---

## 6. Secrets Management (Secret Manager)

Never commit production credentials to Git or embed them in Docker images. Store them in GCP Secret Manager and mount them directly as environment variables into Cloud Run.

### Create Secrets in Secret Manager

```bash
# 1. Store DATABASE_URL
echo -n "postgresql://medeasy_app_user:STRONG_PASSWORD@localhost/medeasy_prod?host=/cloudsql/${PROJECT_ID}:${REGION}:medeasy-db-prod" | \
  gcloud secrets create medeasy-database-url --data-file=-

# 2. Store NEXTAUTH_SECRET (32+ bytes random base64 string)
openssl rand -base64 32 | tr -d '\n' | \
  gcloud secrets create medeasy-auth-secret --data-file=-
```

### Grant Access to Cloud Run Runtime Identity

```bash
# Cloud Run Service Account
export RUN_SA="medeasy-run-sa@${PROJECT_ID}.iam.gserviceaccount.com"

# Grant Secret Accessor role
gcloud secrets add-iam-policy-binding medeasy-database-url \
  --member="serviceAccount:${RUN_SA}" \
  --role="roles/secretmanager.secretAccessor"

gcloud secrets add-iam-policy-binding medeasy-auth-secret \
  --member="serviceAccount:${RUN_SA}" \
  --role="roles/secretmanager.secretAccessor"
```

---

## 7. Runtime Environment Variables

Cloud Run configuration clearly separates non-sensitive environment variables from encrypted secrets.

### Variable Classification

| Variable | Category | Source | Example / Value |
|---|---|---|---|
| `NODE_ENV` | Normal Config | Cloud Run env flag | `production` |
| `NEXT_TELEMETRY_DISABLED` | Normal Config | Cloud Run env flag | `1` |
| `PORT` | Normal Config | Cloud Run automatic | `8080` |
| `HOSTNAME` | Normal Config | Container runtime | `0.0.0.0` |
| `NEXTAUTH_URL` | Normal Config | Cloud Run env flag | `https://medeasy-prod-[HASH].run.app` |
| `GCP_PROJECT_ID` | Normal Config | Cloud Run env flag | `${PROJECT_ID}` |
| `GCP_STORAGE_BUCKET` | Normal Config | Cloud Run env flag | `medeasy-rx-docs-${PROJECT_ID}` |
| `DATABASE_URL` | **Sensitive Secret** | Secret Manager | `medeasy-database-url:latest` |
| `NEXTAUTH_SECRET` | **Sensitive Secret** | Secret Manager | `medeasy-auth-secret:latest` |
| `GCP_CLIENT_EMAIL` | Optional Secret | Secret Manager / Default SA | Auto-resolved in GCP |
| `GCP_PRIVATE_KEY` | Optional Secret | Secret Manager / Default SA | Auto-resolved in GCP |

---

## 8. Prisma Production Migration Strategy

> [!CAUTION]
> **NEVER run `prisma migrate dev` or `prisma migrate reset` against production.**
> `migrate reset` drops all tables and destroys production patient/order records.

### Safe Production Migration Rules
1. Always apply schema changes using **`npx prisma migrate deploy`** (or `npm run db:migrate:deploy`).
2. Run migrations **before** traffic is routed to the new Cloud Run revision.
3. Verify status with **`npm run db:migrate:status`** (`npx prisma migrate status`).

### Recommended Migration Pipeline Options

#### Option A: Run Migration as a Cloud Run Job (Automated)
```bash
# Create migration job
gcloud run jobs create medeasy-migrate \
  --image=${REGION}-docker.pkg.dev/${PROJECT_ID}/${REPO}/${IMAGE}:${TAG} \
  --region=$REGION \
  --set-cloudsql-instances=${PROJECT_ID}:${REGION}:medeasy-db-prod \
  --set-secrets="DATABASE_URL=medeasy-database-url:latest" \
  --command="npx" \
  --args="prisma,migrate,deploy"

# Execute migration job before deployment
gcloud run jobs execute medeasy-migrate --region=$REGION --wait
```

#### Option B: Run Migration via CI/CD (Cloud Build / GitHub Actions)
Execute `npm run db:migrate:deploy` with the Cloud SQL Auth Proxy active.

---

## 9. Deploying to Google Cloud Run

### Complete Deployment Command

```bash
gcloud run deploy medeasy-prod \
  --image=${REGION}-docker.pkg.dev/${PROJECT_ID}/${REPO}/${IMAGE}:${TAG} \
  --platform=managed \
  --region=$REGION \
  --allow-unauthenticated \
  --add-cloudsql-instances=${PROJECT_ID}:${REGION}:medeasy-db-prod \
  --service-account=${RUN_SA} \
  --set-env-vars="NODE_ENV=production,NEXT_TELEMETRY_DISABLED=1,GCP_PROJECT_ID=${PROJECT_ID},GCP_STORAGE_BUCKET=medeasy-rx-docs-${PROJECT_ID}" \
  --set-secrets="DATABASE_URL=medeasy-database-url:latest,NEXTAUTH_SECRET=medeasy-auth-secret:latest" \
  --cpu=1 \
  --memory=1Gi \
  --min-instances=1 \
  --max-instances=10 \
  --port=8080
```

### Production URL

Once deployment completes, Cloud Run assigns a secure HTTPS URL:
```
https://medeasy-prod-[hash]-[region].a.run.app
```

Update `NEXTAUTH_URL` to match this production domain:
```bash
gcloud run services update medeasy-prod \
  --region=$REGION \
  --update-env-vars="NEXTAUTH_URL=https://medeasy-prod-[hash]-[region].a.run.app"
```

---

## 10. Cloud Run Authentication & RBAC Boundary

- **Public Cloud Run Invocation (`--allow-unauthenticated`)**:
  Allows standard web browsers and authorized client applications to reach MedEasy's HTTPS endpoint.
- **Application-Level Security**:
  All route authorization and role-based access control (RBAC) remains strictly enforced inside MedEasy:
  - Unauthenticated requests to `/api/admin/*`, `/api/doctor/*`, `/api/pharmacy/*`, `/api/patient/*` return **HTTP 401 Unauthorized**.
  - Cross-role privilege escalation attempts return **HTTP 403 Forbidden**.
  - Patient horizontal isolation (accessing another patient's records) returns **HTTP 404 Not Found**.

---

## 11. Production Health & Smoke Verification

Use the built-in automated smoke test script to verify production health without risking clinical data integrity:

```bash
# Run against the live Cloud Run production endpoint
npm run test:smoke https://medeasy-prod-[hash]-[region].a.run.app
```

### Verification Checklist

- [x] **Landing & Auth Pages**: `/`, `/login`, `/register/patient`, `/register/doctor`, `/forgot-password` return HTTP 200.
- [x] **Database Connectivity**: `/api/health/db` returns `{"status":"ok","database":"connected"}`.
- [x] **401 API Guards**: Protected APIs reject unauthenticated access.
- [x] **Secret Leakage Prevention**: Responses assert that no database credentials, private keys, or password hashes are leaked.
- [x] **RBAC Matrix**: Verify access with standard test accounts.

---

## 12. Rollback & Redeployment Runbook

### Immediate Zero-Downtime Rollback

If a new revision causes unexpected behavior, instantly shift 100% of production traffic back to the previous known-good revision:

```bash
# 1. List revisions
gcloud run revisions list --service=medeasy-prod --region=$REGION

# 2. Revert traffic to stable revision
gcloud run services update-traffic medeasy-prod \
  --region=$REGION \
  --to-revisions=medeasy-prod-00042-xyz=100
```

### Gradual Canary Traffic Shifting

For high-confidence deployments, route 10% of traffic to the new revision before committing:

```bash
gcloud run services update-traffic medeasy-prod \
  --region=$REGION \
  --to-revisions=medeasy-prod-NEW=10,medeasy-prod-OLD=90
```
