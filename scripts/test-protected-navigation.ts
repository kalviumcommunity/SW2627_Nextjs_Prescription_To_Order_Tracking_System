import { UserRole } from "@prisma/client";
import {
  DOCTOR_NAV_ITEMS,
  PHARMACY_NAV_ITEMS,
  PATIENT_NAV_ITEMS,
  ADMIN_NAV_ITEMS,
  getNavigationForRole,
  getDefaultDashboardPath,
  isPathAllowedForRole,
} from "../lib/navigation";
import fs from "fs";
import path from "path";

console.log("===============================================================================");
console.log("🧭 MedEasy Prescription-to-Order Tracking System - Navigation & UX Verification");
console.log("===============================================================================\n");

let failures = 0;

function assert(condition: boolean, message: string) {
  if (!condition) {
    console.error(`  ❌ FAIL: ${message}`);
    failures++;
  } else {
    console.log(`  ✓ PASS: ${message}`);
  }
}

// ---------------------------------------------------------------------------
// 1. VERIFY DOCTOR NAVIGATION CONFIGURATION
// ---------------------------------------------------------------------------
console.log("-------------------------------------------------------------------------------");
console.log("1. VERIFY DOCTOR NAVIGATION CONFIGURATION");
console.log("-------------------------------------------------------------------------------");

const doctorNav = getNavigationForRole(UserRole.DOCTOR);
const expectedDoctorItems = [
  { name: "Dashboard", href: "/doctor/dashboard" },
  { name: "Prescriptions", href: "/doctor/prescriptions" },
  { name: "Patients", href: "/doctor/patients" },
  { name: "Analytics", href: "/doctor/analytics" },
  { name: "Profile", href: "/doctor/profile" },
];

assert(doctorNav.length === 5, `Doctor navigation contains 5 items (got ${doctorNav.length})`);
expectedDoctorItems.forEach((expected, i) => {
  assert(
    doctorNav[i]?.name === expected.name && doctorNav[i]?.href === expected.href,
    `Doctor nav [${i}]: ${doctorNav[i]?.name} -> ${doctorNav[i]?.href}`
  );
});
assert(getDefaultDashboardPath(UserRole.DOCTOR) === "/doctor/dashboard", "Doctor default path is /doctor/dashboard");

// ---------------------------------------------------------------------------
// 2. VERIFY PHARMACY NAVIGATION CONFIGURATION
// ---------------------------------------------------------------------------
console.log("\n-------------------------------------------------------------------------------");
console.log("2. VERIFY PHARMACY NAVIGATION CONFIGURATION");
console.log("-------------------------------------------------------------------------------");

const pharmacyNav = getNavigationForRole(UserRole.PHARMACY);
const expectedPharmacyItems = [
  { name: "Dashboard", href: "/pharmacy/dashboard" },
  { name: "Prescription Queue", href: "/pharmacy/prescriptions" },
  { name: "Filled History", href: "/pharmacy/history" },
  { name: "Analytics", href: "/pharmacy/analytics" },
  { name: "Profile", href: "/pharmacy/profile" },
];

assert(pharmacyNav.length === 5, `Pharmacy navigation contains 5 items (got ${pharmacyNav.length})`);
expectedPharmacyItems.forEach((expected, i) => {
  assert(
    pharmacyNav[i]?.name === expected.name && pharmacyNav[i]?.href === expected.href,
    `Pharmacy nav [${i}]: ${pharmacyNav[i]?.name} -> ${pharmacyNav[i]?.href}`
  );
});
assert(getDefaultDashboardPath(UserRole.PHARMACY) === "/pharmacy/dashboard", "Pharmacy default path is /pharmacy/dashboard");

// ---------------------------------------------------------------------------
// 3. VERIFY PATIENT NAVIGATION CONFIGURATION
// ---------------------------------------------------------------------------
console.log("\n-------------------------------------------------------------------------------");
console.log("3. VERIFY PATIENT NAVIGATION CONFIGURATION");
console.log("-------------------------------------------------------------------------------");

