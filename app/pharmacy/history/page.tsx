import { AppShell } from '@/components/ui/app-shell';
import { RoleGuard } from '@/components/ui/role-guard';

export default function PharmacyHistoryPage() {
  return (
    <RoleGuard role="PHARMACY">
      <AppShell role="PHARMACY" title="Filled History">
        <div style={{ background: '#fff', border: '1px solid #e2e8f0', borderRadius: '16px', padding: '24px' }}>
          <p>Pharmacy filled prescription history.</p>
        </div>
      </AppShell>
    </RoleGuard>
  );
}
