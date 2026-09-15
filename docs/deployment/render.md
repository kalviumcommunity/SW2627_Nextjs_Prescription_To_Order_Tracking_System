# Render Deployment Guide

This guide deploys MedEasy as a Render Docker web service with a managed Render PostgreSQL database.

## 1. Create the database

In Render, create a **PostgreSQL** database in the same region as the web service.

Copy its **Internal Database URL**. Use the internal URL for `DATABASE_URL`; it avoids routing database traffic over the public internet.

Do not use the local Docker Compose database in production. Render services are separate from your computer and from Docker Compose.

## 2. Create the web service

Create a new **Web Service** from the GitHub repository and select:

| Setting | Value |
|---|---|
| Runtime | `Docker` |
| Dockerfile path | `./Dockerfile` |
| Docker build context | `.` |
| Branch | Your production branch, usually `main` |
| Region | Same as the PostgreSQL database |
| Health check path | `/api/health/db` |

Render injects the `PORT` variable. The production image already listens on `0.0.0.0` and honors that port.

Set this command in **Pre-Deploy Command**:

```text
npx prisma migrate deploy
```

This runs committed migrations before the new web service instance starts. Never use `prisma migrate reset` or `prisma db push` in production.

## 3. Required environment variables

Add these under the web service's **Environment** tab. Keep them as secret values and do not commit them.

| Variable | Value |
|---|---|
| `NODE_ENV` | `production` |
| `DATABASE_URL` | Render PostgreSQL **Internal Database URL** |
| `NEXTAUTH_URL` | Your public Render URL, for example `https://medeasy.onrender.com` |
| `NEXTAUTH_SECRET` | A new random value with at least 32 characters |

Generate the auth secret locally with:

```bash
openssl rand -base64 32
```

After adding a custom domain, update `NEXTAUTH_URL` to the custom HTTPS URL and redeploy.

Render provides `PORT`, so do not hard-code a different port in the Render environment.

## 4. Optional Google Cloud Storage variables

The application stores uploaded prescription documents in its in-memory/local fallback when GCS is not configured. That fallback is not suitable for production because files are lost when a Render instance is replaced.

For persistent prescription documents, create a private Google Cloud Storage bucket and add:

| Variable | Value |
|---|---|
| `GCP_PROJECT_ID` | Google Cloud project ID |
| `GCP_CLIENT_EMAIL` | Service account email |
| `GCP_PRIVATE_KEY` | Service account private key; preserve `\\n` line breaks in the Render value |
| `GCP_STORAGE_BUCKET` | Private GCS bucket name |

Grant the service account object read/write permissions on that bucket, such as **Storage Object User**. Do not make the bucket public and do not commit a service-account JSON file.

## 5. First deployment checklist

1. Push the repository, including `prisma/migrations`, to GitHub.
2. Create the Render PostgreSQL database.
3. Create the Docker web service using the settings above.
4. Add the required variables and deploy.
5. Confirm `https://YOUR-RENDER-DOMAIN/api/health/db` returns a connected/ok response.
6. Open `/login` and test login, registration, and prescription upload.

## 6. Seeding production data

The seed script deletes existing rows before inserting demo data. Do not run it against a production database unless you intentionally want to erase and replace the data.

For a fresh demo database only, run it as a one-off Render shell command:

```text
npx prisma db seed
```

Use a separate staging database for demonstrations and testing.

## Troubleshooting

- **Build fails:** verify the repository contains `package-lock.json` and `prisma/schema.prisma`.
- **Migration fails:** check that `DATABASE_URL` is the database's Internal Database URL and that the database is available.
- **Auth redirects incorrectly:** set `NEXTAUTH_URL` to the exact public HTTPS origin, without a trailing slash.
- **Uploads disappear:** configure the GCS variables; Render's local filesystem is ephemeral.
- **Health check returns 503:** inspect the web service logs and validate `DATABASE_URL` first.