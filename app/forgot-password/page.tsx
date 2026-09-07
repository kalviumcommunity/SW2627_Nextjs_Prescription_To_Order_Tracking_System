/*
We are implementing DAY 12 of MedEasy.
GOAL:
Implement pharmacy prescription fulfillment.
Before changing code:
1. Inspect the existing Prisma schema.
2. Inspect the pharmacy APIs created in Day 11.
3. Inspect existing authentication/RBAC helpers.
4. Inspect existing error-handling conventions.
5. Follow the current project architecture.
6. Do not rewrite working Day 11 functionality unnecessarily.
Implement:
PATCH /api/pharmacy/prescriptions/[id]/fulfill

Request body:
{
"action": "FILLED"
}
or:
{
"action": "CANNOT_FILL"
}
AUTHORIZATION:
- unauthenticated → 401
- authenticated non-pharmacy role → 403
- PHARMACY → continue
BUSINESS RULES:
1. Prescription must exist, otherwise 404.
2. Prescription must currently have status PENDING.
3. PENDING may transition to FILLED.
4. PENDING may transition to CANNOT_FILL.
5. FILLED is terminal.
6. CANNOT_FILL is terminal.
7. Do not allow re-processing of a terminal prescription.
8. A successful fill must identify the authenticated pharmacy.
9. Do not trust a pharmacyId supplied by the client.
10. Diagnosis must never be returned by pharmacy responses.
FILLED behavior:
- update prescription status to FILLED
- create exactly one Fill record
- record authenticated pharmacyId
- record fulfillment timestamp
- perform related writes atomically
CANNOT_FILL behavior:
- update prescription status to CANNOT_FILL
- record the terminal outcome

- do not create a successful Fill record
DUPLICATE PROTECTION:
- Use an atomic/guarded transaction.
- Preserve and rely on the existing unique constraint on
Fill.prescriptionId.
- Handle unique-constraint/concurrency errors gracefully as a
business-rule conflict.
- The final database state must never contain more than one
successful Fill for a prescription.
Do not introduce a new status unless the existing schema requires
it.
Do not allow FILLED → PENDING.
Do not allow CANNOT_FILL → PENDING.
Do not implement refund, order payment, inventory management, or
multi-pharmacy features.
Add tests covering:
- valid FILLED
- valid CANNOT_FILL
- already FILLED
- already CANNOT_FILL
- unauthenticated
- wrong role
- nonexistent prescription
- invalid action
- duplicate fill
- pharmacy identity comes from session
- concurrent fulfillment attempts if the existing test
infrastructure supports it
After implementation:
- run lint
- run TypeScript checks
- run tests
- inspect Prisma/database result manually
- verify exactly one Fill row exists after successful fulfillment
- verify CANNOT_FILL does not create a successful Fill row

None

None

None

None
- summarize changed files and test results.
*/
import Link from "next/link";
import { AuthShell } from "@/components/layout/AuthShell";
import { PasswordResetForm } from "@/components/auth/PasswordResetForm";

export default function ForgotPasswordPage() {
  return <AuthShell eyebrow="Account access" title="Forgot your password?" description="Enter your email and we will guide you to the next step when password recovery is available."><PasswordResetForm mode="request" /><p className="mt-6 text-center text-sm text-slate-600"><Link href="/login" className="font-semibold text-ocean hover:text-ink">Back to sign in</Link></p></AuthShell>;
}
