'use client';

import { usePathname, useRouter } from 'next/navigation';
import { useEffect } from 'react';
import { getDashboardPath, isRoleAllowedForPath, mockSessionUser } from '@/lib/auth-session';
import { ROLE_LABELS, type UserRole } from '@/types/user-role';
import { AccessDenied } from '@/components/ui/access-denied';

export function RoleGuard({
  children,
  role = mockSessionUser.role,
}: {
  children: React.ReactNode;
  role?: UserRole;
}) {
  const pathname = usePathname();
  const router = useRouter();

  useEffect(() => {
    if (!pathname) return;

    if (!isRoleAllowedForPath(role, pathname)) {
      const dashboard = getDashboardPath(role);
      if (pathname !== dashboard) {
        router.replace(dashboard);
      }
    }
  }, [pathname, role, router]);

  if (!pathname || !isRoleAllowedForPath(role, pathname)) {
    const dashboard = getDashboardPath(role);
    const attemptedPath = pathname ?? '/unknown';

    return (
      <div style={{ padding: '32px' }}>
        <AccessDenied roleLabel={ROLE_LABELS[role]} dashboardHref={dashboard} attemptedPath={attemptedPath} />
      </div>
    );
  }

  return <>{children}</>;
}
