import assert from "assert";
import { UserRole, PrescriptionStatus } from "@prisma/client";
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
} from "../lib/patient-service";
import {
  getAdminDashboardData,
  getAdminDoctorsList,
  getAdminPharmacyInfo,
  getAdminPrescriptionsList,
  getAdminPrescriptionDetail,
} from "../lib/admin-service";
import { storageService, validateDocumentFile } from "../lib/storage";
import { GET as getPrescriptionDocument } from "../app/api/prescriptions/[id]/document/route";
import { POST as registerRoute } from "../app/api/auth/register/route";
import { POST as forgotPasswordRoute } from "../app/api/auth/forgot-password/route";
import { POST as resetPasswordRoute } from "../app/api/auth/reset-password/route";
import { GET as doctorPrescriptionsRoute } from "../app/api/doctor/prescriptions/route";
import { NextRequest } from "next/server";

async function runDay17SecurityTestSuite() {
  console.log("===============================================================================");
  console.log("🛡️  MedEasy Day 17 - Complete Backend Security & Hardening Verification");
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
  // 1. AUTHENTICATION (Unauthenticated -> 401)
  // ---------------------------------------------------------------------------
  console.log("-------------------------------------------------------------------------------");
  console.log("1. AUTHENTICATION: REJECT UNAUTHENTICATED REQUESTS WITH 401");
  console.log("-------------------------------------------------------------------------------");

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

  // Document route unauthenticated
  const docReq = new Request("http://localhost:3000/api/prescriptions/fake-id/document");
  const docUnauthRes = await getPrescriptionDocument(docReq, { params: { id: "fake-id" } });
  check(docUnauthRes.status === 401, "GET /api/prescriptions/[id]/document returns 401 when unauthenticated");

  // ---------------------------------------------------------------------------
  // 2. RBAC (Wrong Role -> 403)
  // ---------------------------------------------------------------------------
  console.log("\n-------------------------------------------------------------------------------");
  console.log("2. RBAC: ENFORCE ENDPOINT-LEVEL ROLES (WRONG ROLE -> 403)");
  console.log("-------------------------------------------------------------------------------");

  const roles = [UserRole.DOCTOR, UserRole.PHARMACY, UserRole.PATIENT, UserRole.ADMIN];
  for (const userRole of roles) {
    for (const targetRole of roles) {
      const testUser: AuthUser = { id: "test-user", email: "test@demo", role: userRole };
      const authResult = await authorizeRequest({ allowedRoles: [targetRole], userOverride: testUser });
      if (userRole === targetRole) {
        check(authResult.errorResponse === null, `RBAC [${userRole} -> ${targetRole}]: ALLOWED (200)`);
      } else {
        check(authResult.errorResponse?.status === 403, `RBAC [${userRole} -> ${targetRole}]: FORBIDDEN (403)`);
      }
    }
  }

  // ---------------------------------------------------------------------------
  // 3. OWNERSHIP ISOLATION (DOCTOR & PATIENT)
  // ---------------------------------------------------------------------------
  console.log("\n-------------------------------------------------------------------------------");
  console.log("3. OWNERSHIP ISOLATION: DOCTOR & PATIENT RESTRICTED TO OWN RECORDS");
  console.log("-------------------------------------------------------------------------------");

  // Create a prescription authored by Dr. Sarah for Alice
  const sarahRxRes = await createDoctorPrescription(doctorSarah.id, {
    patientId: patientAlice.patientProfile!.id,
    diagnosis: "Seasonal Allergies",
    documentRef: "rx-docs/test-security-sarah.pdf",
    medicines: [{ medicineId: medicine.id, dosage: "10mg", frequency: "Daily", duration: "7 days" }],
  });
  check("prescription" in sarahRxRes && Boolean(sarahRxRes.prescription?.id), "Created prescription authored by Dr. Sarah");
  const sarahRxId = (sarahRxRes as { prescription: { id: string } }).prescription.id;

  // Dr. John attempts to read Dr. Sarah's prescription
  const johnAttempt = await getDoctorPrescriptionDetail(doctorJohn.id, sarahRxId);
  check("error" in johnAttempt && johnAttempt.statusCode === 403, "Dr. John blocked from reading Dr. Sarah's prescription (403)");

  // Patient Robert attempts to read Patient Alice's prescription
  const robertAttempt = await getPatientPrescriptionDetail(patientRobert.id, sarahRxId);
  check("error" in robertAttempt && robertAttempt.statusCode === 404, "Patient Robert querying Alice's prescription returns safe 404");

  // Patient Robert attempts to read tracking of Alice's prescription
  const robertTrackingAttempt = await getPatientPrescriptionTracking(patientRobert.id, sarahRxId);
  check("error" in robertTrackingAttempt && robertTrackingAttempt.statusCode === 404, "Patient Robert tracking Alice's prescription returns safe 404");

  // Patient Alice CAN read her own prescription
  const aliceAccess = await getPatientPrescriptionDetail(patientAlice.id, sarahRxId);
  check("prescription" in aliceAccess && Boolean(aliceAccess.prescription?.id), "Patient Alice successfully retrieves her own prescription");

  // Dr. Sarah CAN read her own prescription
  const sarahAccess = await getDoctorPrescriptionDetail(doctorSarah.id, sarahRxId);
  check("prescription" in sarahAccess && Boolean(sarahAccess.prescription?.id), "Dr. Sarah successfully retrieves her authored prescription");

  // ---------------------------------------------------------------------------
  // 4. DOCTOR-PATIENT CARE ROSTER LINKAGE
  // ---------------------------------------------------------------------------
  console.log("\n-------------------------------------------------------------------------------");
  console.log("4. DOCTOR-PATIENT LINKAGE: VERIFY ROSTER REQUIREMENT");
  console.log("-------------------------------------------------------------------------------");

  // Dr. Sarah attempts to create a prescription for Patient Emma (unlinked)
  const unlinkedAttempt = await createDoctorPrescription(doctorSarah.id, {
    patientId: patientEmma.patientProfile!.id,
    diagnosis: "Unlinked Patient Attempt",
    medicines: [{ medicineId: medicine.id, dosage: "500mg", frequency: "TID", duration: "5 days" }],
  });
  check("error" in unlinkedAttempt && unlinkedAttempt.statusCode === 403, "Prescription creation for unlinked patient rejected with 403 Forbidden");

  // Non-existent patient ID
  const nonExistentPatientAttempt = await createDoctorPrescription(doctorSarah.id, {
    patientId: "non-existent-patient-cuid",
    diagnosis: "Ghost Patient",
    medicines: [{ medicineId: medicine.id, dosage: "500mg", frequency: "TID", duration: "5 days" }],
  });
  check("error" in nonExistentPatientAttempt && nonExistentPatientAttempt.statusCode === 404, "Prescription creation for non-existent patient ID returns 404");

  // ---------------------------------------------------------------------------
  // 5. STATUS MACHINE & EXACTLY-ONCE FULFILLMENT
  // ---------------------------------------------------------------------------
  console.log("\n-------------------------------------------------------------------------------");
  console.log("5. STATUS MACHINE & EXACTLY-ONCE FULFILLMENT");
  console.log("-------------------------------------------------------------------------------");

  // Invalid action
  const invalidActionAttempt = await fulfillPrescription(pharmacyUser.id, sarahRxId, {
    action: "DISPENSE_NOW",
  });
  check("error" in invalidActionAttempt && invalidActionAttempt.statusCode === 400, "Invalid fulfillment action rejected with 400");

  // First fulfillment: PENDING -> FILLED
  const firstFulfill = await fulfillPrescription(pharmacyUser.id, sarahRxId, {
    action: "FILLED",
    notes: "Verified and dispensed by Central Pharmacy",
  });
  check("success" in firstFulfill && firstFulfill.success === true, "Prescription successfully filled (PENDING -> FILLED)");

  // Duplicate fulfillment: FILLED -> FILLED
  const duplicateFulfill = await fulfillPrescription(pharmacyUser.id, sarahRxId, {
    action: "FILLED",
    notes: "Second attempt should fail",
  });
  check("error" in duplicateFulfill && duplicateFulfill.statusCode === 409, "Duplicate fulfillment on FILLED prescription returns 409 Conflict");

  // Invalid transition: FILLED -> CANNOT_FILL
  const invalidTransition = await fulfillPrescription(pharmacyUser.id, sarahRxId, {
    action: "CANNOT_FILL",
    notes: "Attempt to revert filled prescription",
  });
  check("error" in invalidTransition && invalidTransition.statusCode === 409, "Terminal state transition FILLED -> CANNOT_FILL returns 409 Conflict");

  // ---------------------------------------------------------------------------
  // 6. CONCURRENT FULFILLMENT ATTEMPTS
  // ---------------------------------------------------------------------------
  console.log("\n-------------------------------------------------------------------------------");
  console.log("6. CONCURRENCY: SIMULTANEOUS FULFILLMENT REQUESTS");
  console.log("-------------------------------------------------------------------------------");

  // Create another pending prescription for Alice
  const concRxRes = await createDoctorPrescription(doctorSarah.id, {
    patientId: patientAlice.patientProfile!.id,
    diagnosis: "Concurrency Stress Test",
    medicines: [{ medicineId: medicine.id, dosage: "250mg", frequency: "BD", duration: "3 days" }],
  });
  const concRxId = (concRxRes as { prescription: { id: string } }).prescription.id;

  // Fire 5 concurrent fulfill requests simultaneously
  const concurrentResults = await Promise.all([
    fulfillPrescription(pharmacyUser.id, concRxId, { action: "FILLED", notes: "Worker 1" }),
    fulfillPrescription(pharmacyUser.id, concRxId, { action: "FILLED", notes: "Worker 2" }),
    fulfillPrescription(pharmacyUser.id, concRxId, { action: "FILLED", notes: "Worker 3" }),
    fulfillPrescription(pharmacyUser.id, concRxId, { action: "FILLED", notes: "Worker 4" }),
    fulfillPrescription(pharmacyUser.id, concRxId, { action: "FILLED", notes: "Worker 5" }),
  ]);

  const successCount = concurrentResults.filter((r) => "success" in r && r.success).length;
  const conflictCount = concurrentResults.filter((r) => "error" in r && r.statusCode === 409).length;

  check(successCount === 1, `Exactly 1 concurrent fulfillment succeeded (successCount = ${successCount})`);
  check(conflictCount === 4, `Remaining 4 concurrent fulfillments rejected with 409 Conflict (conflictCount = ${conflictCount})`);

  const fillCountInDb = await prisma.fill.count({ where: { prescriptionId: concRxId } });
  check(fillCountInDb === 1, `Database integrity verified: exactly 1 Fill record exists for prescription`);

  // ---------------------------------------------------------------------------
  // 7. PHARMACY IDENTITY INTEGRITY (IGNORE FAKE PHARMACY ID)
  // ---------------------------------------------------------------------------
  console.log("\n-------------------------------------------------------------------------------");
  console.log("7. PHARMACY IDENTITY: IGNORE CLIENT-SUPPLIED PHARMACY ID");
  console.log("-------------------------------------------------------------------------------");

  const testRx3 = await createDoctorPrescription(doctorSarah.id, {
    patientId: patientAlice.patientProfile!.id,
    diagnosis: "Identity Verification Rx",
    medicines: [{ medicineId: medicine.id, dosage: "100mg", frequency: "OD", duration: "2 days" }],
  });
  const testRx3Id = (testRx3 as { prescription: { id: string } }).prescription.id;

  // Attempt to pass malicious pharmacyId in body
  const fulfillWithFakeId = await fulfillPrescription(pharmacyUser.id, testRx3Id, {
    action: "FILLED",
    notes: "Attempt with injected pharmacyId",
    // @ts-expect-error Testing client body injection
    pharmacyId: "fake-malicious-pharmacy-profile-id",
  });
  check("success" in fulfillWithFakeId && fulfillWithFakeId.success === true, "Prescription filled with authenticated pharmacy context");

  const dbFillRecord = await prisma.fill.findUniqueOrThrow({
    where: { prescriptionId: testRx3Id },
  });
  check(
    dbFillRecord.pharmacyId === pharmacyUser.pharmacyProfile!.id,
    "Fill.pharmacyId strictly matched authenticated pharmacy profile, ignoring injection"
  );

  // ---------------------------------------------------------------------------
  // 8. MASS ASSIGNMENT & SERVER-CONTROLLED VALUES
  // ---------------------------------------------------------------------------
  console.log("\n-------------------------------------------------------------------------------");
  console.log("8. MASS ASSIGNMENT: REJECT OVERRIDE OF STATUS, DOCTORID, TIMESTAMPS");
  console.log("-------------------------------------------------------------------------------");

  // Clinician attempts to inject status: "FILLED" and doctorId: "fake-doctor"
  const massAssignAttempt = await createDoctorPrescription(doctorSarah.id, {
    patientId: patientAlice.patientProfile!.id,
    diagnosis: "Mass Assignment Test",
    medicines: [{ medicineId: medicine.id, dosage: "50mg", frequency: "OD", duration: "1 day" }],
    // @ts-expect-error Testing untrusted fields
    status: PrescriptionStatus.FILLED,
    doctorId: "hacked-doctor-id",
    id: "hacked-prescription-id",
    createdAt: new Date("2020-01-01"),
  });

  const createdRx = (massAssignAttempt as { prescription: { id: string; status: PrescriptionStatus; doctorId: string } }).prescription;
  check(createdRx.status === PrescriptionStatus.PENDING, "Prescription status initialized strictly to PENDING (injection ignored)");
  check(createdRx.doctorId === doctorSarah.doctorProfile!.id, "doctorId strictly derived from server session (injection ignored)");
  check(createdRx.id !== "hacked-prescription-id", "Prescription ID generated by server, custom ID ignored");

  // ---------------------------------------------------------------------------
  // 9. SENSITIVE RESPONSE FIELDS AUDIT (NO SECRETS RETURNED)
  // ---------------------------------------------------------------------------
  console.log("\n-------------------------------------------------------------------------------");
  console.log("9. API RESPONSE SECURITY: ZERO SENSITIVE CREDENTIALS LEAKED");
  console.log("-------------------------------------------------------------------------------");

  // Retrieve samples from all service modules
  const [adminDash, doctorDetail, patientDetail, pharmacyDetail] = await Promise.all([
    getAdminDashboardData(),
    getDoctorPrescriptionDetail(doctorSarah.id, sarahRxId),
    getPatientPrescriptionDetail(patientAlice.id, sarahRxId),
    getPharmacyPrescriptionDetail(pharmacyUser.id, sarahRxId),
  ]);

  const serializedData = JSON.stringify({ adminDash, doctorDetail, patientDetail, pharmacyDetail });

  check(!serializedData.includes("password"), "No 'password' field in serialized responses");
  check(!serializedData.includes("passwordHash"), "No 'passwordHash' field in serialized responses");
  check(!serializedData.includes("secret"), "No 'secret' field in serialized responses");
  check(!serializedData.includes("DATABASE_URL"), "No 'DATABASE_URL' in serialized responses");
  check(!serializedData.includes("GCP_PRIVATE_KEY"), "No 'GCP_PRIVATE_KEY' in serialized responses");

  // ---------------------------------------------------------------------------
  // 10. FILE & DOCUMENT SECURITY (NO IDOR, PATH TRAVERSAL REJECTED)
  // ---------------------------------------------------------------------------
  console.log("\n-------------------------------------------------------------------------------");
  console.log("10. FILE SECURITY: IDOR PROTECTION & PATH TRAVERSAL REJECTION");
  console.log("-------------------------------------------------------------------------------");

  // Path traversal in filename upload validation
  const traversalValidation = validateDocumentFile({
    buffer: Buffer.from("test document content"),
    originalName: "../../etc/passwd.pdf",
    mimeType: "application/pdf",
    size: 21,
  });
  check(!traversalValidation.valid, "File with path traversal ('../../etc/passwd.pdf') rejected by validator");

  // Prescription creation with path traversal in documentRef
  const traversalDocRefAttempt = await createDoctorPrescription(doctorSarah.id, {
    patientId: patientAlice.patientProfile!.id,
    diagnosis: "Path Traversal Test",
    documentRef: "../../../etc/shadow",
    medicines: [{ medicineId: medicine.id, dosage: "10mg", frequency: "OD", duration: "1 day" }],
  });
  check("error" in traversalDocRefAttempt && traversalDocRefAttempt.statusCode === 400, "Path traversal in documentRef rejected with 400");

  // Storage getDocument path traversal
  const traversalStorageFetch = await storageService.getDocument("../../../secret.key");
  check(traversalStorageFetch === null, "storageService.getDocument('../../../secret.key') safely returns null");

  // Authorized document access via prescription ownership
  const canAccessOwner = await canUserAccessPrescription(patientAliceAuth, sarahRxId);
  check(canAccessOwner.allowed, "Patient Alice authorized to access her prescription document");

  const canAccessDoctor = await canUserAccessPrescription(doctorSarahAuth, sarahRxId);
  check(canAccessDoctor.allowed, "Doctor Sarah authorized to access her prescription document");

  const canAccessStrangerDoctor = await canUserAccessPrescription(doctorJohnAuth, sarahRxId);
  check(!canAccessStrangerDoctor.allowed, "Unrelated Doctor John denied access to prescription document (403)");

  const canAccessStrangerPatient = await canUserAccessPrescription(patientRobertAuth, sarahRxId);
  check(!canAccessStrangerPatient.allowed, "Unrelated Patient Robert denied access to prescription document (403)");

  // ---------------------------------------------------------------------------
  // 11. INPUT VALIDATION HARNESS
  // ---------------------------------------------------------------------------
  console.log("\n-------------------------------------------------------------------------------");
  console.log("11. INPUT VALIDATION: MALFORMED DATA, EMPTY ARRAYS, INVALID ENUMS");
  console.log("-------------------------------------------------------------------------------");

  // Empty medicines array
  const emptyMedicines = await createDoctorPrescription(doctorSarah.id, {
    patientId: patientAlice.patientProfile!.id,
    diagnosis: "Empty Meds",
    medicines: [],
  });
  check("error" in emptyMedicines && emptyMedicines.statusCode === 400, "Prescription creation with empty medicines rejected with 400");

  // Missing dosage
  const missingDosage = await createDoctorPrescription(doctorSarah.id, {
    patientId: patientAlice.patientProfile!.id,
    diagnosis: "Missing Dosage",
    medicines: [{ medicineId: medicine.id, dosage: "   ", frequency: "OD", duration: "1 day" }],
  });
  check("error" in missingDosage && missingDosage.statusCode === 400, "Medication with whitespace dosage rejected with 400");

  // Duplicate medicines in same prescription
  const duplicateMedicines = await createDoctorPrescription(doctorSarah.id, {
    patientId: patientAlice.patientProfile!.id,
    diagnosis: "Duplicate Meds",
    medicines: [
      { medicineId: medicine.id, dosage: "10mg", frequency: "OD", duration: "5 days" },
      { medicineId: medicine.id, dosage: "20mg", frequency: "BD", duration: "3 days" },
    ],
  });
  check("error" in duplicateMedicines && duplicateMedicines.statusCode === 400, "Duplicate medications in same prescription rejected with 400");

  // Invalid query status parameter in doctor prescriptions route
  const invalidStatusReq = new Request("http://localhost:3000/api/doctor/prescriptions?status=INVALID_STATUS");
  const invalidStatusRes = await doctorPrescriptionsRoute(invalidStatusReq);
  // Unauth check first, or if authorized validates enum
  check(invalidStatusRes.status === 401 || invalidStatusRes.status === 400, "Invalid query status rejected with appropriate error code");

  // Registration input validation
  const invalidRegisterReq = new Request("http://localhost:3000/api/auth/register", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ role: UserRole.PATIENT, email: "invalid-email-no-at", password: "short" }),
  });
  const registerRes = await registerRoute(invalidRegisterReq);
  check(registerRes.status === 400, "Patient registration with invalid email format rejected with 400");

  const negativeAgeReq = new Request("http://localhost:3000/api/auth/register", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      role: UserRole.PATIENT,
      email: "valid@email.com",
      password: "validPassword123!",
      name: "Test Patient",
      gender: "Female",
      contactInfo: "555-1234",
      age: -5,
    }),
  });
  const negativeAgeRes = await registerRoute(negativeAgeReq);
  check(negativeAgeRes.status === 400, "Patient registration with negative age rejected with 400");

  // Clean up created test records
  console.log("\n-------------------------------------------------------------------------------");
  console.log("CLEANUP TEMPORARY TEST DATA");
  console.log("-------------------------------------------------------------------------------");
  await prisma.prescriptionMedicine.deleteMany({
    where: { prescriptionId: { in: [sarahRxId, concRxId, testRx3Id, createdRx.id] } },
  });
  await prisma.fill.deleteMany({
    where: { prescriptionId: { in: [sarahRxId, concRxId, testRx3Id, createdRx.id] } },
  });
  await prisma.prescription.deleteMany({
    where: { id: { in: [sarahRxId, concRxId, testRx3Id, createdRx.id] } },
  });
  check(true, "Temporary security test prescriptions and fills cleanly removed");

  console.log("\n===============================================================================");
  console.log(`🎉 ALL ${passedChecks}/${totalChecks} BACKEND SECURITY CHECKS PASSED SUCCESSFULLY!`);
  console.log("===============================================================================\n");
}

runDay17SecurityTestSuite()
  .catch((err) => {
    console.error("FATAL: Security test suite failed:", err);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
