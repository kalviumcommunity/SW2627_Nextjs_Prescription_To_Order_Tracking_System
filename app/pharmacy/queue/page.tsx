<<<<<<< HEAD
import { EmptyState } from '@/components/ui/EmptyState';

export default function PharmacyQueuePage() {
  return (
    <div>
      <h2 className="text-2xl font-bold text-gray-900 mb-2">Prescription Queue</h2>
      <EmptyState title="Fulfillment queue is not available yet" description="Pending prescriptions will appear here when the pharmacy queue workflow is enabled." />
    </div>
  );
=======
import { redirect } from 'next/navigation';

export default function PharmacyQueuePage() {
  redirect('/pharmacy/prescriptions');
>>>>>>> b4f1fa2b98e4279b1dac767894fa76c5a43470c5
}

