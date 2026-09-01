# Doctor Prescription Creation - Integration Test Report

**Day 8, PR 24, Branch: test/d08-prescription-integration**
**Date:** 2026-09-01

## Overview

End-to-end integration testing for the Doctor Create Prescription workflow.

Flow: Doctor Login -> Dashboard -> Create Prescription -> Select Patient -> Add Medicines -> Submit -> API -> PostgreSQL -> Prescription List

---

## Integration Issues Found and Fixed

### 1. Missing GET /api/doctor/medicines route
- Problem: The UI calls GET /api/doctor/medicines but route did not exist.
- Fix: Created app/api/doctor/medicines/route.ts - DOCTOR-only endpoint returning { medicines }.

### 2. New Prescription button on Dashboard was non-functional
- Problem: Showed an info toast instead of routing to the create form.
- Fix: Replaced with Link href=/doctor/prescriptions/new.

### 3. New Prescription button missing from Prescriptions List page
- Fix: Added primary button to app/doctor/prescriptions/page.tsx.

### 4. New Prescription button missing from Patients page
- Fix: Added primary button to app/doctor/patients/page.tsx.

### 5. Post-creation redirect to /doctor/prescriptions/:id (page not built yet)
- Fix: Simplified redirect to /doctor/prescriptions list.

---

## Test Cases

| TC | Description | Input | Expected | Actual | Result |
|----|-------------|-------|----------|--------|--------|
| TC-01 | Valid prescription - 1 medicine | Alice Johnson, Paracetamol 500mg x5d | HTTP 201, PENDING | Created, PENDING in DB | PASS |
| TC-02 | Valid prescription - multiple medicines | Alice Johnson, Paracetamol + Amoxicillin | HTTP 201, 2 PrescriptionMedicine | Both rows in DB | PASS |
| TC-03 | Missing patient | patientId empty | HTTP 400 | HTTP 400 Patient ID required | PASS |
| TC-04 | Patient not linked to doctor | Dr. Sarah for Emma Watson | HTTP 403 | HTTP 403 Access denied | PASS |
| TC-05 | Empty medicine list | medicines=[] | HTTP 400 | HTTP 400 at least one required | PASS |
| TC-06 | Invalid medicine ID | nonexistent medicineId | HTTP 400 | HTTP 400 catalog check | PASS |
| TC-07 | Missing dosage | dosage empty | HTTP 400 | HTTP 400 | PASS |
| TC-08 | Missing frequency | frequency empty | HTTP 400 | HTTP 400 | PASS |
| TC-09 | Missing duration | duration empty | HTTP 400 | HTTP 400 | PASS |
| TC-10 | Duplicate medicines | same medicineId twice | HTTP 400 | HTTP 400 before DB write | PASS |
| TC-11 | Forged status/doctorId | status=FILLED, foreign doctorId | PENDING enforced, doctorId from JWT | Overrides ignored | PASS |
| TC-12 | Create then page refresh | Create then reload list | Persists in DB | Survives refresh | PASS |

---

## Database Verification

| Check | Result |
|-------|--------|
| Prescription exists in DB | PASS |
| doctorId = Dr. Sarah profile | PASS |
| patientId = Alice Johnson | PASS |
| status = PENDING | PASS |
| PrescriptionMedicine records exist | PASS - 2 rows |
| Each medicine linked correctly | PASS |
| dosage/frequency/duration correct | PASS |

All writes wrapped in prisma.() - atomic.

---

## Ownership Verification

| Scenario | Result |
|----------|--------|
| Dr. Sarah creates for Alice (her roster) | PASS HTTP 201 |
| Dr. Sarah CANNOT create for Emma Watson (Dr. John patient) | PASS HTTP 403 |
| Non-doctor roles rejected | PASS HTTP 403 |
| Unauthenticated rejected | PASS HTTP 401 |
| Cross-doctor GET detail blocked | PASS HTTP 403 |

---

## Automated Test Results

npm run test:doctor:create: ALL 11/11 PASSED
npm run test:doctor-integration: ALL 34/34 PASSED
npm run test:doctor: ALL PASSED
npm run lint: No ESLint warnings or errors
npm run build: Compiled successfully, 29/29 static pages

---

## Manual Browser Testing

| Step | Action | Result |
|------|--------|--------|
| 1 | Login as dr.sarah@medeasy.demo | PASS - /doctor/dashboard |
| 2 | Click New Prescription on Dashboard | PASS - /doctor/prescriptions/new |
| 3 | Patient dropdown loads roster | PASS - 4 patients |
| 4 | Medicine dropdown loads catalog | PASS |
| 5 | Fill form and save | PASS - POST /api/doctor/prescriptions |
| 6 | Redirect to /doctor/prescriptions | PASS |
| 7 | Prescription in list with Pending status, 2 items | PASS |
| 8 | Refresh page | PASS - persists from PostgreSQL |
| 9 | View Details modal | PASS - full info shown |
| 10 | New Prescription from List page | PASS |
| 11 | New Prescription from Patients page | PASS |

---

## Concepts Explained

### 1. What Integration Testing Means

Integration testing verifies that two or more independently working components function correctly TOGETHER.
In this Day 8 PR:
- Frontend form integrates with the API route
- API route integrates with the service layer (createDoctorPrescription)
- Service layer integrates with PostgreSQL via Prisma transactions
- Prescriptions list integrates with the dashboard and list UI

Integration testing catches contract mismatches that unit tests never reveal.
Example: UI calling /api/doctor/medicines which did not exist yet.

### 2. Unit vs Integration vs E2E Testing

Unit: Tests one function in isolation with mocked dependencies.
Example: testing validateRow() or createDoctorPrescription() with mocked Prisma.

Integration: Tests multiple real components together.
Example: createDoctorPrescription() -> real Prisma -> real PostgreSQL.

End-to-End: Tests the entire system from browser to database.
Example: Browser login -> fill form -> submit -> reload page -> verify in list.

Our automated scripts are integration tests (real DB, no browser).
Manual browser steps are E2E tests (full chain).

### 3. Why Database Verification Matters

After a successful HTTP response you must verify PostgreSQL directly because:
1. The API could return 201 but fail to write to DB
2. Transactions can roll back silently
3. Foreign key constraints on PrescriptionMedicine must be verified
4. status=PENDING must be confirmed in DB (not just in response)
5. dosage/frequency/duration must be stored correctly

Verification in tests: prisma.prescription.findUnique with include prescriptionMedicines.

### 4. Why Refreshing After Creation Is a Useful Persistence Test

Refreshing is the simplest persistence test because:
1. It bypasses React state - data comes exclusively from the database after reload
2. It proves the full round-trip: Form -> API -> PostgreSQL -> API -> UI
3. It catches cache bugs - stale data would cause prescription to disappear
4. It simulates real user behaviour (closing/reopening tabs)
5. It validates live DB queries - dynamic = force-dynamic ensures no static caching