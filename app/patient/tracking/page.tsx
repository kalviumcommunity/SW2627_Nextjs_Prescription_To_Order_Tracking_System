import { EmptyState } from '@/components/ui/EmptyState';

export default function PatientTrackingPage() {
  return (
    <div>
      <h2 className="text-2xl font-bold text-gray-900 mb-2">Tracking</h2>
      <EmptyState title="No orders to track" description="Prescription order status will appear here when tracking is available." />
    </div>
  );
}
