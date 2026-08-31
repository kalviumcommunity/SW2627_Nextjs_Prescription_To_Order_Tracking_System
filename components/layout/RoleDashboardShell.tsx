'use client';

import React from "react";
import { useSession, signOut } from "next-auth/react";
import { usePathname } from "next/navigation";
import { UserRole } from "@prisma/client";
import { DashboardShell } from "@/components/layout/DashboardShell";
import { getNavigationForRole } from "@/lib/navigation";

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
  const { data: session } = useSession();
  const pathname = usePathname();

  const userRole = session?.user?.role as UserRole | undefined;
  const userName = session?.user?.name ?? undefined;

  // Get role-specific nav items and append Logout action
  const navItems = [
    ...getNavigationForRole(userRole),
  ];

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
