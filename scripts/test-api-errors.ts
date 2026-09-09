import assert from "node:assert/strict";
import { Prisma } from "@prisma/client";
import {
  apiError,
  apiSuccess,
  ApplicationError,
  errorFromResult,
} from "../lib/api-errors";

async function readJson(response: Response) {
  return (await response.json()) as Record<string, unknown>;
}

async function runApiErrorTests() {
  const cases = [
    ["UNAUTHENTICATED", 401],
    ["FORBIDDEN", 403],
    ["VALIDATION_ERROR", 400],
    ["NOT_FOUND", 404],
    ["CONFLICT", 409],
    ["BUSINESS_RULE_ERROR", 422],
    ["INTERNAL_SERVER_ERROR", 500],
  ] as const;

  for (const [code, status] of cases) {
    const response = apiError(new ApplicationError(code, "test message"));
    const body = await readJson(response);
    assert.equal(response.status, status);
    assert.deepEqual(body.error, { code, message: "test message" });
  }

  const conflict = apiError(
    new Prisma.PrismaClientKnownRequestError("database details", {
      code: "P2002",
      clientVersion: "test",
    })
  );
  const conflictBody = await readJson(conflict);
  assert.equal(conflict.status, 409);
  assert.deepEqual(conflictBody.error, {
    code: "CONFLICT",
    message: "The requested resource already exists.",
  });
  assert.equal(JSON.stringify(conflictBody).includes("database details"), false);

  const mapped = apiError(errorFromResult({ error: "Missing record.", statusCode: 404 }));
  const mappedBody = await readJson(mapped);
  assert.deepEqual(mappedBody.error, {
    code: "NOT_FOUND",
    message: "Missing record.",
  });

  const success = apiSuccess({ ok: true });
  assert.equal(success.status, 200);
  assert.deepEqual(await readJson(success), { ok: true });

  console.log("All centralized API error and response helper tests passed.");
}

runApiErrorTests().catch((error) => {
  console.error(error);
  process.exit(1);
});
