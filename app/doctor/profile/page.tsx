import { AppShell } from '@/components/ui/app-shell';
import { RoleGuard } from '@/components/ui/role-guard';

export default function DoctorProfilePage() {
  return (
    <RoleGuard role="DOCTOR">
      <AppShell role="DOCTOR" title="Profile">
        <div style={{ background: '#fff', border: '1px solid #e2e8f0', borderRadius: '16px', padding: '24px' }}>
          <p>Doctor profile settings.</p>
        </div>
      </AppShell>
    </RoleGuard>
  );
}
