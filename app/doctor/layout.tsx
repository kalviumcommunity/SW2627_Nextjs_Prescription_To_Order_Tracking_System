'use client';

import { UserRole } from "@prisma/client";
import { RoleGuard } from "@/components/auth/RoleGuard";
import { RoleDashboardShell } from "@/components/layout/RoleDashboardShell";

export default function DoctorLayout({ children }: { children: React.ReactNode }) {
  return (
    <RoleGuard allowedRoles={[UserRole.DOCTOR]}>
      <RoleDashboardShell>{children}</RoleDashboardShell>
    </RoleGuard>
  );
}
