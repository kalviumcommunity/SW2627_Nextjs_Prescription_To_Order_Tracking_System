import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import bcrypt from "bcryptjs";
import { Prisma, PrescriptionStatus, UserRole } from "@prisma/client";
import { prisma } from "../lib/prisma";
import {
  AuthUser,
  canDoctorAccessPatient,
  canUserAccessPrescription,
  requireRole,
  sanitizePrescriptionForPharmacy,
} from "../lib/permissions";
import {
  apiError,
  apiSuccess,
  ApplicationError,
  businessRuleError,
  conflictError,
  errorFromResult,
  forbiddenError,
  notFoundError,
  validationError,
} from "../lib/api-errors";
import {
  createDoctorPrescription,
  getDoctorAnalytics,
  getDoctorDashboardData,
  getDoctorPatientsRoster,
  getDoctorPrescriptionDetail,
  getDoctorPrescriptionsList,
} from "../lib/doctor-service";
import {
  fulfillPrescription,
  getPharmacyAnalytics,
  getPharmacyDashboardData,
  getPharmacyHistory,
  getPharmacyPrescriptionDetail,
  getPharmacyPrescriptions,
} from "../lib/pharmacy-service";
import {
  getPatientDashboardData,
  getPatientPrescriptionDetail,
  getPatientPrescriptionsList,
  getPatientPrescriptionTracking,
} from "../lib/patient-service";
import {
  getAdminAnalyticsData,
  getAdminDashboardData,
  getAdminDoctorsList,
  getAdminPharmacyInfo,
  getAdminPrescriptionDetail,
  getAdminPrescriptionsList,
} from "../lib/admin-service";

// Shared UI components for direct import integrity
import { LoadingState } from "../components/ui/LoadingState";
import { EmptyState } from "../components/ui/EmptyState";
import { ErrorState } from "../components/ui/ErrorState";
import { Modal } from "../components/ui/Modal";
import { PrescriptionStatus as PrescriptionStatusBadge, STATUS_CONFIG } from "../components/prescriptions/PrescriptionStatus";
import { PrescriptionDetails } from "../components/prescriptions/PrescriptionDetails";
import { PrescriptionCard } from "../components/prescriptions/PrescriptionCard";
import { PrescriptionTable } from "../components/prescriptions/PrescriptionTable";

let totalChecks = 0;
let passedChecks = 0;

function check(assertion: boolean, description: string) {
  totalChecks++;
  if (!assertion) {
    console.error(`  ❌ FAIL: ${description}`);
    throw new Error(`Assertion failed: ${description}`);
  }
  passedChecks++;
  console.log(`  ✓ PASS: ${description}`);
}

async function readResponseJson(response: Response): Promise<Record<string, unknown>> {
  return (await response.json()) as Record<string, unknown>;
}

function assertNoDiagnosisKey(obj: unknown, loc = "root") {
  if (!obj || typeof obj !== "object") return;
  if (Object.prototype.hasOwnProperty.call(obj, "diagnosis")) {
    throw new Error(`CLINICAL PRIVACY VIOLATION: "diagnosis" leaked at ${loc}`);
  }
  for (const [k, v] of Object.entries(obj)) {
    assertNoDiagnosisKey(v, `${loc}.${k}`);
  }
}

function assertNoSecrets(obj: unknown, loc = "root") {
  const json = JSON.stringify(obj).toLowerCase();
  check(!json.includes("password"), `Zero password exposure at ${loc}`);
  check(!json.includes("$2b$10$"), `Zero bcrypt hash exposure at ${loc}`);
}

