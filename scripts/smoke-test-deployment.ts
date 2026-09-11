import assert from "node:assert";

interface SmokeCheckResult {
  name: string;
  url: string;
  status: "PASS" | "FAIL";
  httpStatus?: number;
  error?: string;
  details?: string;
}

const results: SmokeCheckResult[] = [];

function recordPass(name: string, url: string, httpStatus: number, details?: string) {
  results.push({ name, url, status: "PASS", httpStatus, details });
  console.log(`  ✓ PASS: ${name} (HTTP ${httpStatus})${details ? ` — ${details}` : ""}`);
}

function recordFail(name: string, url: string, error: string, httpStatus?: number) {
  results.push({ name, url, status: "FAIL", httpStatus, error });
  console.error(`  ❌ FAIL: ${name}${httpStatus ? ` (HTTP ${httpStatus})` : ""}: ${error}`);
}

function assertNoSecretsLeaked(text: string, label: string) {
  const lower = text.toLowerCase();
  assert(!lower.includes("begin private key"), `${label} must NOT leak private keys`);
  assert(!lower.includes("postgres:postgres@"), `${label} must NOT leak raw postgres credentials`);
  assert(!lower.includes("your-development-secret-key"), `${label} must NOT leak dev secret keys`);
  assert(!/\$2[aby]\$\d{2}\$[./A-Za-z0-9]{53}/.test(text), `${label} must NOT leak bcrypt password hashes`);
}

async function runDeploymentSmokeTest() {
  const baseUrl = (process.argv[2] || process.env.BASE_URL || "http://localhost:3000").replace(/\/$/, "");

  console.log("===============================================================================");
  console.log("🚀 MedEasy Day 19 — Production Deployment Smoke & Health Verification");
  console.log(`🎯 Target URL: ${baseUrl}`);
  console.log("===============================================================================\n");

  // ---------------------------------------------------------------------------
  // 1. PUBLIC WEB ROUTES
  // ---------------------------------------------------------------------------
  console.log("-------------------------------------------------------------------------------");
  console.log("1. VERIFYING PUBLIC WEB PAGES & ROUTING");
  console.log("-------------------------------------------------------------------------------");

  const publicRoutes = [
    { name: "Landing / Root (Redirect to Login)", path: "/", expectedStatuses: [200, 307] },
    { name: "Sign-In Page", path: "/login", expectedStatuses: [200] },
    { name: "Patient Registration Page", path: "/register/patient", expectedStatuses: [200] },
    { name: "Doctor Registration Page", path: "/register/doctor", expectedStatuses: [200] },
    { name: "Password Recovery Page", path: "/forgot-password", expectedStatuses: [200] },
  ];

  for (const route of publicRoutes) {
    const targetUrl = `${baseUrl}${route.path}`;
    try {
      const res = await fetch(targetUrl, { redirect: "follow" });
      const html = await res.text();

      if (route.expectedStatuses.includes(res.status) || res.ok) {
        assertNoSecretsLeaked(html, route.name);
        recordPass(route.name, targetUrl, res.status);
      } else {
        recordFail(route.name, targetUrl, `Unexpected status code`, res.status);
      }
    } catch (err: unknown) {
      recordFail(route.name, targetUrl, err instanceof Error ? err.message : String(err));
    }
  }

  // ---------------------------------------------------------------------------
  // 2. PRODUCTION DATABASE CONNECTIVITY
  // ---------------------------------------------------------------------------
  console.log("\n-------------------------------------------------------------------------------");
  console.log("2. VERIFYING DATABASE CONNECTIVITY & PRISMA RUNTIME");
  console.log("-------------------------------------------------------------------------------");

  const dbHealthUrl = `${baseUrl}/api/health/db`;
  try {
    const res = await fetch(dbHealthUrl, { cache: "no-store" });
    const data = await res.json().catch(() => ({}));
    const rawText = JSON.stringify(data);

    assertNoSecretsLeaked(rawText, "Database Health Endpoint");

    if (res.status === 200 && data.status === "ok" && data.database === "connected") {
      recordPass("Database Health Endpoint", dbHealthUrl, res.status, "Connected & Operational");
    } else {
      recordFail(
        "Database Health Endpoint",
        dbHealthUrl,
        `Expected { status: 'ok', database: 'connected' }, received: ${rawText}`,
        res.status
      );
    }
  } catch (err: unknown) {
    recordFail("Database Health Endpoint", dbHealthUrl, err instanceof Error ? err.message : String(err));
  }

  // ---------------------------------------------------------------------------
  // 3. RBAC & UNAUTHENTICATED PROTECTION (401 GUARDS)
  // ---------------------------------------------------------------------------
  console.log("\n-------------------------------------------------------------------------------");
  console.log("3. VERIFYING UNPROTECTED INVOCATION GUARDS (RBAC / 401 ENFORCEMENT)");
  console.log("-------------------------------------------------------------------------------");

  const protectedEndpoints = [
    { name: "Admin Dashboard API", path: "/api/admin/dashboard" },
    { name: "Admin Prescriptions API", path: "/api/admin/prescriptions" },
    { name: "Doctor Prescriptions API", path: "/api/doctor/prescriptions" },
    { name: "Doctor Patients Roster API", path: "/api/doctor/patients" },
    { name: "Pharmacy Queue API", path: "/api/pharmacy/queue" },
    { name: "Patient Prescriptions API", path: "/api/patient/prescriptions" },
  ];

  for (const ep of protectedEndpoints) {
    const targetUrl = `${baseUrl}${ep.path}`;
    try {
      const res = await fetch(targetUrl, { cache: "no-store" });
      const body = await res.text();
      assertNoSecretsLeaked(body, ep.name);

      if (res.status === 401) {
        recordPass(ep.name, targetUrl, res.status, "Correctly rejected unauthenticated request");
      } else {
        recordFail(ep.name, targetUrl, `Expected HTTP 401, but received ${res.status}`, res.status);
      }
    } catch (err: unknown) {
      recordFail(ep.name, targetUrl, err instanceof Error ? err.message : String(err));
    }
  }

  // ---------------------------------------------------------------------------
  // 4. SUMMARY
  // ---------------------------------------------------------------------------
  console.log("\n===============================================================================");
  const total = results.length;
  const passed = results.filter((r) => r.status === "PASS").length;
  const failed = results.filter((r) => r.status === "FAIL").length;

  console.log(`📊 Smoke Test Summary: ${passed}/${total} checks PASSED (${failed} failed)`);
  console.log("===============================================================================");

  if (failed > 0) {
    console.error("❌ Production deployment smoke test failed.");
    process.exit(1);
  } else {
    console.log("🎉 ALL PRODUCTION SMOKE CHECKS PASSED SUCCESSFULLY!");
  }
}

runDeploymentSmokeTest().catch((err) => {
  console.error("Fatal error during smoke test:", err);
  process.exit(1);
});
