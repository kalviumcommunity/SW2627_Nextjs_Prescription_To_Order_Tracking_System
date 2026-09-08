import { EmptyState } from '@/components/ui/EmptyState';

export default function PatientPrescriptionsPage() {
  return (
    <div>
      <h2 className="text-2xl font-bold text-gray-900 mb-2">My Prescriptions</h2>
      <EmptyState title="No prescription history to show" description="Your prescription history and current medications will appear here." />
    </div>
  );
}
