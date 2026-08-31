'use client';

import React from "react";
import { useSession } from "next-auth/react";
import { useRouter } from "next/navigation";
import { UserRole } from "@prisma/client";
import { AccessDenied } from "@/components/ui/AccessDenied";
import { Spinner } from "@/components/ui/Spinner";

export interface RoleGuardProps {
  /** Roles allowed to view the wrapped content. */
  allowedRoles: UserRole[];
  children: React.ReactNode;
}

/**
 * Client-side route protection component.
 *
 * - Loading → shows spinner
 * - Unauthenticated → redirects to /login
 * - Wrong role → shows AccessDenied
 * - Correct role → renders children
 *
 * NOTE: This is a UX convenience layer, NOT a security boundary.
 * Server-side authorization (lib/permissions.ts) is the actual protection.
 */
export function RoleGuard({ allowedRoles, children }: RoleGuardProps) {
  const { data: session, status } = useSession();
  const router = useRouter();

  // Still loading the session
  if (status === "loading") {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="text-center">
          <Spinner />
          <p className="mt-3 text-sm text-gray-500">Verifying access…</p>
        </div>
      </div>
    );
  }

  // Not authenticated → redirect to login
  if (status === "unauthenticated" || !session?.user) {
    router.replace("/login");
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="text-center">
          <Spinner />
          <p className="mt-3 text-sm text-gray-500">Redirecting to sign in…</p>
        </div>
      </div>
    );
  }

  // Authenticated but wrong role
  const userRole = session.user.role as UserRole;
  if (!allowedRoles.includes(userRole)) {
    return <AccessDenied />;
  }

  // Authorized → render children
  return <>{children}</>;
}
