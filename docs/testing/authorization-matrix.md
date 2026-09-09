# MedEasy Prescription-to-Order Tracking System
## Authorization Test Matrix & Verification Specification

This document defines the complete role-based access control (RBAC), resource ownership, and API route protection authorization matrix for the MedEasy platform across all four defined user roles:
- **`DOCTOR`**
- **`PHARMACY`**
- **`PATIENT`**
- **`ADMIN`**

---

## 1. Core Authorization Rules & Status Codes

| Request Condition | Expected HTTP Status Code | Behavior / Response |
|---|---|---|
| **No Session / Unauthenticated** | `HTTP 401 Unauthorized` | `{ error: "Authentication required." }` |
| **Authenticated, Role Not Allowed** | `HTTP 403 Forbidden` | `{ error: "Forbidden: You do not have permission to access this resource." }` |
| **Authenticated, Allowed Role, Outside Ownership** | `HTTP 403 Forbidden` | `{ error: "Access denied to requested resource." }` |
| **Authenticated, Allowed Role, Valid Ownership** | `HTTP 200 OK` | Authorized payload returned. |

---

## 2. Comprehensive Role vs. Endpoint Access Matrix

The following matrix documents the access rights for each role across all server-side API endpoints and resource types:

| Endpoint / Resource | Description | Unauthenticated | DOCTOR | PHARMACY | PATIENT | ADMIN |
|---|---|:---:|:---:|:---:|:---:|:---:|
| `GET /api/doctor/roster` | Fetch assigned patient roster | **401** | **200** (Own Roster) | **403** | **403** | **403** |
| `POST /api/prescriptions` *(Day 7)* | Create new prescription | **401** | **200** (Roster Only) | **403** | **403** | **403** |
| `GET /api/patient/prescriptions` | Fetch patient's own prescriptions | **401** | **403** | **403** | **200** (Own Only) | **403** |
| `GET /api/pharmacy/queue` | Fulfillment queue of pending prescriptions | **401** | **403** | **200** (Diagnosis Redacted) | **403** | **403** |
| `GET /api/admin/system-stats` | Platform metrics and oversight stats | **401** | **403** | **403** | **403** | **200** |
| `GET /api/prescriptions/[id]` | View prescription details | **401** | **200** (Author Only) / **403** (Other) | **200** (Diagnosis Redacted) | **200** (Recipient Only) / **403** (Other) | **200** (Audit) |
| `PATCH /api/orders/[id]/status` *(Day 7)* | Dispense / fill prescription | **401** | **403** | **200** | **403** | **403** |

---

## 3. Resource Ownership & Relationship Validation

Healthcare systems require fine-grained resource ownership in addition to role checks:

### A. Doctor-Patient Roster Ownership (`DoctorPatient`)
- **Rule**: A Doctor can only view clinical records or create prescriptions for a Patient if an explicit relationship exists in the `DoctorPatient` join table.
- **Test Scenarios**:
  - `Doctor A` accesses `Patient A` (in roster) $\rightarrow$ **ALLOWED (200)**.
  - `Doctor A` attempts to access `Patient B` (not in roster) $\rightarrow$ **DENIED (403 Forbidden)**.

### B. Prescription Author Ownership
- **Rule**: A Doctor can only access or modify prescriptions authored by their `DoctorProfile`.
- **Test Scenarios**:
  - `Doctor A` accesses Prescription authored by `Doctor A` $\rightarrow$ **ALLOWED (200)** with full `diagnosis`.
  - `Doctor B` attempts to access Prescription authored by `Doctor A` $\rightarrow$ **DENIED (403 Forbidden)**.

### C. Patient Record Ownership
- **Rule**: A Patient can only view their own prescriptions and order tracking history.
- **Test Scenarios**:
  - `Patient A` accesses Prescription issued to `Patient A` $\rightarrow$ **ALLOWED (200)**.
  - `Patient B` attempts to access Prescription issued to `Patient A` $\rightarrow$ **DENIED (403 Forbidden)**.

### D. Pharmacy Fulfillment & Clinical Privacy Protection
- **Rule**: The pre-provisioned Pharmacy can access pending prescriptions to fulfill orders, but **must never receive sensitive clinical diagnosis fields**.
- **Test Scenarios**:
  - `Pharmacy` accesses Prescription queue / detail $\rightarrow$ **ALLOWED (200)**, but `diagnosis` is strictly `undefined` / redacted.
  - `Pharmacy` attempts to access administrative stats $\rightarrow$ **DENIED (403 Forbidden)**.

### E. System Administrator Cross-Cutting Oversight
- **Rule**: `ADMIN` has read-only access to system health, platform metrics, and audit logs, but cannot masquerade as clinicians to create medical prescriptions.

---

## 4. Test Categories and Automation Coverage

| Test Category | Description | Implementation in [`scripts/test-authorization.ts`](file:///c:/Users/ironm/Desktop/SW2627_Nextjs_Prescription_To_Order_Tracking_System/scripts/test-authorization.ts) |
|---|---|---|
| **1. Unauthenticated Access** | Calls without a session or JWT | Verified: `requireAuth`, `requireRole`, and route handlers return 401. |
| **2. Correct-Role Access** | Valid user with matching required role | Verified: `DOCTOR`, `PHARMACY`, `PATIENT`, and `ADMIN` granted access to their authorized endpoints. |
| **3. Wrong-Role Access** | Valid user with non-matching role | Verified: 16 cross-role matrix tests all return 403. |
| **4. Resource Ownership** | Accessing records of other users | Verified: Cross-doctor, cross-patient, and unassigned roster rejections return 403. |
| **5. Privacy Redaction** | Pharmacy access to prescription data | Verified: `diagnosis` is strictly redacted from payloads. |
| **6. Protected API Routes** | Direct invocation of Next.js Route Handlers | Verified: Route handlers enforce 401 when session is absent. |
| **7. 401 vs 403 Status Disambiguation** | Accurate HTTP error semantics | Verified: Missing auth is 401; insufficient privileges is 403. |

---

## 5. Security Principles & Architecture

1. **Server-Side Enforcement**: All authorization decisions are computed on the server within [`lib/permissions.ts`](file:///c:/Users/ironm/Desktop/SW2627_Nextjs_Prescription_To_Order_Tracking_System/lib/permissions.ts) and verified in Next.js API Route Handlers.
2. **Centralized Permission Helpers**: Eliminates brittle copy-pasted role checks across route handlers.
3. **No Frontend Reliance**: Client-side navigation filtering is purely a UX enhancement and is never treated as a security boundary.

---

## 6. Known Limitations & Future Phase Scope

- **Self-Service Pharmacy Registration**: By product requirements, pharmacy accounts cannot self-register; exactly one seeded pharmacy exists.
- **Multi-Pharmacy Routing**: Current phase routes all fulfillment to the central pharmacy. Multi-pharmacy geographic routing is reserved for future releases.
- **Revocation / Token Blacklisting**: JWT sessions are stateless. Token expiration is configured, and instant token blacklisting prior to expiry is scheduled for enterprise phase hardening.
