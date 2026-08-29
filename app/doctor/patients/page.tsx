import { AppShell } from '@/components/ui/app-shell';
import { RoleGuard } from '@/components/ui/role-guard';

export default function DoctorPatientsPage() {
  return (
    <RoleGuard role="DOCTOR">
      <AppShell role="DOCTOR" title="Patients">
        <div style={{ background: '#fff', border: '1px solid #e2e8f0', borderRadius: '16px', padding: '24px' }}>
          <p>Doctor patient list.</p>
        </div>
      </AppShell>
    </RoleGuard>
  );
}
