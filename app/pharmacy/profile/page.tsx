import { AppShell } from '@/components/ui/app-shell';
import { RoleGuard } from '@/components/ui/role-guard';

export default function PharmacyProfilePage() {
  return (
    <RoleGuard role="PHARMACY">
      <AppShell role="PHARMACY" title="Profile">
        <div style={{ background: '#fff', border: '1px solid #e2e8f0', borderRadius: '16px', padding: '24px' }}>
          <p>Pharmacy profile settings.</p>
        </div>
      </AppShell>
    </RoleGuard>
  );
}
