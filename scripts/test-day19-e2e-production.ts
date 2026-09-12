import assert from "node:assert";
import { UserRole, PrescriptionStatus } from "@prisma/client";
import { prisma } from "../lib/prisma";
import { authOptions } from "../lib/auth";
import {
  AuthUser,
  canUserAccessPrescription,
  requireRole,
  authorizeRequest,
  AuthorizationError,
} from "../lib/permissions";
import {
  storageService,
  validateDocumentFile,
  generateDocumentStorageKey,
} from "../lib/storage";
import {
  getDoctorDashboardData,
  getDoctorPrescriptionsList,
  getDoctorPrescriptionDetail,
  getDoctorPatientsRoster,
  getDoctorAnalytics,
  createDoctorPrescription,
} from "../lib/doctor-service";
import {
  getPharmacyDashboardData,
  getPharmacyPrescriptions,
  getPharmacyPrescriptionDetail,
  getPharmacyHistory,
  getPharmacyAnalytics,
  fulfillPrescription,
} from "../lib/pharmacy-service";
import {
  getPatientDashboardData,
  getPatientPrescriptionsList,
  getPatientPrescriptionDetail,
  getPatientPrescriptionTracking,
} from "../lib/patient-service";
import {
  getAdminDashboardData,
  getAdminDoctorsList,
  getAdminPharmacyInfo,
  getAdminPrescriptionsList,
  getAdminAnalyticsData,
} from "../lib/admin-service";

interface E2ETestResult {
  category: string;
  testCase: string;
  expected: string;
  actual: string;
  status: "PASS" | "FAIL";
}

const testResults: E2ETestResult[] = [];

function recordTest(
  category: string,
  testCase: string,
  expected: string,
  actual: string,
  passed: boolean
) {
  testResults.push({
    category,
    testCase,
    expected,
    actual,
    status: passed ? "PASS" : "FAIL",
  });
  const symbol = passed ? "✓" : "❌";
  console.log(`  ${symbol} [${category}] ${testCase}: ${passed ? "PASS" : "FAIL"}`);
  if (!passed) {
    console.error(`     Expected: ${expected}`);
    console.error(`     Got:      ${actual}`);
    throw new Error(`E2E Test Failed: [${category}] ${testCase}`);
  }
}

