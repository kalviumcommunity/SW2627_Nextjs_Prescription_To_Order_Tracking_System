# Day 16 API Error Handling and Authorization Standardization

Date: 2026-09-08
Branch: `test/day15-admin-module`

## Architecture

- `lib/api-errors.ts` defines `ApplicationError` and the required error codes: `UNAUTHENTICATED`, `FORBIDDEN`, `VALIDATION_ERROR`, `NOT_FOUND`, `CONFLICT`, `BUSINESS_RULE_ERROR`, and `INTERNAL_SERVER_ERROR`.
- `apiError()` returns `{ error: { code, message } }` with the correct status and logs unknown errors server-side with a safe generic message.
- Prisma `P2002` maps to `409 CONFLICT`; `P2025` maps to `404 NOT_FOUND`; Prisma details are never returned to clients.
- `apiSuccess()` preserves existing successful payloads and status codes.
- `errorFromResult()` adapts existing service `{ error, statusCode }` results without moving business logic.
- `authorizeRequest()` now uses the central error response while preserving authentication and role checks.

## Routes Migrated

- Auth registration, forgot-password, and reset-password routes
- Doctor dashboard, medicines, patients, roster, prescriptions, prescription detail, upload, and analytics
- Pharmacy dashboard, queue, prescriptions, prescription detail, fulfillment, history, and analytics
- Patient dashboard, prescriptions, detail, and tracking response wrappers
- Admin dashboard, doctors, pharmacy, prescriptions, prescription detail, analytics, and system stats
- Shared prescription detail ownership route
- Database health route

The NextAuth catch-all route remains delegated to NextAuth because its protocol and response handling are owned by the authentication framework. Its application credential validation remains safe and does not expose database errors.

## Authorization Order

Protected routes continue to perform authentication, role authorization, ownership/scope checks, validation, and business logic in the existing order. No DoctorPatient linkage, patient ownership, pharmacy-only fulfillment, terminal status, exactly-once fulfillment, Admin-only access, or diagnosis-redaction logic was changed.

## Tests

| Check | Result |
|---|---|
| Central error helper unit test (`npm run test:api-errors`) | PASS |
| Authentication (`npm run test:auth`) | PASS |
| Authorization matrix (`npm run test:authz`) | PASS |
| Admin backend (`npm run test:admin`) | PASS |
| Admin frontend (`npm run test:admin:frontend`) | PASS |
| Doctor API and integration | PASS |
| Patient API | PASS after updating the expected standardized error shape |
| Pharmacy API and integration | PASS |
| Pharmacy fulfillment | PASS |
| TypeScript | PASS |
| Lint | PASS |
| Production build | Pending dependency repair; tracked `node_modules` currently contains an invalid Windows SWC binary |

## Response Contract Examples

```json
{
  "error": {
    "code": "FORBIDDEN",
    "message": "Forbidden. You do not have permission to access this resource."
  }
}
```

Unknown errors return `500 INTERNAL_SERVER_ERROR` with a safe generic message. They never expose stack traces, SQL, Prisma internals, tokens, passwords, or secrets.
