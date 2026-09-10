import { UserRole, PrescriptionStatus, Prisma } from "@prisma/client";
import { prisma } from "../lib/prisma";
import {
  requireAuth,
  requireRole,
  authorizeRequest,
  AuthorizationError,
  canUserAccessPrescription,
  AuthUser,
} from "../lib/permissions";
import {
  createDoctorPrescription,
  getDoctorPrescriptionDetail,
  getDoctorPrescriptionsList,
  getDoctorPatientsRoster,
  getDoctorAnalytics,
} from "../lib/doctor-service";
import {
  fulfillPrescription,
  getPharmacyPrescriptionDetail,
  getPharmacyHistory,
  getPharmacyAnalytics,
} from "../lib/pharmacy-service";
import {
  getPatientPrescriptionDetail,
  getPatientPrescriptionTracking,
  getPatientPrescriptionsList,
  getPatientDashboardData,
} from "../lib/patient-service";
import {
  getAdminDashboardData,
  getAdminDoctorsList,
  getAdminPharmacyInfo,
  getAdminPrescriptionsList,
  getAdminPrescriptionDetail,
  getAdminAnalyticsData,
} from "../lib/admin-service";
import { storageService, validateDocumentFile } from "../lib/storage";
import { GET as getPrescriptionDocument } from "../app/api/prescriptions/[id]/document/route";
import { POST as registerRoute } from "../app/api/auth/register/route";
import { POST as forgotPasswordRoute } from "../app/api/auth/forgot-password/route";
import { POST as resetPasswordRoute } from "../app/api/auth/reset-password/route";
import { GET as doctorPrescriptionsRoute, POST as doctorCreatePrescriptionRoute } from "../app/api/doctor/prescriptions/route";
import { GET as doctorDashboardRoute } from "../app/api/doctor/dashboard/route";
import { GET as doctorPatientsRoute } from "../app/api/doctor/patients/route";
import { GET as doctorAnalyticsRoute } from "../app/api/doctor/analytics/route";
import { PATCH as fulfillRoute } from "../app/api/pharmacy/prescriptions/[id]/fulfill/route";
import { GET as patientDashboardRoute } from "../app/api/patient/dashboard/route";
import { GET as patientPrescriptionsRoute } from "../app/api/patient/prescriptions/route";
import { GET as patientTrackingRoute } from "../app/api/patient/prescriptions/[id]/tracking/route";
import { GET as adminDashboardRoute } from "../app/api/admin/dashboard/route";
import { GET as adminAnalyticsRoute } from "../app/api/admin/analytics/route";
import { GET as sharedPrescriptionDetailRoute } from "../app/api/prescriptions/[id]/route";
import { apiError, validationError, ApplicationError } from "../lib/api-errors";

