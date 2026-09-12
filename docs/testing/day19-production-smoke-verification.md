# MedEasy Day 19 — Production Deployment Verification & Smoke Testing

## Overview & Scope
- **Module**: MedEasy Day 19 Production Deployment & Smoke Verification
- **Target URL Tested**: `http://localhost:3000` (Local production server runtime simulating Cloud Run environment)
- **Environment**:
  - **Runtime**: Next.js 14.2.35 Standalone (`next start` / Node.js 20+)
  - **Database**: PostgreSQL 15 on Docker (`localhost:5432/medeasy`), managed by Prisma ORM 6.19.3
  - **Storage**: Google Cloud Storage (`@google-cloud/storage` v8.1.0) with scoped key generation (`rx-docs/`), IAM credential abstraction, and offline test mock store
  - **Authentication**: NextAuth.js v4 Credentials Provider with Bcrypt password hashing
- **Execution Date**: 2026-09-12
- **Result Summary**: **69 / 69 Checks Passed (100% Success)**

---

## Complete Test Case Execution Matrix

| # | Category | Test Case | Expected | Actual | Pass / Fail |
|---|---|---|---|---|---|
| 1 | **1. Cloud Run Service** | Root URL Reachability | HTTP 200 or 307 redirect to `/login` | Status 307 | **PASS** |
| 2 | **1. Cloud Run Service** | Login Page Rendering | HTTP 200 with MedEasy branding | Status 200, contains "MedEasy" | **PASS** |
| 3 | **1. Cloud Run Service** | Database Health Probe | HTTP 200 with `status='ok'` & `database='connected'` | Status 200, `data: { status: 'ok', database: 'connected' }` | **PASS** |
| 4 | **2. Authentication** | Doctor Login Authentication | Valid user object with `role='DOCTOR'` and `name='Dr. Sarah'` | Role: DOCTOR, Name: Dr. Sarah, ID: cuid | **PASS** |
| 5 | **2. Authentication** | Doctor Password Leak Prevention | User object contains zero password/hash fields | Password field present: false | **PASS** |
| 6 | **2. Authentication** | Pharmacy Login Authentication | Valid user object with `role='PHARMACY'` and `name='MedEasy Central Pharmacy'` | Role: PHARMACY, Name: MedEasy Central Pharmacy, ID: cuid | **PASS** |
| 7 | **2. Authentication** | Pharmacy Password Leak Prevention | User object contains zero password/hash fields | Password field present: false | **PASS** |
| 8 | **2. Authentication** | Patient Login Authentication | Valid user object with `role='PATIENT'` and `name='Alice Johnson'` | Role: PATIENT, Name: Alice Johnson, ID: cuid | **PASS** |
| 9 | **2. Authentication** | Patient Password Leak Prevention | User object contains zero password/hash fields | Password field present: false | **PASS** |
| 10 | **2. Authentication** | Admin Login Authentication | Valid user object with `role='ADMIN'` and `name='System Administrator'` | Role: ADMIN, Name: System Administrator, ID: cuid | **PASS** |
| 11 | **2. Authentication** | Admin Password Leak Prevention | User object contains zero password/hash fields | Password field present: false | **PASS** |
| 12 | **3. Doctor** | Doctor Dashboard Data Retrieval | Returns stats object with integer `totalPrescriptions` | Stats total prescriptions: count > 0 | **PASS** |
| 13 | **3. Doctor** | Patient Roster Retrieval | Returns linked patient roster for authenticated clinician | Linked patients count > 0 | **PASS** |
| 14 | **3. Doctor** | Prescription Document Upload | Generates unique `documentRef` prefixed with `rx-docs/` | `documentRef: rx-docs/17892...` | **PASS** |
| 15 | **3. Doctor** | Prescription Creation in DB | Prescription saved with `status=PENDING` and attached `documentRef` | Status: PENDING, documentRef matches upload | **PASS** |
| 16 | **3. Doctor** | Prescription Appears as PENDING | Newly created prescription listed in doctor's prescription ledger | Status: PENDING confirmed | **PASS** |
| 17 | **3. Doctor** | Prescription Detail View | Full clinical detail visible (diagnosis, medicines, patient info) | Diagnosis visible, documentRef attached | **PASS** |
| 18 | **3. Doctor** | Doctor Analytics Dashboard | Returns doctor-scoped prescription aggregations | Analytics summary counts retrieved | **PASS** |
| 19 | **4. Pharmacy** | Pharmacy Dashboard Metrics | Returns fulfillment metrics, pending counts, and recent queue | Metrics and pharmacyName populated | **PASS** |
| 20 | **4. Pharmacy** | Pending Queue Discovery | Newly created prescription appears in pharmacy queue | In queue: true | **PASS** |
| 21 | **4. Pharmacy** | Pharmacy Detail - Privacy Boundary | Diagnosis field STRICTLY REDACTED/omitted for pharmacy role | `diagnosis present: false` | **PASS** |
| 22 | **4. Pharmacy** | Pharmacy Detail - Document Reference | `documentRef` and `documentAvailable: true` accessible | Document reference verified | **PASS** |
| 23 | **4. Pharmacy** | Prescription Dispensing (FILL) | Status transitions to `FILLED` with `filledAt` timestamp | Status: FILLED, filledAt recorded | **PASS** |
| 24 | **4. Pharmacy** | Terminal Action (CANNOT_FILL) | Status transitions to `CANNOT_FILL` without creating a Fill row | Status: CANNOT_FILL confirmed | **PASS** |
| 25 | **4. Pharmacy** | Historical Fulfillment Ledger | Fulfilled prescription appears in historical fulfillment list | Found in history: true | **PASS** |
| 26 | **4. Pharmacy** | Pharmacy Analytics Retrieval | Returns fulfillment rate, trend buckets, and status breakdown | Fulfillment rate percentage computed | **PASS** |
| 27 | **5. Patient** | Patient Dashboard Retrieval | Returns patient profile, metrics, and prescription cards | Profile and active metrics populated | **PASS** |
| 28 | **5. Patient** | Patient Prescription List | List contains all prescriptions owned by the patient | Found: true | **PASS** |
| 29 | **5. Patient** | Patient Detail - Diagnosis Visibility | Clinical diagnosis IS visible to the owner patient | Diagnosis displayed properly | **PASS** |
| 30 | **5. Patient** | Patient Tracking - FILLED State | Timeline displays `FILLED` state and dispensing pharmacy name | Status: FILLED, Dispenser: Central Pharmacy | **PASS** |
| 31 | **5. Patient** | Patient Tracking - CANNOT_FILL State | Timeline displays `CANNOT_FILL` terminal status and message | Status: CANNOT_FILL, isCannotFill: true | **PASS** |
| 32 | **5. Patient** | Patient Tracking - PENDING State | Timeline displays `PENDING` awaiting fulfillment state | Status: PENDING, isPending: true | **PASS** |
| 33 | **6. Admin** | Admin Dashboard Aggregates | System-wide totals for prescriptions, doctors, pharmacies | Aggregates > 0 | **PASS** |
| 34 | **6. Admin** | Doctors Directory Audit | Registered clinicians directory retrieved | Doctors count > 0 | **PASS** |
| 35 | **6. Admin** | Pharmacy Status Directory | Pharmacy profile and operational status retrieved | Pharmacy verified active | **PASS** |
| 36 | **6. Admin** | Prescriptions Audit Ledger | Includes all prescriptions across clinicians and pharmacies | Contains test prescription: true | **PASS** |
| 37 | **6. Admin** | System Analytics Metrics | Platform-wide fulfillment metrics and performance breakdown | Total fulfilled count retrieved | **PASS** |
| 38 | **7. Database** | Prescription Persistence | Prescription persists across database reload/re-queries | ID & diagnosis match stored row | **PASS** |
| 39 | **7. Database** | Medicines Relation Persistence | PrescriptionMedicine rows remain linked to prescription | Medicines count >= 1 | **PASS** |
| 40 | **7. Database** | Fulfillment Persistence | Fill row persists and references prescription & pharmacy | Fill ID and pharmacyId verified | **PASS** |
| 41 | **7. Database** | Session Renewal Persistence | User re-authenticates after logout and views previously saved data | Saved prescription retrieved | **PASS** |
| 42 | **8. GCS** | Object Existence in Storage | GCS document object verified to exist in storage layer | `objectExists: true` | **PASS** |
| 43 | **8. GCS** | PostgreSQL Reference-Only Storage | PostgreSQL stores reference string only; zero binary columns | Binary columns: false, type: string | **PASS** |
| 44 | **8. GCS** | Authorized Doctor Access | Author clinician granted access to prescription document | `allowed: true` | **PASS** |
| 45 | **8. GCS** | Unauthorized Doctor Blocked | Non-author clinician blocked with 403 Forbidden | `allowed: false` | **PASS** |
| 46 | **8. GCS** | Owner Patient Access | Recipient patient granted access to prescription document | `allowed: true` | **PASS** |
| 47 | **8. GCS** | Unauthorized Patient Blocked | Stranger patient blocked with 403 Forbidden | `allowed: false` | **PASS** |
| 48 | **8. GCS** | Authorized Pharmacy Access | Pharmacy granted access to document for fulfillment operations | `allowed: true` | **PASS** |
| 49 | **8. GCS** | Admin Audit Access | Administrator granted document access for audit/compliance | `allowed: true` | **PASS** |
| 50 | **8. GCS** | No Public Storage URLs | URLs resolve via internal proxy, never raw public GCS links | Does not start with storage.googleapis.com | **PASS** |
| 51 | **9. Authorization** | Wrong Role: Patient -> Doctor | Patient blocked from doctor-only patient roster | Returns error / profile not found | **PASS** |
| 52 | **9. Authorization** | Wrong Role: Doctor -> Pharmacy Guard | Doctor blocked from pharmacy-restricted operations | Throws AuthorizationError (403) | **PASS** |
| 53 | **9. Authorization** | Patient Ownership: Cross-Access Detail | Stranger patient accessing another's prescription detail | Returns safe 404 (zero ID enumeration leaks) | **PASS** |
| 54 | **9. Authorization** | Patient Ownership: Cross-Access Tracking | Stranger patient accessing another's tracking timeline | Returns safe 404 | **PASS** |
| 55 | **9. Authorization** | Doctor Ownership: Cross-Access Detail | Stranger doctor accessing un-authored prescription detail | Returns safe 403 / 404 | **PASS** |
| 56 | **9. Authorization** | Pharmacy Fulfillment Restriction | Non-pharmacy role blocked from fulfilling prescriptions | Rejected with 404 (pharmacy profile not found) | **PASS** |
| 57 | **9. Authorization** | Admin Endpoint Restrictions | Non-admin roles strictly blocked from admin resources | Throws AuthorizationError (403) | **PASS** |
| 58 | **10. Exactly-Once** | Concurrent Race Condition Handling | 4 simultaneous fulfillment calls: 1 succeeds, 3 conflict (409) | Wins: 1, Conflicts: 3 | **PASS** |
| 59 | **10. Exactly-Once** | Database Constraint Integrity | Exactly 1 Fill row created in PostgreSQL | Fill rows count: 1 | **PASS** |
| 60 | **10. Exactly-Once** | Terminal State Mutation Block | CANNOT_FILL terminal state cannot be re-fulfilled | Rejected with HTTP 409 Conflict | **PASS** |
| 61 | **11. Error Handling** | Standardized Error Payload | Malformed request returns safe standardized JSON error | HTTP 400 / 401 error format | **PASS** |
| 62 | **11. Error Handling** | Zero Secret & Trace Leaks | No Prisma traces, raw SQL, passwords, or GCP keys exposed | Zero forbidden strings leaked | **PASS** |
| 63 | **12. Deployment Config**| DATABASE_URL Configuration | Valid PostgreSQL connection string configured | Configured: true | **PASS** |
| 64 | **12. Deployment Config**| NEXTAUTH_SECRET Entropy | Session encryption key has >= 32 characters | Secret length: 64 characters | **PASS** |
| 65 | **12. Deployment Config**| NEXTAUTH_URL Configuration | Canonical base URL configured | Configured: true | **PASS** |
| 66 | **12. Deployment Config**| Storage Abstraction Readiness | Storage service provides upload, get, exists, delete APIs | All interface methods operational | **PASS** |
| 67 | **13. Health** | DB Health Probe HTTP 200 | Database health endpoint responds with HTTP 200 | HTTP 200 OK | **PASS** |
| 68 | **13. Health** | DB Health Status Confirmation | Payload confirms `status='ok'` and `database='connected'` | Status & database confirmed | **PASS** |
| 69 | **13. Health** | Diagnostic Privacy Protection | No database passwords, internal ports, or schemas exposed | Zero sensitive details leaked | **PASS** |