const patientNav = getNavigationForRole(UserRole.PATIENT);
const expectedPatientItems = [
  { name: "Dashboard", href: "/patient/dashboard" },
  { name: "My Prescriptions", href: "/patient/prescriptions" },
  { name: "Tracking", href: "/patient/tracking" },
  { name: "Profile", href: "/patient/profile" },
];

assert(patientNav.length === 4, `Patient navigation contains 4 items (got ${patientNav.length})`);
expectedPatientItems.forEach((expected, i) => {
  assert(
    patientNav[i]?.name === expected.name && patientNav[i]?.href === expected.href,
    `Patient nav [${i}]: ${patientNav[i]?.name} -> ${patientNav[i]?.href}`
  );
});
assert(getDefaultDashboardPath(UserRole.PATIENT) === "/patient/dashboard", "Patient default path is /patient/dashboard");

// ---------------------------------------------------------------------------
// 4. VERIFY ADMIN NAVIGATION CONFIGURATION
// ---------------------------------------------------------------------------
console.log("\n-------------------------------------------------------------------------------");
console.log("4. VERIFY ADMIN NAVIGATION CONFIGURATION");
console.log("-------------------------------------------------------------------------------");

const adminNav = getNavigationForRole(UserRole.ADMIN);
const expectedAdminItems = [
  { name: "Dashboard", href: "/admin/dashboard" },
  { name: "Doctors", href: "/admin/doctors" },
  { name: "Pharmacy", href: "/admin/pharmacy" },
  { name: "Prescriptions", href: "/admin/prescriptions" },
  { name: "Analytics", href: "/admin/analytics" },
];

assert(adminNav.length === 5, `Admin navigation contains 5 items (got ${adminNav.length})`);
expectedAdminItems.forEach((expected, i) => {
  assert(
    adminNav[i]?.name === expected.name && adminNav[i]?.href === expected.href,
    `Admin nav [${i}]: ${adminNav[i]?.name} -> ${adminNav[i]?.href}`
  );
});
assert(getDefaultDashboardPath(UserRole.ADMIN) === "/admin/dashboard", "Admin default path is /admin/dashboard");

// ---------------------------------------------------------------------------
// 5. VERIFY PATH ALLOWANCE & ROLE BOUNDARY MATRIX
// ---------------------------------------------------------------------------
console.log("\n-------------------------------------------------------------------------------");
console.log("5. VERIFY PATH ALLOWANCE & ROLE BOUNDARY MATRIX");
console.log("-------------------------------------------------------------------------------");

// Matrix tests: DOCTOR
assert(isPathAllowedForRole("/doctor/dashboard", UserRole.DOCTOR), "Doctor allowed /doctor/dashboard");
assert(isPathAllowedForRole("/doctor/prescriptions", UserRole.DOCTOR), "Doctor allowed /doctor/prescriptions");
assert(!isPathAllowedForRole("/pharmacy/queue", UserRole.DOCTOR), "Doctor denied /pharmacy/queue");
assert(!isPathAllowedForRole("/patient/prescriptions", UserRole.DOCTOR), "Doctor denied /patient/prescriptions");
assert(!isPathAllowedForRole("/admin/dashboard", UserRole.DOCTOR), "Doctor denied /admin/dashboard");

// Matrix tests: PHARMACY
assert(isPathAllowedForRole("/pharmacy/dashboard", UserRole.PHARMACY), "Pharmacy allowed /pharmacy/dashboard");
assert(isPathAllowedForRole("/pharmacy/queue", UserRole.PHARMACY), "Pharmacy allowed /pharmacy/queue");
assert(!isPathAllowedForRole("/doctor/dashboard", UserRole.PHARMACY), "Pharmacy denied /doctor/dashboard");
assert(!isPathAllowedForRole("/patient/dashboard", UserRole.PHARMACY), "Pharmacy denied /patient/dashboard");
assert(!isPathAllowedForRole("/admin/dashboard", UserRole.PHARMACY), "Pharmacy denied /admin/dashboard");

