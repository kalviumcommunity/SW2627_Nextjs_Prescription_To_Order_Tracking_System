<<<<<<< HEAD
'use client';

import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/Card';
import { Spinner } from '@/components/ui/Spinner';

type Status = 'PENDING' | 'FILLED' | 'CANNOT_FILL';
interface Prescription { id: string; createdAt: string; status: Status; doctor: { specialization: string; user?: { email: string } | null }; }
interface ResponseData { prescriptions: Prescription[]; }

function statusBadge(status: Status) {
  if (status === 'FILLED') return <Badge variant="success">Filled</Badge>;
  if (status === 'CANNOT_FILL') return <Badge variant="destructive">Cannot Fill</Badge>;
  return <Badge variant="warning">Pending</Badge>;
}

function formatDate(value: string) {
  return new Date(value).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' });
}

export default function PatientPrescriptionsPage() {
  const [data, setData] = useState<ResponseData | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchPrescriptions = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      const response = await fetch('/api/patient/prescriptions');
      const payload = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(payload.error || 'Unable to load your prescriptions.');
      setData(payload);
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : 'Unable to load your prescriptions.');
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => { fetchPrescriptions(); }, [fetchPrescriptions]);

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 border-b border-gray-200 pb-4 sm:flex-row sm:items-center sm:justify-between">
        <div><p className="text-sm font-medium uppercase tracking-wide text-blue-600">Patient</p><h1 className="text-2xl font-bold text-gray-900">My prescriptions</h1><p className="mt-1 text-sm text-gray-500">Review prescriptions issued to you and their fulfillment status.</p></div>
        <Button variant="secondary" size="sm" onClick={fetchPrescriptions} isLoading={isLoading}>Refresh</Button>
      </div>
      {error && <Card><CardContent className="p-8 text-center"><h2 className="text-lg font-semibold text-red-900">Unable to load prescriptions</h2><p className="mt-2 text-sm text-red-700">{error}</p><Button className="mt-4" size="sm" onClick={fetchPrescriptions}>Try again</Button></CardContent></Card>}
      {isLoading && !data && <div className="flex min-h-[16rem] items-center justify-center"><Spinner size="lg" /></div>}
      {data && <Card>
        <CardHeader><CardTitle>Prescription records</CardTitle><p className="mt-1 text-xs text-gray-500">{data.prescriptions.length} {data.prescriptions.length === 1 ? 'record' : 'records'}</p></CardHeader>
        {data.prescriptions.length === 0 ? <CardContent className="p-10 text-center"><p className="font-semibold text-gray-800">No prescriptions found</p><p className="mt-1 text-sm text-gray-500">Your prescription history will appear here.</p></CardContent> : <div className="overflow-x-auto"><table className="w-full min-w-[40rem] text-left text-sm text-gray-600"><caption className="sr-only">Your prescriptions</caption><thead className="border-b border-gray-200 bg-gray-50 text-xs uppercase tracking-wider text-gray-500"><tr><th scope="col" className="px-6 py-3 font-semibold">Prescription ID</th><th scope="col" className="px-6 py-3 font-semibold">Doctor</th><th scope="col" className="px-6 py-3 font-semibold">Date</th><th scope="col" className="px-6 py-3 font-semibold">Status</th><th scope="col" className="px-6 py-3 text-right font-semibold">Action</th></tr></thead><tbody className="divide-y divide-gray-100">{data.prescriptions.map((prescription) => <tr key={prescription.id} className="hover:bg-gray-50"><td className="px-6 py-4 font-mono text-xs font-semibold text-gray-800">#{prescription.id}</td><td className="px-6 py-4"><span className="font-medium text-gray-900">{prescription.doctor.user?.email || 'Doctor'}</span><span className="block text-xs text-gray-500">{prescription.doctor.specialization}</span></td><td className="whitespace-nowrap px-6 py-4 text-xs text-gray-500">{formatDate(prescription.createdAt)}</td><td className="px-6 py-4">{statusBadge(prescription.status)}</td><td className="px-6 py-4 text-right"><Link href={`/patient/prescriptions/${prescription.id}`} className="font-semibold text-blue-700 hover:text-blue-900">View details</Link></td></tr>)}</tbody></table></div>}
      </Card>}
=======
export default function PatientPrescriptionsPage() {
  return (
    <div>
      <h2 className="text-2xl font-bold text-gray-900 mb-2">My Prescriptions</h2>
      <p className="text-gray-600">View your prescription history and current medications. Features will be available in upcoming releases.</p>
>>>>>>> 8cb84a5d07c7faeeded506a6b2a4cb078bb615a2
    </div>
  );
}