---

## Deployment Issues & Applied Fixes

### 1. Database Hostname Mismatch in Local Environment
- **Issue**: Running the production server (`next start`) on the host system initially produced `503 Service Unavailable` with `"Unable to connect to the database"`.
- **Root Cause**: `.env.local` contained `DATABASE_URL="postgresql://medeasy:medeasy_dev_secret@medeasy_db:5432/medeasy?schema=public"`, where `medeasy_db` is a Docker internal hostname that only resolves inside Docker networks, not from the host machine.
- **Resolution**: Updated `.env.local` to use `localhost:5432`, matching `.env`. Tested `/api/health/db`, which immediately returned `200 { status: 'ok', database: 'connected' }`.

### 2. Sign-In Page Route Mapping
- **Issue**: Standard NextAuth signin check attempted `GET /auth/signin`, which yielded HTTP 404.
- **Root Cause**: The MedEasy application implements a custom authentication shell route at `/login` with an automatic root redirect (`/` -> `/login`).
- **Resolution**: Updated the verification probe to validate the actual `/login` page, confirming HTTP 200 and successful rendering of MedEasy brand elements.

### 3. Missing Object Handling in Storage Abstraction Fallback
- **Issue**: When running without live cloud GCS credentials, the initial mock implementation returned dummy PDF buffers for any arbitrary key, causing non-existent object checks to return false positives.
- **Root Cause**: The fallback store lacked object existence tracking.
- **Resolution**: Refactored `lib/storage.ts` to maintain `KNOWN_SEEDED_DOCUMENTS` and an in-memory tracking map for dynamic uploads. Queries for non-existent or deleted keys now reliably return `null`, correctly exercising the 404 path.

