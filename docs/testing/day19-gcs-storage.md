# MedEasy — Day 19: Google Cloud Storage Integration & Security Runbook

## 1. Overview & Objective

Day 19 productionizes prescription document storage using **Google Cloud Storage (GCS)** while strictly preserving protected health information (PHI) confidentiality. 

Under the MedEasy architecture:
- Prescription document binaries (PDF, JPEG, PNG, WEBP) are stored privately in a configured Google Cloud Storage bucket.
- Under **no** circumstance are prescription documents made publicly accessible (`allUsers` / `allAuthenticatedUsers`).
- PostgreSQL stores exclusively the unique document reference string (`documentRef`) and application metadata; **no file binaries are ever stored in the database**.
- Document access is mediated entirely through authenticated, role-authorized Next.js API endpoints (`/api/prescriptions/[id]/document`).
- An in-memory/local mock store is maintained as an offline fallback so CI/CD and local development workflows function without requiring live GCP credentials.

---

## 2. Storage Abstraction Architecture (`lib/storage.ts`)

All cloud storage operations are isolated within `lib/storage.ts`. Neither page components nor API routes make direct SDK calls to Google Cloud Platform.

```
┌────────────────────────────────────────────────────────┐
│             MedEasy Application Layer                  │
│    (Doctor Upload, Patient/Pharmacy Detail Views)      │
└──────────────────────────┬─────────────────────────────┘
                           │
                           ▼
┌────────────────────────────────────────────────────────┐
│     Storage Abstraction Layer (lib/storage.ts)         │
│  • validateDocumentFile()                              │
│  • generateDocumentStorageKey()                        │
│  • uploadPrescriptionDocument()                        │
│  • getDocument()                                       │
│  • checkObjectExists()                                 │
│  • deleteDocument()                                    │
└──────────────┬──────────────────────────┬──────────────┘
               │                          │
        (GCP Configured)            (Offline / Test)
               ▼                          ▼
┌──────────────────────────────┐ ┌──────────────────────┐
│  Google Cloud Storage Bucket │ │ In-Memory Mock Store │
│  • Private ACL               │ │ (Map<string, Buffer>)│
│  • Encrypted at rest         │ └──────────────────────┘
└──────────────────────────────┘
```

### Storage Operations

| Method | Signature | Behavior |
|---|---|---|
| `validateDocumentFile` | `(file, options) => { valid, error }` | Validates presence, non-empty, size <= 5MB, whitelisted MIME (PDF, JPG, PNG, WEBP), whitelisted extensions, path traversal rejection. |
| `generateDocumentStorageKey`| `(originalName) => string` | Produces `rx-docs/${timestamp}-${uuid}-${sanitizedName}${ext}` with secure UUID entropy. |
| `uploadPrescriptionDocument`| `(file) => Promise<UploadResult>` | Uploads file privately to GCS (or mock store). Never sets public ACL. |
| `getDocument` | `(documentRef) => Promise<{buffer, mimeType, fileName} \| null>` | Validates reference, prevents path traversal, fetches binary and metadata. Returns null for missing objects. |
| `checkObjectExists` | `(documentRef) => Promise<boolean>` | Verifies if an object is present in GCS or mock store. |
| `deleteDocument` | `(documentRef) => Promise<boolean>` | Deletes an object securely. |
| `getDocumentUrl` | `(documentRef) => Promise<string \| null>` | Returns internal authenticated route (`/api/doctor/prescriptions/documents/...`). Never exposes raw `storage.googleapis.com` URLs. |

---

## 3. Object Naming & Entropy

To eliminate enumeration vulnerabilities and Insecure Direct Object Reference (IDOR), object keys follow a strict format:

```
rx-docs/{timestamp}-{randomUuid}-{sanitizedBaseName}{extension}
```

Example:
`rx-docs/1789231389867-b28d80b3-3ee0-4af7-81aa-5e3caa3ed69e-clinical-chart.pdf`

