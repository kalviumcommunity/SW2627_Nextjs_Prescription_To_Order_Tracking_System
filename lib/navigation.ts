import { UserRole } from "@prisma/client";
import { SidebarItem } from "@/components/layout/Sidebar";

export interface RoleNavigationConfig {
  role: UserRole;
  defaultPath: string;
  items: SidebarItem[];
}

export const DOCTOR_NAV_ITEMS: SidebarItem[] = [
  { name: "Dashboard", href: "/doctor/dashboard" },
  { name: "Prescriptions", href: "/doctor/prescriptions" },
  { name: "Patients", href: "/doctor/patients" },
  { name: "Analytics", href: "/doctor/analytics" },
  { name: "Profile", href: "/doctor/profile" },
];

export const PHARMACY_NAV_ITEMS: SidebarItem[] = [
  { name: "Dashboard", href: "/pharmacy/dashboard" },
  { name: "Prescription Queue", href: "/pharmacy/queue" },
  { name: "Filled History", href: "/pharmacy/history" },
  { name: "Analytics", href: "/pharmacy/analytics" },
  { name: "Profile", href: "/pharmacy/profile" },
];

export const PATIENT_NAV_ITEMS: SidebarItem[] = [
  { name: "Dashboard", href: "/patient/dashboard" },
  { name: "My Prescriptions", href: "/patient/prescriptions" },
  { name: "Tracking", href: "/patient/tracking" },
  { name: "Profile", href: "/patient/profile" },
];

export const ADMIN_NAV_ITEMS: SidebarItem[] = [
  { name: "Dashboard", href: "/admin/dashboard" },
  { name: "Doctors", href: "/admin/doctors" },
  { name: "Pharmacy", href: "/admin/pharmacy" },
  { name: "Prescriptions", href: "/admin/prescriptions" },
  { name: "Analytics", href: "/admin/analytics" },
];

export const ROLE_NAVIGATION: Record<UserRole, RoleNavigationConfig> = {
  [UserRole.DOCTOR]: {
    role: UserRole.DOCTOR,
    defaultPath: "/doctor/dashboard",
    items: DOCTOR_NAV_ITEMS,
  },
  [UserRole.PHARMACY]: {
    role: UserRole.PHARMACY,
    defaultPath: "/pharmacy/dashboard",
    items: PHARMACY_NAV_ITEMS,
  },
  [UserRole.PATIENT]: {
    role: UserRole.PATIENT,
    defaultPath: "/patient/dashboard",
    items: PATIENT_NAV_ITEMS,
  },
  [UserRole.ADMIN]: {
    role: UserRole.ADMIN,
    defaultPath: "/admin/dashboard",
    items: ADMIN_NAV_ITEMS,
  },
};

/**
 * Returns the sidebar navigation items configured for a specific user role.
 */
export function getNavigationForRole(role?: UserRole | null): SidebarItem[] {
  if (!role || !ROLE_NAVIGATION[role]) {
    return [];
  }
  return ROLE_NAVIGATION[role].items;
}

/**
 * Resolves the primary dashboard landing page for a given role.
 */
export function getDefaultDashboardPath(role?: UserRole | null): string {
  if (!role || !ROLE_NAVIGATION[role]) {
    return "/login";
  }
  return ROLE_NAVIGATION[role].defaultPath;
}

/**
 * Helper to determine if a given pathname belongs to a role's authorized section.
 */
export function isPathAllowedForRole(pathname: string, role?: UserRole | null): boolean {
  if (!role) return false;

  // Root role section prefix matching
  const rolePrefixes: Record<UserRole, string> = {
    [UserRole.DOCTOR]: "/doctor",
    [UserRole.PHARMACY]: "/pharmacy",
    [UserRole.PATIENT]: "/patient",
    [UserRole.ADMIN]: "/admin",
  };

  const prefix = rolePrefixes[role];
  if (!prefix) return false;

  return pathname.startsWith(prefix);
}