async function runMasterDay16Regression() {
  console.log("===============================================================================");
  console.log("🏥 MedEasy Master Day 16: Full Integration & Regression Test Suite");
  console.log("===============================================================================\n");

  // Track created IDs for cleanup
  const cleanupPrescriptionIds: string[] = [];

  try {
    // ---------------------------------------------------------------------------
    // SECTION 1: RESOLVE USERS & VERIFY AUTHENTICATION / LOGIN FOR EVERY ROLE
    // ---------------------------------------------------------------------------
    console.log("-------------------------------------------------------------------------------");
    console.log("1. TEST EVERY ROLE: AUTHENTICATION & CREDENTIAL VERIFICATION");
    console.log("-------------------------------------------------------------------------------");

    const [adminDb, doctorSarahDb, doctorJohnDb, pharmacyDb, patientAliceDb, patientRobertDb] =
      await Promise.all([
        prisma.user.findUniqueOrThrow({ where: { email: "admin@medeasy.demo" } }),
        prisma.user.findUniqueOrThrow({
          where: { email: "dr.sarah@medeasy.demo" },
          include: { doctorProfile: true },
        }),
        prisma.user.findUniqueOrThrow({
          where: { email: "dr.john@medeasy.demo" },
          include: { doctorProfile: true },
        }),
        prisma.user.findUniqueOrThrow({
          where: { email: "pharmacy@medeasy.demo" },
          include: { pharmacyProfile: true },
        }),
        prisma.user.findUniqueOrThrow({
          where: { email: "patient.alice@medeasy.demo" },
          include: { patientProfile: true },
        }),
        prisma.user.findUniqueOrThrow({
          where: { email: "patient.robert@medeasy.demo" },
          include: { patientProfile: true },
        }),
      ]);

    // Verify Password Login for Doctor
    const doctorPassOk = await bcrypt.compare("DemoDoctorPassword123!", doctorSarahDb.password);
    check(doctorPassOk, "Doctor credential login verification succeeds");

    // Verify Password Login for Pharmacy
    const pharmacyPassOk = await bcrypt.compare("DemoPharmacyPassword123!", pharmacyDb.password);
    check(pharmacyPassOk, "Pharmacy credential login verification succeeds");

    // Verify Password Login for Patient
    const patientPassOk = await bcrypt.compare("DemoPatientPassword123!", patientAliceDb.password);
    check(patientPassOk, "Patient credential login verification succeeds");

    // Verify Password Login for Admin
    const adminPassOk = await bcrypt.compare("DemoAdminPassword123!", adminDb.password);
    check(adminPassOk, "Admin credential login verification succeeds");

    // Construct authenticated session representations
    const doctorSarahAuth: AuthUser = {
      id: doctorSarahDb.id,
      email: doctorSarahDb.email,
      role: UserRole.DOCTOR,
      name: "Dr. Sarah",
    };
    const doctorJohnAuth: AuthUser = {
      id: doctorJohnDb.id,
      email: doctorJohnDb.email,
      role: UserRole.DOCTOR,
      name: "Dr. John",
    };
    const pharmacyAuth: AuthUser = {
      id: pharmacyDb.id,
      email: pharmacyDb.email,
      role: UserRole.PHARMACY,
      name: "MedEasy Central Pharmacy",
    };
    const patientAliceAuth: AuthUser = {
      id: patientAliceDb.id,
      email: patientAliceDb.email,
      role: UserRole.PATIENT,
      name: "Alice Johnson",
    };
    const patientRobertAuth: AuthUser = {
      id: patientRobertDb.id,
      email: patientRobertDb.email,
      role: UserRole.PATIENT,
      name: "Robert Miller",
    };
    const adminAuth: AuthUser = {
      id: adminDb.id,
      email: adminDb.email,
      role: UserRole.ADMIN,
      name: "System Administrator",
    };

    // ---------------------------------------------------------------------------
    // SECTION 2: TEST EVERY ROLE FUNCTIONAL FLOW
    // ---------------------------------------------------------------------------
    console.log("\n-------------------------------------------------------------------------------");
    console.log("2. TEST EVERY ROLE: FUNCTIONAL WORKFLOWS");
    console.log("-------------------------------------------------------------------------------");

    // --- DOCTOR FLOW ---
    console.log("  [Doctor Role]");
    // 1. Dashboard
    const docDash = await getDoctorDashboardData(doctorSarahAuth.id);
    check(!("error" in docDash), "Doctor retrieves dashboard data");
    if (!("error" in docDash)) {
      check(docDash.stats.totalPrescriptions >= 0, "Doctor dashboard calculates totalPrescriptions");
      check(docDash.stats.pendingCount >= 0, "Doctor dashboard calculates pendingCount");
      check(docDash.stats.filledCount >= 0, "Doctor dashboard calculates filledCount");
      check(Array.isArray(docDash.recentPrescriptions), "Doctor dashboard loads recentPrescriptions array");
    }

    // 2. Patients Roster
    const docRoster = await getDoctorPatientsRoster(doctorSarahAuth.id);
    check(!("error" in docRoster), "Doctor retrieves patient roster");
    if (!("error" in docRoster)) {
      check(Array.isArray(docRoster.patients), "Doctor patients roster returns patients array");
      const aliceInRoster = docRoster.patients.some((p) => p.id === patientAliceDb.patientProfile?.id);
      check(aliceInRoster, "Patient Alice Johnson is verified in Dr. Sarah's care roster");
    }

    // 3. Create Prescription
    const medicines = await prisma.medicine.findMany({ take: 2 });
    check(medicines.length >= 2, "Medicine catalog provides valid medications");

    const createResult = await createDoctorPrescription(doctorSarahAuth.id, {
      patientId: patientAliceDb.patientProfile!.id,
      diagnosis: "Regression Test Bronchial Infection",
      documentRef: "rx-docs/test-regression-flow.pdf",
      medicines: [
        {
          medicineId: medicines[0].id,
          dosage: "500mg",
          frequency: "Twice daily",
          duration: "7 days",
        },
        {
          medicineId: medicines[1].id,
          dosage: "250mg",
          frequency: "Once daily",
          duration: "5 days",
        },
      ],
    });
    check(!("error" in createResult), "Doctor creates multi-medicine prescription successfully");
    const createdRx = (createResult as { prescription: { id: string; status: PrescriptionStatus; diagnosis: string } }).prescription;
    cleanupPrescriptionIds.push(createdRx.id);
    check(createdRx.status === PrescriptionStatus.PENDING, "Newly created prescription is strictly PENDING");
    check(createdRx.diagnosis === "Regression Test Bronchial Infection", "Diagnosis stored accurately for clinician");

    // 4. List Prescriptions
    const docList = await getDoctorPrescriptionsList(doctorSarahAuth.id);
    check(!("error" in docList), "Doctor retrieves prescriptions list");
    if (!("error" in docList)) {
      check(Array.isArray(docList.prescriptions), "Doctor prescriptions list returns array");
      const rxFoundInList = docList.prescriptions.some((p) => p.id === createdRx.id);
      check(rxFoundInList, "Newly created prescription is listed under authoring doctor");
    }

    // 5. Details
    const docDetail = await getDoctorPrescriptionDetail(doctorSarahAuth.id, createdRx.id);
    check(!("error" in docDetail), "Doctor retrieves prescription detail");
    check((docDetail as { prescription: { diagnosis: string } }).prescription.diagnosis === "Regression Test Bronchial Infection", "Prescription detail exposes diagnosis to authoring doctor");

    // 6. Analytics
    const docAnalytics = await getDoctorAnalytics(doctorSarahAuth.id);
    check(!("error" in docAnalytics), "Doctor retrieves clinical analytics");
    if (!("error" in docAnalytics)) {
      check(docAnalytics.summary.totalPrescriptions >= 1, "Doctor analytics calculates totalPrescriptions");
      check(typeof docAnalytics.summary.overallFillRate === "number", "Doctor analytics calculates overallFillRate");
    }

    // --- PHARMACY FLOW ---
    console.log("\n  [Pharmacy Role]");
    // 1. Dashboard
    const pharmDash = await getPharmacyDashboardData(pharmacyAuth.id);
    check(!("error" in pharmDash), "Pharmacy retrieves dashboard data");
    if (!("error" in pharmDash)) {
      check(pharmDash.pendingCount >= 1, "Pharmacy dashboard reflects active pendingCount");
      check(typeof pharmDash.metrics.fulfillmentRate === "number", "Pharmacy dashboard calculates fulfillmentRate number");
    }

    // 2. Queue
    const pharmQueue = await getPharmacyPrescriptions(pharmacyAuth.id, PrescriptionStatus.PENDING);
    check(!("error" in pharmQueue), "Pharmacy retrieves prescriptions queue");
    if (!("error" in pharmQueue)) {
      check(Array.isArray(pharmQueue.prescriptions), "Pharmacy queue returns prescriptions array");
      const rxFoundInQueue = pharmQueue.prescriptions.some((p) => p.id === createdRx.id);
      check(rxFoundInQueue, "Newly created prescription appears in pharmacy PENDING queue");
    }

    // 3. Details (with diagnosis redaction assertion)
    const pharmDetail = await getPharmacyPrescriptionDetail(pharmacyAuth.id, createdRx.id);
    check(!("error" in pharmDetail), "Pharmacy retrieves prescription detail successfully");
    assertNoDiagnosisKey(pharmDetail, "pharmacy prescription detail");
    console.log("  ✓ PASS: Pharmacy prescription detail strictly excludes diagnosis");

    // 4. History
    const pharmHistory = await getPharmacyHistory(pharmacyAuth.id);
    check(!("error" in pharmHistory), "Pharmacy retrieves fulfillment history");
    if (!("error" in pharmHistory)) {
      check(Array.isArray(pharmHistory.history), "Pharmacy fulfillment history returns array");
    }

    // 5. Analytics
    const pharmAnalytics = await getPharmacyAnalytics(pharmacyAuth.id);
    check(!("error" in pharmAnalytics), "Pharmacy retrieves analytics data");
    if (!("error" in pharmAnalytics)) {
      check(pharmAnalytics.summary.totalPrescriptionsReceived >= 1, "Pharmacy analytics calculates totalPrescriptionsReceived");
      check(typeof pharmAnalytics.statusBreakdown === "object", "Pharmacy analytics provides statusBreakdown");
    }

    // --- PATIENT FLOW ---
    console.log("\n  [Patient Role]");
    // 1. Dashboard
    const patDash = await getPatientDashboardData(patientAliceAuth.id);
    check(!("error" in patDash), "Patient retrieves dashboard data");
    if (!("error" in patDash)) {
      check(patDash.totalPrescriptions >= 1, "Patient dashboard reports totalPrescriptions");
    }

    // 2. Prescriptions List
    const patList = await getPatientPrescriptionsList(patientAliceAuth.id);
    check(!("error" in patList), "Patient retrieves prescriptions list");
    const rxInPatList = (patList as { prescriptions: Array<{ id: string }> }).prescriptions.some((p) => p.id === createdRx.id);
    check(rxInPatList, "Created prescription appears in patient Alice's prescription list");

    // 3. Details (Diagnosis visible for patient)
    const patDetail = await getPatientPrescriptionDetail(patientAliceAuth.id, createdRx.id);
    check(!("error" in patDetail), "Patient retrieves prescription detail");
    check((patDetail as { prescription: { diagnosis: string } }).prescription.diagnosis === "Regression Test Bronchial Infection", "Diagnosis is VISIBLE to patient recipient");

    // 4. Tracking
    const patTracking = await getPatientPrescriptionTracking(patientAliceAuth.id, createdRx.id);
    check(!("error" in patTracking), "Patient retrieves tracking timeline");
    check((patTracking as { tracking: { status: PrescriptionStatus } }).tracking.status === PrescriptionStatus.PENDING, "Initial patient tracking status is PENDING");

    // --- ADMIN FLOW ---
    console.log("\n  [Admin Role]");
    // 1. Dashboard
    const adminDash = await getAdminDashboardData();
    check(adminDash.totalPrescriptions >= 1, "Admin dashboard reports platform totalPrescriptions");
    check(adminDash.totalDoctors >= 1, "Admin dashboard reports totalDoctors");
    check(adminDash.totalPatients >= 1, "Admin dashboard reports totalPatients");

    // 2. Doctor Management
    const adminDoctors = await getAdminDoctorsList();
    check(adminDoctors.doctors.length >= 2, "Admin doctor directory returns all registered clinicians");
    assertNoSecrets(adminDoctors, "admin doctors directory");

    // 3. Pharmacy Management
    const adminPharmacy = await getAdminPharmacyInfo();
    check(adminPharmacy.accountStatus === "ACTIVE", "Admin pharmacy info reports pre-provisioned pharmacy status");
    assertNoSecrets(adminPharmacy, "admin pharmacy info");

    // 4. Prescription Management
    const adminRxList = await getAdminPrescriptionsList();
    check(adminRxList.prescriptions.length >= 1, "Admin lists platform-wide prescriptions");
    const adminRxDetail = await getAdminPrescriptionDetail(createdRx.id);
    check(!("error" in adminRxDetail), "Admin retrieves full prescription projection");

    // 5. Analytics
    const adminAnalytics = await getAdminAnalyticsData();
    check(adminAnalytics.totalPrescriptionsCreated >= 1, "Admin platform analytics aggregates totalPrescriptionsCreated");
    check(typeof adminAnalytics.overallFulfillmentRate === "number", "Admin analytics calculates overallFulfillmentRate number");

    // ---------------------------------------------------------------------------
    // SECTION 3: ERROR MATRIX & UNIFORM SHAPE VERIFICATION
    // ---------------------------------------------------------------------------
    console.log("\n-------------------------------------------------------------------------------");
    console.log("3. ERROR MATRIX: STATUS CODES, UNIFORM RESPONSE SHAPE & SECRECY");
    console.log("-------------------------------------------------------------------------------");

    // Test cases for central error response mapping:
    const errorCases: Array<{
      error: unknown;
      expectedStatus: number;
      expectedCode: string;
      label: string;
    }> = [
      {
        error: new ApplicationError("UNAUTHENTICATED", "Authentication required.", 401),
        expectedStatus: 401,
        expectedCode: "UNAUTHENTICATED",
        label: "unauthenticated → 401",
      },
      {
        error: forbiddenError("Access denied."),
        expectedStatus: 403,
        expectedCode: "FORBIDDEN",
        label: "wrong role / unauthorized access → 403",
      },
      {
        error: validationError("Invalid payload."),
        expectedStatus: 400,
        expectedCode: "VALIDATION_ERROR",
        label: "invalid input → 400",
      },
      {
        error: notFoundError("Resource not found."),
        expectedStatus: 404,
        expectedCode: "NOT_FOUND",
        label: "nonexistent resource → 404",
      },
      {
        error: conflictError("Resource already exists."),
        expectedStatus: 409,
        expectedCode: "CONFLICT",
        label: "conflict → 409",
      },
      {
        error: businessRuleError("Invalid transition."),
        expectedStatus: 422,
        expectedCode: "BUSINESS_RULE_ERROR",
        label: "business rule error → 422",
      },
      {
        error: new Prisma.PrismaClientKnownRequestError("Unique constraint violation", {
          code: "P2002",
          clientVersion: "test",
        }),
        expectedStatus: 409,
        expectedCode: "CONFLICT",
        label: "Prisma P2002 unique constraint → 409 (sanitized)",
      },
      {
        error: new Prisma.PrismaClientKnownRequestError("Record does not exist", {
          code: "P2025",
          clientVersion: "test",
        }),
        expectedStatus: 404,
        expectedCode: "NOT_FOUND",
        label: "Prisma P2025 record not found → 404 (sanitized)",
      },
      {
        error: new Error("Unhandled database crash SELECT * FROM confidential_table"),
        expectedStatus: 500,
        expectedCode: "INTERNAL_SERVER_ERROR",
        label: "unknown server failure → safe 500 (internal details stripped)",
      },
    ];

    for (const ec of errorCases) {
      const resp = apiError(ec.error);
      check(resp.status === ec.expectedStatus, `${ec.label}: status code matches ${ec.expectedStatus}`);
      const body = await readResponseJson(resp);
      check(Boolean(body.error), `${ec.label}: response contains uniform "error" object`);
      const errObj = body.error as { code: string; message: string };
      check(errObj.code === ec.expectedCode, `${ec.label}: error.code is ${ec.expectedCode}`);
      check(typeof errObj.message === "string", `${ec.label}: error.message is human-readable string`);

      // Verify Prisma / database internal query secrecy
      const rawText = JSON.stringify(body);
      check(!rawText.includes("SELECT *"), `${ec.label}: no raw SQL leaked`);
      check(!rawText.includes("confidential_table"), `${ec.label}: no table names leaked`);
    }

    // Verify errorFromResult helper
    const mapped400 = apiError(errorFromResult({ error: "Bad field", statusCode: 400 }));
    check(mapped400.status === 400, "errorFromResult(400) maps to 400");
    const mapped403 = apiError(errorFromResult({ error: "No permission", statusCode: 403 }));
    check(mapped403.status === 403, "errorFromResult(403) maps to 403");
    const mapped404 = apiError(errorFromResult({ error: "Missing", statusCode: 404 }));
    check(mapped404.status === 404, "errorFromResult(404) maps to 404");

    // Verify apiSuccess standard shape
    const successResp = apiSuccess({ ok: true, data: "test" }, 201);
    check(successResp.status === 201, "apiSuccess returns specified 201 status");
    const successBody = await readResponseJson(successResp);
    check(successBody.ok === true, "apiSuccess returns transparent JSON body");

    // ---------------------------------------------------------------------------
    // SECTION 4: SECURITY REGRESSION TESTS
    // ---------------------------------------------------------------------------
    console.log("\n-------------------------------------------------------------------------------");
    console.log("4. SECURITY REGRESSION: RBAC, HORIZONTAL ISOLATION & PRIVACY");
    console.log("-------------------------------------------------------------------------------");

    // 1. Doctor CANNOT use pharmacy fulfillment
    let doctorFulfillBlocked = false;
    try {
      await requireRole([UserRole.PHARMACY], doctorSarahAuth);
    } catch (err: unknown) {
      if (err && typeof err === "object" && "statusCode" in err && (err as { statusCode: number }).statusCode === 403) {
        doctorFulfillBlocked = true;
      }
    }
    check(doctorFulfillBlocked, "Doctor is strictly blocked with 403 from pharmacy fulfillment");

    // 2. Patient CANNOT use pharmacy fulfillment
    let patientFulfillBlocked = false;
    try {
      await requireRole([UserRole.PHARMACY], patientAliceAuth);
    } catch (err: unknown) {
      if (err && typeof err === "object" && "statusCode" in err && (err as { statusCode: number }).statusCode === 403) {
        patientFulfillBlocked = true;
      }
    }
    check(patientFulfillBlocked, "Patient is strictly blocked with 403 from pharmacy fulfillment");

    // 3. Non-admin CANNOT access admin-only operations
    let nonAdminBlockedCount = 0;
    for (const nonAdmin of [doctorSarahAuth, pharmacyAuth, patientAliceAuth]) {
      try {
        await requireRole([UserRole.ADMIN], nonAdmin);
      } catch (err: unknown) {
        if (err && typeof err === "object" && "statusCode" in err && (err as { statusCode: number }).statusCode === 403) {
          nonAdminBlockedCount++;
        }
      }
    }
    check(nonAdminBlockedCount === 3, "Non-admin roles (Doctor, Pharmacy, Patient) are strictly blocked with 403 from Admin");

    // 4. Patient A CANNOT access Patient B data (Safe 404 to prevent enumeration)
    const crossPatientDetail = await getPatientPrescriptionDetail(patientRobertAuth.id, createdRx.id);
    check("error" in crossPatientDetail && crossPatientDetail.statusCode === 404, "Patient Robert accessing Alice's prescription returns safe 404 Not Found");
    const crossPatientTracking = await getPatientPrescriptionTracking(patientRobertAuth.id, createdRx.id);
    check("error" in crossPatientTracking && crossPatientTracking.statusCode === 404, "Patient Robert accessing Alice's tracking returns safe 404 Not Found");

    // 5. Doctor A CANNOT access Doctor B unassigned prescription
    const crossDocDetail = await getDoctorPrescriptionDetail(doctorJohnAuth.id, createdRx.id);
    check("error" in crossDocDetail && crossDocDetail.statusCode === 403, "Dr. John accessing Dr. Sarah's prescription is blocked with 403 Forbidden");

    // 6. Pharmacy CANNOT receive diagnosis across any payload
    const sanitizedRx = sanitizePrescriptionForPharmacy(createdRx);
    check(!("diagnosis" in sanitizedRx), "sanitizePrescriptionForPharmacy strips diagnosis");
    const accessCheck = await canUserAccessPrescription(pharmacyAuth, createdRx.id);
    check(accessCheck.allowed, "Pharmacy has access to fulfillment attributes");
    assertNoDiagnosisKey(accessCheck.prescription, "canUserAccessPrescription result");
    console.log("  ✓ PASS: Clinical privacy boundary enforced: diagnosis omitted for pharmacy");

    // ---------------------------------------------------------------------------
    // SECTION 5: SHARED UI REGRESSION AUDIT
    // ---------------------------------------------------------------------------
    console.log("\n-------------------------------------------------------------------------------");
    console.log("5. SHARED UI REGRESSION: COMPONENT ADOPTION & ATTRIBUTES");
    console.log("-------------------------------------------------------------------------------");

    // 1. Export integrity of all shared UI primitives
    check(typeof LoadingState === "function", "LoadingState component is exported");
    check(typeof EmptyState === "function", "EmptyState component is exported");
    check(typeof ErrorState === "function", "ErrorState component is exported");
    check(typeof Modal === "function", "Modal component is exported");
    check(typeof PrescriptionStatusBadge === "function", "PrescriptionStatus badge is exported");
    check(typeof PrescriptionDetails === "function", "PrescriptionDetails is exported");
    check(typeof PrescriptionCard === "function", "PrescriptionCard is exported");
    check(typeof PrescriptionTable === "function", "PrescriptionTable is exported");

    // 2. Status badge dictionary mappings
    check(STATUS_CONFIG.PENDING.label === "Pending" && STATUS_CONFIG.PENDING.variant === "warning", "Status PENDING maps to 'Pending' (warning)");
    check(STATUS_CONFIG.FILLED.label === "Filled" && STATUS_CONFIG.FILLED.variant === "success", "Status FILLED maps to 'Filled' (success)");
    check(STATUS_CONFIG.CANNOT_FILL.label === "Cannot Fill" && STATUS_CONFIG.CANNOT_FILL.variant === "destructive", "Status CANNOT_FILL maps to 'Cannot Fill' (destructive)");

    // 3. Static code audit across all role pages for component adoption
    const rolePagesToAudit = [
      "app/doctor/dashboard/page.tsx",
      "app/doctor/prescriptions/page.tsx",
      "app/doctor/prescriptions/[id]/page.tsx",
      "app/pharmacy/dashboard/page.tsx",
      "app/pharmacy/prescriptions/page.tsx",
      "app/pharmacy/prescriptions/[id]/page.tsx",
      "app/patient/dashboard/page.tsx",
      "app/patient/prescriptions/page.tsx",
      "app/patient/tracking/page.tsx",
      "app/patient/prescriptions/[id]/page.tsx",
      "app/admin/dashboard/page.tsx",
      "app/admin/prescriptions/page.tsx",
      "app/admin/doctors/page.tsx",
      "app/admin/pharmacy/page.tsx",
    ];

    for (const pagePath of rolePagesToAudit) {
      const fullPath = path.resolve(process.cwd(), pagePath);
      check(fs.existsSync(fullPath), `Page file exists: ${pagePath}`);
      const content = fs.readFileSync(fullPath, "utf-8");
      check(content.includes("LoadingState"), `${pagePath} adopts shared LoadingState`);
      check(content.includes("ErrorState"), `${pagePath} adopts shared ErrorState`);
    }

    // ---------------------------------------------------------------------------
    // SECTION 6: COMPLETE END-TO-END BUSINESS FLOW WITH REFRESH PERSISTENCE
    // ---------------------------------------------------------------------------
    console.log("\n-------------------------------------------------------------------------------");
    console.log("6. COMPLETE BUSINESS FLOW & REFRESH PERSISTENCE");
    console.log("-------------------------------------------------------------------------------");

    // Step A: Baseline admin metrics before new prescription
    const baselineAdminAnalytics = await getAdminAnalyticsData();
    const baselineTotalRx = baselineAdminAnalytics.totalPrescriptionsCreated;
    const baselineFulfilledRx = baselineAdminAnalytics.totalPrescriptionsFulfilled;

    // Step B: Doctor creates prescription
    const flowRxResult = await createDoctorPrescription(doctorSarahAuth.id, {
      patientId: patientAliceDb.patientProfile!.id,
      diagnosis: "E2E Bacterial Pharyngitis",
      documentRef: "rx-docs/e2e-pharyngitis-order.pdf",
      medicines: [
        {
          medicineId: medicines[0].id,
          dosage: "500mg",
          frequency: "Three times daily",
          duration: "10 days",
        },
      ],
    });
    check(!("error" in flowRxResult), "E2E: Doctor successfully creates prescription");
    const e2eRxId = (flowRxResult as { prescription: { id: string } }).prescription.id;
    cleanupPrescriptionIds.push(e2eRxId);

    // Refresh Persistence Check 1: Direct database query verifies PENDING state persisted
    const dbPersist1 = await prisma.prescription.findUniqueOrThrow({
      where: { id: e2eRxId },
      include: { fill: true },
    });
    check(dbPersist1.status === PrescriptionStatus.PENDING, "Persistence 1: Database confirms status is PENDING");
    check(dbPersist1.fill === null, "Persistence 1: Database confirms zero Fill record initially");

    // Step C: Pharmacy sees prescription in queue
    const queueAfterCreate = await getPharmacyPrescriptions(pharmacyAuth.id, PrescriptionStatus.PENDING);
    check(!("error" in queueAfterCreate), "E2E: Pharmacy queries queue successfully");
    const inQueue = !("error" in queueAfterCreate) && queueAfterCreate.prescriptions.some((p) => p.id === e2eRxId);
    check(Boolean(inQueue), "E2E: Pharmacy queries queue and finds new prescription as PENDING");

    // Step D: Pharmacy fulfills prescription (FILLED action)
    const fulfillResult = await fulfillPrescription(pharmacyAuth.id, e2eRxId, {
      action: "FILLED",
      notes: "Fulfilled at MedEasy Central Pharmacy dispensing counter 1",
    });
    check(!("error" in fulfillResult), "E2E: Pharmacy executes FILLED action successfully");
    const fulfillRx = (fulfillResult as { prescription: { status: PrescriptionStatus; filledAt: Date | null } }).prescription;
    check(fulfillRx.status === PrescriptionStatus.FILLED, "E2E: Prescription status transitions to FILLED");
    check(fulfillRx.filledAt !== null, "E2E: filledAt timestamp is populated");

    // Refresh Persistence Check 2: Direct database query verifies FILLED and Fill record persisted
    const dbPersist2 = await prisma.prescription.findUniqueOrThrow({
      where: { id: e2eRxId },
      include: { fill: { include: { pharmacy: true } } },
    });
    check(dbPersist2.status === PrescriptionStatus.FILLED, "Persistence 2: Database confirms status is FILLED after refresh");
    check(dbPersist2.fill !== null, "Persistence 2: Database confirms Fill record created and linked");
    check(dbPersist2.fill?.pharmacy.pharmacyName === "MedEasy Central Pharmacy", "Persistence 2: Fill record linked to Central Pharmacy");

    // Step E: Duplicate fulfillment conflict rejection (Business conflict / idempotency)
    const duplicateFulfill = await fulfillPrescription(pharmacyAuth.id, e2eRxId, {
      action: "FILLED",
      notes: "Duplicate attempt",
    });
    check("error" in duplicateFulfill, "E2E: Duplicate fulfillment attempt is rejected");
    check(
      "statusCode" in duplicateFulfill && (duplicateFulfill.statusCode === 409 || duplicateFulfill.statusCode === 400),
      "E2E: Duplicate fulfillment returns conflict code (409/400)"
    );

    // Step F: Patient sees updated live tracking
    const trackingAfterFill = await getPatientPrescriptionTracking(patientAliceAuth.id, e2eRxId);
    check(!("error" in trackingAfterFill), "E2E: Patient queries tracking after fulfillment");
    if (!("error" in trackingAfterFill) && trackingAfterFill.tracking) {
      check(trackingAfterFill.tracking.status === PrescriptionStatus.FILLED, "E2E: Patient tracking timeline displays FILLED status");
    }

    // Step G: Admin platform analytics reflect the updated state
    const adminAnalyticsAfterFill = await getAdminAnalyticsData();
    check(adminAnalyticsAfterFill.totalPrescriptionsCreated === baselineTotalRx + 1, "E2E: Admin analytics totalPrescriptions incremented by 1");
    check(adminAnalyticsAfterFill.totalPrescriptionsFulfilled === baselineFulfilledRx + 1, "E2E: Admin analytics totalFulfilled incremented by 1");

    // Refresh Persistence Check 3: Second prescription flow to test CANNOT_FILL transition
    const cannotFillRxResult = await createDoctorPrescription(doctorSarahAuth.id, {
      patientId: patientAliceDb.patientProfile!.id,
      diagnosis: "E2E Cannot Fill Shortage Test",
      medicines: [{ medicineId: medicines[0].id, dosage: "1000mg", frequency: "Daily", duration: "3 days" }],
    });
    check(!("error" in cannotFillRxResult), "E2E: Created secondary test prescription for CANNOT_FILL");
    const cannotFillRxId = (cannotFillRxResult as { prescription: { id: string } }).prescription.id;
    cleanupPrescriptionIds.push(cannotFillRxId);

    const cannotFillActionResult = await fulfillPrescription(pharmacyAuth.id, cannotFillRxId, {
      action: "CANNOT_FILL",
      notes: "Medication out of stock in regional warehouse",
    });
    check(!("error" in cannotFillActionResult), "E2E: Pharmacy executes CANNOT_FILL action");
    const cannotFillPersist = await prisma.prescription.findUniqueOrThrow({ where: { id: cannotFillRxId } });
    check(cannotFillPersist.status === PrescriptionStatus.CANNOT_FILL, "Persistence 3: Database confirms CANNOT_FILL status persisted");

    const cannotFillTracking = await getPatientPrescriptionTracking(patientAliceAuth.id, cannotFillRxId);
    check(!("error" in cannotFillTracking), "E2E: Patient queries cannot-fill tracking successfully");
    if (!("error" in cannotFillTracking) && cannotFillTracking.tracking) {
      check(cannotFillTracking.tracking.status === PrescriptionStatus.CANNOT_FILL, "E2E: Patient tracking accurately displays CANNOT_FILL");
    }

  } finally {
    // ---------------------------------------------------------------------------
    // SECTION 7: CLEANUP TEMPORARY TEST DATA
    // ---------------------------------------------------------------------------
    console.log("\n-------------------------------------------------------------------------------");
    console.log("7. CLEANUP TEMPORARY TEST DATA");
    console.log("-------------------------------------------------------------------------------");
    for (const rxId of cleanupPrescriptionIds) {
      await prisma.fill.deleteMany({ where: { prescriptionId: rxId } });
      await prisma.prescriptionMedicine.deleteMany({ where: { prescriptionId: rxId } });
      await prisma.prescription.deleteMany({ where: { id: rxId } });
    }
    console.log(`  ✓ Successfully cleaned up ${cleanupPrescriptionIds.length} temporary test prescription records`);
  }

  console.log("\n===============================================================================");
  console.log(`🎉 ALL ${totalChecks}/${totalChecks} MASTER REGRESSION & INTEGRATION CHECKS PASSED WITH 100% SUCCESS!`);
  console.log("===============================================================================\n");
}

runMasterDay16Regression().catch((error) => {
  console.error("FATAL REGRESSION FAILURE:", error);
  process.exit(1);
});