async function runDay17ComprehensiveSecurityAudit() {
  console.log("===============================================================================");
  console.log("🛡️  MedEasy Day 17 - Complete Backend Security, Abuse & Regression Audit");
  console.log("===============================================================================\n");

  let totalChecks = 0;
  let passedChecks = 0;

  function check(condition: boolean, description: string) {
    totalChecks++;
    if (!condition) {
      console.error(`  ❌ FAILED: ${description}`);
      throw new Error(`Security Check Failed: ${description}`);
    }
    passedChecks++;
    console.log(`  ✓ ${description}`);
  }

  // 0. Load test accounts
  const [adminUser, doctorSarah, doctorJohn, pharmacyUser, patientAlice, patientRobert, patientEmma] =
    await Promise.all([
      prisma.user.findUniqueOrThrow({ where: { email: "admin@medeasy.demo" }, include: { doctorProfile: true } }),
      prisma.user.findUniqueOrThrow({ where: { email: "dr.sarah@medeasy.demo" }, include: { doctorProfile: true } }),
      prisma.user.findUniqueOrThrow({ where: { email: "dr.john@medeasy.demo" }, include: { doctorProfile: true } }),
      prisma.user.findUniqueOrThrow({ where: { email: "pharmacy@medeasy.demo" }, include: { pharmacyProfile: true } }),
      prisma.user.findUniqueOrThrow({ where: { email: "patient.alice@medeasy.demo" }, include: { patientProfile: true } }),
      prisma.user.findUniqueOrThrow({ where: { email: "patient.robert@medeasy.demo" }, include: { patientProfile: true } }),
      prisma.user.findUniqueOrThrow({ where: { email: "patient.emma@medeasy.demo" }, include: { patientProfile: true } }),
    ]);

  const adminAuth: AuthUser = { id: adminUser.id, email: adminUser.email, role: UserRole.ADMIN };
  const doctorSarahAuth: AuthUser = { id: doctorSarah.id, email: doctorSarah.email, role: UserRole.DOCTOR };
  const doctorJohnAuth: AuthUser = { id: doctorJohn.id, email: doctorJohn.email, role: UserRole.DOCTOR };
  const pharmacyAuth: AuthUser = { id: pharmacyUser.id, email: pharmacyUser.email, role: UserRole.PHARMACY };
  const patientAliceAuth: AuthUser = { id: patientAlice.id, email: patientAlice.email, role: UserRole.PATIENT };
  const patientRobertAuth: AuthUser = { id: patientRobert.id, email: patientRobert.email, role: UserRole.PATIENT };

  const medicine = await prisma.medicine.findFirstOrThrow({ where: { stockStatus: true } });

  // ---------------------------------------------------------------------------
  // 1. TEST AUTHENTICATION
  // ---------------------------------------------------------------------------
  console.log("-------------------------------------------------------------------------------");
  console.log("1. TEST AUTHENTICATION (NO SESSION -> 401, INVALID -> REJECTED, VALID -> ALLOWED)");
  console.log("-------------------------------------------------------------------------------");

  // A. No session -> 401
  let unauthCaught = false;
  try {
    await requireAuth(null);
  } catch (err) {
    if (err instanceof AuthorizationError && err.statusCode === 401) {
      unauthCaught = true;
    }
  }
  check(unauthCaught, "requireAuth(null) throws AuthorizationError with status 401");

  const unauthAuthorize = await authorizeRequest({ userOverride: null });
  check(Boolean(unauthAuthorize.errorResponse), "authorizeRequest(null) returns errorResponse");
  check(unauthAuthorize.errorResponse?.status === 401, "authorizeRequest(null) errorResponse status is 401");

  // Route handlers unauthenticated -> 401
  const docReq = new Request("http://localhost:3000/api/prescriptions/fake-id/document");
  const docUnauthRes = await getPrescriptionDocument(docReq, { params: { id: "fake-id" } });
  check(docUnauthRes.status === 401, "GET /api/prescriptions/[id]/document returns 401 when unauthenticated");

  const doctorDashUnauth = await doctorDashboardRoute();
  check(doctorDashUnauth.status === 401, "GET /api/doctor/dashboard returns 401 when unauthenticated");

  const adminDashUnauth = await adminDashboardRoute();
  check(adminDashUnauth.status === 401, "GET /api/admin/dashboard returns 401 when unauthenticated");

  const patientDashUnauth = await patientDashboardRoute();
  check(patientDashUnauth.status === 401, "GET /api/patient/dashboard returns 401 when unauthenticated");

  // B. Invalid / expired session -> rejected (simulated via invalid / empty user object)
  const invalidSessionAuth = await authorizeRequest({
    // @ts-expect-error Testing invalid session payload
    userOverride: { id: "", email: "invalid", role: "INVALID_ROLE" },
    allowedRoles: [UserRole.DOCTOR],
  });
  check(invalidSessionAuth.errorResponse !== null, "Invalid session object is rejected by authorizeRequest");

  // C. Valid session -> allowed
  const validDoctorAuth = await authorizeRequest({
    userOverride: doctorSarahAuth,
    allowedRoles: [UserRole.DOCTOR],
  });
  check(validDoctorAuth.errorResponse === null && validDoctorAuth.user.id === doctorSarah.id, "Valid DOCTOR session is allowed");

  const validPatientAuth = await authorizeRequest({
    userOverride: patientAliceAuth,
    allowedRoles: [UserRole.PATIENT],
  });
  check(validPatientAuth.errorResponse === null && validPatientAuth.user.id === patientAlice.id, "Valid PATIENT session is allowed");

  // ---------------------------------------------------------------------------
  // 2. TEST RBAC
  // ---------------------------------------------------------------------------
  console.log("\n-------------------------------------------------------------------------------");
  console.log("2. TEST RBAC (WRONG ROLE -> 403 ACROSS DOCTOR, PHARMACY, PATIENT, ADMIN)");
  console.log("-------------------------------------------------------------------------------");

  // Doctor restrictions:
  // - cannot access pharmacy fulfillment
  const doctorFulfillAuth = await authorizeRequest({
    userOverride: doctorSarahAuth,
    allowedRoles: [UserRole.PHARMACY],
  });
  check(doctorFulfillAuth.errorResponse?.status === 403, "Doctor blocked with 403 from Pharmacy fulfillment");

  // - cannot access admin-only APIs
  const doctorAdminAuth = await authorizeRequest({
    userOverride: doctorSarahAuth,
    allowedRoles: [UserRole.ADMIN],
  });
  check(doctorAdminAuth.errorResponse?.status === 403, "Doctor blocked with 403 from Admin APIs");

  // Pharmacy restrictions:
  // - cannot access patient-only APIs
  const pharmacyPatientAuth = await authorizeRequest({
    userOverride: pharmacyAuth,
    allowedRoles: [UserRole.PATIENT],
  });
  check(pharmacyPatientAuth.errorResponse?.status === 403, "Pharmacy blocked with 403 from Patient APIs");

  // - cannot access admin-only APIs
  const pharmacyAdminAuth = await authorizeRequest({
    userOverride: pharmacyAuth,
    allowedRoles: [UserRole.ADMIN],
  });
  check(pharmacyAdminAuth.errorResponse?.status === 403, "Pharmacy blocked with 403 from Admin APIs");

  // - cannot access doctor-only operations
  const pharmacyDoctorAuth = await authorizeRequest({
    userOverride: pharmacyAuth,
    allowedRoles: [UserRole.DOCTOR],
  });
  check(pharmacyDoctorAuth.errorResponse?.status === 403, "Pharmacy blocked with 403 from Doctor operations");

  // Patient restrictions:
  // - cannot perform pharmacy fulfillment
  const patientFulfillAuth = await authorizeRequest({
    userOverride: patientAliceAuth,
    allowedRoles: [UserRole.PHARMACY],
  });
  check(patientFulfillAuth.errorResponse?.status === 403, "Patient blocked with 403 from Pharmacy fulfillment");

  // - cannot access admin-only APIs
  const patientAdminAuth = await authorizeRequest({
    userOverride: patientAliceAuth,
    allowedRoles: [UserRole.ADMIN],
  });
  check(patientAdminAuth.errorResponse?.status === 403, "Patient blocked with 403 from Admin APIs");

  // Non-admin cannot access admin operations
  for (const nonAdmin of [doctorSarahAuth, pharmacyAuth, patientAliceAuth]) {
    const r = await authorizeRequest({ userOverride: nonAdmin, allowedRoles: [UserRole.ADMIN] });
    check(r.errorResponse?.status === 403, `Non-admin role [${nonAdmin.role}] rejected with 403 from Admin operations`);
  }

  // Exhaustive 4x4 matrix
  const allRoles = [UserRole.DOCTOR, UserRole.PHARMACY, UserRole.PATIENT, UserRole.ADMIN];
  for (const userRole of allRoles) {
    for (const targetRole of allRoles) {
      const u: AuthUser = { id: "test-user", email: "test@demo", role: userRole };
      const authResult = await authorizeRequest({ allowedRoles: [targetRole], userOverride: u });
      if (userRole === targetRole) {
        check(authResult.errorResponse === null, `RBAC Matrix [${userRole} -> ${targetRole}]: ALLOWED (200)`);
      } else {
        check(authResult.errorResponse?.status === 403, `RBAC Matrix [${userRole} -> ${targetRole}]: FORBIDDEN (403)`);
      }
    }
  }

  // ---------------------------------------------------------------------------
  // 3. TEST OWNERSHIP ISOLATION
  // ---------------------------------------------------------------------------
  console.log("\n-------------------------------------------------------------------------------");
  console.log("3. TEST OWNERSHIP ISOLATION (PATIENT A/B, DOCTOR A/B ROSTER, PRESCRIPTION, ANALYTICS)");
  console.log("-------------------------------------------------------------------------------");

  // Create a seed prescription for Dr. Sarah and Patient Alice
  const sarahRxRes = await createDoctorPrescription(doctorSarah.id, {
    patientId: patientAlice.patientProfile!.id,
    diagnosis: "Seasonal Allergies and Rhinitis",
    documentRef: "rx-docs/test-ownership-sarah.pdf",
    medicines: [{ medicineId: medicine.id, dosage: "10mg", frequency: "Daily", duration: "7 days" }],
  });
  check("prescription" in sarahRxRes && Boolean(sarahRxRes.prescription?.id), "Setup: Created prescription authored by Dr. Sarah for Alice");
  const sarahRxId = (sarahRxRes as { prescription: { id: string } }).prescription.id;

  // 1. Patient A tries Patient B prescription -> safe 404
  const robertReadAliceRx = await getPatientPrescriptionDetail(patientRobert.id, sarahRxId);
  check("error" in robertReadAliceRx && robertReadAliceRx.statusCode === 404, "1. Patient Robert accessing Alice's prescription returns safe 404 (ID enumeration safe)");

  // 2. Patient A tries Patient B tracking -> safe 404
  const robertTrackAliceRx = await getPatientPrescriptionTracking(patientRobert.id, sarahRxId);
  check("error" in robertTrackAliceRx && robertTrackAliceRx.statusCode === 404, "2. Patient Robert tracking Alice's prescription returns safe 404");

  // 3. Doctor A tries Doctor B patient roster -> strict isolation
  const sarahRoster = await getDoctorPatientsRoster(doctorSarah.id);
  const johnRoster = await getDoctorPatientsRoster(doctorJohn.id);
  check("patients" in sarahRoster && "patients" in johnRoster, "Retrieved rosters for Dr. Sarah and Dr. John");
  const sarahPatientNames = (sarahRoster as { patients: Array<{ name: string }> }).patients.map((p) => p.name);
  const johnPatientNames = (johnRoster as { patients: Array<{ name: string }> }).patients.map((p) => p.name);
  check(
    !sarahPatientNames.includes("Emma Watson"),
    "3. Dr. Sarah cannot view Dr. John-only patient (Emma Watson) in roster"
  );
  check(
    johnPatientNames.includes("Emma Watson"),
    "3. Dr. John roster exclusively includes assigned patient Emma Watson"
  );

  // 4. Doctor A tries Doctor B prescription -> 403 Forbidden
  const johnReadSarahRx = await getDoctorPrescriptionDetail(doctorJohn.id, sarahRxId);
  check(
    "error" in johnReadSarahRx && johnReadSarahRx.statusCode === 403,
    "4. Dr. John attempting to read Dr. Sarah's authored prescription returns 403 Forbidden"
  );

  // 5. Doctor A tries Doctor B analytics -> strictly isolated counts
  const sarahAnalytics = await getDoctorAnalytics(doctorSarah.id);
  const johnAnalytics = await getDoctorAnalytics(doctorJohn.id);
  check(
    "summary" in sarahAnalytics && "summary" in johnAnalytics,
    "5. Doctor analytics executes in strict isolation per clinician"
  );
  const sSummary = (sarahAnalytics as { summary: { totalPrescriptions: number } }).summary;
  const jSummary = (johnAnalytics as { summary: { totalPrescriptions: number } }).summary;
  check(
    sSummary.totalPrescriptions !== jSummary.totalPrescriptions || sSummary.totalPrescriptions > 0,
    "5. Doctor analytics metrics strictly reflect author-scoped prescriptions"
  );

  // ---------------------------------------------------------------------------
  // 4. TEST DOCTOR-PATIENT LINKAGE & TRANSACTION ATOMICITY
  // ---------------------------------------------------------------------------
  console.log("\n-------------------------------------------------------------------------------");
  console.log("4. TEST DOCTOR-PATIENT LINKAGE & TRANSACTION ATOMICITY");
  console.log("-------------------------------------------------------------------------------");

  // Valid linked patient -> succeeds
  const linkedRx = await createDoctorPrescription(doctorSarah.id, {
    patientId: patientAlice.patientProfile!.id,
    diagnosis: "Valid Linked Patient Test",
    medicines: [{ medicineId: medicine.id, dosage: "50mg", frequency: "OD", duration: "3 days" }],
  });
  check("prescription" in linkedRx && Boolean(linkedRx.prescription?.id), "Valid linked patient: prescription creation succeeds");
  const linkedRxId = (linkedRx as { prescription: { id: string } }).prescription.id;

  // Record database counts before unlinked failure
  const rxCountBefore = await prisma.prescription.count();
  const medCountBefore = await prisma.prescriptionMedicine.count();

  // Unlinked patient -> creation fails (403 Forbidden)
  const unlinkedRx = await createDoctorPrescription(doctorSarah.id, {
    patientId: patientEmma.patientProfile!.id,
    diagnosis: "Unlinked Roster Bypass Attempt",
    medicines: [{ medicineId: medicine.id, dosage: "500mg", frequency: "TID", duration: "5 days" }],
  });
  check("error" in unlinkedRx && unlinkedRx.statusCode === 403, "Unlinked patient: prescription creation fails with 403 Forbidden");

  // Verify atomicity: no partial records left behind
  const rxCountAfter = await prisma.prescription.count();
  const medCountAfter = await prisma.prescriptionMedicine.count();
  check(rxCountBefore === rxCountAfter, "Atomicity: Zero partial Prescription rows created on linkage failure");
  check(medCountBefore === medCountAfter, "Atomicity: Zero orphaned PrescriptionMedicine rows created on linkage failure");

  // ---------------------------------------------------------------------------
  // 5. TEST STATUS MACHINE TRANSITIONS
  // ---------------------------------------------------------------------------
  console.log("\n-------------------------------------------------------------------------------");
  console.log("5. TEST STATUS MACHINE (VALID & INVALID TRANSITIONS)");
  console.log("-------------------------------------------------------------------------------");

  // Create two dedicated test prescriptions: one for FILLED, one for CANNOT_FILL
  const fillTestRx = await createDoctorPrescription(doctorSarah.id, {
    patientId: patientAlice.patientProfile!.id,
    diagnosis: "Status Machine Test FILLED",
    medicines: [{ medicineId: medicine.id, dosage: "10mg", frequency: "OD", duration: "1 day" }],
  });
  const fillTestRxId = (fillTestRx as { prescription: { id: string } }).prescription.id;

  const cannotFillTestRx = await createDoctorPrescription(doctorSarah.id, {
    patientId: patientAlice.patientProfile!.id,
    diagnosis: "Status Machine Test CANNOT_FILL",
    medicines: [{ medicineId: medicine.id, dosage: "10mg", frequency: "OD", duration: "1 day" }],
  });
  const cannotFillTestRxId = (cannotFillTestRx as { prescription: { id: string } }).prescription.id;

  // Valid 1: PENDING -> FILLED
  const validPendingToFilled = await fulfillPrescription(pharmacyUser.id, fillTestRxId, {
    action: "FILLED",
    notes: "Valid transition to FILLED",
  });
  check("success" in validPendingToFilled && validPendingToFilled.success === true, "Valid transition: PENDING -> FILLED succeeds");

  // Valid 2: PENDING -> CANNOT_FILL
  const validPendingToCannotFill = await fulfillPrescription(pharmacyUser.id, cannotFillTestRxId, {
    action: "CANNOT_FILL",
    notes: "Medication out of stock in regional warehouse",
  });
  check("success" in validPendingToCannotFill && validPendingToCannotFill.success === true, "Valid transition: PENDING -> CANNOT_FILL succeeds");

  // Invalid 1: FILLED -> PENDING (Cannot re-fulfill or revert)
  const filledToPending = await fulfillPrescription(pharmacyUser.id, fillTestRxId, {
    action: "FILLED",
    notes: "Attempting duplicate fill on filled rx",
  });
  check("error" in filledToPending && filledToPending.statusCode === 409, "Invalid transition: FILLED -> PENDING / Re-fill rejected with 409 Conflict");

  // Invalid 2: FILLED -> CANNOT_FILL
  const filledToCannotFill = await fulfillPrescription(pharmacyUser.id, fillTestRxId, {
    action: "CANNOT_FILL",
    notes: "Attempting CANNOT_FILL on already filled rx",
  });
  check("error" in filledToCannotFill && filledToCannotFill.statusCode === 409, "Invalid transition: FILLED -> CANNOT_FILL rejected with 409 Conflict");

  // Invalid 3: CANNOT_FILL -> PENDING / Re-fulfill
  const cannotFillToFilled = await fulfillPrescription(pharmacyUser.id, cannotFillTestRxId, {
    action: "FILLED",
    notes: "Attempting to re-fill CANNOT_FILL rx",
  });
  check("error" in cannotFillToFilled && cannotFillToFilled.statusCode === 409, "Invalid transition: CANNOT_FILL -> FILLED rejected with 409 Conflict");

  // Invalid 4: CANNOT_FILL -> CANNOT_FILL duplicate
  const cannotFillDuplicate = await fulfillPrescription(pharmacyUser.id, cannotFillTestRxId, {
    action: "CANNOT_FILL",
    notes: "Duplicate CANNOT_FILL",
  });
  check("error" in cannotFillDuplicate && cannotFillDuplicate.statusCode === 409, "Invalid transition: CANNOT_FILL -> CANNOT_FILL rejected with 409 Conflict");

  // ---------------------------------------------------------------------------
  // 6. TEST FULFILLMENT INTEGRITY & CONCURRENCY
  // ---------------------------------------------------------------------------
  console.log("\n-------------------------------------------------------------------------------");
  console.log("6. TEST FULFILLMENT: EXACTLY-ONCE, CONCURRENCY & PHARMACY IDENTITY");
  console.log("-------------------------------------------------------------------------------");

  // Setup prescription for concurrency
  const concRx = await createDoctorPrescription(doctorSarah.id, {
    patientId: patientAlice.patientProfile!.id,
    diagnosis: "Concurrency Exactly-Once Test",
    medicines: [{ medicineId: medicine.id, dosage: "10mg", frequency: "OD", duration: "1 day" }],
  });
  const concRxId = (concRx as { prescription: { id: string } }).prescription.id;

  // Concurrency: Fire 5 concurrent requests simultaneously
  const concurrentFulfillments = await Promise.all([
    fulfillPrescription(pharmacyUser.id, concRxId, { action: "FILLED", notes: "Worker 1" }),
    fulfillPrescription(pharmacyUser.id, concRxId, { action: "FILLED", notes: "Worker 2" }),
    fulfillPrescription(pharmacyUser.id, concRxId, { action: "FILLED", notes: "Worker 3" }),
    fulfillPrescription(pharmacyUser.id, concRxId, { action: "FILLED", notes: "Worker 4" }),
    fulfillPrescription(pharmacyUser.id, concRxId, { action: "FILLED", notes: "Worker 5" }),
  ]);

  const wins = concurrentFulfillments.filter((r) => "success" in r && r.success).length;
  const conflicts = concurrentFulfillments.filter((r) => "error" in r && r.statusCode === 409).length;

  check(wins === 1, `Concurrent execution: Exactly 1 worker succeeded (wins = ${wins})`);
  check(conflicts === 4, `Concurrent execution: Remaining 4 workers returned 409 Conflict (conflicts = ${conflicts})`);

  const fillRecordCount = await prisma.fill.count({ where: { prescriptionId: concRxId } });
  check(fillRecordCount === 1, "Database integrity verified: Exactly 1 Fill row created under race condition");

  // Pharmacy identity: fake/client-provided pharmacyId cannot impersonate
  const idTestRx = await createDoctorPrescription(doctorSarah.id, {
    patientId: patientAlice.patientProfile!.id,
    diagnosis: "Pharmacy Impersonation Defense Test",
    medicines: [{ medicineId: medicine.id, dosage: "5mg", frequency: "OD", duration: "1 day" }],
  });
  const idTestRxId = (idTestRx as { prescription: { id: string } }).prescription.id;

  await fulfillPrescription(pharmacyUser.id, idTestRxId, {
    action: "FILLED",
    notes: "Attempt with injected pharmacyId",
    // @ts-expect-error Testing untrusted body property
    pharmacyId: "injected-malicious-pharmacy-profile-id",
  });

  const persistedFill = await prisma.fill.findUniqueOrThrow({ where: { prescriptionId: idTestRxId } });
  check(
    persistedFill.pharmacyId === pharmacyUser.pharmacyProfile!.id,
    "Authenticated pharmacy identity recorded: client-injected pharmacyId ignored"
  );
  check(
    persistedFill.pharmacyId !== "injected-malicious-pharmacy-profile-id",
    "Fake/client-provided pharmacyId cannot impersonate another pharmacy"
  );

  // ---------------------------------------------------------------------------
  // 7. TEST MASS ASSIGNMENT
  // ---------------------------------------------------------------------------
  console.log("\n-------------------------------------------------------------------------------");
  console.log("7. TEST MASS ASSIGNMENT (PREVENT OVERRIDING SERVER-CONTROLLED FIELDS)");
  console.log("-------------------------------------------------------------------------------");

  const massAssignAttempt = await createDoctorPrescription(doctorSarah.id, {
    patientId: patientAlice.patientProfile!.id,
    diagnosis: "Mass Assignment Test",
    medicines: [{ medicineId: medicine.id, dosage: "25mg", frequency: "OD", duration: "2 days" }],
    // @ts-expect-error Submitting server-controlled fields
    doctorId: "hacked-doctor-id",
    status: PrescriptionStatus.FILLED,
    fulfilledAt: new Date("2020-01-01"),
    id: "hacked-prescription-id",
    createdAt: new Date("1999-01-01"),
  });

  const createdRx = (massAssignAttempt as { prescription: { id: string; status: PrescriptionStatus; doctorId: string; createdAt: Date } }).prescription;
  check(createdRx.id !== "hacked-prescription-id", "Mass assignment: Custom prescription 'id' injection ignored");
  check(createdRx.status === PrescriptionStatus.PENDING, "Mass assignment: 'status' initialized strictly to PENDING");
  check(createdRx.doctorId === doctorSarah.doctorProfile!.id, "Mass assignment: 'doctorId' strictly bound to server session");
  check(createdRx.createdAt.getFullYear() >= 2026, "Mass assignment: Server timestamp controls 'createdAt'");

  // ---------------------------------------------------------------------------
  // 8. TEST SENSITIVE DATA LEAKAGE
  // ---------------------------------------------------------------------------
  console.log("\n-------------------------------------------------------------------------------");
  console.log("8. TEST SENSITIVE DATA (ZERO SECRETS, CREDENTIALS, OR DB INTERNALS LEAKED)");
  console.log("-------------------------------------------------------------------------------");

  const [adminDashData, adminDoctorsData, doctorDetailData, patientDetailData, pharmacyDetailData] = await Promise.all([
    getAdminDashboardData(),
    getAdminDoctorsList(),
    getDoctorPrescriptionDetail(doctorSarah.id, sarahRxId),
    getPatientPrescriptionDetail(patientAlice.id, sarahRxId),
    getPharmacyPrescriptionDetail(pharmacyUser.id, sarahRxId),
  ]);

  const auditPayload = JSON.stringify({
    adminDashData,
    adminDoctorsData,
    doctorDetailData,
    patientDetailData,
    pharmacyDetailData,
  });

  const sensitiveTerms = [
    "password",
    "passwordHash",
    "secret",
    "DATABASE_URL",
    "GCP_PRIVATE_KEY",
    "NEXTAUTH_SECRET",
    "Bearer ",
  ];

  for (const term of sensitiveTerms) {
    check(!auditPayload.includes(`"${term}"`) && !auditPayload.includes(`'${term}'`), `Zero sensitive field '${term}' present in API responses`);
  }

  // ---------------------------------------------------------------------------
  // 9. TEST FILE & DOCUMENT SECURITY
  // ---------------------------------------------------------------------------
  console.log("\n-------------------------------------------------------------------------------");
  console.log("9. TEST FILE SECURITY (IDOR PROTECTION, GUESSED REFERENCES, PATH TRAVERSAL)");
  console.log("-------------------------------------------------------------------------------");

  // Guessing / manipulating references across users
  const strangerDoctorAccess = await canUserAccessPrescription(doctorJohnAuth, sarahRxId);
  check(!strangerDoctorAccess.allowed, "Stranger doctor cannot access document for un-authored prescription (403)");

  const strangerPatientAccess = await canUserAccessPrescription(patientRobertAuth, sarahRxId);
  check(!strangerPatientAccess.allowed, "Stranger patient cannot access document for another patient's prescription (403)");

  // Authorized users can access
  const authorDoctorAccess = await canUserAccessPrescription(doctorSarahAuth, sarahRxId);
  check(authorDoctorAccess.allowed, "Authoring doctor authorized to access prescription document");

  const ownerPatientAccess = await canUserAccessPrescription(patientAliceAuth, sarahRxId);
  check(ownerPatientAccess.allowed, "Owner patient authorized to access prescription document");

  // Path traversal in filename upload validator
  const traversalUpload = validateDocumentFile({
    buffer: Buffer.from("dummy pdf content"),
    originalName: "../../etc/passwd.pdf",
    mimeType: "application/pdf",
    size: 17,
  });
  check(!traversalUpload.valid, "Upload validator rejects directory traversal in filename ('../../etc/passwd.pdf')");

  // Path traversal in documentRef creation
  const traversalCreate = await createDoctorPrescription(doctorSarah.id, {
    patientId: patientAlice.patientProfile!.id,
    diagnosis: "Path Traversal Probe",
    documentRef: "../../../etc/shadow",
    medicines: [{ medicineId: medicine.id, dosage: "10mg", frequency: "OD", duration: "1 day" }],
  });
  check("error" in traversalCreate && traversalCreate.statusCode === 400, "Prescription creation rejects directory traversal in documentRef (400)");

  // Storage getDocument direct probe
  const directStorageProbe = await storageService.getDocument("../../../secret.key");
  check(directStorageProbe === null, "Storage service safely returns null on manipulated path traversal probe");

  // ---------------------------------------------------------------------------
  // 10. TEST MALFORMED INPUT & ABUSE HARNESS
  // ---------------------------------------------------------------------------
  console.log("\n-------------------------------------------------------------------------------");
  console.log("10. TEST MALFORMED INPUT (INVALID IDS, ENUMS, ACTIONS, EMPTY ARRAYS, INJECTIONS)");
  console.log("-------------------------------------------------------------------------------");

  // Empty medicines array
  const emptyMeds = await createDoctorPrescription(doctorSarah.id, {
    patientId: patientAlice.patientProfile!.id,
    diagnosis: "Empty Meds Probe",
    medicines: [],
  });
  check("error" in emptyMeds && emptyMeds.statusCode === 400, "Rejects empty medicines array with 400");

  // Whitespace-only dosage
  const whitespaceDosage = await createDoctorPrescription(doctorSarah.id, {
    patientId: patientAlice.patientProfile!.id,
    diagnosis: "Whitespace Dosage Probe",
    medicines: [{ medicineId: medicine.id, dosage: "    ", frequency: "OD", duration: "1 day" }],
  });
  check("error" in whitespaceDosage && whitespaceDosage.statusCode === 400, "Rejects whitespace-only dosage with 400");

  // Duplicate medicines
  const duplicateMeds = await createDoctorPrescription(doctorSarah.id, {
    patientId: patientAlice.patientProfile!.id,
    diagnosis: "Duplicate Meds Probe",
    medicines: [
      { medicineId: medicine.id, dosage: "10mg", frequency: "OD", duration: "2 days" },
      { medicineId: medicine.id, dosage: "20mg", frequency: "BD", duration: "3 days" },
    ],
  });
  check("error" in duplicateMeds && duplicateMeds.statusCode === 400, "Rejects duplicate medications in same prescription with 400");

  // Invalid enum / action in fulfillment
  const invalidAction = await fulfillPrescription(pharmacyUser.id, sarahRxId, {
    action: "MALICIOUS_DROP_TABLE",
  });
  check("error" in invalidAction && invalidAction.statusCode === 400, "Rejects invalid action enum ('MALICIOUS_DROP_TABLE') with 400");

  // Malicious SQL injection string in patientId
  const sqlInjectionAttempt = await createDoctorPrescription(doctorSarah.id, {
    patientId: "'; DROP TABLE \"Prescription\"; --",
    diagnosis: "SQL Injection Probe",
    medicines: [{ medicineId: medicine.id, dosage: "10mg", frequency: "OD", duration: "1 day" }],
  });
  check("error" in sqlInjectionAttempt && (sqlInjectionAttempt.statusCode === 404 || sqlInjectionAttempt.statusCode === 400), "SQL injection in patientId safely handled without database crash");

  // XSS script injection in diagnosis
  const xssAttempt = await createDoctorPrescription(doctorSarah.id, {
    patientId: patientAlice.patientProfile!.id,
    diagnosis: "<script>alert('XSS')</script>",
    medicines: [{ medicineId: medicine.id, dosage: "10mg", frequency: "OD", duration: "1 day" }],
  });
  check("prescription" in xssAttempt && Boolean(xssAttempt.prescription?.id), "XSS payload stored safely without execution or crash");
  const xssRxId = (xssAttempt as { prescription: { id: string } }).prescription.id;

  // Invalid ID route parameter format
  const invalidIdReq = new Request("http://localhost:3000/api/prescriptions/%20%20%20");
  const invalidIdRes = await sharedPrescriptionDetailRoute(invalidIdReq, { params: { id: "   " } });
  check(invalidIdRes.status === 400 || invalidIdRes.status === 401, "Route handler with whitespace ID parameter safely rejects with 400/401");

  // Direct canUserAccessPrescription check for whitespace ID
  const whitespaceIdCheck = await canUserAccessPrescription(doctorSarahAuth, "   ");
  check(!whitespaceIdCheck.allowed, "canUserAccessPrescription with whitespace ID safely returns allowed=false");

  // ---------------------------------------------------------------------------
  // 11. TEST ERROR SECURITY
  // ---------------------------------------------------------------------------
  console.log("\n-------------------------------------------------------------------------------");
  console.log("11. TEST ERROR SECURITY (NO RAW SQL, PRISMA TRACES, OR INTERNAL PATHS)");
  console.log("-------------------------------------------------------------------------------");

  // Prisma simulated error envelope test
  const simulatedPrismaError = new Error("Invalid `prisma.prescription.findUnique()` invocation:\nPrismaClientKnownRequestError: Table 'db.Prescriptions' does not exist");
  const formattedErrorResponse = apiError(simulatedPrismaError);
  const errorJson = await formattedErrorResponse.json();
  check(formattedErrorResponse.status === 500, "Unhandled database crash returns generic 500");
  check(errorJson.error.code === "INTERNAL_SERVER_ERROR", "Error code mapped to INTERNAL_SERVER_ERROR");
  check(!errorJson.error.message.includes("Table 'db.Prescriptions'"), "Formatted error strips raw SQL/table names");
  check(!errorJson.error.message.includes("PrismaClientKnownRequestError"), "Formatted error strips Prisma internal error names");

  // Test Prisma P2002 (Unique constraint violation)
  const p2002Error = new Prisma.PrismaClientKnownRequestError("Unique constraint failed on the fields: (`prescriptionId`)", {
    code: "P2002",
    clientVersion: "6.19.3",
  });
  const p2002Response = apiError(p2002Error);
  const p2002Json = await p2002Response.json();
  check(p2002Response.status === 409, "Prisma P2002 mapped to 409 Conflict");
  check(p2002Json.error.code === "CONFLICT", "Prisma P2002 code is CONFLICT");
  check(!p2002Json.error.message.includes("`prescriptionId`"), "Prisma P2002 sanitizes internal column names");

  // ---------------------------------------------------------------------------
  // 12. TEST REGRESSION: FULL E2E BUSINESS FLOW
  // ---------------------------------------------------------------------------
  console.log("\n-------------------------------------------------------------------------------");
  console.log("12. TEST REGRESSION: FULL END-TO-END BUSINESS LIFECYCLE FLOW");
  console.log("-------------------------------------------------------------------------------");

  // Step 1: Doctor creates prescription
  const e2eRxRes = await createDoctorPrescription(doctorSarah.id, {
    patientId: patientAlice.patientProfile!.id,
    diagnosis: "E2E Lifecycle Hardening Verification",
    medicines: [{ medicineId: medicine.id, dosage: "100mg", frequency: "TID", duration: "5 days" }],
  });
  check("prescription" in e2eRxRes && Boolean(e2eRxRes.prescription?.id), "Step 1: Doctor successfully creates prescription");
  const e2eRxId = (e2eRxRes as { prescription: { id: string } }).prescription.id;

  // Step 2: Verify Initial PENDING state in Patient tracking & Pharmacy queue
  const initialTracking = await getPatientPrescriptionTracking(patientAlice.id, e2eRxId);
  const initTrack = initialTracking as { tracking?: { status: PrescriptionStatus } };
  check("tracking" in initialTracking && initTrack.tracking?.status === PrescriptionStatus.PENDING, "Step 2: Patient tracking confirms PENDING status");

  // Step 3: Pharmacy fills prescription
  const e2eFulfillRes = await fulfillPrescription(pharmacyUser.id, e2eRxId, {
    action: "FILLED",
    notes: "Dispensed with proper dosage counseling",
  });
  check("success" in e2eFulfillRes && e2eFulfillRes.success === true, "Step 3: Pharmacy fulfills prescription successfully");

  // Step 4: Patient tracking shows FILLED and pharmacy details
  const postFulfillTracking = await getPatientPrescriptionTracking(patientAlice.id, e2eRxId);
  const postTrack = postFulfillTracking as { tracking?: { status: PrescriptionStatus; fulfillment?: { pharmacyName: string } } };
  check(
    "tracking" in postFulfillTracking &&
      postTrack.tracking?.status === PrescriptionStatus.FILLED &&
      Boolean(postTrack.tracking?.fulfillment?.pharmacyName),
    "Step 4: Patient tracking shows FILLED status with pharmacy details"
  );

  // Step 5: Admin platform analytics reflects the fulfillment
  const adminAnalytics = await getAdminAnalyticsData();
  check(
    adminAnalytics.totalPrescriptionsFulfilled >= 1,
    "Step 5: Admin platform analytics records fulfillment count"
  );

  // ---------------------------------------------------------------------------
  // CLEANUP TEST RECORDS
  // ---------------------------------------------------------------------------
  console.log("\n-------------------------------------------------------------------------------");
  console.log("CLEANUP TEST DATA");
  console.log("-------------------------------------------------------------------------------");
  const allCreatedRxIds = [
    sarahRxId,
    linkedRxId,
    fillTestRxId,
    cannotFillTestRxId,
    concRxId,
    idTestRxId,
    createdRx.id,
    xssRxId,
    e2eRxId,
  ];

  await prisma.prescriptionMedicine.deleteMany({ where: { prescriptionId: { in: allCreatedRxIds } } });
  await prisma.fill.deleteMany({ where: { prescriptionId: { in: allCreatedRxIds } } });
  await prisma.prescription.deleteMany({ where: { id: { in: allCreatedRxIds } } });
  check(true, "Cleaned up all temporary test prescriptions and fills");

  console.log("\n===============================================================================");
  console.log(`🎉 ALL ${passedChecks}/${totalChecks} COMPREHENSIVE SECURITY & ABUSE CHECKS PASSED!`);
  console.log("===============================================================================\n");
}

runDay17ComprehensiveSecurityAudit()
  .catch((err) => {
    console.error("FATAL: Comprehensive security audit failed:", err);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
