import { AppShell } from '@/components/ui/app-shell';
import { RoleGuard } from '@/components/ui/role-guard';

export default function DoctorPrescriptionsPage() {
  return (
    <RoleGuard role="DOCTOR">
      <AppShell role="DOCTOR" title="Prescriptions">
        <div style={{ background: '#fff', border: '1px solid #e2e8f0', borderRadius: '16px', padding: '24px' }}>
          <p>Doctor prescriptions overview.</p>
        </div>
      </AppShell>
    </RoleGuard>
  );
}