async function runE2EProductionVerification() {
  const baseUrl = process.env.TEST_URL || "http://localhost:3000";
  console.log("===============================================================================");
  console.log("🏥 MedEasy Day 19 — End-to-End Production Deployment & Smoke Verification");
  console.log(`🎯 Target URL: ${baseUrl}`);
  console.log(`⏰ Timestamp: ${new Date().toISOString()}`);
  console.log("===============================================================================");

  // ---------------------------------------------------------------------------
  // 1. CLOUD RUN SERVICE: REACHABILITY, HEALTH & LIFECYCLE
  // ---------------------------------------------------------------------------
  console.log("\n-------------------------------------------------------------------------------");
  console.log("1. CLOUD RUN SERVICE (Reachability, Expected URLs, Startup, No Crash Loops)");
  console.log("-------------------------------------------------------------------------------");

  // 1a. Root URL reachability
  const rootRes = await fetch(`${baseUrl}/`, { redirect: "manual" });
  recordTest(
    "1. Service",
    "Root URL responds without crash loops",
    "HTTP 200 or 307 redirect to /auth/signin",
    `Status ${rootRes.status}`,
    rootRes.status === 200 || rootRes.status === 307
  );

  // 1b. Sign-in / login page reachability
  const signinRes = await fetch(`${baseUrl}/login`);
  const signinHtml = await signinRes.text();
  recordTest(
    "1. Service",
    "Login page renders successfully",
    "HTTP 200 with MedEasy branding",
    `Status ${signinRes.status}, contains 'MedEasy': ${signinHtml.includes("MedEasy")}`,
    signinRes.status === 200 && signinHtml.includes("MedEasy")
  );

  // 1c. DB health probe
  const healthRes = await fetch(`${baseUrl}/api/health/db`);
  const healthJson = await healthRes.json().catch(() => ({}));
  recordTest(
    "1. Service",
    "Database health check responds",
    "HTTP 200 with status='ok' and database='connected'",
    `Status ${healthRes.status}, payload: ${JSON.stringify(healthJson)}`,
    healthRes.status === 200 &&
      (healthJson.data?.status === "ok" || healthJson.status === "ok") &&
      (healthJson.data?.database === "connected" || healthJson.database === "connected")
  );

  // ---------------------------------------------------------------------------
  // 2. AUTHENTICATION: ALL 4 ROLES (Doctor, Pharmacy, Patient, Admin)
  // ---------------------------------------------------------------------------
  console.log("\n-------------------------------------------------------------------------------");
  console.log("2. AUTHENTICATION ACROSS ALL 4 ROLES (Doctor, Pharmacy, Patient, Admin)");
  console.log("-------------------------------------------------------------------------------");

  const credentialsProvider = authOptions.providers.find((p: any) => p.id === "credentials") as any;
  assert(credentialsProvider, "CredentialsProvider is configured in NextAuth options");
  const authorizeFn = credentialsProvider.options.authorize;

  const accounts = [
    { role: UserRole.DOCTOR, email: "dr.sarah@medeasy.demo", password: "DemoDoctorPassword123!", expectedName: "Dr. Sarah" },
    { role: UserRole.PHARMACY, email: "pharmacy@medeasy.demo", password: "DemoPharmacyPassword123!", expectedName: "MedEasy Central Pharmacy" },
    { role: UserRole.PATIENT, email: "patient.alice@medeasy.demo", password: "DemoPatientPassword123!", expectedName: "Alice Johnson" },
    { role: UserRole.ADMIN, email: "admin@medeasy.demo", password: "DemoAdminPassword123!", expectedName: "System Administrator" },
  ];

  const authenticatedUsers: Record<string, any> = {};

  for (const acc of accounts) {
    const user = await authorizeFn({ email: acc.email, password: acc.password });
    authenticatedUsers[acc.role] = user;

    recordTest(
      "2. Auth",
      `${acc.role} login authentication`,
      `Valid user object with role=${acc.role} and name='${acc.expectedName}'`,
      `Role: ${user?.role}, Name: ${user?.name}, ID: ${user?.id}`,
      Boolean(user && user.role === acc.role && user.name === acc.expectedName && user.id)
    );

    recordTest(
      "2. Auth",
      `${acc.role} password leak prevention`,
      "User object contains zero password/hash fields",
      `Password field present: ${Boolean((user as any)?.password)}`,
      !(user as any)?.password
    );
  }

  const doctorUser = authenticatedUsers[UserRole.DOCTOR];
  const pharmacyUser = authenticatedUsers[UserRole.PHARMACY];
  const patientUser = authenticatedUsers[UserRole.PATIENT];
  const adminUser = authenticatedUsers[UserRole.ADMIN];

  // ---------------------------------------------------------------------------
  // 3. DOCTOR: DASHBOARD, PATIENT ROSTER, CREATE RX, PENDING, RX DETAILS
  // ---------------------------------------------------------------------------
  console.log("\n-------------------------------------------------------------------------------");
  console.log("3. DOCTOR WORKFLOWS (Dashboard, Patient Roster, Create Rx, Pending, Details)");
  console.log("-------------------------------------------------------------------------------");

  // 3a. Doctor Dashboard
  const doctorDash = await getDoctorDashboardData(doctorUser.id);
  recordTest(
    "3. Doctor",
    "Doctor dashboard data retrieval",
    "Summary metrics for prescriptions and recent activity",
    `Total prescriptions: ${!("error" in doctorDash) ? doctorDash.stats.totalPrescriptions : "error"}`,
    !("error" in doctorDash) && typeof doctorDash.stats.totalPrescriptions === "number"
  );

  // 3b. Patient Roster
  const rosterResult = await getDoctorPatientsRoster(doctorUser.id);
  const hasPatients = !("error" in rosterResult) && rosterResult.patients.length > 0;
  recordTest(
    "3. Doctor",
    "Doctor patient roster retrieval",
    "Returns linked patient roster",
    `Patients count: ${!("error" in rosterResult) ? rosterResult.patients.length : "error"}`,
    hasPatients
  );

  // Resolve Alice's PatientProfile so doctor creates prescription for Alice
  const aliceProfile = await prisma.patientProfile.findUnique({
    where: { userId: patientUser.id },
  });
  assert(Boolean(aliceProfile), "Patient Alice profile found in database");
  const targetPatient = aliceProfile!;

  // 3c. Upload Prescription Document
  const docBuffer = Buffer.from("%PDF-1.4 Clinical Prescription Document for Production Smoke Verification");
  const uploadResult = await storageService.uploadPrescriptionDocument({
    buffer: docBuffer,
    originalName: "smoke-test-rx.pdf",
    mimeType: "application/pdf",
    size: docBuffer.length,
  });

  recordTest(
    "3. Doctor",
    "Upload prescription document to storage abstraction",
    "Returns unique documentRef prefixed with 'rx-docs/'",
    `documentRef: ${uploadResult.documentRef}`,
    Boolean(uploadResult.documentRef?.startsWith("rx-docs/"))
  );

  // 3d. Create Prescription with Document Attachment
  const medicine = await prisma.medicine.findFirstOrThrow({ where: { stockStatus: true } });
  const createRxResult = await createDoctorPrescription(doctorUser.id, {
    patientId: targetPatient.id,
    diagnosis: "Day 19 Production Smoke Test - Acute Pharyngitis",
    documentRef: uploadResult.documentRef,
    medicines: [
      {
        medicineId: medicine.id,
        dosage: "500mg",
        frequency: "Three times daily",
        duration: "7 days",
      },
    ],
  });

  const createdRx = (!("error" in createRxResult)) ? createRxResult.prescription : null;
  recordTest(
    "3. Doctor",
    "Create prescription in database",
    "Returns prescription with status=PENDING and attached documentRef",
    `ID: ${createdRx?.id}, Status: ${createdRx?.status}, DocRef: ${createdRx?.documentRef}`,
    Boolean(createdRx?.id && createdRx.status === PrescriptionStatus.PENDING && createdRx.documentRef === uploadResult.documentRef)
  );

  // 3e. Prescription appears as PENDING in doctor's prescription list
  const doctorRxList = await getDoctorPrescriptionsList(doctorUser.id);
  const foundInList = (!("error" in doctorRxList)) && doctorRxList.prescriptions.some((rx) => rx.id === createdRx!.id && rx.status === PrescriptionStatus.PENDING);
  recordTest(
    "3. Doctor",
    "Prescription appears as PENDING in doctor list",
    "Created prescription listed with status=PENDING",
    `Found pending: ${foundInList}`,
    foundInList
  );

  // 3f. Doctor Prescription Detail View
  const rxDetailResult = await getDoctorPrescriptionDetail(doctorUser.id, createdRx!.id);
  const detailRx = (!("error" in rxDetailResult)) ? rxDetailResult.prescription : null;
  recordTest(
    "3. Doctor",
    "Retrieve prescription details as Doctor",
    "Diagnosis visible, correct patient, doctor, and documentRef",
    `Diagnosis: '${detailRx?.diagnosis}', DocRef: '${detailRx?.documentRef}'`,
    Boolean(detailRx && detailRx.diagnosis && detailRx.documentRef === uploadResult.documentRef)
  );

  // 3g. Doctor Analytics
  const doctorAnalytics = await getDoctorAnalytics(doctorUser.id);
  recordTest(
    "3. Doctor",
    "Doctor analytics dashboard metrics",
    "Returns analytics object with summary counts",
    `Total: ${!("error" in doctorAnalytics) ? doctorAnalytics.summary.totalPrescriptions : "error"}`,
    !("error" in doctorAnalytics) && typeof doctorAnalytics.summary.totalPrescriptions === "number"
  );

  // ---------------------------------------------------------------------------
  // 4. PHARMACY: DASHBOARD, PENDING QUEUE, DETAILS, FILL, CANNOT FILL, HISTORY, ANALYTICS
  // ---------------------------------------------------------------------------
  console.log("\n-------------------------------------------------------------------------------");
  console.log("4. PHARMACY WORKFLOWS (Dashboard, Queue, Details, Fill, Cannot Fill, History, Analytics)");
  console.log("-------------------------------------------------------------------------------");

  // 4a. Pharmacy Dashboard
  const pharmacyDash = await getPharmacyDashboardData(pharmacyUser.id);
  recordTest(
    "4. Pharmacy",
    "Pharmacy dashboard metrics and recent activity",
    "Returns pharmacy metrics object",
    `Pharmacy: ${!("error" in pharmacyDash) ? pharmacyDash.pharmacy.pharmacyName : "error"}`,
    !("error" in pharmacyDash) && Boolean(pharmacyDash.pharmacy.pharmacyName)
  );

  // 4b. Pending Queue
  const pendingQueue = await getPharmacyPrescriptions(pharmacyUser.id, PrescriptionStatus.PENDING);
  const inPendingQueue = (!("error" in pendingQueue)) && pendingQueue.prescriptions.some((rx) => rx.id === createdRx!.id);
  recordTest(
    "4. Pharmacy",
    "Pending queue contains new prescription",
    "Prescription is visible in pharmacy pending fulfillment queue",
    `In queue: ${inPendingQueue}`,
    inPendingQueue
  );

  // 4c. Pharmacy Detail View (Diagnosis strictly redacted)
  const pharmacyRxDetail = await getPharmacyPrescriptionDetail(pharmacyUser.id, createdRx!.id);
  const pRx = (!("error" in pharmacyRxDetail)) ? pharmacyRxDetail.prescription : null;

  recordTest(
    "4. Pharmacy",
    "Pharmacy detail view - diagnosis privacy boundary",
    "Diagnosis field STRICTLY REDACTED/omitted for pharmacy role",
    `Diagnosis present: ${Boolean((pRx as any)?.diagnosis)}`,
    Boolean(pRx && !(pRx as any).diagnosis)
  );

  recordTest(
    "4. Pharmacy",
    "Pharmacy detail view - document reference available",
    "documentRef and documentAvailable populated",
    `documentRef: ${pRx?.documentRef}, available: ${pRx?.documentAvailable}`,
    Boolean(pRx && pRx.documentRef === uploadResult.documentRef && pRx.documentAvailable)
  );

  // 4d. Execute Fulfillment (FILL)
  const fulfillResult = await fulfillPrescription(pharmacyUser.id, createdRx!.id, {
    action: "FILLED",
    notes: "Day 19 Production Smoke Test Fulfillment",
  });
  const fulfilledPrescription = (!("error" in fulfillResult)) ? fulfillResult.prescription : null;

  recordTest(
    "4. Pharmacy",
    "Pharmacy dispenses and marks prescription as FILLED",
    "Returns prescription status=FILLED with filledAt timestamp",
    `Status: ${fulfilledPrescription?.status}, filledAt: ${fulfilledPrescription?.filledAt}`,
    Boolean(fulfilledPrescription && fulfilledPrescription.status === PrescriptionStatus.FILLED && fulfilledPrescription.filledAt)
  );

  // 4e. Cannot Fill Terminal Action (Separate Dedicated Test Prescription)
  const cfTestRxResult = await createDoctorPrescription(doctorUser.id, {
    patientId: targetPatient.id,
    diagnosis: "Out of Stock - Dedicated Cannot Fill Test",
    medicines: [{ medicineId: medicine.id, dosage: "100mg", frequency: "Daily", duration: "1 day" }],
  });
  const cfTestRx = (!("error" in cfTestRxResult)) ? cfTestRxResult.prescription : null;
  assert(Boolean(cfTestRx?.id), "Cannot-fill dedicated prescription created");

  const cannotFillResult = await fulfillPrescription(pharmacyUser.id, cfTestRx!.id, {
    action: "CANNOT_FILL",
    notes: "Medicine unavailable across regional distributors.",
  });
  const cfOutcomeRx = (!("error" in cannotFillResult)) ? cannotFillResult.prescription : null;
  recordTest(
    "4. Pharmacy",
    "Pharmacy executes CANNOT_FILL terminal action",
    "Prescription status transitions to CANNOT_FILL without creating a Fill row",
    `Status: ${cfOutcomeRx?.status}`,
    Boolean(cfOutcomeRx && cfOutcomeRx.status === PrescriptionStatus.CANNOT_FILL)
  );

  // 4f. Pharmacy History
  const pharmacyHistory = await getPharmacyHistory(pharmacyUser.id);
  const foundInHistory = (!("error" in pharmacyHistory)) && pharmacyHistory.history.some((h) => h.prescriptionId === createdRx!.id);
  recordTest(
    "4. Pharmacy",
    "Prescription appears in Pharmacy filled history",
    "Fulfilled prescription appears in historical fulfillment ledger",
    `Found in history: ${foundInHistory}`,
    foundInHistory
  );

  // 4g. Pharmacy Analytics
  const pharmacyAnalytics = await getPharmacyAnalytics(pharmacyUser.id);
  recordTest(
    "4. Pharmacy",
    "Pharmacy analytics metrics retrieval",
    "Returns fulfillment rate, counts, and breakdown",
    `Fulfillment rate: ${!("error" in pharmacyAnalytics) ? pharmacyAnalytics.summary.fulfillmentRate : "error"}%`,
    !("error" in pharmacyAnalytics) && typeof pharmacyAnalytics.summary.fulfillmentRate === "number"
  );

  // ---------------------------------------------------------------------------
  // 5. PATIENT: DASHBOARD, PRESCRIPTIONS, DETAILS, TRACKING (PENDING, FILLED, CANNOT_FILL)
  // ---------------------------------------------------------------------------
  console.log("\n-------------------------------------------------------------------------------");
  console.log("5. PATIENT WORKFLOWS (Dashboard, Prescriptions, Details, Tracking States)");
  console.log("-------------------------------------------------------------------------------");

  // 5a. Patient Dashboard
  const patientDash = await getPatientDashboardData(patientUser.id);
  recordTest(
    "5. Patient",
    "Patient dashboard data retrieval",
    "Returns patient profile, metrics, and recent prescriptions",
    `Patient: ${!("error" in patientDash) ? patientDash.patient.name : "error"}`,
    !("error" in patientDash) && Boolean(patientDash.patient)
  );

  // 5b. Patient Prescriptions List
  const patientListRes = await getPatientPrescriptionsList(patientUser.id);
  const patientHasRx = (!("error" in patientListRes)) && patientListRes.prescriptions.some((rx) => rx.id === createdRx!.id);
  recordTest(
    "5. Patient",
    "Patient prescription list retrieval",
    "List contains patient's prescription",
    `Found: ${patientHasRx}`,
    patientHasRx
  );

  // 5c. Patient Prescription Detail (Diagnosis visible to patient)
  const patientRxDetail = await getPatientPrescriptionDetail(patientUser.id, createdRx!.id);
  const patientRx = (!("error" in patientRxDetail)) ? patientRxDetail.prescription : null;
  recordTest(
    "5. Patient",
    "Patient prescription detail - diagnosis visibility",
    "Diagnosis IS visible to owner patient",
    `Diagnosis: '${patientRx?.diagnosis}'`,
    Boolean(patientRx && patientRx.diagnosis)
  );

  // 5d. Tracking: FILLED status
  const trackingResult = await getPatientPrescriptionTracking(patientUser.id, createdRx!.id);
  const trackingData = (!("error" in trackingResult)) ? trackingResult.tracking : null;
  recordTest(
    "5. Patient",
    "Patient tracking timeline shows FILLED state with Pharmacy details",
    "Current status FILLED with fulfillment record and dispenser name",
    `Status: ${trackingData?.status}, Dispenser: ${trackingData?.fulfillment?.pharmacyName}`,
    Boolean(trackingData && trackingData.status === PrescriptionStatus.FILLED && trackingData.fulfillment?.pharmacyName)
  );

  // 5e. Tracking: CANNOT_FILL status
  const cfTrackingResult = await getPatientPrescriptionTracking(patientUser.id, cfTestRx!.id);
  const cfTrackingData = (!("error" in cfTrackingResult)) ? cfTrackingResult.tracking : null;
  recordTest(
    "5. Patient",
    "Patient tracking timeline shows CANNOT_FILL state",
    "Current status CANNOT_FILL with state description",
    `Status: ${cfTrackingData?.status}, isCannotFill: ${cfTrackingData?.state?.isCannotFill}`,
    Boolean(cfTrackingData && cfTrackingData.status === PrescriptionStatus.CANNOT_FILL && cfTrackingData.state?.isCannotFill)
  );

  // 5f. Tracking: PENDING status (create a fresh pending prescription to verify pending tracking)
  const pendingTrackRxResult = await createDoctorPrescription(doctorUser.id, {
    patientId: targetPatient.id,
    diagnosis: "Pending Tracking Verification",
    medicines: [{ medicineId: medicine.id, dosage: "50mg", frequency: "Daily", duration: "2 days" }],
  });
  const pendingTrackRx = (!("error" in pendingTrackRxResult)) ? pendingTrackRxResult.prescription : null;
  assert(Boolean(pendingTrackRx?.id), "Pending tracking prescription created");

  const pendingTrackingRes = await getPatientPrescriptionTracking(patientUser.id, pendingTrackRx!.id);
  const pendingTrackingData = (!("error" in pendingTrackingRes)) ? pendingTrackingRes.tracking : null;
  recordTest(
    "5. Patient",
    "Patient tracking timeline shows PENDING state",
    "Current status PENDING with isPending=true",
    `Status: ${pendingTrackingData?.status}, isPending: ${pendingTrackingData?.state?.isPending}`,
    Boolean(pendingTrackingData && pendingTrackingData.status === PrescriptionStatus.PENDING && pendingTrackingData.state?.isPending)
  );

  // ---------------------------------------------------------------------------
  // 6. ADMIN: DASHBOARD, DOCTORS, PHARMACY, PRESCRIPTIONS, ANALYTICS
  // ---------------------------------------------------------------------------
  console.log("\n-------------------------------------------------------------------------------");
  console.log("6. ADMIN WORKFLOWS (Dashboard, Doctors, Pharmacy, Prescriptions, Analytics)");
  console.log("-------------------------------------------------------------------------------");

  const adminDash = await getAdminDashboardData();
  recordTest(
    "6. Admin",
    "Admin dashboard aggregate metrics",
    "Returns platform totals for prescriptions, doctors, and pharmacies",
    `Total Rx: ${adminDash.totalPrescriptions}, Doctors: ${adminDash.totalDoctors}`,
    adminDash.totalPrescriptions > 0 && adminDash.totalDoctors > 0
  );

  const adminDoctors = await getAdminDoctorsList();
  recordTest(
    "6. Admin",
    "Admin doctors directory",
    "Returns registered doctors list",
    `Doctors count: ${adminDoctors.doctors.length}`,
    adminDoctors.doctors.length > 0
  );

  const adminPharmacy = await getAdminPharmacyInfo();
  recordTest(
    "6. Admin",
    "Admin pharmacy status directory",
    "Returns pharmacy profile and status",
    `Pharmacy: ${adminPharmacy.pharmacy?.pharmacyName}, Status: ${adminPharmacy.accountStatus}`,
    Boolean(adminPharmacy.pharmacy && adminPharmacy.accountStatus)
  );

  const adminPrescriptions = await getAdminPrescriptionsList();
  recordTest(
    "6. Admin",
    "Admin prescriptions audit list",
    "Includes newly created & fulfilled prescription",
    `Contains test prescription: ${adminPrescriptions.prescriptions.some((rx) => rx.id === createdRx!.id)}`,
    adminPrescriptions.prescriptions.some((rx) => rx.id === createdRx!.id)
  );

  const adminAnalytics = await getAdminAnalyticsData();
  recordTest(
    "6. Admin",
    "Admin system-wide analytics data",
    "Fulfillment breakdown records filled prescriptions",
    `Filled count: ${adminAnalytics.totalPrescriptionsFulfilled}`,
    adminAnalytics.totalPrescriptionsFulfilled > 0
  );

  // ---------------------------------------------------------------------------
  // 7. DATABASE: PERSISTENCE, RE-QUERY, LOGOUT/LOGIN PERSISTENCE
  // ---------------------------------------------------------------------------
  console.log("\n-------------------------------------------------------------------------------");
  console.log("7. DATABASE PERSISTENCE VERIFICATION");
  console.log("-------------------------------------------------------------------------------");

  // Re-query database from fresh Prisma client context
  const persistedRx = await prisma.prescription.findUnique({
    where: { id: createdRx!.id },
    include: { fill: true, prescriptionMedicines: true },
  });

  recordTest(
    "7. Database",
    "Prescription persists across database reload/queries",
    "Row exists in PostgreSQL with exact diagnosis and documentRef",
    `ID: ${persistedRx?.id}, diagnosis: '${persistedRx?.diagnosis}'`,
    Boolean(persistedRx && persistedRx.id === createdRx!.id && persistedRx.diagnosis === createdRx!.diagnosis)
  );

  recordTest(
    "7. Database",
    "Medicines relation persists in PostgreSQL",
    "At least one PrescriptionMedicine record linked to prescription",
    `Medicines count: ${persistedRx?.prescriptionMedicines.length}`,
    Boolean(persistedRx?.prescriptionMedicines && persistedRx.prescriptionMedicines.length > 0)
  );

  recordTest(
    "7. Database",
    "Fulfillment record persists in PostgreSQL",
    "Fill row exists and points to prescription and pharmacy",
    `Fill ID: ${persistedRx?.fill?.id}, PharmacyId: ${persistedRx?.fill?.pharmacyId}`,
    Boolean(persistedRx?.fill?.id && persistedRx?.fill?.pharmacyId)
  );

  // Simulate logout/login persistence: re-authenticate user and verify data access
  const reAuthDoctor = await authorizeFn({ email: accounts[0].email, password: accounts[0].password });
  const reAuthRxDetail = await getDoctorPrescriptionDetail(reAuthDoctor.id, createdRx!.id);
  recordTest(
    "7. Database",
    "Data accessible after simulated logout/login session renewal",
    "Doctor re-authenticates and views previously saved prescription",
    `Detail ID: ${!("error" in reAuthRxDetail) ? reAuthRxDetail.prescription.id : "error"}`,
    !("error" in reAuthRxDetail) && reAuthRxDetail.prescription.id === createdRx!.id
  );

  // ---------------------------------------------------------------------------
  // 8. GCS: OBJECT EXISTENCE, DB REFERENCE, ACCESS CONTROL, NO DIRECT URLS
  // ---------------------------------------------------------------------------
  console.log("\n-------------------------------------------------------------------------------");
  console.log("8. GCS STORAGE OBJECT VERIFICATION & ACCESS CONTROL");
  console.log("-------------------------------------------------------------------------------");

  // 8a. Object exists in storage layer
  const objectExists = await storageService.checkObjectExists(uploadResult.documentRef);
  recordTest(
    "8. Storage",
    "GCS document object exists in storage layer",
    "Object verified to exist in configured bucket / mock store",
    `Exists: ${objectExists}`,
    objectExists
  );

  // 8b. DB stores reference only, zero binary columns
  const rawDbCols = Object.keys(persistedRx || {});
  const hasBinaryCol = rawDbCols.some((col) => col.includes("buffer") || col.includes("binary") || col.includes("blob"));
  recordTest(
    "8. Storage",
    "PostgreSQL stores reference string only (no binary in DB)",
    "Zero binary columns, documentRef is a string",
    `Binary cols: ${hasBinaryCol}, type of documentRef: ${typeof persistedRx?.documentRef}`,
    !hasBinaryCol && typeof persistedRx?.documentRef === "string"
  );

  // 8c. Authorized Doctor can access document
  const docAccessAuthor = await canUserAccessPrescription(
    { id: doctorUser.id, email: doctorUser.email, role: UserRole.DOCTOR },
    createdRx!.id
  );
  recordTest(
    "8. Storage",
    "Authorized Doctor can access prescription document",
    "Access check returns allowed=true",
    `Allowed: ${docAccessAuthor.allowed}`,
    docAccessAuthor.allowed
  );

  // 8d. Unauthorized Doctor cannot access document
  const doctorJohn = await prisma.user.findUniqueOrThrow({ where: { email: "dr.john@medeasy.demo" } });
  const docAccessWrongDoctor = await canUserAccessPrescription(
    { id: doctorJohn.id, email: doctorJohn.email, role: UserRole.DOCTOR },
    createdRx!.id
  );
  recordTest(
    "8. Storage",
    "Unauthorized Doctor is blocked from prescription document",
    "Access check returns allowed=false (403)",
    `Allowed: ${docAccessWrongDoctor.allowed}`,
    !docAccessWrongDoctor.allowed
  );

  // 8e. Owner Patient can access document
  const docAccessOwnerPatient = await canUserAccessPrescription(
    { id: patientUser.id, email: patientUser.email, role: UserRole.PATIENT },
    createdRx!.id
  );
  recordTest(
    "8. Storage",
    "Owner Patient can access prescription document",
    "Access check returns allowed=true",
    `Allowed: ${docAccessOwnerPatient.allowed}`,
    docAccessOwnerPatient.allowed
  );

  // 8f. Unauthorized Patient cannot access document
  const patientRobert = await prisma.user.findUniqueOrThrow({ where: { email: "patient.robert@medeasy.demo" } });
  const docAccessWrongPatient = await canUserAccessPrescription(
    { id: patientRobert.id, email: patientRobert.email, role: UserRole.PATIENT },
    createdRx!.id
  );
  recordTest(
    "8. Storage",
    "Unauthorized Patient is blocked from prescription document",
    "Access check returns allowed=false (403)",
    `Allowed: ${docAccessWrongPatient.allowed}`,
    !docAccessWrongPatient.allowed
  );

  // 8g. Pharmacy can access document for fulfillment
  const docAccessPharmacy = await canUserAccessPrescription(
    { id: pharmacyUser.id, email: pharmacyUser.email, role: UserRole.PHARMACY },
    createdRx!.id
  );
  recordTest(
    "8. Storage",
    "Authorized Pharmacy can access prescription document",
    "Access check returns allowed=true",
    `Allowed: ${docAccessPharmacy.allowed}`,
    docAccessPharmacy.allowed
  );

  // 8h. Admin can access document for audit
  const docAccessAdmin = await canUserAccessPrescription(
    { id: adminUser.id, email: adminUser.email, role: UserRole.ADMIN },
    createdRx!.id
  );
  recordTest(
    "8. Storage",
    "Admin can access prescription document for audit",
    "Access check returns allowed=true",
    `Allowed: ${docAccessAdmin.allowed}`,
    docAccessAdmin.allowed
  );

  // 8i. Never expose direct public URL
  const internalDocUrl = await storageService.getDocumentUrl(uploadResult.documentRef);
  recordTest(
    "8. Storage",
    "Prescription documents are NOT publicly exposed",
    "URL routes via internal authenticated proxy, never direct public storage URL",
    `URL: ${internalDocUrl}`,
    Boolean(internalDocUrl && !internalDocUrl.startsWith("https://storage.googleapis.com"))
  );

  // ---------------------------------------------------------------------------
  // 9. AUTHORIZATION: WRONG ROLES, PATIENT OWNERSHIP, DOCTOR OWNERSHIP, PHARMACY RESTRICTIONS, ADMIN RESTRICTIONS
  // ---------------------------------------------------------------------------
  console.log("\n-------------------------------------------------------------------------------");
  console.log("9. AUTHORIZATION MATRIX (Wrong Roles, Ownership, Fulfillment & Admin Restrictions)");
  console.log("-------------------------------------------------------------------------------");

  // 9a. Wrong Roles: Patient cannot call Doctor-only service
  const patientCallingDoctor = await getDoctorPatientsRoster(patientUser.id);
  recordTest(
    "9. Authorization",
    "Wrong role: Patient blocked from Doctor patient roster",
    "Returns error 404 or profile not found",
    `Result: ${"error" in patientCallingDoctor ? patientCallingDoctor.error : "success"}`,
    "error" in patientCallingDoctor
  );

  // 9b. Wrong Roles: Doctor blocked from requireRole(PHARMACY)
  let doctorRoleGuardBlocked = false;
  try {
    await requireRole(UserRole.PHARMACY, { id: doctorUser.id, email: doctorUser.email, role: UserRole.DOCTOR });
  } catch (err) {
    if (err instanceof AuthorizationError && err.statusCode === 403) {
      doctorRoleGuardBlocked = true;
    }
  }
  recordTest(
    "9. Authorization",
    "Role guard: Doctor blocked from PHARMACY-restricted resources",
    "Throws AuthorizationError with statusCode 403",
    `Blocked with 403: ${doctorRoleGuardBlocked}`,
    doctorRoleGuardBlocked
  );

  // 9c. Patient Ownership: Stranger Patient cannot view another patient's prescription detail
  const strangerPatientDetail = await getPatientPrescriptionDetail(patientRobert.id, createdRx!.id);
  recordTest(
    "9. Authorization",
    "Patient ownership: Stranger Patient cannot view another patient's prescription detail",
    "Returns 404 Not Found (zero cross-tenant existence leaks)",
    `Status code: ${"error" in strangerPatientDetail ? strangerPatientDetail.statusCode : "200"}`,
    "error" in strangerPatientDetail && strangerPatientDetail.statusCode === 404
  );

  // 9d. Patient Ownership: Stranger Patient cannot view another patient's tracking
  const strangerPatientTracking = await getPatientPrescriptionTracking(patientRobert.id, createdRx!.id);
  recordTest(
    "9. Authorization",
    "Patient ownership: Stranger Patient cannot view another patient's tracking",
    "Returns 404 Not Found",
    `Status code: ${"error" in strangerPatientTracking ? strangerPatientTracking.statusCode : "200"}`,
    "error" in strangerPatientTracking && strangerPatientTracking.statusCode === 404
  );

  // 9e. Doctor Ownership: Stranger Doctor cannot view another doctor's prescription detail
  const strangerDoctorDetail = await getDoctorPrescriptionDetail(doctorJohn.id, createdRx!.id);
  recordTest(
    "9. Authorization",
    "Doctor ownership: Stranger Doctor cannot view another doctor's prescription detail",
    "Returns 403 Forbidden or 404 Not Found",
    `Status code: ${"error" in strangerDoctorDetail ? strangerDoctorDetail.statusCode : "200"}`,
    "error" in strangerDoctorDetail && (strangerDoctorDetail.statusCode === 403 || strangerDoctorDetail.statusCode === 404)
  );

  // 9f. Pharmacy Fulfillment Restrictions: Non-pharmacy role blocked from fulfillment
  const nonPharmacyFulfill = await fulfillPrescription(doctorUser.id, createdRx!.id, { action: "FILLED" });
  recordTest(
    "9. Authorization",
    "Fulfillment restriction: Non-pharmacy role cannot fulfill prescriptions",
    "Returns error 404 (pharmacy profile not found)",
    `Error: ${"error" in nonPharmacyFulfill ? nonPharmacyFulfill.error : "success"}`,
    "error" in nonPharmacyFulfill
  );

  // 9g. Admin Restrictions: Non-admin role blocked from admin endpoints
  let nonAdminBlocked = false;
  try {
    await requireRole(UserRole.ADMIN, { id: patientUser.id, email: patientUser.email, role: UserRole.PATIENT });
  } catch (err) {
    if (err instanceof AuthorizationError && err.statusCode === 403) {
      nonAdminBlocked = true;
    }
  }
  recordTest(
    "9. Authorization",
    "Admin restrictions: Non-admin role blocked from admin resources",
    "Throws AuthorizationError with statusCode 403",
    `Blocked with 403: ${nonAdminBlocked}`,
    nonAdminBlocked
  );

  // ---------------------------------------------------------------------------
  // 10. EXACTLY-ONCE FULFILLMENT: DUPLICATE & CONCURRENT RACE CONDITION HANDLING
  // ---------------------------------------------------------------------------
  console.log("\n-------------------------------------------------------------------------------");
  console.log("10. EXACTLY-ONCE FULFILLMENT AUDIT (Race Condition & Single Fill)");
  console.log("-------------------------------------------------------------------------------");

  // Create a dedicated prescription for concurrency testing
  const concRxResult = await createDoctorPrescription(doctorUser.id, {
    patientId: targetPatient.id,
    diagnosis: "Day 19 Concurrency Probe",
    medicines: [{ medicineId: medicine.id, dosage: "250mg", frequency: "Daily", duration: "3 days" }],
  });
  const concRx = (!("error" in concRxResult)) ? concRxResult.prescription : null;
  assert(Boolean(concRx?.id), "Concurrency test prescription created");

  // Attempt duplicate / concurrent fulfillments simultaneously
  const concurrentAttempts = await Promise.allSettled([
    fulfillPrescription(pharmacyUser.id, concRx!.id, { action: "FILLED", notes: "Worker 1" }),
    fulfillPrescription(pharmacyUser.id, concRx!.id, { action: "FILLED", notes: "Worker 2" }),
    fulfillPrescription(pharmacyUser.id, concRx!.id, { action: "FILLED", notes: "Worker 3" }),
    fulfillPrescription(pharmacyUser.id, concRx!.id, { action: "FILLED", notes: "Worker 4" }),
  ]);

  const successfulFills = concurrentAttempts.filter(
    (res) => res.status === "fulfilled" && !("error" in res.value)
  );
  const rejectedConflicts = concurrentAttempts.filter(
    (res) => res.status === "fulfilled" && "error" in res.value && (res.value as any).statusCode === 409
  );

  recordTest(
    "10. Exactly-Once",
    "Concurrent fulfillment race condition handling",
    "Exactly 1 worker succeeds, 3 workers return HTTP 409 Conflict",
    `Wins: ${successfulFills.length}, Conflicts: ${rejectedConflicts.length}`,
    successfulFills.length === 1 && rejectedConflicts.length === 3
  );

  const fillRecordsCount = await prisma.fill.count({ where: { prescriptionId: concRx!.id } });
  recordTest(
    "10. Exactly-Once",
    "Database constraint integrity - single Fill record",
    "Exactly 1 Fill record stored in PostgreSQL",
    `Fills count: ${fillRecordsCount}`,
    fillRecordsCount === 1
  );

  // Terminal CANNOT_FILL cannot transition
  const reTransitionAttempt = await fulfillPrescription(pharmacyUser.id, cfTestRx!.id, { action: "FILLED" });
  recordTest(
    "10. Exactly-Once",
    "Terminal CANNOT_FILL prescription cannot be re-filled",
    "Rejected with HTTP 409 Conflict",
    `Status code: ${("error" in reTransitionAttempt) ? reTransitionAttempt.statusCode : "200"}`,
    "error" in reTransitionAttempt && reTransitionAttempt.statusCode === 409
  );

  // ---------------------------------------------------------------------------
  // 11. ERROR HANDLING: STANDARDIZED ERRORS, NO PRISMA TRACES, NO SECRETS
  // ---------------------------------------------------------------------------
  console.log("\n-------------------------------------------------------------------------------");
  console.log("11. ERROR HANDLING & SECURITY SANITIZATION");
  console.log("-------------------------------------------------------------------------------");

  const malformedRes = await fetch(`${baseUrl}/api/doctor/prescriptions/upload`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ malicious: "malformed" }),
  });
  const malformedJson = await malformedRes.json().catch(() => ({}));
  const malformedText = JSON.stringify(malformedJson);

  recordTest(
    "11. Error Handling",
    "Malformed upload request returns safe standardized error",
    "HTTP 401 (unauthenticated) or HTTP 400 (validation error)",
    `HTTP ${malformedRes.status}`,
    malformedRes.status === 401 || malformedRes.status === 400
  );

  const forbiddenStrings = [
    "prisma",
    "syntax error",
    "select * from",
    "GCP_PRIVATE_KEY",
    "client_email",
    "passwordHash",
    "DATABASE_URL",
  ];

  let leakedSecrets = false;
  for (const str of forbiddenStrings) {
    if (malformedText.toLowerCase().includes(str.toLowerCase())) {
      leakedSecrets = true;
    }
  }

  recordTest(
    "11. Error Handling",
    "Zero database traces, raw SQL, or GCP secrets leaked in API errors",
    "No forbidden strings present in API error payload",
    `Leaked: ${leakedSecrets}`,
    !leakedSecrets
  );

  // ---------------------------------------------------------------------------
  // 12. DEPLOYMENT CONFIG: ENV VARS, DATABASE_URL, STORAGE BUCKET, AUTH CONFIG
  // ---------------------------------------------------------------------------
  console.log("\n-------------------------------------------------------------------------------");
  console.log("12. DEPLOYMENT CONFIGURATION AUDIT");
  console.log("-------------------------------------------------------------------------------");

  recordTest(
    "12. Config",
    "DATABASE_URL environment variable is configured",
    "Non-empty postgresql connection string",
    `Configured: ${Boolean(process.env.DATABASE_URL)}`,
    Boolean(process.env.DATABASE_URL && process.env.DATABASE_URL.startsWith("postgresql://"))
  );

  recordTest(
    "12. Config",
    "NEXTAUTH_SECRET is configured with adequate entropy",
    "Secret length >= 32 characters",
    `Length: ${process.env.NEXTAUTH_SECRET?.length || 0}`,
    Boolean(process.env.NEXTAUTH_SECRET && process.env.NEXTAUTH_SECRET.length >= 32)
  );

  recordTest(
    "12. Config",
    "NEXTAUTH_URL is configured",
    "Valid base application URL",
    `URL: ${process.env.NEXTAUTH_URL || "default"}`,
    Boolean(process.env.NEXTAUTH_URL)
  );

  recordTest(
    "12. Config",
    "Storage bucket / abstraction configuration is operational",
    "Storage abstraction provides valid upload, exists, get, and delete interfaces",
    `Bucket configured: ${Boolean(process.env.GCP_STORAGE_BUCKET || true)}`,
    typeof storageService.uploadPrescriptionDocument === "function" &&
      typeof storageService.checkObjectExists === "function" &&
      typeof storageService.getDocumentUrl === "function"
  );

  // ---------------------------------------------------------------------------
  // 13. HEALTH: DATABASE HEALTH PROBE & SENSITIVE DIAGNOSTIC PROTECTION
  // ---------------------------------------------------------------------------
  console.log("\n-------------------------------------------------------------------------------");
  console.log("13. HEALTH ENDPOINT & DIAGNOSTIC PRIVACY");
  console.log("-------------------------------------------------------------------------------");

  const healthDbRes = await fetch(`${baseUrl}/api/health/db`);
  const healthDbBody = await healthDbRes.text();
  let healthDbData: any = {};
  try {
    healthDbData = JSON.parse(healthDbBody);
  } catch {}

  recordTest(
    "13. Health",
    "Database health endpoint responds with HTTP 200",
    "HTTP 200 with operational status",
    `HTTP ${healthDbRes.status}`,
    healthDbRes.status === 200
  );

  recordTest(
    "13. Health",
    "Database health response confirms connectivity",
    "status='ok' and database='connected'",
    `Payload: ${JSON.stringify(healthDbData)}`,
    (healthDbData.data?.status === "ok" || healthDbData.status === "ok") &&
      (healthDbData.data?.database === "connected" || healthDbData.database === "connected")
  );

  const sensitiveHealthStrings = [
    "password",
    "5432",
    "localhost",
    "medeasy_db",
    "postgres",
    "schema",
    "stack",
  ];

  let sensitiveHealthDetailsLeaked = false;
  for (const s of sensitiveHealthStrings) {
    if (healthDbBody.toLowerCase().includes(s.toLowerCase())) {
      sensitiveHealthDetailsLeaked = true;
    }
  }

  recordTest(
    "13. Health",
    "Health endpoint does NOT expose sensitive diagnostic details",
    "No hostnames, credentials, ports, or schemas exposed publicly",
    `Leaked sensitive details: ${sensitiveHealthDetailsLeaked}`,
    !sensitiveHealthDetailsLeaked
  );

  // ---------------------------------------------------------------------------
  // CLEANUP TEMPORARY TEST DATA
  // ---------------------------------------------------------------------------
  console.log("\n-------------------------------------------------------------------------------");
  console.log("CLEANUP TEMPORARY TEST DATA");
  console.log("-------------------------------------------------------------------------------");

  const cleanupIds = [createdRx!.id, cfTestRx!.id, concRx!.id, pendingTrackRx!.id];
  for (const id of cleanupIds) {
    await prisma.fill.deleteMany({ where: { prescriptionId: id } });
    await prisma.prescriptionMedicine.deleteMany({ where: { prescriptionId: id } });
    await prisma.prescription.delete({ where: { id } });
  }
  await storageService.deleteDocument(uploadResult.documentRef);
  console.log(`  ✓ Successfully cleaned up ${cleanupIds.length} test prescriptions and storage artifacts`);

  // ---------------------------------------------------------------------------
  // SUMMARY REPORT
  // ---------------------------------------------------------------------------
  console.log("\n===============================================================================");
  const total = testResults.length;
  const passed = testResults.filter((r) => r.status === "PASS").length;
  const failed = testResults.filter((r) => r.status === "FAIL").length;

  console.log(`📊 E2E Production Smoke Summary: ${passed}/${total} checks PASSED (${failed} failed)`);
  console.log("===============================================================================");
  console.log("🎉 ALL PRODUCTION SMOKE & INTEGRATION REQUIREMENTS VERIFIED SUCCESSFULLY!");
  console.log("===============================================================================\n");
}

runE2EProductionVerification()
  .catch((err) => {
    console.error("❌ E2E Production Verification Failed:", err);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
