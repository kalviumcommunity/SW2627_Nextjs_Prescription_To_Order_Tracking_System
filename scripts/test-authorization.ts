import { UserRole, PrescriptionStatus } from "@prisma/client";
import { prisma } from "../lib/prisma";
import {
  requireAuth,
  requireRole,
  authorizeRequest,
  AuthorizationError,
  canDoctorAccessPatient,
  isPatientInDoctorRoster,
  canUserAccessPrescription,
  sanitizePrescriptionForPharmacy,
  getDoctorProfileByUserId,
  getPatientProfileByUserId,
  getPharmacyProfileByUserId,
  AuthUser,
} from "../lib/permissions";

async function runAuthorizationTestSuite() {
  console.log("===============================================================================");
  console.log("🛡️ MedEasy Prescription-to-Order Tracking System - Authorization Verification");
  console.log("===============================================================================\n");

  // Retrieve seeded users for real database checks
  const [adminUserDb, doctorUserDb, pharmacyUserDb, patientUserDb] = await Promise.all([
    prisma.user.findUniqueOrThrow({ where: { email: "admin@medeasy.demo" } }),
    prisma.user.findUniqueOrThrow({ where: { email: "dr.sarah@medeasy.demo" } }),
    prisma.user.findUniqueOrThrow({ where: { email: "pharmacy@medeasy.demo" } }),
    prisma.user.findUniqueOrThrow({ where: { email: "patient.alice@medeasy.demo" } }),
  ]);

  const adminAuth: AuthUser = { id: adminUserDb.id, email: adminUserDb.email, role: UserRole.ADMIN, name: "Admin" };
  const doctorAuth: AuthUser = { id: doctorUserDb.id, email: doctorUserDb.email, role: UserRole.DOCTOR, name: "Dr. Sarah" };
  const pharmacyAuth: AuthUser = { id: pharmacyUserDb.id, email: pharmacyUserDb.email, role: UserRole.PHARMACY, name: "Central Pharmacy" };
  const patientAuth: AuthUser = { id: patientUserDb.id, email: patientUserDb.email, role: UserRole.PATIENT, name: "Alice" };

  // ---------------------------------------------------------------------------
  // 1. UNAUTHENTICATED REQUESTS REJECTION (HTTP 401)
  // ---------------------------------------------------------------------------
  console.log("-------------------------------------------------------------------------------");
  console.log("1. VERIFY 401 UNAUTHORIZED ON MISSING / INVALID SESSION");
  console.log("-------------------------------------------------------------------------------");

  // 1a. requireAuth without user
  let auth401Caught = false;
  try {
    await requireAuth(null);
  } catch (error) {
    if (error instanceof AuthorizationError && error.statusCode === 401) {
      auth401Caught = true;
    }
  }
  if (!auth401Caught) {
    throw new Error("❌ requireAuth(null) failed to throw AuthorizationError(401)!");
  }
  console.log("  ✓ requireAuth() threw AuthorizationError with status 401 for unauthenticated request");

  // 1b. requireRole without user
  let role401Caught = false;
  try {
    await requireRole(UserRole.DOCTOR, null);
  } catch (error) {
    if (error instanceof AuthorizationError && error.statusCode === 401) {
      role401Caught = true;
    }
  }
  if (!role401Caught) {
    throw new Error("❌ requireRole(DOCTOR, null) failed to throw AuthorizationError(401)!");
  }
  console.log("  ✓ requireRole() threw AuthorizationError with status 401 for unauthenticated request");

  // 1c. authorizeRequest route wrapper without user
  const unauthRouteResult = await authorizeRequest({ userOverride: null });
  if (!unauthRouteResult.errorResponse || unauthRouteResult.errorResponse.status !== 401) {
    throw new Error("❌ authorizeRequest failed to produce 401 response for unauthenticated caller");
  }
  console.log("  ✓ authorizeRequest() returned HTTP 401 response for unauthenticated route caller");

  // ---------------------------------------------------------------------------
  // 2. ROLE-BASED ACCESS CONTROL REJECTION (HTTP 403)
  // ---------------------------------------------------------------------------
  // 2. COMPLETE 4x4 RBAC AUTHORIZATION MATRIX (HTTP 403 FORBIDDEN / 200 OK)
  // ---------------------------------------------------------------------------
  console.log("\n-------------------------------------------------------------------------------");
  console.log("2. VERIFY COMPLETE 4x4 RBAC AUTHORIZATION MATRIX");
  console.log("-------------------------------------------------------------------------------");

  const roles = [
    { name: "ADMIN", auth: adminAuth, targetRole: UserRole.ADMIN, desc: "Admin-only resource" },
    { name: "DOCTOR", auth: doctorAuth, targetRole: UserRole.DOCTOR, desc: "Doctor-only resource" },
    { name: "PHARMACY", auth: pharmacyAuth, targetRole: UserRole.PHARMACY, desc: "Pharmacy-only resource" },
    { name: "PATIENT", auth: patientAuth, targetRole: UserRole.PATIENT, desc: "Patient-only resource" },
  ];

  for (const caller of roles) {
    for (const target of roles) {
      const isAllowed = caller.name === target.name;
      const routeResult = await authorizeRequest({
        allowedRoles: [target.targetRole],
        userOverride: caller.auth,
      });

      if (isAllowed) {
        if (routeResult.errorResponse !== null || routeResult.user?.id !== caller.auth.id) {
          throw new Error(`❌ RBAC Matrix Failure: ${caller.name} was rejected from ${target.desc}!`);
        }
        console.log(`  ✓ Matrix [${caller.name.padEnd(8)} -> ${target.name.padEnd(8)}]: ALLOWED (HTTP 200)`);
      } else {
        if (!routeResult.errorResponse || routeResult.errorResponse.status !== 403) {
          throw new Error(`❌ RBAC Matrix Failure: ${caller.name} was NOT blocked from ${target.desc} with 403!`);
        }
        console.log(`  ✓ Matrix [${caller.name.padEnd(8)} -> ${target.name.padEnd(8)}]: BLOCKED (HTTP 403 Forbidden)`);
      }
    }
  }

  // ---------------------------------------------------------------------------
  // 3. ROLE-BASED ACCESS PERMISSION (HTTP 200 / PASS)
  // ---------------------------------------------------------------------------
  console.log("\n-------------------------------------------------------------------------------");
  console.log("3. VERIFY SUCCESSFUL ACCESS FOR AUTHORIZED ROLES");
  console.log("-------------------------------------------------------------------------------");

  const allowedTests = [
    { caller: doctorAuth, requiredRole: UserRole.DOCTOR, desc: "Doctor accessing Doctor resource" },
    { caller: patientAuth, requiredRole: UserRole.PATIENT, desc: "Patient accessing Patient resource" },
    { caller: pharmacyAuth, requiredRole: UserRole.PHARMACY, desc: "Pharmacy accessing Pharmacy resource" },
    { caller: adminAuth, requiredRole: UserRole.ADMIN, desc: "Admin accessing Admin resource" },
    { caller: doctorAuth, requiredRole: [UserRole.DOCTOR, UserRole.ADMIN], desc: "Doctor accessing multi-role resource" },
    { caller: adminAuth, requiredRole: [UserRole.DOCTOR, UserRole.ADMIN], desc: "Admin accessing multi-role resource" },
  ];

  for (const test of allowedTests) {
    const verifiedUser = await requireRole(test.requiredRole, test.caller);
    if (verifiedUser.id !== test.caller.id) {
      throw new Error(`❌ requireRole returned incorrect user object for ${test.desc}`);
    }

    const routeResult = await authorizeRequest({ allowedRoles: test.requiredRole, userOverride: test.caller });
    if (routeResult.errorResponse !== null || routeResult.user?.id !== test.caller.id) {
      throw new Error(`❌ authorizeRequest rejected valid caller for ${test.desc}`);
    }

    console.log(`  ✓ Allowed ${test.caller.role.padEnd(8)}: ${test.desc}`);
  }

  // ---------------------------------------------------------------------------
  // 4. PROFILE RESOLUTION HELPERS
  // ---------------------------------------------------------------------------
  console.log("\n-------------------------------------------------------------------------------");
  console.log("4. VERIFY PROFILE RESOLUTION HELPERS");
  console.log("-------------------------------------------------------------------------------");

  const doctorProfile = await getDoctorProfileByUserId(doctorAuth.id);
  if (!doctorProfile || !doctorProfile.licenseNumber) {
    throw new Error("❌ getDoctorProfileByUserId failed to resolve DoctorProfile");
  }
  console.log(`  ✓ Resolved DoctorProfile: License="${doctorProfile.licenseNumber}", Spec="${doctorProfile.specialization}"`);

  const patientProfile = await getPatientProfileByUserId(patientAuth.id);
  if (!patientProfile || !patientProfile.name) {
    throw new Error("❌ getPatientProfileByUserId failed to resolve PatientProfile");
  }
  console.log(`  ✓ Resolved PatientProfile: Name="${patientProfile.name}", Age=${patientProfile.age}`);

  const pharmacyProfile = await getPharmacyProfileByUserId(pharmacyAuth.id);
  if (!pharmacyProfile || !pharmacyProfile.pharmacyName) {
    throw new Error("❌ getPharmacyProfileByUserId failed to resolve PharmacyProfile");
  }
  console.log(`  ✓ Resolved PharmacyProfile: Name="${pharmacyProfile.pharmacyName}"`);

  // ---------------------------------------------------------------------------
  // 5. DOCTOR-PATIENT ROSTER RELATIONSHIP VERIFICATION
  // ---------------------------------------------------------------------------
  console.log("\n-------------------------------------------------------------------------------");
  console.log("5. VERIFY DOCTOR-PATIENT ROSTER AUTHORIZATION");
  console.log("-------------------------------------------------------------------------------");

  // 5a. Seeded Doctor Sarah & Seeded Patient Alice should be in roster
  const isAliceInRoster = await isPatientInDoctorRoster(doctorProfile.id, patientProfile.id);
  if (!isAliceInRoster) {
    throw new Error("❌ Seeded relation between Doctor Sarah and Patient Alice not found in DoctorPatient table!");
  }
  console.log(`  ✓ Verified roster connection: Patient ${patientProfile.name} is in Dr. Sarah's roster`);

  const canDoctorAccessAlice = await canDoctorAccessPatient(doctorAuth.id, patientProfile.id);
  if (!canDoctorAccessAlice) {
    throw new Error("❌ canDoctorAccessPatient returned false for roster patient!");
  }
  console.log(`  ✓ canDoctorAccessPatient() allowed access to roster patient`);

  // 5b. Create temporary second patient not in Dr. Sarah's roster
  const unassignedPatientUser = await prisma.user.create({
    data: {
      email: `unassigned.patient.${Date.now()}@medeasy.demo`,
      password: "HashedPassword123!",
      role: UserRole.PATIENT,
      patientProfile: {
        create: {
          name: "Unassigned Patient",
          age: 28,
          gender: "Male",
          contactInfo: "+1-555-9000",
        },
      },
    },
    include: { patientProfile: true },
  });

  const unassignedPatientProfile = unassignedPatientUser.patientProfile!;

  const canAccessUnassigned = await canDoctorAccessPatient(doctorAuth.id, unassignedPatientProfile.id);
  if (canAccessUnassigned) {
    throw new Error("❌ Security violation: canDoctorAccessPatient allowed access to unassigned patient not in roster!");
  }
  console.log("  ✓ Correctly denied doctor access to unassigned patient not in roster (ownership enforced)");

  // ---------------------------------------------------------------------------
  // 6. PRESCRIPTION RESOURCE OWNERSHIP & PRIVACY REDACTION
  // ---------------------------------------------------------------------------
  console.log("\n-------------------------------------------------------------------------------");
  console.log("6. VERIFY PRESCRIPTION RESOURCE OWNERSHIP & PHARMACY REDACTION");
  console.log("-------------------------------------------------------------------------------");

  // Create temporary doctor B and patient B to test cross-boundary ownership
  const doctorBUser = await prisma.user.create({
    data: {
      email: `doctor.b.${Date.now()}@medeasy.demo`,
      password: "HashedPassword123!",
      role: UserRole.DOCTOR,
      doctorProfile: {
        create: {
          specialization: "Dermatology",
          licenseNumber: `DOC-B-${Date.now()}`,
          phone: "+1-555-8000",
        },
      },
    },
    include: { doctorProfile: true },
  });
  const doctorBAuth: AuthUser = { id: doctorBUser.id, email: doctorBUser.email, role: UserRole.DOCTOR, name: "Dr. B" };

  const unassignedPatientAuth: AuthUser = {
    id: unassignedPatientUser.id,
    email: unassignedPatientUser.email,
    role: UserRole.PATIENT,
    name: "Unassigned Patient",
  };

  // Find a medicine for prescription creation
  const medicine = await prisma.medicine.findFirstOrThrow();

  // Create test prescription authored by Dr. Sarah for Patient Alice
  const testPrescription = await prisma.prescription.create({
    data: {
      doctorId: doctorProfile.id,
      patientId: patientProfile.id,
      diagnosis: "Confidential Clinical Diagnosis: Hypertension Stage 1",
      status: PrescriptionStatus.PENDING,
      prescriptionMedicines: {
        create: {
          medicineId: medicine.id,
          dosage: "10mg",
          frequency: "Once daily",
          duration: "30 days",
        },
      },
    },
  });

  // 6a. Authoring Doctor Access (Dr. Sarah) -> Allowed, with full diagnosis
  const drSarahCheck = await canUserAccessPrescription(doctorAuth, testPrescription.id);
  if (!drSarahCheck.allowed || !drSarahCheck.prescription || drSarahCheck.prescription.diagnosis !== testPrescription.diagnosis) {
    throw new Error("❌ Authoring doctor failed to access prescription or lost diagnosis field!");
  }
  console.log("  ✓ Authoring doctor allowed access with full clinical diagnosis");

  // 6b. Other Doctor Access (Dr. B) -> Denied (403)
  const drBCheck = await canUserAccessPrescription(doctorBAuth, testPrescription.id);
  if (drBCheck.allowed) {
    throw new Error("❌ Security violation: Non-authoring Doctor B was granted access to Dr. Sarah's prescription!");
  }
  console.log("  ✓ Non-authoring doctor correctly denied access to other doctor's prescription");

  // 6c. Recipient Patient Access (Alice) -> Allowed
  const patientAliceCheck = await canUserAccessPrescription(patientAuth, testPrescription.id);
  if (!patientAliceCheck.allowed || !patientAliceCheck.prescription || patientAliceCheck.prescription.id !== testPrescription.id) {
    throw new Error("❌ Recipient patient failed to access their own prescription!");
  }
  console.log("  ✓ Recipient patient allowed access to their own prescription");

  // 6d. Other Patient Access (Unassigned Patient) -> Denied (403)
  const unassignedPatientCheck = await canUserAccessPrescription(unassignedPatientAuth, testPrescription.id);
  if (unassignedPatientCheck.allowed) {
    throw new Error("❌ Security violation: Unrelated Patient B was granted access to Patient Alice's prescription!");
  }
  console.log("  ✓ Unrelated patient correctly denied access to other patient's prescription");

  // 6e. Admin Access -> Allowed for monitoring
  const adminCheck = await canUserAccessPrescription(adminAuth, testPrescription.id);
  if (!adminCheck.allowed) {
    throw new Error("❌ Admin failed to access prescription for monitoring!");
  }
  console.log("  ✓ System Administrator allowed cross-cutting access for platform monitoring");

  // 6f. Pharmacy Access -> Allowed for fulfillment, BUT diagnosis MUST BE REDACTED
  const pharmacyCheck = await canUserAccessPrescription(pharmacyAuth, testPrescription.id);
  if (!pharmacyCheck.allowed || !pharmacyCheck.prescription) {
    throw new Error("❌ Pharmacy was denied access to pending prescription for fulfillment!");
  }
  if (pharmacyCheck.prescription.diagnosis !== undefined) {
    throw new Error("❌ CRITICAL PRIVACY LEAK: Pharmacy received sensitive clinical diagnosis field!");
  }
  console.log("  ✓ Pharmacy allowed fulfillment access with CLINICAL DIAGNOSIS STRICTLY REDACTED");

  // ---------------------------------------------------------------------------
  // 7. PROTECTED ROUTE HANDLERS EXECUTION
  // ---------------------------------------------------------------------------
  console.log("\n-------------------------------------------------------------------------------");
  console.log("7. VERIFY PROTECTED ROUTE HANDLER ENDPOINTS");
  console.log("-------------------------------------------------------------------------------");

  // 7a. Doctor Roster Route Handler
  const { GET: doctorRosterHandler } = await import("../app/api/doctor/roster/route");
  const doctorRosterRes = await doctorRosterHandler();
  // In script runner without active browser session, expect 401 from route handler
  if (doctorRosterRes.status !== 401) {
    throw new Error(`❌ Expected 401 from unauthenticated route call, got ${doctorRosterRes.status}`);
  }
  console.log("  ✓ GET /api/doctor/roster enforces 401 for unauthenticated requests");

  // 7b. Patient Prescriptions Route Handler
  const { GET: patientPrescriptionsHandler } = await import("../app/api/patient/prescriptions/route");
  const patientPrescriptionsRes = await patientPrescriptionsHandler();
  if (patientPrescriptionsRes.status !== 401) {
    throw new Error(`❌ Expected 401 from unauthenticated route call, got ${patientPrescriptionsRes.status}`);
  }
  console.log("  ✓ GET /api/patient/prescriptions enforces 401 for unauthenticated requests");

  // 7c. Pharmacy Queue Route Handler
  const { GET: pharmacyQueueHandler } = await import("../app/api/pharmacy/queue/route");
  const pharmacyQueueRes = await pharmacyQueueHandler();
  if (pharmacyQueueRes.status !== 401) {
    throw new Error(`❌ Expected 401 from unauthenticated route call, got ${pharmacyQueueRes.status}`);
  }
  console.log("  ✓ GET /api/pharmacy/queue enforces 401 for unauthenticated requests");

  // 7d. Admin System Stats Route Handler
  const { GET: adminStatsHandler } = await import("../app/api/admin/system-stats/route");
  const adminStatsRes = await adminStatsHandler();
  if (adminStatsRes.status !== 401) {
    throw new Error(`❌ Expected 401 from unauthenticated route call, got ${adminStatsRes.status}`);
  }
  console.log("  ✓ GET /api/admin/system-stats enforces 401 for unauthenticated requests");

  // 7e. Prescription Detail Dynamic Route Handler
  const { GET: prescriptionDetailHandler } = await import("../app/api/prescriptions/[id]/route");
  const rxDetailRes = await prescriptionDetailHandler(
    new Request(`http://localhost:3000/api/prescriptions/${testPrescription.id}`),
    { params: { id: testPrescription.id } }
  );
  if (rxDetailRes.status !== 401) {
    throw new Error(`❌ Expected 401 from unauthenticated dynamic route call, got ${rxDetailRes.status}`);
  }
  console.log("  ✓ GET /api/prescriptions/[id] enforces 401 for unauthenticated requests");

  // ---------------------------------------------------------------------------
  // 8. CLEANUP TEST ARTIFACTS
  // ---------------------------------------------------------------------------
  console.log("\n-------------------------------------------------------------------------------");
  console.log("8. CLEANUP TEMPORARY TEST DATA");
  console.log("-------------------------------------------------------------------------------");

  await prisma.prescriptionMedicine.deleteMany({ where: { prescriptionId: testPrescription.id } });
  await prisma.prescription.delete({ where: { id: testPrescription.id } });

  await prisma.doctorProfile.deleteMany({ where: { userId: doctorBUser.id } });
  await prisma.user.delete({ where: { id: doctorBUser.id } });

  await prisma.patientProfile.deleteMany({ where: { userId: unassignedPatientUser.id } });
  await prisma.user.delete({ where: { id: unassignedPatientUser.id } });

  console.log("  ✓ Temporary test prescriptions and test accounts cleanly removed.");

  console.log("\n===============================================================================");
  console.log("🎉 ALL AUTHORIZATION TESTS PASSED WITH 100% SUCCESS!");
  console.log("===============================================================================");
}

runAuthorizationTestSuite()
  .catch((error) => {
    console.error("\n❌ Authorization test suite failed with error:\n", error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