// Matrix tests: PATIENT
assert(isPathAllowedForRole("/patient/dashboard", UserRole.PATIENT), "Patient allowed /patient/dashboard");
assert(isPathAllowedForRole("/patient/prescriptions", UserRole.PATIENT), "Patient allowed /patient/prescriptions");
assert(!isPathAllowedForRole("/doctor/dashboard", UserRole.PATIENT), "Patient denied /doctor/dashboard");
assert(!isPathAllowedForRole("/pharmacy/queue", UserRole.PATIENT), "Patient denied /pharmacy/queue");
assert(!isPathAllowedForRole("/admin/dashboard", UserRole.PATIENT), "Patient denied /admin/dashboard");

// Matrix tests: ADMIN
assert(isPathAllowedForRole("/admin/dashboard", UserRole.ADMIN), "Admin allowed /admin/dashboard");
assert(isPathAllowedForRole("/admin/doctors", UserRole.ADMIN), "Admin allowed /admin/doctors");
assert(!isPathAllowedForRole("/doctor/dashboard", UserRole.ADMIN), "Admin boundary checked for /doctor/dashboard");
assert(!isPathAllowedForRole("/patient/dashboard", UserRole.ADMIN), "Admin boundary checked for /patient/dashboard");

// Unauthenticated / null role tests
assert(!isPathAllowedForRole("/doctor/dashboard", null), "Unauthenticated (null) denied /doctor/dashboard");
assert(getNavigationForRole(null).length === 0, "Unauthenticated (null) gets empty navigation items");
assert(getDefaultDashboardPath(null) === "/login", "Unauthenticated (null) default path is /login");

// ---------------------------------------------------------------------------
// 6. VERIFY ALL REQUIRED APP ROUTES EXIST ON FILESYSTEM
// ---------------------------------------------------------------------------
console.log("\n-------------------------------------------------------------------------------");
console.log("6. VERIFY ALL REQUIRED APP ROUTES EXIST ON FILESYSTEM");
console.log("-------------------------------------------------------------------------------");

const allRequiredPagePaths = [
  // Doctor
  "app/doctor/layout.tsx",
  "app/doctor/dashboard/page.tsx",
  "app/doctor/prescriptions/page.tsx",
  "app/doctor/patients/page.tsx",
  "app/doctor/analytics/page.tsx",
  "app/doctor/profile/page.tsx",
  // Pharmacy
  "app/pharmacy/layout.tsx",
  "app/pharmacy/dashboard/page.tsx",
  "app/pharmacy/queue/page.tsx",
  "app/pharmacy/history/page.tsx",
  "app/pharmacy/analytics/page.tsx",
  "app/pharmacy/profile/page.tsx",
  // Patient
  "app/patient/layout.tsx",
  "app/patient/dashboard/page.tsx",
  "app/patient/prescriptions/page.tsx",
  "app/patient/tracking/page.tsx",
  "app/patient/profile/page.tsx",
  // Admin
  "app/admin/layout.tsx",
  "app/admin/dashboard/page.tsx",
  "app/admin/doctors/page.tsx",
  "app/admin/pharmacy/page.tsx",
  "app/admin/prescriptions/page.tsx",
  "app/admin/analytics/page.tsx",
  // Components
  "components/ui/AccessDenied.tsx",
  "components/auth/RoleGuard.tsx",
  "components/layout/RoleDashboardShell.tsx",
  "components/providers/SessionProvider.tsx",
  "lib/navigation.ts",
];

const rootDir = path.resolve(__dirname, "..");

allRequiredPagePaths.forEach((relPath) => {
  const fullPath = path.join(rootDir, relPath);
  const exists = fs.existsSync(fullPath);
  assert(exists, `Verified file exists: ${relPath}`);
});

// ---------------------------------------------------------------------------
// SUMMARY
// ---------------------------------------------------------------------------
console.log("\n===============================================================================");
if (failures === 0) {
  console.log("🎉 ALL ROLE NAVIGATION AND ROUTE PROTECTION TESTS PASSED SUCCESSFULLY!");
} else {
  console.error(`💥 TEST SUITE FAILED WITH ${failures} ERRORS.`);
  process.exit(1);
}
console.log("===============================================================================\n");
