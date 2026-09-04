'use client';

import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/Card';

type Status = 'PENDING' | 'FILLED' | 'CANNOT_FILL';

interface Prescription {
  id: string;
  documentRef: string | null;
  documentAvailable: boolean;
  status: Status;
  createdAt: string;
  filledAt: string | null;
  doctor: { name: string; email: string; specialization: string; licenseNumber: string; phone: string };
  patient: { name: string; age: number; gender: string; contactInfo: string };
  medicines: Array<{ id: string; dosage: string; frequency: string; duration: string; medicine: { name: string; genericName: string; stockStatus: boolean } }>;
  fill: { filledAt: string; notes: string | null; pharmacy: { pharmacyName: string; phone: string } } | null;
}

function statusBadge(status: Status) {
  const labels = { PENDING: 'Pending', FILLED: 'Filled', CANNOT_FILL: 'Cannot fill' };
  const variants = { PENDING: 'warning', FILLED: 'success', CANNOT_FILL: 'destructive' } as const;
  return <Badge variant={variants[status]}>{labels[status]}</Badge>;
}

function formatDate(value: string | null) {
  if (!value) return 'Not available';
  return new Date(value).toLocaleString(undefined, { dateStyle: 'medium', timeStyle: 'short' });
}

export default function PharmacyPrescriptionDetailPage({ params }: { params: { id: string } }) {
  const [prescription, setPrescription] = useState<Prescription | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [fulfilling, setFulfilling] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);
  const [notes, setNotes] = useState('');

  const loadPrescription = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const response = await fetch(`/api/pharmacy/prescriptions/${params.id}`, { cache: 'no-store' });
      const body = await response.json().catch(() => ({}));
      if (response.status === 404) {
        setError(body.error || 'Prescription not found.');
        return;
      }
      if (!response.ok) throw new Error(body.error || `Unable to load prescription (HTTP ${response.status})`);
      setPrescription(body.prescription);
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : 'Unable to load prescription details.');
    } finally {
      setLoading(false);
    }
  }, [params.id]);

  useEffect(() => { loadPrescription(); }, [loadPrescription]);

  const handleFulfill = async (action: 'FILLED' | 'CANNOT_FILL') => {
    setFulfilling(true);
    setActionError(null);
    try {
      const response = await fetch(`/api/pharmacy/prescriptions/${params.id}/fulfill`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action, notes: notes.trim() || undefined }),
      });
      const body = await response.json().catch(() => ({}));
      if (!response.ok) {
        throw new Error(body.error || `Fulfillment failed (HTTP ${response.status})`);
      }
      if (body.prescription) {
        setPrescription(body.prescription);
      } else {
        await loadPrescription();
      }
      setNotes('');
    } catch (err) {
      setActionError(err instanceof Error ? err.message : 'Failed to update fulfillment status.');
    } finally {
      setFulfilling(false);
    }
  };

  if (loading) return <div className="space-y-6 animate-pulse" aria-label="Loading prescription details"><div className="h-8 bg-gray-200 rounded w-1/3" /><div className="h-64 bg-gray-200 rounded-lg" /><div className="h-48 bg-gray-200 rounded-lg" /></div>;
  if (error && !prescription) return <div className="rounded-lg border border-red-200 bg-red-50 p-8 text-center space-y-3"><h1 className="text-lg font-semibold text-red-900">Unable to load prescription</h1><p className="text-sm text-red-700">{error}</p><div className="flex justify-center gap-3"><Link href="/pharmacy/prescriptions"><Button variant="secondary" size="sm">Back to queue</Button></Link>{error !== 'Prescription not found.' && <Button onClick={loadPrescription} variant="primary" size="sm">Try again</Button>}</div></div>;
  if (!prescription) return null;

  return <div className="space-y-6">
    <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 border-b border-gray-200 pb-5"><div><Link href="/pharmacy/prescriptions" className="text-sm font-semibold text-blue-700 hover:underline">← Back to prescription queue</Link><h1 className="text-2xl font-bold text-gray-900 mt-3">Prescription #{prescription.id.slice(-8).toUpperCase()}</h1><p className="text-sm text-gray-500 mt-1">Created {formatDate(prescription.createdAt)}</p></div><div>{statusBadge(prescription.status)}</div></div>

    {prescription.status === 'PENDING' && (
      <Card className="border-blue-200 bg-blue-50/40">
        <CardHeader>
          <CardTitle className="text-blue-950">Prescription Fulfillment Actions</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <p className="text-sm text-gray-700">
            Verify the prescription items and submit the terminal fulfillment outcome. A successful fill registers this pharmacy and creates the fulfillment record.
          </p>
          <div>
            <label className="block text-xs font-semibold uppercase text-gray-600 mb-1">
              Fulfillment Notes (Optional)
            </label>
            <input
              type="text"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="e.g. Dispensed with counselling on food intake..."
              className="w-full rounded-md border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900 placeholder-gray-400 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
              disabled={fulfilling}
            />
          </div>
          {actionError && (
            <div className="rounded-md bg-red-50 p-3 text-sm text-red-700 border border-red-200">
              {actionError}
            </div>
          )}
          <div className="flex flex-wrap gap-3">
            <Button
              onClick={() => handleFulfill('FILLED')}
              variant="primary"
              isLoading={fulfilling}
              disabled={fulfilling}
            >
              Dispense &amp; Mark as Filled
            </Button>
            <Button
              onClick={() => handleFulfill('CANNOT_FILL')}
              variant="destructive"
              isLoading={fulfilling}
              disabled={fulfilling}
            >
              Cannot Fill Prescription
            </Button>
          </div>
        </CardContent>
      </Card>
    )}

    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
      <Card><CardHeader><CardTitle>Patient information</CardTitle></CardHeader><CardContent className="space-y-3 text-sm"><div><p className="text-xs uppercase font-semibold text-gray-500">Name</p><p className="font-semibold text-gray-900">{prescription.patient.name}</p></div><div className="grid grid-cols-2 gap-4"><div><p className="text-xs uppercase font-semibold text-gray-500">Age</p><p className="text-gray-700">{prescription.patient.age}</p></div><div><p className="text-xs uppercase font-semibold text-gray-500">Gender</p><p className="text-gray-700">{prescription.patient.gender}</p></div></div><div><p className="text-xs uppercase font-semibold text-gray-500">Contact</p><p className="text-gray-700 break-words">{prescription.patient.contactInfo}</p></div></CardContent></Card>
      <Card><CardHeader><CardTitle>Doctor information</CardTitle></CardHeader><CardContent className="space-y-3 text-sm"><div><p className="text-xs uppercase font-semibold text-gray-500">Doctor</p><p className="font-semibold text-gray-900">{prescription.doctor.name}</p><p className="text-gray-500">{prescription.doctor.specialization}</p></div><div><p className="text-xs uppercase font-semibold text-gray-500">License</p><p className="font-mono text-gray-700">{prescription.doctor.licenseNumber}</p></div><div><p className="text-xs uppercase font-semibold text-gray-500">Contact</p><p className="text-gray-700">{prescription.doctor.phone}</p><p className="text-gray-700 break-all">{prescription.doctor.email}</p></div></CardContent></Card>
    </div>

    <Card><CardHeader><CardTitle>Medicines and directions</CardTitle></CardHeader><CardContent className="p-0"><div className="divide-y divide-gray-100">{prescription.medicines.map((item) => <div key={item.id} className="p-5 grid grid-cols-1 md:grid-cols-[1fr_auto] gap-4"><div><h2 className="font-semibold text-gray-900">{item.medicine.name}</h2><p className="text-sm text-gray-500">{item.medicine.genericName}</p></div><dl className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-sm md:min-w-[26rem]"><div><dt className="text-xs uppercase font-semibold text-gray-500">Dosage</dt><dd className="text-gray-700 mt-1">{item.dosage}</dd></div><div><dt className="text-xs uppercase font-semibold text-gray-500">Frequency</dt><dd className="text-gray-700 mt-1">{item.frequency}</dd></div><div><dt className="text-xs uppercase font-semibold text-gray-500">Duration</dt><dd className="text-gray-700 mt-1">{item.duration}</dd></div></dl></div>)}</div></CardContent></Card>

    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
      <Card><CardHeader><CardTitle>Prescription document</CardTitle></CardHeader><CardContent className="text-sm">{prescription.documentAvailable && prescription.documentRef ? <p className="break-all text-gray-700">Reference: <span className="font-mono">{prescription.documentRef}</span></p> : <p className="text-gray-500">No prescription document is available.</p>}</CardContent></Card>
      <Card><CardHeader><CardTitle>Fulfillment timeline</CardTitle></CardHeader><CardContent className="space-y-3 text-sm">
        <div><p className="text-xs uppercase font-semibold text-gray-500">Created</p><p className="text-gray-700">{formatDate(prescription.createdAt)}</p></div>
        <div><p className="text-xs uppercase font-semibold text-gray-500">Fulfilled</p><p className="text-gray-700">{formatDate(prescription.filledAt || prescription.fill?.filledAt || null)}</p></div>
        {prescription.fill?.pharmacy && (
          <div><p className="text-xs uppercase font-semibold text-gray-500">Dispensed By</p><p className="text-gray-900 font-medium">{prescription.fill.pharmacy.pharmacyName}</p></div>
        )}
        {prescription.fill?.notes && (
          <div><p className="text-xs uppercase font-semibold text-gray-500">Fulfillment Notes</p><p className="text-gray-700">{prescription.fill.notes}</p></div>
        )}
      </CardContent></Card>
    </div>
  </div>;
}