### 4. Patient Diagnosis Visibility Test Linkage
- **Issue**: Patient prescription detail test initially received `undefined` diagnosis because `targetPatient` was resolved from the first patient in the roster rather than matching the test patient's profile.
- **Root Cause**: The authoring clinician had multiple patients; creating a prescription for patient Robert caused patient Alice's ownership check to correctly return a safe 404 (hiding the prescription).
- **Resolution**: Updated the test harness to explicitly look up Alice's `PatientProfile` linked to `patientUser.id`, verifying that Alice can view her own diagnosis while stranger patients receive safe 404s.

---

## Verification Artifacts
- Master E2E Production Test Script: [`scripts/test-day19-e2e-production.ts`](file:///c:/Users/harsh/Desktop/SW2627_Nextjs_Prescription_To_Order_Tracking_System/scripts/test-day19-e2e-production.ts)
- GCS Storage Layer Implementation: [`lib/storage.ts`](file:///c:/Users/harsh/Desktop/SW2627_Nextjs_Prescription_To_Order_Tracking_System/lib/storage.ts)
- Storage & Security Unit Tests: [`scripts/test-day19-gcs-storage.ts`](file:///c:/Users/harsh/Desktop/SW2627_Nextjs_Prescription_To_Order_Tracking_System/scripts/test-day19-gcs-storage.ts)
- Database Health Endpoint: [`app/api/health/db/route.ts`](file:///c:/Users/harsh/Desktop/SW2627_Nextjs_Prescription_To_Order_Tracking_System/app/api/health/db/route.ts)
