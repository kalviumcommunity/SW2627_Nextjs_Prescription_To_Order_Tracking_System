import { authOptions } from "../lib/auth";
import { registerDoctor, registerPatient, hashPassword, verifyPassword } from "../lib/auth-service";
import {
  requestPasswordReset,
  validateResetToken,
  resetPasswordWithToken,
  createPasswordResetToken,
  clearResetTokensForTesting,
  DevelopmentEmailProvider,
} from "../lib/password-reset-service";
import { prisma } from "../lib/prisma";
import { UserRole } from "@prisma/client";

async function runAuthTestSuite() {
  console.log("===============================================================================");
  console.log("🧪 MedEasy Prescription-to-Order Tracking System - Authentication Verification");
  console.log("===============================================================================\n");

  const credentialsProvider = authOptions.providers.find(
    (p: any) => p.id === "credentials" || p.name === "Credentials"
  ) as any;

  const authorizeFn = credentialsProvider?.options?.authorize || credentialsProvider?.authorize;

  if (!authorizeFn) {
    throw new Error("❌ Credentials provider authorize function not found in authOptions!");
  }

  // ---------------------------------------------------------------------------
  // 1. VALID LOGIN FOR SEEDED USERS ACROSS ROLES
  // ---------------------------------------------------------------------------
  console.log("-------------------------------------------------------------------------------");
  console.log("1. VERIFY VALID LOGIN (Seeded Accounts)");
  console.log("-------------------------------------------------------------------------------");

  const seededUsers = [
    {
      role: UserRole.ADMIN,
      email: "admin@medeasy.demo",
      password: "DemoAdminPassword123!",
      expectedRole: UserRole.ADMIN,
      expectedName: "System Administrator",
    },
    {
      role: UserRole.DOCTOR,
      email: "dr.sarah@medeasy.demo",
      password: "DemoDoctorPassword123!",
      expectedRole: UserRole.DOCTOR,
      expectedName: "Dr. Sarah",
    },
    {
      role: UserRole.PHARMACY,
      email: "pharmacy@medeasy.demo",
      password: "DemoPharmacyPassword123!",
      expectedRole: UserRole.PHARMACY,
      expectedName: "MedEasy Central Pharmacy",
    },
    {
      role: UserRole.PATIENT,
      email: "patient.alice@medeasy.demo",
      password: "DemoPatientPassword123!",
      expectedRole: UserRole.PATIENT,
      expectedName: "Alice Johnson",
    },
  ];

  for (const account of seededUsers) {
    const authResult = await authorizeFn({
      email: account.email,
      password: account.password,
    });

    if (!authResult) {
      throw new Error(`❌ Failed login for seeded ${account.role} (${account.email})`);
    }

    if (authResult.role !== account.expectedRole) {
      throw new Error(
        `❌ Role mismatch for ${account.email}: expected ${account.expectedRole}, got ${authResult.role}`
      );
    }

    if (authResult.name !== account.expectedName) {
      throw new Error(
        `❌ Name mismatch for ${account.email}: expected "${account.expectedName}", got "${authResult.name}"`
      );
    }

    if (!authResult.id || !authResult.email) {
      throw new Error(`❌ Missing identity fields in authorized user object for ${account.email}`);
    }

    // Ensure password is never included in the user object
    if ((authResult as any).password) {
      throw new Error(`❌ CRITICAL SECURITY VULNERABILITY: Password hash exposed in authorized user object for ${account.email}`);
    }

    console.log(`  ✓ Authenticated ${account.role.padEnd(8)}: "${authResult.name}" <${authResult.email}> [ID: ${authResult.id}]`);
  }

  // ---------------------------------------------------------------------------
  // 2. INVALID CREDENTIALS REJECTION (Wrong Password, Unknown User, Empty)
  // ---------------------------------------------------------------------------
  console.log("\n-------------------------------------------------------------------------------");
  console.log("2. VERIFY INVALID CREDENTIALS REJECTION");
  console.log("-------------------------------------------------------------------------------");

  // 2a. Wrong Password
  const wrongPasswordResult = await authorizeFn({
    email: "admin@medeasy.demo",
    password: "IncorrectPassword999!",
  });
  if (wrongPasswordResult !== null) {
    throw new Error("❌ Security violation: Wrong password returned a valid user object instead of null!");
  }
  console.log("  ✓ Correctly rejected invalid password for existing account (returned null)");

  // 2b. Unknown / Non-existent User
  const unknownUserResult = await authorizeFn({
    email: "unknown.user.999@medeasy.demo",
    password: "SomePassword123!",
  });
  if (unknownUserResult !== null) {
    throw new Error("❌ Security violation: Unknown user returned a valid user object instead of null!");
  }
  console.log("  ✓ Correctly rejected non-existent user account (returned null)");

  // 2c. Empty / Malformed Credentials
  const emptyCredentialsResult = await authorizeFn({
    email: "",
    password: "",
  });
  if (emptyCredentialsResult !== null) {
    throw new Error("❌ Empty credentials returned a valid user object instead of null!");
  }
  console.log("  ✓ Correctly rejected empty email and password inputs (returned null)");

  // ---------------------------------------------------------------------------
  // 3. PASSWORD STORAGE SECURITY & BCRYPT HASH INTEGRITY
  // ---------------------------------------------------------------------------
  console.log("\n-------------------------------------------------------------------------------");
  console.log("3. VERIFY PASSWORD HASHING INTEGRITY");
  console.log("-------------------------------------------------------------------------------");

  const dbAdmin = await prisma.user.findUnique({ where: { email: "admin@medeasy.demo" } });
  if (!dbAdmin) throw new Error("❌ Admin user not found in DB");

  const isBcrypt = dbAdmin.password.startsWith("$2a$") || dbAdmin.password.startsWith("$2b$");
  if (!isBcrypt) {
    throw new Error(`❌ Database contains plaintext or non-bcrypt password: ${dbAdmin.password}`);
  }
  console.log(`  ✓ Stored database password format verified: Bcrypt salt & hash (${dbAdmin.password.substring(0, 15)}...)`);

  const passwordCheck = await verifyPassword("DemoAdminPassword123!", dbAdmin.password);
  if (!passwordCheck) {
    throw new Error("❌ verifyPassword helper failed to validate matching password hash!");
  }
  console.log("  ✓ verifyPassword helper successfully verified valid password hash");

  // ---------------------------------------------------------------------------
  // 4. SESSION CREATION & TOKEN POPULATION (JWT and Session Callbacks)
  // ---------------------------------------------------------------------------
  console.log("\n-------------------------------------------------------------------------------");
  console.log("4. VERIFY SESSION CREATION & CONTENTS");
  console.log("-------------------------------------------------------------------------------");

  const jwtCallback = authOptions.callbacks?.jwt;
  const sessionCallback = authOptions.callbacks?.session;

  if (!jwtCallback || !sessionCallback) {
    throw new Error("❌ Missing JWT or Session callback in authOptions!");
  }

  const sampleUser = {
    id: "test-user-session-001",
    email: "dr.sarah@medeasy.demo",
    name: "Dr. Sarah",
    role: UserRole.DOCTOR,
  };

  // 4a. JWT Token generation
  const generatedToken = await (jwtCallback as any)({
    token: {},
    user: sampleUser,
  });

  if (
    generatedToken.id !== sampleUser.id ||
    generatedToken.role !== sampleUser.role ||
    generatedToken.email !== sampleUser.email ||
    generatedToken.name !== sampleUser.name
  ) {
    throw new Error(`❌ JWT callback did not populate expected token attributes: ${JSON.stringify(generatedToken)}`);
  }
  console.log(`  ✓ JWT Token created with identity: id=${generatedToken.id}, role=${generatedToken.role}, email=${generatedToken.email}`);

  // 4b. Session generation from token
  const generatedSession = await (sessionCallback as any)({
    session: { user: {}, expires: new Date(Date.now() + 86400000).toISOString() },
    token: generatedToken,
  });

  if (
    generatedSession.user.id !== sampleUser.id ||
    generatedSession.user.role !== sampleUser.role ||
    generatedSession.user.email !== sampleUser.email ||
    generatedSession.user.name !== sampleUser.name
  ) {
    throw new Error(`❌ Session callback did not populate user identity correctly: ${JSON.stringify(generatedSession)}`);
  }

  // Ensure session.user never contains password or internal tokens
  if ((generatedSession.user as any).password) {
    throw new Error("❌ Session user object exposed password!");
  }

  console.log(`  ✓ Session verified: { id: "${generatedSession.user.id}", role: "${generatedSession.user.role}", name: "${generatedSession.user.name}", email: "${generatedSession.user.email}" }`);

  // ---------------------------------------------------------------------------
  // 5. SESSION INVALIDATION & LOGOUT SEMANTICS
  // ---------------------------------------------------------------------------
  console.log("\n-------------------------------------------------------------------------------");
  console.log("5. VERIFY SESSION INVALIDATION (Logout Semantics)");
  console.log("-------------------------------------------------------------------------------");

  // In NextAuth JWT strategy, logout clears the session cookie or sets an expired cookie
  const emptyTokenSession = await (sessionCallback as any)({
    session: { user: {}, expires: new Date().toISOString() },
    token: null,
  });

  if (emptyTokenSession.user?.id) {
    throw new Error("❌ Inactive token still produced an authenticated session user id!");
  }
  console.log("  ✓ Invalidation verified: Cleared / missing JWT token produces empty unauthenticated session");

  // ---------------------------------------------------------------------------
  // 6. DOCTOR REGISTRATION & PROFILE CREATION
  // ---------------------------------------------------------------------------
  console.log("\n-------------------------------------------------------------------------------");
  console.log("6. VERIFY DOCTOR REGISTRATION");
  console.log("-------------------------------------------------------------------------------");

  const testDoctorEmail = `test.clinician.${Date.now()}@medeasy.demo`;
  const doctorLicense = `LIC-DOC-${Date.now()}`;

  const createdDoctor = await registerDoctor({
    email: testDoctorEmail,
    password: "ClinicianSecurePass2026!",
    specialization: "Neurology",
    licenseNumber: doctorLicense,
    phone: "+1-555-0199",
  });

  if (!createdDoctor || createdDoctor.role !== UserRole.DOCTOR) {
    throw new Error("❌ Doctor registration failed to assign UserRole.DOCTOR");
  }

  if (!createdDoctor.doctorProfile || createdDoctor.doctorProfile.specialization !== "Neurology") {
    throw new Error("❌ Doctor registration failed to create DoctorProfile relation");
  }

  if ((createdDoctor as any).password) {
    throw new Error("❌ Doctor registration response exposed hashed password!");
  }

  console.log(`  ✓ Successfully registered DOCTOR: <${createdDoctor.email}>`);
  console.log(`    - DoctorProfile: Specialization="${createdDoctor.doctorProfile.specialization}", License="${createdDoctor.doctorProfile.licenseNumber}", Phone="${createdDoctor.doctorProfile.phone}"`);

  // Verify login works for new doctor
  const doctorLogin = await authorizeFn({
    email: testDoctorEmail,
    password: "ClinicianSecurePass2026!",
  });
  if (!doctorLogin || doctorLogin.role !== UserRole.DOCTOR) {
    throw new Error("❌ Login failed for newly registered doctor account");
  }
  console.log(`  ✓ Login succeeded for newly registered doctor: "${doctorLogin.name}"`);

  // ---------------------------------------------------------------------------
  // 7. PATIENT REGISTRATION & PROFILE CREATION
  // ---------------------------------------------------------------------------
  console.log("\n-------------------------------------------------------------------------------");
  console.log("7. VERIFY PATIENT REGISTRATION");
  console.log("-------------------------------------------------------------------------------");

  const testPatientEmail = `test.patient.${Date.now()}@medeasy.demo`;

  const createdPatient = await registerPatient({
    email: testPatientEmail,
    password: "PatientSecurePass2026!",
    name: "Eleanor Vance",
    age: 34,
    gender: "Female",
    contactInfo: "+1-555-0144, 42 MedWay Blvd",
  });

  if (!createdPatient || createdPatient.role !== UserRole.PATIENT) {
    throw new Error("❌ Patient registration failed to assign UserRole.PATIENT");
  }

  if (!createdPatient.patientProfile || createdPatient.patientProfile.name !== "Eleanor Vance") {
    throw new Error("❌ Patient registration failed to create PatientProfile relation");
  }

  if ((createdPatient as any).password) {
    throw new Error("❌ Patient registration response exposed hashed password!");
  }

  console.log(`  ✓ Successfully registered PATIENT: <${createdPatient.email}>`);
  console.log(`    - PatientProfile: Name="${createdPatient.patientProfile.name}", Age=${createdPatient.patientProfile.age}, Gender="${createdPatient.patientProfile.gender}", Contact="${createdPatient.patientProfile.contactInfo}"`);

  // Verify login works for new patient
  const patientLogin = await authorizeFn({
    email: testPatientEmail,
    password: "PatientSecurePass2026!",
  });
  if (!patientLogin || patientLogin.role !== UserRole.PATIENT || patientLogin.name !== "Eleanor Vance") {
    throw new Error("❌ Login failed for newly registered patient account");
  }
  console.log(`  ✓ Login succeeded for newly registered patient: "${patientLogin.name}"`);

  // ---------------------------------------------------------------------------
  // 8. REGISTRATION API ROUTE & SECURITY RESTRICTIONS
  // ---------------------------------------------------------------------------
  console.log("\n-------------------------------------------------------------------------------");
  console.log("8. VERIFY REGISTRATION API VALIDATIONS & RESTRICTIONS");
  console.log("-------------------------------------------------------------------------------");

  const { POST: apiRegisterHandler } = await import("../app/api/auth/register/route");

  // 8a. Prohibit Admin direct self-registration via API
  const adminForbiddenReq = new Request("http://localhost:3000/api/auth/register", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      email: "rogue.admin@medeasy.demo",
      password: "AdminPassword123!",
      role: UserRole.ADMIN,
    }),
  });
  const adminForbiddenRes = await apiRegisterHandler(adminForbiddenReq);
  if (adminForbiddenRes.status !== 403) {
    throw new Error(`❌ Expected status 403 for Admin direct registration, got ${adminForbiddenRes.status}`);
  }
  console.log("  ✓ Admin direct registration blocked with HTTP 403 Forbidden");

  // 8b. Prohibit Pharmacy direct self-registration via API
  const pharmacyForbiddenReq = new Request("http://localhost:3000/api/auth/register", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      email: "rogue.pharmacy@medeasy.demo",
      password: "PharmacyPassword123!",
      role: UserRole.PHARMACY,
    }),
  });
  const pharmacyForbiddenRes = await apiRegisterHandler(pharmacyForbiddenReq);
  if (pharmacyForbiddenRes.status !== 403) {
    throw new Error(`❌ Expected status 403 for Pharmacy direct registration, got ${pharmacyForbiddenRes.status}`);
  }
  console.log("  ✓ Pharmacy direct registration blocked with HTTP 403 Forbidden");

  // 8c. Reject password shorter than 8 characters
  const shortPassReq = new Request("http://localhost:3000/api/auth/register", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      email: "shortpass.user@medeasy.demo",
      password: "123",
      role: UserRole.PATIENT,
      name: "Short Pass",
      age: 25,
      gender: "Other",
      contactInfo: "+1-555-0000",
    }),
  });
  const shortPassRes = await apiRegisterHandler(shortPassReq);
  if (shortPassRes.status !== 400) {
    throw new Error(`❌ Expected status 400 for short password, got ${shortPassRes.status}`);
  }
  console.log("  ✓ Weak password (< 8 chars) rejected with HTTP 400 Bad Request");

  // 8d. Reject duplicate email
  const duplicateEmailReq = new Request("http://localhost:3000/api/auth/register", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      email: testPatientEmail,
      password: "AnotherPassword123!",
      role: UserRole.PATIENT,
      name: "Duplicate Patient",
      age: 30,
      gender: "Male",
      contactInfo: "+1-555-1111",
    }),
  });
  const duplicateEmailRes = await apiRegisterHandler(duplicateEmailReq);
  if (duplicateEmailRes.status !== 409) {
    throw new Error(`❌ Expected status 409 Conflict for duplicate email, got ${duplicateEmailRes.status}`);
  }
  console.log("  ✓ Duplicate email registration rejected with HTTP 409 Conflict");

  // ---------------------------------------------------------------------------
  // 9. FORGOT & RESET PASSWORD FLOW ARCHITECTURE & VALIDATION
  // ---------------------------------------------------------------------------
  console.log("\n-------------------------------------------------------------------------------");
  console.log("9. VERIFY FORGOT & RESET PASSWORD ARCHITECTURE");
  console.log("-------------------------------------------------------------------------------");

  // 9a. Request reset token for existing user via test email provider
  const resetEmail = testPatientEmail;
  class TestCaptureEmailProvider {
    lastToken = "";
    async sendPasswordResetEmail(_email: string, resetToken: string): Promise<void> {
      this.lastToken = resetToken;
    }
  }

  const testEmailProvider = new TestCaptureEmailProvider();
  const resetReqResult = await requestPasswordReset(resetEmail, testEmailProvider);
  if (!resetReqResult.success || !testEmailProvider.lastToken) {
    throw new Error("❌ requestPasswordReset failed to deliver reset token to provider");
  }
  const resetToken = testEmailProvider.lastToken;
  console.log(`  ✓ Password reset requested safely: anti-enumeration message returned`);

  // 9b. Anti-enumeration verification: requesting for non-existent user returns same message
  const nonExistentReset = await requestPasswordReset("nonexistent.person.999@medeasy.demo");
  if (!nonExistentReset.success || nonExistentReset.message !== resetReqResult.message) {
    throw new Error("❌ Password reset request leaked information about non-existent user!");
  }
  console.log("  ✓ Anti-enumeration verified: identical response returned for non-existent email");

  // 9c. Validate token
  const isTokenValid = await validateResetToken(resetEmail, resetToken);
  if (!isTokenValid) {
    throw new Error("❌ validateResetToken returned false for a valid token!");
  }
  console.log("  ✓ Valid reset token successfully verified");

  // 9d. Rejection of invalid token
  const isInvalidTokenValid = await validateResetToken(resetEmail, "invalid-dummy-token-12345");
  if (isInvalidTokenValid) {
    throw new Error("❌ validateResetToken accepted an invalid token!");
  }
  console.log("  ✓ Invalid reset token correctly rejected");

  // 9e. Reset password using valid token
  const newPatientPassword = "BrandNewPassword2026!";
  const resetResult = await resetPasswordWithToken(resetEmail, resetToken, newPatientPassword);
  if (!resetResult.success) {
    throw new Error("❌ resetPasswordWithToken failed to update password");
  }
  console.log("  ✓ Password successfully reset with valid token");

  // 9f. Verify token cannot be reused (Single-Use / Replay Attack Prevention)
  const tokenReplayAttempt = await validateResetToken(resetEmail, resetToken);
  if (tokenReplayAttempt) {
    throw new Error("❌ CRITICAL: Reset token was not invalidated after single use!");
  }
  console.log("  ✓ Single-use token invalidation verified (replay attempt rejected)");

  // 9g. Verify user can log in with new password
  const postResetLogin = await authorizeFn({
    email: resetEmail,
    password: newPatientPassword,
  });
  if (!postResetLogin) {
    throw new Error("❌ Login failed using new updated password after reset");
  }
  console.log(`  ✓ Successfully logged in with newly reset password for ${resetEmail}`);

  // 9h. Verify old password no longer works
  const oldPasswordLogin = await authorizeFn({
    email: resetEmail,
    password: "PatientSecurePass2026!",
  });
  if (oldPasswordLogin !== null) {
    throw new Error("❌ Old password still authenticated after password reset!");
  }
  console.log("  ✓ Old password correctly rejected after reset");

  // ---------------------------------------------------------------------------
  // 10. CLEANUP TEMPORARY TEST RECORDS
  // ---------------------------------------------------------------------------
  console.log("\n-------------------------------------------------------------------------------");
  console.log("10. CLEANUP TEMPORARY TEST DATA");
  console.log("-------------------------------------------------------------------------------");

  await prisma.doctorProfile.deleteMany({ where: { userId: createdDoctor.id } });
  await prisma.user.delete({ where: { id: createdDoctor.id } });

  await prisma.patientProfile.deleteMany({ where: { userId: createdPatient.id } });
  await prisma.user.delete({ where: { id: createdPatient.id } });

  clearResetTokensForTesting();
  console.log("  ✓ Temporary test accounts and token stores cleanly deleted.");

  console.log("\n===============================================================================");
  console.log("🎉 ALL AUTHENTICATION INTEGRATION TESTS COMPLETED & VERIFIED SUCCESSFULLY!");
  console.log("===============================================================================");
}

runAuthTestSuite()
  .catch((err) => {
    console.error("\n❌ Test Suite Failed with Error:\n", err);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
