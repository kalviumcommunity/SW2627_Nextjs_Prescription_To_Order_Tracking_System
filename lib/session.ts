import { getServerSession } from "next-auth/next";
import { authOptions } from "@/lib/auth";

/**
 * Retrieves the current authenticated session on the server.
 */
export async function getAuthSession() {
  try {
    return await getServerSession(authOptions);
  } catch {
    return null;
  }
}

/**
 * Convenience helper to retrieve the authenticated user from the server session.
 */
export async function getCurrentUser() {
  const session = await getAuthSession();
  return session?.user;
}
