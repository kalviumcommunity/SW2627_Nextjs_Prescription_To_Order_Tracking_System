'use client';

import React from "react";
import { useSession, signOut } from "next-auth/react";
import { usePathname } from "next/navigation";
import { UserRole } from "@prisma/client";
import { DashboardShell } from "@/components/layout/DashboardShell";
import { getNavigationForRole } from "@/lib/navigation";
import { LoadingState } from "@/components/ui/LoadingState";

export interface RoleDashboardShellProps {
  children: React.ReactNode;
}

/**
 * Connects the generic DashboardShell to the authenticated user's
 * role-based navigation, active path detection, and NextAuth logout.
 *
 * The Logout action is appended dynamically to every role's sidebar.
 */
export function RoleDashboardShell({ children }: RoleDashboardShellProps) {
  const { data: session, status } = useSession();
  const pathname = usePathname();

  if (status === "loading") {
    return <LoadingState message="Verifying your access..." className="min-h-screen" />;
  }

  const userRole = session?.user?.role as UserRole | undefined;
  const userName = session?.user?.name ?? undefined;

  // Get role-specific nav items and append Logout action
  const navItems = [
    ...getNavigationForRole(userRole),
  ];

  if (!userRole || navItems.length === 0) {
    return <LoadingState message="Redirecting to sign in..." className="min-h-screen" />;
  }

  const handleLogout = () => {
    signOut({ callbackUrl: "/login" });
  };

  return (
    <DashboardShell
      sidebarItems={navItems}
      activePath={pathname}
      headerProps={{
        title: "MedEasy",
        userName: userName,
        onLogout: handleLogout,
      }}
    >
      {children}
    </DashboardShell>
  );
}
