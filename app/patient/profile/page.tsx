import { AppShell } from '@/components/ui/app-shell';
import { RoleGuard } from '@/components/ui/role-guard';

export default function PatientProfilePage() {
  return (
    <RoleGuard role="PATIENT">
      <AppShell role="PATIENT" title="Profile">
        <div style={{ background: '#fff', border: '1px solid #e2e8f0', borderRadius: '16px', padding: '24px' }}>
          <p>Patient profile settings.</p>
        </div>
      </AppShell>
    </RoleGuard>
  );
}
