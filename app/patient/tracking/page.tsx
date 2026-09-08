<<<<<<< HEAD
import { EmptyState } from '@/components/ui/EmptyState';

export default function PatientTrackingPage() {
  return (
    <div>
      <h2 className="text-2xl font-bold text-gray-900 mb-2">Tracking</h2>
      <EmptyState title="No orders to track" description="Prescription order status will appear here when tracking is available." />
    </div>
  );
=======
'use client';

import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/Card';
import { Spinner } from '@/components/ui/Spinner';

type Status = 'PENDING' | 'FILLED' | 'CANNOT_FILL';
interface Prescription { id: string; status: Status; createdAt: string; fill?: { filledAt: string } | null; }
interface ResponseData { prescriptions: Prescription[]; }

function formatDate(value: string) {
  return new Date(value).toLocaleString(undefined, { dateStyle: 'medium', timeStyle: 'short' });
}

function TrackingMessage({ prescription }: { prescription: Prescription }) {
  if (prescription.status === 'FILLED') return <div className="mt-3 text-sm text-green-800">Successfully fulfilled{prescription.fill?.filledAt ? ` on ${formatDate(prescription.fill.filledAt)}` : '.'}</div>;
  if (prescription.status === 'CANNOT_FILL') return <div className="mt-3 text-sm text-red-800">This prescription is unavailable for fulfillment.</div>;
  return <div className="mt-3 text-sm text-yellow-900">This prescription is waiting for pharmacy fulfillment.</div>;
}

function statusBadge(status: Status) {
  if (status === 'FILLED') return <Badge variant="success">FILLED</Badge>;
  if (status === 'CANNOT_FILL') return <Badge variant="destructive">CANNOT_FILL</Badge>;
  return <Badge variant="warning">PENDING</Badge>;
}

export default function PatientTrackingPage() {
  const [data, setData] = useState<ResponseData | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchTracking = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      const response = await fetch('/api/patient/prescriptions');
      const payload = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(payload.error || 'Unable to load tracking information.');
      setData(payload);
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : 'Unable to load tracking information.');
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => { fetchTracking(); }, [fetchTracking]);

  return <div className="space-y-6"><div className="flex flex-col gap-4 border-b border-gray-200 pb-4 sm:flex-row sm:items-center sm:justify-between"><div><p className="text-sm font-medium uppercase tracking-wide text-blue-600">Patient</p><h1 className="text-2xl font-bold text-gray-900">Prescription tracking</h1><p className="mt-1 text-sm text-gray-500">Follow the fulfillment status of your prescriptions.</p></div><Button variant="secondary" size="sm" onClick={fetchTracking} isLoading={isLoading}>Refresh</Button></div>
    {error && <Card><CardContent className="p-8 text-center"><h2 className="text-lg font-semibold text-red-900">Unable to load tracking</h2><p className="mt-2 text-sm text-red-700">{error}</p><Button className="mt-4" size="sm" onClick={fetchTracking}>Try again</Button></CardContent></Card>}
    {isLoading && !data && <div className="flex min-h-[16rem] items-center justify-center"><Spinner size="lg" /></div>}
    {data && <Card><CardHeader><CardTitle>Fulfillment status</CardTitle><p className="mt-1 text-xs text-gray-500">Status is updated by the pharmacy.</p></CardHeader>{data.prescriptions.length === 0 ? <CardContent className="p-10 text-center"><p className="font-semibold text-gray-800">No prescriptions to track</p><p className="mt-1 text-sm text-gray-500">Your fulfillment updates will appear here.</p></CardContent> : <div className="divide-y divide-gray-100">{data.prescriptions.map((prescription) => <div key={prescription.id} className="px-6 py-5"><div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between"><div><p className="font-mono text-xs font-semibold text-gray-800">#{prescription.id}</p><p className="mt-1 text-xs text-gray-500">Created {formatDate(prescription.createdAt)}</p></div><div className="flex items-center gap-3">{statusBadge(prescription.status)}<Link href={`/patient/prescriptions/${prescription.id}`} className="text-sm font-semibold text-blue-700 hover:text-blue-900">Details</Link></div></div><TrackingMessage prescription={prescription} /></div>)}</div>}</Card>}
  </div>;
>>>>>>> b4f1fa2b98e4279b1dac767894fa76c5a43470c5
}
