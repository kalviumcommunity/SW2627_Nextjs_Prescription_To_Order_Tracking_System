export type UserRole = 'DOCTOR' | 'PHARMACY' | 'PATIENT' | 'ADMIN';

export type NavItem = {
  label: string;
  href: string;
  description?: string;
};

export const ROLE_LABELS: Record<UserRole, string> = {
  DOCTOR: 'Doctor',
  PHARMACY: 'Pharmacy',
  PATIENT: 'Patient',
  ADMIN: 'Admin',
};

export const DASHBOARD_BY_ROLE: Record<UserRole, string> = {
  DOCTOR: '/doctor/dashboard',
  PHARMACY: '/pharmacy/dashboard',
  PATIENT: '/patient/dashboard',
  ADMIN: '/admin/dashboard',
};

export const ROLE_NAV_ITEMS: Record<UserRole, NavItem[]> = {
  DOCTOR: [
    { label: 'Dashboard', href: '/doctor/dashboard' },
    { label: 'Prescriptions', href: '/doctor/prescriptions' },
    { label: 'Patients', href: '/doctor/patients' },
    { label: 'Analytics', href: '/doctor/analytics' },
    { label: 'Profile', href: '/doctor/profile' },
    { label: 'Logout', href: '/logout' },
  ],
  PHARMACY: [
    { label: 'Dashboard', href: '/pharmacy/dashboard' },
    { label: 'Prescription Queue', href: '/pharmacy/queue' },
    { label: 'Filled History', href: '/pharmacy/history' },
    { label: 'Analytics', href: '/pharmacy/analytics' },
    { label: 'Profile', href: '/pharmacy/profile' },
    { label: 'Logout', href: '/logout' },
  ],
  PATIENT: [
    { label: 'Dashboard', href: '/patient/dashboard' },
    { label: 'My Prescriptions', href: '/patient/prescriptions' },
    { label: 'Tracking', href: '/patient/tracking' },
    { label: 'Profile', href: '/patient/profile' },
    { label: 'Logout', href: '/logout' },
  ],
  ADMIN: [
    { label: 'Dashboard', href: '/admin/dashboard' },
    { label: 'Doctors', href: '/admin/doctors' },
    { label: 'Pharmacy', href: '/admin/pharmacies' },
    { label: 'Prescriptions', href: '/admin/prescriptions' },
    { label: 'Analytics', href: '/admin/analytics' },
    { label: 'Logout', href: '/logout' },
  ],
};

export const ROLE_PATH_TOKENS: Record<UserRole, string> = {
  DOCTOR: '/doctor',
  PHARMACY: '/pharmacy',
  PATIENT: '/patient',
  ADMIN: '/admin',
};
