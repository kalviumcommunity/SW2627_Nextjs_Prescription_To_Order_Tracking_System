import { NextResponse } from "next/server";
import { resetPasswordWithToken } from "@/lib/password-reset-service";

export const dynamic = "force-dynamic";

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const { email, token, password } = body;

    if (!email || !token || !password) {
      return NextResponse.json(
        { error: "Email, reset token, and new password are required." },
        { status: 400 }
      );
    }

    if (typeof password !== "string" || password.length < 8) {
      return NextResponse.json(
        { error: "Password must be at least 8 characters long." },
        { status: 400 }
      );
    }

    const result = await resetPasswordWithToken(email, token, password);
    return NextResponse.json(result, { status: 200 });
  } catch (error: unknown) {
    const err = error as Error;
    console.error("Reset password error:", err.message);

    if (err.message.includes("Invalid or expired")) {
      return NextResponse.json({ error: err.message }, { status: 400 });
    }

    return NextResponse.json(
      { error: "Failed to reset password. Please try requesting a new reset link." },
      { status: 500 }
    );
  }
}
