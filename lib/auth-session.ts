import { DASHBOARD_BY_ROLE, ROLE_PATH_TOKENS, ROLE_NAV_ITEMS, type UserRole } from '@/types/user-role';

export type AuthUser = {
  id: string;
  email: string;
  name?: string;
  role: UserRole;
};

export const mockSessionUser: AuthUser = {
  id: 'demo-user',
  email: 'demo@medeasy.local',
  name: 'MedEasy User',
  role: 'DOCTOR',
};

export function getAllowedNavItems(role: UserRole) {
  return ROLE_NAV_ITEMS[role] ?? [];
}

export function getDashboardPath(role: UserRole) {
  return DASHBOARD_BY_ROLE[role] ?? '/';
}

export function isRoleAllowedForPath(role: UserRole, path: string) {
  const normalized = path.startsWith('/') ? path : `/${path}`;
  const allowedPrefix = ROLE_PATH_TOKENS[role];

  if (normalized === allowedPrefix || normalized.startsWith(`${allowedPrefix}/`)) {
    return true;
  }

  if (normalized === '/logout') {
    return true;
  }

  return false;
}

export function getRoleMismatchMessage(role: UserRole) {
  return `This page is not available for ${ROLE_PATH_TOKENS[role].replace('/', '').toUpperCase()}.`;
}
