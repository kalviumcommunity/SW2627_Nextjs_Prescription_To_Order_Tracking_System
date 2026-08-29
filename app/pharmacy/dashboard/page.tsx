import { AppShell } from '@/components/ui/app-shell';
import { RoleGuard } from '@/components/ui/role-guard';

export default function PharmacyDashboardPage() {
  return (
    <RoleGuard role="PHARMACY">
      <AppShell role="PHARMACY" title="Pharmacy Dashboard">
        <div style={{ background: '#fff', border: '1px solid #e2e8f0', borderRadius: '16px', padding: '24px' }}>
          <h2>Welcome, Pharmacy</h2>
          <p>Process prescription queue items and track fulfillment history across orders.</p>
        </div>
      </AppShell>
    </RoleGuard>
  );
}
