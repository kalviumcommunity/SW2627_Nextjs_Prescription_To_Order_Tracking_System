# Day 14: Patient Backend Module Verification Report

## 1. Overview & Scope
This document verifies the Day 14 implementation of the Patient backend module in the **MedEasy Prescription-to-Order Tracking System**. The module provides authenticated patients with access to their dashboard metrics, personal prescription lists, permitted prescription details, and fulfillment tracking across all lifecycle states (`PENDING`, `FILLED`, `CANNOT_FILL`), with strict ownership enforcement and clinical privacy compliance.

---

## 2. Implemented API Endpoints

| Endpoint | Method | Allowed Roles | Description | Ownership Rule |
|---|---|---|---|---|
| `/api/patient/dashboard` | `GET` | `PATIENT` | Returns real-time database-derived metrics (`activePrescriptions`, `pendingPrescriptions`, `filledPrescriptions`, `cannotFillPrescriptions`, `totalPrescriptions`) and recent prescription activity. | Strictly scoped to authenticated patient's profile. |
| `/api/patient/prescriptions` | `GET` | `PATIENT` | Returns prescriptions list with ID, formatted doctor name, creation timestamp, and status. | Strictly filtered by `patientId == patientProfile.id`. |
| `/api/patient/prescriptions/[id]` | `GET` | `PATIENT` | Returns full patient-permitted details: patient info, doctor info, clinical diagnosis, medicines (dosage, frequency, duration), prescription document (`documentRef`), status, creation & fulfillment timestamps. | Query condition includes `patientId`. Cross-patient access returns **HTTP 404**. |
| `/api/patient/prescriptions/[id]/tracking` | `GET` | `PATIENT` | Dedicated order tracking endpoint clearly communicating current lifecycle state (`PENDING`, `FILLED`, `CANNOT_FILL`). | Query condition includes `patientId`. Cross-patient access returns **HTTP 404**. |

---

## 3. Authorization & Security Strategy

1. **Authentication Enforcement (HTTP 401)**:
   - All endpoints enforce authentication via `authorizeRequest({ allowedRoles: [UserRole.PATIENT] })`.
   - Any request lacking a valid NextAuth session is rejected with HTTP 401 Unauthorized.
2. **Role Boundary Enforcement (HTTP 403)**:
   - Clinicians (`DOCTOR`) and Pharmacies (`PHARMACY`) attempting to access patient endpoints are strictly rejected with HTTP 403 Forbidden.
3. **Critical Resource Ownership & Anti-Enumeration (HTTP 404)**:
   - A patient can access **only** their own prescriptions.
   - The query condition explicitly includes `where: { id: prescriptionId, patientId: patientProfile.id }`.
   - Querying a prescription belonging to another patient returns **HTTP 404 Not Found** ("Prescription not found."), identical to querying a non-existent ID, preventing identifier enumeration attacks.
4. **Clinical Visibility**:
   - Unlike pharmacy endpoints (which redact `diagnosis`), patient endpoints **strictly allow** clinical diagnosis visibility, itemized medicines, dosages, frequencies, durations, and attached document references (`documentRef`).
5. **Schema Integrity**:
   - For `CANNOT_FILL`, the unavailable/failed fulfillment state is clearly communicated via informative status messages without inventing fictitious database schema fields or stored reason columns.

---

## 4. Test Matrix & Verification Results

All test scenarios were verified using automated script [`scripts/test-patient-api.ts`](file:///c:/Users/harsh/Desktop/SW2627_Nextjs_Prescription_To_Order_Tracking_System/scripts/test-patient-api.ts).

| Category | Test Scenario | Expected Outcome | Actual Result | Status |
|---|---|---|---|:---:|
| **Authentication** | Unauthenticated `GET /api/patient/dashboard` | `HTTP 401 Unauthorized` | Status 401, error returned | **PASS** |
| **Authentication** | Unauthenticated `GET /api/patient/prescriptions` | `HTTP 401 Unauthorized` | Status 401, error returned | **PASS** |
| **Authentication** | Unauthenticated `GET /api/patient/prescriptions/[id]` | `HTTP 401 Unauthorized` | Status 401, error returned | **PASS** |
| **Authentication** | Unauthenticated `GET /api/patient/prescriptions/[id]/tracking` | `HTTP 401 Unauthorized` | Status 401, error returned | **PASS** |
| **RBAC** | Doctor accessing patient dashboard / list / detail / tracking | `HTTP 403 Forbidden` | Status 403 across all routes | **PASS** |
| **RBAC** | Pharmacy accessing patient dashboard / list / detail / tracking | `HTTP 403 Forbidden` | Status 403 across all routes | **PASS** |
| **Dashboard** | Real DB-derived counts (`active`, `pending`, `filled`, `total`) | Matches direct Prisma counts | Matched 100% with DB queries | **PASS** |
| **Dashboard** | Recent prescription activity | Contains real recent items with doctor name and status | Verified 2 recent prescriptions | **PASS** |
| **Prescription List** | Authenticated patient queries list | Prescriptions belonging strictly to caller | All items matched patient ID | **PASS** |
| **Prescription List** | List fields presence | `id`, `doctorName`, `createdAt`, `status` present | All required fields verified | **PASS** |
| **Prescription Detail** | Patient accesses own prescription | Returns patient & doctor info, diagnosis, medicines, documentRef, status, timestamps | 100% of fields verified | **PASS** |
| **Prescription Detail** | Diagnosis visibility | Diagnosis string visible to patient | Visible: "Acute Upper Respiratory Tract Infection" | **PASS** |
| **Prescription Detail** | Attached document reference | `documentRef` present | Visible: "rx-docs/alice-urti-2026.pdf" | **PASS** |
| **Ownership** | Patient A accesses Patient B's prescription | Safe `HTTP 404 Not Found` | Status 404 ("Prescription not found.") | **PASS** |
| **Ownership** | Patient A tracks Patient B's prescription | Safe `HTTP 404 Not Found` | Status 404 ("Prescription not found.") | **PASS** |
| **Ownership** | Patient accesses non-existent prescription ID | Safe `HTTP 404 Not Found` | Status 404 ("Prescription not found.") | **PASS** |
| **Tracking** | `PENDING` prescription tracking | Clearly represents awaiting pharmacy state | `status: PENDING`, `isPending: true` | **PASS** |
| **Tracking** | `FILLED` prescription tracking | Clearly represents filled state with pharmacy & timestamp | `status: FILLED`, `filledAt` present, pharmacy name present | **PASS** |
| **Tracking** | `CANNOT_FILL` prescription tracking | Clearly communicates failed/unavailable state without fake DB column | `status: CANNOT_FILL`, `isCannotFill: true`, clear message | **PASS** |

---

## 5. Verification Commands Run

1. `npm run test:patient`: **PASS** (100% of checks passed)
2. `npm run test:authz`: **PASS** (All 16 RBAC checks passed)
3. `npm run test:doctor-integration`: **PASS** (34/34 checks passed)
4. `npm run test:pharmacy-day13`: **PASS** (Passed)
5. `npx tsc --noEmit`: **PASS** (0 TypeScript errors)
6. `npm run lint`: **PASS** (0 ESLint errors/warnings)
7. `npm run build`: **PASS** (Next.js production build succeeded)
