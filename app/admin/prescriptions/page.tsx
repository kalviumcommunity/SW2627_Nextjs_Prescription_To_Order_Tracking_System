import { EmptyState } from '@/components/ui/EmptyState';

export default function AdminPrescriptionsPage() {
  return (
    <div>
      <h2 className="text-2xl font-bold text-gray-900 mb-2">Prescriptions</h2>
      <EmptyState title="No prescription records to show" description="Platform-wide prescription oversight and audit records will appear here." />
    </div>
  );
}
