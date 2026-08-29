import { AppShell } from '@/components/ui/app-shell';
import { RoleGuard } from '@/components/ui/role-guard';

export default function PatientTrackingPage() {
  return (
    <RoleGuard role="PATIENT">
      <AppShell role="PATIENT" title="Tracking">
        <div style={{ background: '#fff', border: '1px solid #e2e8f0', borderRadius: '16px', padding: '24px' }}>
          <p>Patient order tracking dashboard.</p>
        </div>
      </AppShell>
    </RoleGuard>
  );
}
