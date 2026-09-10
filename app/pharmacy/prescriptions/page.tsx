'use client';

import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { Button } from '@/components/ui/Button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/Card';
import { LoadingState } from '@/components/ui/LoadingState';
import { EmptyState } from '@/components/ui/EmptyState';
import { ErrorState } from '@/components/ui/ErrorState';
import { getApiErrorMessage } from '@/lib/client-errors';
import { PrescriptionStatus } from '@/components/prescriptions/PrescriptionStatus';

type Status = 'PENDING' | 'FILLED' | 'CANNOT_FILL';
type Filter = 'ALL' | Status;

interface Prescription {
  id: string;
  status: Status;
  createdAt: string;
  doctor: { name: string; specialization: string };
  patient: { name: string };
  medicines: Array<{ medicine: { name: string } }>;
}

interface PrescriptionsResponse {
  pharmacy: { pharmacyName: string };
  prescriptions: Prescription[];
}

function formatDate(value: string) {
  return new Date(value).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' });
}

export default function PharmacyPrescriptionsPage() {
  const searchParams = useSearchParams();
  const requestedStatus = searchParams.get('status');
  const initialFilter: Filter = requestedStatus === 'PENDING' || requestedStatus === 'FILLED' || requestedStatus === 'CANNOT_FILL' ? requestedStatus : 'ALL';
  const [filter, setFilter] = useState<Filter>(initialFilter);
  const [data, setData] = useState<PrescriptionsResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const loadPrescriptions = useCallback(async (selectedFilter: Filter) => {
    setLoading(true);
    setError(null);
    try {
      const query = selectedFilter === 'ALL' ? '' : `?status=${selectedFilter}`;
      const response = await fetch(`/api/pharmacy/prescriptions${query}`, { cache: 'no-store' });
      if (!response.ok) {
        const body = await response.json().catch(() => ({}));
        throw new Error(getApiErrorMessage(body, `Unable to load prescriptions (HTTP ${response.status})`));
      }
      setData(await response.json());
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : 'Unable to load pharmacy prescriptions.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { loadPrescriptions(filter); }, [filter, loadPrescriptions]);

  if (loading && !data) {
    return (
      <div className="py-8">
        <LoadingState message="Loading prescriptions..." />
      </div>
    );
  }

  if (error && !data) {
    return (
      <ErrorState
        title="Unable to load prescriptions"
        message={error}
        onRetry={() => loadPrescriptions(filter)}
      />
    );
  }

  if (!data) return null;

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 border-b border-gray-200 pb-5">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Prescription Queue</h1>
          <p className="text-sm text-gray-500 mt-1">Review prescriptions available to {data.pharmacy.pharmacyName}.</p>
        </div>
        <Button onClick={() => loadPrescriptions(filter)} variant="secondary" size="sm" isLoading={loading}>Refresh</Button>
      </div>
      <Card>
        <CardHeader className="space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
            <div>
              <CardTitle>Prescription records</CardTitle>
              <p className="text-xs text-gray-500 mt-1">{data.prescriptions.length} {data.prescriptions.length === 1 ? 'record' : 'records'} shown</p>
            </div>
            <label className="text-sm text-gray-700">Filter status
              <select value={filter} onChange={(event) => setFilter(event.target.value as Filter)} className="ml-2 rounded-md border border-gray-300 bg-white px-3 py-2 text-sm">
                <option value="ALL">All statuses</option>
                <option value="PENDING">Pending</option>
                <option value="FILLED">Filled</option>
                <option value="CANNOT_FILL">Cannot fill</option>
              </select>
            </label>
          </div>
        </CardHeader>
        <CardContent className="p-0">
          {data.prescriptions.length === 0 ? (
            <div className="p-6">
              <EmptyState
                title="No prescriptions found"
                description="There are no records matching this status."
                action={
                  filter !== 'ALL' ? (
                    <Button variant="secondary" size="sm" onClick={() => setFilter('ALL')}>
                      Show all prescriptions
                    </Button>
                  ) : undefined
                }
              />
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-sm">
                <thead className="bg-gray-50 text-xs uppercase text-gray-500">
                  <tr>
                    <th className="px-6 py-3">Prescription</th>
                    <th className="px-6 py-3">Doctor</th>
                    <th className="px-6 py-3">Patient</th>
                    <th className="px-6 py-3">Created</th>
                    <th className="px-6 py-3">Status</th>
                    <th className="px-6 py-3"><span className="sr-only">Actions</span></th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {data.prescriptions.map((prescription) => (
                    <tr key={prescription.id} className="hover:bg-gray-50">
                      <td className="px-6 py-4">
                        <Link href={`/pharmacy/prescriptions/${prescription.id}`} className="font-mono text-xs font-semibold text-blue-700 hover:underline">
                          #{prescription.id.slice(-8).toUpperCase()}
                        </Link>
                        <p className="text-xs text-gray-500 mt-1">{prescription.medicines.map((medicine) => medicine.medicine.name).join(', ')}</p>
                      </td>
                      <td className="px-6 py-4">
                        <p className="font-medium text-gray-900">{prescription.doctor.name}</p>
                        <p className="text-xs text-gray-500">{prescription.doctor.specialization}</p>
                      </td>
                      <td className="px-6 py-4 text-gray-700">{prescription.patient.name}</td>
                      <td className="px-6 py-4 text-gray-600">{formatDate(prescription.createdAt)}</td>
                      <td className="px-6 py-4"><PrescriptionStatus status={prescription.status} /></td>
                      <td className="px-6 py-4 text-right">
                        <Link href={`/pharmacy/prescriptions/${prescription.id}`} className="text-sm font-semibold text-blue-700 hover:underline">
                          View
                        </Link>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}