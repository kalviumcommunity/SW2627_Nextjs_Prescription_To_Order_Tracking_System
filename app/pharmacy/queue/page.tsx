<<<<<<< HEAD
export default function PharmacyQueuePage() {
  return (
    <div>
      <h2 className="text-2xl font-bold text-gray-900 mb-2">Prescription Queue</h2>
      <p className="text-gray-600">View and process pending prescriptions for fulfillment. Features will be available in upcoming releases.</p>
    </div>
  );
}
=======
import { redirect } from 'next/navigation';

export default function PharmacyQueuePage() {
  redirect('/pharmacy/prescriptions');
}

>>>>>>> 8cb84a5d07c7faeeded506a6b2a4cb078bb615a2
