import { NextResponse } from "next/server";
import { requestPasswordReset } from "@/lib/password-reset-service";

export const dynamic = "force-dynamic";

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const { email } = body;

    if (!email || typeof email !== "string") {
      return NextResponse.json(
        { error: "A valid email address is required." },
        { status: 400 }
      );
    }

    const result = await requestPasswordReset(email);
    return NextResponse.json(result, { status: 200 });
  } catch (error: unknown) {
    const err = error as Error;
    console.error("Forgot password request error:", err.message);
    return NextResponse.json(
      { error: "An error occurred while processing your password reset request." },
      { status: 500 }
    );
  }
}