- **Namespace Scope**: `rx-docs/` prefixes all prescription objects.
- **Timestamp**: Provides chronological ordering.
- **UUID v4**: 128-bit cryptographically secure random entropy prevents guessing or collisions.
- **Sanitized Basename**: Strips path separators (`/`, `\`), null bytes (`\0`), traversal sequences (`..`), and non-alphanumeric characters.
- **Extension Preservation**: Maintains `.pdf`, `.png`, `.jpg`, `.jpeg`, or `.webp`.

---

## 4. PostgreSQL Database Isolation

The database schema strictly limits prescription document tracking to reference metadata:

```prisma
model Prescription {
  id          String             @id @default(cuid())
  doctorId    String
  patientId   String
  diagnosis   String
  documentRef String?            // String storage key only (e.g. "rx-docs/178923...pdf")
  status      PrescriptionStatus @default(PENDING)
  filledAt    DateTime?
  createdAt   DateTime           @default(now())
  updatedAt   DateTime           @updatedAt
  ...
}
```

Zero binary, blob, or bytea columns exist in the database, ensuring database performance and decoupling file storage from relational transactions.

---

## 5. Security & Access Control Model

Prescription documents are protected by a multi-layered defense-in-depth model:

```
1. Client Request -> GET /api/prescriptions/[id]/document
   ├── 2. Authentication Check (NextAuth Session)
   │      └── No session -> HTTP 401 Unauthorized
   ├── 3. Resource Ownership (canUserAccessPrescription)
   │      ├── Authoring Doctor -> ALLOWED (200)
   │      ├── Recipient Patient -> ALLOWED (200)
   │      ├── Registered Pharmacy -> ALLOWED (200)
   │      ├── Platform Admin -> ALLOWED (200)
   │      ├── Unauthorized Doctor -> HTTP 403 Forbidden
   │      └── Unauthorized Patient -> HTTP 403 Forbidden
   └── 4. Document Retrieval & Streaming
          ├── Fetch binary via storageService.getDocument(prescription.documentRef)
          ├── Object missing -> HTTP 404 Not Found
          └── Stream to client with security headers:
              • Content-Type: [mimeType]
              • Content-Disposition: inline; filename="..."
              • X-Content-Type-Options: nosniff
              • Cache-Control: private, no-cache, no-store, must-revalidate
```

### Access Control Matrix

| Requester Role | Relationship to Prescription | Access Outcome | HTTP Status |
|---|---|---|---|
| **Anonymous** | Unauthenticated | Rejected | `401 Unauthorized` |
| **Doctor** | Authoring Physician (`rx.doctorId == doctor.id`) | Granted | `200 OK` |
| **Doctor** | Different Doctor (`rx.doctorId != doctor.id`) | Blocked | `403 Forbidden` |
| **Patient** | Prescription Recipient (`rx.patientId == patient.id`) | Granted | `200 OK` |
| **Patient** | Different Patient (`rx.patientId != patient.id`) | Blocked | `403 Forbidden` |
| **Pharmacy** | Registered Pharmacy profile | Granted for Fulfillment | `200 OK` |
| **Admin** | System Administrator | Granted for Auditing | `200 OK` |
| **Any** | Non-existent Prescription ID | Not Found | `404 Not Found` |
| **Any** | Prescription with null `documentRef` | Not Found | `404 Not Found` |
| **Any** | Prescription with deleted GCS object | Not Found | `404 Not Found` |

---

## 6. Runtime Configuration & Environment Variables

MedEasy dynamically loads GCS configuration at runtime from environment variables without hardcoded keys:

| Variable | Category | Description |
|---|---|---|
| `GCP_STORAGE_BUCKET` | Required in Prod | Target GCS bucket name (e.g. `medeasy-rx-docs-production`) |
| `GCP_PROJECT_ID` | Optional | GCP Project ID |
| `GCP_CLIENT_EMAIL` | Optional | Service account email for explicit authentication |
| `GCP_PRIVATE_KEY` | Optional | Service account private key (handles formatted `\n` newlines) |
| `GOOGLE_APPLICATION_CREDENTIALS` | Optional | Path to service account JSON (standard ADC) |

When deployed on **Google Cloud Run**, the container automatically authenticates via Cloud Run's attached Service Account identity (Application Default Credentials), requiring zero private key secrets in environment variables.

---

## 7. UI Components & Error Handling

1. **Doctor Prescription Creation (`app/doctor/prescriptions/new/page.tsx`)**:
   - Card 5 provides interactive drag-and-drop / file selector supporting PDF, PNG, JPG, WEBP up to 5MB.
   - Client-side validation catches empty files, oversized files, and unsupported extensions before upload.
   - Communicates with `POST /api/doctor/prescriptions/upload`.
   - Error handling:
     * **Upload failure**: Displays error message returned by the server.
     * **Invalid document**: Inline error alert.
     * **Network failure**: Catches connection failures with retry guidance.
   - Success state displays uploaded file name, formatted size (KB), document key, and a "Remove" button.
   - Associates `documentRef` into the final prescription creation payload.

2. **Prescription Overview (`components/prescriptions/PrescriptionDetails.tsx`)**:
   - Displays `documentRef` and provides a styled "View Document" action linking to `/api/prescriptions/${prescription.id}/document`.
   - Fallback text when no document is attached: `"No document reference attached to this prescription."` (regression test compliant).

3. **Pharmacy Detail (`app/pharmacy/prescriptions/[id]/page.tsx`)**:
   - Includes "View Document" link to `/api/prescriptions/${prescription.id}/document` when a document is available.

---

## 8. Verification & Test Summary

All Day 19 requirements were validated via automated test execution:

```bash
npm run test:day19
```

**Results**: 57/57 checks passed (100% success rate):
- Section 1: File validation constraints (7 tests)
- Section 2: Object naming and UUID entropy (6 tests)
- Section 3: Storage abstraction CRUD operations (9 tests)
- Section 4: PostgreSQL reference isolation (5 tests)
- Section 5: Access control matrix across roles (6 tests)
- Section 6: Route-level access control & security headers (6 tests)
- Section 7: Security sanitization & leak prevention (9 tests)

**Regression & Quality Gates**:
- `npm run lint`: 0 ESLint warnings or errors.
- `npx tsc --noEmit`: 0 TypeScript errors.
- `npm run test:day9`: 52/52 passed.
- `npm run test:day16-ui`: 100% passed.
- `npm run test:day16-regression`: 199/199 passed.
- `npm run test:day17-security`: 99/99 passed.
- `npm run build`: Production Next.js standalone build compiled successfully.
