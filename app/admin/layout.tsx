'use client';

import { UserRole } from "@prisma/client";
import { RoleGuard } from "@/components/auth/RoleGuard";
import { RoleDashboardShell } from "@/components/layout/RoleDashboardShell";

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  return (
    <RoleGuard allowedRoles={[UserRole.ADMIN]}>
      <RoleDashboardShell>{children}</RoleDashboardShell>
    </RoleGuard>
  );
}
