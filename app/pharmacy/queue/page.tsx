import { EmptyState } from '@/components/ui/EmptyState';

export default function PharmacyQueuePage() {
  return (
    <div>
      <h2 className="text-2xl font-bold text-gray-900 mb-2">Prescription Queue</h2>
      <EmptyState title="Fulfillment queue is not available yet" description="Pending prescriptions will appear here when the pharmacy queue workflow is enabled." />
    </div>
  );
}
