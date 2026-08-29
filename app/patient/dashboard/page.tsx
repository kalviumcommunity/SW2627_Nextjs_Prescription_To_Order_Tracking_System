import { AppShell } from '@/components/ui/app-shell';
import { RoleGuard } from '@/components/ui/role-guard';

export default function PatientDashboardPage() {
  return (
    <RoleGuard role="PATIENT">
      <AppShell role="PATIENT" title="Patient Dashboard">
        <div style={{ background: '#fff', border: '1px solid #e2e8f0', borderRadius: '16px', padding: '24px' }}>
          <h2>Welcome, Patient</h2>
          <p>Track prescription status, review refill history, and monitor delivery progress.</p>
        </div>
      </AppShell>
    </RoleGuard>
  );
}
