import { authOptions } from "../lib/auth";
import { registerDoctor, registerPatient, hashPassword, verifyPassword } from "../lib/auth-service";
import { prisma } from "../lib/prisma";
import { UserRole } from "@prisma/client";
import bcrypt from "bcryptjs";

async function runAuthTests() {
  console.log("=================================================");
  console.log("🧪 Starting MedEasy Authentication Test Suite");
  console.log("=================================================\n");

  const credentialsProvider = authOptions.providers.find(
    (p: any) => p.id === "credentials" || p.name === "Credentials"
  ) as any;

  const authorizeFn = credentialsProvider?.options?.authorize || credentialsProvider?.authorize;

  if (!authorizeFn) {
    throw new Error("Credentials provider authorize function not found!");
  }

  // ---------------------------------------------------------------------------
  // TEST 1: Seeded Accounts Authentication
  // ---------------------------------------------------------------------------
  console.log("Test 1: Verifying Seeded Account Logins...");

  const testAccounts = [
    {
      role: UserRole.ADMIN,
      email: "admin@medeasy.demo",
      password: "DemoAdminPassword123!",
      expectedRole: UserRole.ADMIN,
    },
    {
      role: UserRole.DOCTOR,
      email: "dr.sarah@medeasy.demo",
      password: "DemoDoctorPassword123!",
      expectedRole: UserRole.DOCTOR,
    },
    {
      role: UserRole.PHARMACY,
      email: "pharmacy@medeasy.demo",
      password: "DemoPharmacyPassword123!",
      expectedRole: UserRole.PHARMACY,
    },
    {
      role: UserRole.PATIENT,
      email: "patient.alice@medeasy.demo",
      password: "DemoPatientPassword123!",
      expectedRole: UserRole.PATIENT,
    },
  ];

  for (const acc of testAccounts) {
    const authResult = await authorizeFn({
      email: acc.email,
      password: acc.password,
    });

    if (!authResult) {
      throw new Error(`❌ Failed login for seeded ${acc.role}: ${acc.email}`);
    }

    if (authResult.role !== acc.expectedRole) {
      throw new Error(
        `❌ Role mismatch for ${acc.email}: expected ${acc.expectedRole}, got ${authResult.role}`
      );
    }

    if (!authResult.id || !authResult.email || !authResult.name) {
      throw new Error(`❌ Missing required fields in user object for ${acc.email}: ${JSON.stringify(authResult)}`);
    }

    console.log(`  ✓ Successfully authenticated ${acc.role}: ${authResult.name} (${authResult.email}) [ID: ${authResult.id}]`);
  }

  // ---------------------------------------------------------------------------
  // TEST 2: Password Storage Verification (Bcrypt Hash in Database)
  // ---------------------------------------------------------------------------
  console.log("\nTest 2: Verifying Stored Passwords are Valid Bcrypt Hashes...");
  const adminInDb = await prisma.user.findUnique({
    where: { email: "admin@medeasy.demo" },
  });

  if (!adminInDb) {
    throw new Error("Admin user not found in DB");
  }

  if (!adminInDb.password.startsWith("$2a$") && !adminInDb.password.startsWith("$2b$")) {
    throw new Error(`❌ Password in database is not a bcrypt hash: ${adminInDb.password}`);
  }

  console.log(`  ✓ Database password hash format verified: ${adminInDb.password.substring(0, 15)}... (never plaintext)`);

  // ---------------------------------------------------------------------------
  // TEST 3: Invalid Credentials Handling
  // ---------------------------------------------------------------------------
  console.log("\nTest 3: Verifying Invalid Credentials Rejection...");

  // Wrong password
  const wrongPasswordResult = await authorizeFn({
    email: "admin@medeasy.demo",
    password: "WrongPassword!999",
  });

  if (wrongPasswordResult !== null) {
    throw new Error("❌ Expected wrong password to return null, but got a user object!");
  }
  console.log("  ✓ Correctly rejected wrong password (returned null)");

  // Missing / non-existent user
  const nonExistentUserResult = await authorizeFn({
    email: "nonexistent@medeasy.demo",
    password: "SomePassword123!",
  });

  if (nonExistentUserResult !== null) {
    throw new Error("❌ Expected non-existent user to return null, but got a user object!");
  }
  console.log("  ✓ Correctly rejected non-existent user (returned null)");

  // Empty credentials
  const emptyCredentialsResult = await authorizeFn({
    email: "",
    password: "",
  });

  if (emptyCredentialsResult !== null) {
    throw new Error("❌ Expected empty credentials to return null!");
  }
  console.log("  ✓ Correctly rejected empty credentials (returned null)");

  // ---------------------------------------------------------------------------
  // TEST 4: JWT and Session Callbacks
  // ---------------------------------------------------------------------------
  console.log("\nTest 4: Verifying JWT and Session Callbacks...");
  const jwtCallback = authOptions.callbacks?.jwt;
  const sessionCallback = authOptions.callbacks?.session;

  if (!jwtCallback || !sessionCallback) {
    throw new Error("❌ JWT or Session callback is missing in authOptions!");
  }

  const dummyUser = {
    id: "user-test-123",
    email: "dr.sarah@medeasy.demo",
    name: "Dr. Sarah Smith",
    role: UserRole.DOCTOR,
  };

  // Simulate token generation at sign-in
  const token = await (jwtCallback as any)({
    token: {},
    user: dummyUser,
  });

  if (token.id !== dummyUser.id || token.role !== dummyUser.role || token.email !== dummyUser.email) {
    throw new Error(`❌ JWT callback did not populate token correctly: ${JSON.stringify(token)}`);
  }
  console.log(`  ✓ JWT token populated: id=${token.id}, role=${token.role}, email=${token.email}`);

  // Simulate session generation from token
  const session = await (sessionCallback as any)({
    session: { user: {}, expires: "2026-12-31" },
    token,
  });

  if (
    session.user.id !== dummyUser.id ||
    session.user.role !== dummyUser.role ||
    session.user.email !== dummyUser.email ||
    session.user.name !== dummyUser.name
  ) {
    throw new Error(`❌ Session callback did not populate session.user correctly: ${JSON.stringify(session)}`);
  }
  console.log(`  ✓ Session populated: id=${session.user.id}, role=${session.user.role}, name=${session.user.name}, email=${session.user.email}`);

  // ---------------------------------------------------------------------------
  // TEST 5: Doctor & Patient Registration Support
  // ---------------------------------------------------------------------------
  console.log("\nTest 5: Verifying Registration Architecture for Doctors and Patients...");

  const testDoctorEmail = `test.dr.${Date.now()}@medeasy.demo`;
  const testPatientEmail = `test.patient.${Date.now()}@medeasy.demo`;

  // Register Doctor
  const newDoctor = await registerDoctor({
    email: testDoctorEmail,
    password: "NewDoctorSecurePassword123!",
    specialization: "Cardiology",
    licenseNumber: `DOC-TEST-${Date.now()}`,
    phone: "+1-555-9999",
  });

  if (!newDoctor || newDoctor.role !== UserRole.DOCTOR || !newDoctor.doctorProfile) {
    throw new Error("❌ Doctor registration failed to create user with DoctorProfile");
  }
  console.log(`  ✓ Successfully registered new Doctor: ${newDoctor.email} with profile specialization: ${newDoctor.doctorProfile.specialization}`);

  // Test login for newly registered doctor
  const newDoctorAuth = await authorizeFn({
    email: testDoctorEmail,
    password: "NewDoctorSecurePassword123!",
  });
  if (!newDoctorAuth || newDoctorAuth.role !== UserRole.DOCTOR) {
    throw new Error("❌ Failed to log in with newly registered Doctor credentials");
  }
  console.log(`  ✓ Successfully authenticated newly registered Doctor: ${newDoctorAuth.email}`);

  // Register Patient
  const newPatient = await registerPatient({
    email: testPatientEmail,
    password: "NewPatientSecurePassword123!",
    name: "Test Patient Robinson",
    age: 42,
    gender: "Other",
    contactInfo: "+1-555-8888, 99 Test Boulevard",
  });

  if (!newPatient || newPatient.role !== UserRole.PATIENT || !newPatient.patientProfile) {
    throw new Error("❌ Patient registration failed to create user with PatientProfile");
  }
  console.log(`  ✓ Successfully registered new Patient: ${newPatient.email} with profile name: ${newPatient.patientProfile.name}`);

  // Test login for newly registered patient
  const newPatientAuth = await authorizeFn({
    email: testPatientEmail,
    password: "NewPatientSecurePassword123!",
  });
  if (!newPatientAuth || newPatientAuth.role !== UserRole.PATIENT) {
    throw new Error("❌ Failed to log in with newly registered Patient credentials");
  }
  console.log(`  ✓ Successfully authenticated newly registered Patient: ${newPatientAuth.name} (${newPatientAuth.email})`);

  // Test duplicate email rejection
  let duplicateRejected = false;
  try {
    await registerPatient({
      email: testPatientEmail,
      password: "AnotherPassword123!",
      name: "Duplicate Person",
      age: 25,
      gender: "Female",
      contactInfo: "+1-555-7777",
    });
  } catch (err: any) {
    duplicateRejected = err.message.includes("already exists");
  }

  if (!duplicateRejected) {
    throw new Error("❌ Expected duplicate email registration to be rejected!");
  }
  console.log("  ✓ Duplicate email registration correctly rejected with conflict error");

  // ---------------------------------------------------------------------------
  // TEST 6: Registration API Route Handler Verification
  // ---------------------------------------------------------------------------
  console.log("\nTest 6: Verifying app/api/auth/register/route.ts POST Handler...");
  const { POST: registerHandler } = await import("../app/api/auth/register/route");

  // 6a: Test rejection of Admin self-registration
  const adminAttemptReq = new Request("http://localhost:3000/api/auth/register", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      email: "hacker.admin@medeasy.demo",
      password: "Password123!",
      role: UserRole.ADMIN,
    }),
  });
  const adminAttemptRes = await registerHandler(adminAttemptReq);
  if (adminAttemptRes.status !== 403) {
    throw new Error(`❌ Expected 403 Forbidden for Admin registration, got ${adminAttemptRes.status}`);
  }
  console.log("  ✓ Correctly rejected Admin self-registration via API (403 Forbidden)");

  // 6b: Test rejection of Pharmacy self-registration
  const pharmacyAttemptReq = new Request("http://localhost:3000/api/auth/register", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      email: "hacker.pharmacy@medeasy.demo",
      password: "Password123!",
      role: UserRole.PHARMACY,
    }),
  });
  const pharmacyAttemptRes = await registerHandler(pharmacyAttemptReq);
  if (pharmacyAttemptRes.status !== 403) {
    throw new Error(`❌ Expected 403 Forbidden for Pharmacy registration, got ${pharmacyAttemptRes.status}`);
  }
  console.log("  ✓ Correctly rejected Pharmacy self-registration via API (403 Forbidden)");

  // 6c: Test rejection of short password (< 8 chars)
  const shortPassReq = new Request("http://localhost:3000/api/auth/register", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      email: "shortpass@medeasy.demo",
      password: "123",
      role: UserRole.PATIENT,
      name: "Short Pass",
      age: 20,
      gender: "Male",
      contactInfo: "+1-555-1234",
    }),
  });
  const shortPassRes = await registerHandler(shortPassReq);
  if (shortPassRes.status !== 400) {
    throw new Error(`❌ Expected 400 Bad Request for short password, got ${shortPassRes.status}`);
  }
  console.log("  ✓ Correctly rejected short password (< 8 chars) with 400 Bad Request");

  // 6d: Test successful patient registration via API route
  const apiPatientEmail = `api.patient.${Date.now()}@medeasy.demo`;
  const apiPatientReq = new Request("http://localhost:3000/api/auth/register", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      email: apiPatientEmail,
      password: "ApiPatientPassword123!",
      role: UserRole.PATIENT,
      name: "API Registered Patient",
      age: 29,
      gender: "Female",
      contactInfo: "+1-555-4321, 100 API Lane",
    }),
  });
  const apiPatientRes = await registerHandler(apiPatientReq);
  if (apiPatientRes.status !== 201) {
    throw new Error(`❌ Expected 201 Created for Patient registration via API, got ${apiPatientRes.status}`);
  }
  const apiPatientJson = await apiPatientRes.json();
  console.log(`  ✓ Successfully registered Patient via API: ${apiPatientJson.user.email} (Status 201)`);

  // Cleanup API registered patient
  await prisma.patientProfile.deleteMany({ where: { userId: apiPatientJson.user.id } });
  await prisma.user.delete({ where: { id: apiPatientJson.user.id } });

  // ---------------------------------------------------------------------------
  // CLEANUP TEST USERS
  // ---------------------------------------------------------------------------
  console.log("\n🧹 Cleaning up test-registered users...");
  await prisma.doctorProfile.deleteMany({ where: { userId: newDoctor.id } });
  await prisma.user.delete({ where: { id: newDoctor.id } });
  await prisma.patientProfile.deleteMany({ where: { userId: newPatient.id } });
  await prisma.user.delete({ where: { id: newPatient.id } });
  console.log("  ✓ Temporary test accounts cleaned up.");

  console.log("\n=================================================");
  console.log("🎉 ALL AUTHENTICATION TESTS PASSED SUCCESSFULLY!");
  console.log("=================================================");
}

runAuthTests()
  .catch((e) => {
    console.error("❌ Test suite failed:", e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
