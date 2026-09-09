'use client';

import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { Button } from '@/components/ui/Button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/Card';
import { LoadingState } from '@/components/ui/LoadingState';
import { EmptyState } from '@/components/ui/EmptyState';
import { ErrorState } from '@/components/ui/ErrorState';
import { PrescriptionStatus } from '@/components/prescriptions/PrescriptionStatus';

type Status = 'PENDING' | 'FILLED' | 'CANNOT_FILL';

interface Prescription {
  id: string;
  status: Status;
  createdAt: string;
  doctor: { specialization: string };
  prescriptionMedicines: { medicine: { name: string } }[];
  fill?: { filledAt: string } | null;
}

interface PatientPrescriptionsResponse {
  patient: { id: string; name: string };
  prescriptions: Prescription[];
}

function formatDate(value: string) {
  return new Date(value).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' });
}

export default function PatientDashboardPage() {
  const [data, setData] = useState<PatientPrescriptionsResponse | null>(null);
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

  useEffect(() => {
    fetchPrescriptions();
  }, [fetchPrescriptions]);

  if (isLoading && !data) {
    return (
      <div className="py-8">
        <LoadingState message="Loading your health overview..." />
      </div>
    );
  }

  if (error && !data) {
    return (
      <div className="space-y-6">
        <PageHeading />
        <ErrorState
          title="Unable to load dashboard"
          message={error}
          onRetry={fetchPrescriptions}
        />
      </div>
    );
  }

  const prescriptions = data?.prescriptions ?? [];
  const pending = prescriptions.filter((prescription) => prescription.status === 'PENDING').length;
  const filled = prescriptions.filter((prescription) => prescription.status === 'FILLED').length;
  const active = pending + filled;
  const recent = prescriptions.slice(0, 5);

  return (
    <div className="space-y-6">
      <PageHeading patientName={data?.patient.name} onRefresh={fetchPrescriptions} isLoading={isLoading} />

      {error && <div className="rounded-md border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800" role="alert">{error}</div>}

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <MetricCard label="Active prescriptions" value={active} detail="Pending or successfully fulfilled" />
        <MetricCard label="Filled prescriptions" value={filled} detail="Successfully fulfilled" tone="green" />
        <MetricCard label="Pending prescriptions" value={pending} detail="Waiting for pharmacy fulfillment" tone="yellow" />
      </div>

      <Card>
        <CardHeader className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div><CardTitle>Recent prescription activity</CardTitle><p className="mt-1 text-xs text-gray-500">Your latest prescription status updates</p></div>
          <Link href="/patient/prescriptions" className="text-sm font-semibold text-blue-700 hover:text-blue-900">View all</Link>
        </CardHeader>
        {recent.length === 0 ? (
          <CardContent className="p-6">
            <EmptyState
              title="No prescriptions yet"
              description="Prescriptions issued to you will appear here."
            />
          </CardContent>
        ) : (
          <div className="divide-y divide-gray-100">
            {recent.map((prescription) => (
              <div key={prescription.id} className="flex flex-col gap-3 px-6 py-4 sm:flex-row sm:items-center sm:justify-between">
                <div className="min-w-0"><p className="font-mono text-xs font-semibold text-gray-800">#{prescription.id}</p><p className="mt-1 truncate text-sm text-gray-700">{prescription.doctor.specialization} · {prescription.prescriptionMedicines.map((item) => item.medicine.name).join(', ') || 'No medicines listed'}</p><p className="mt-1 text-xs text-gray-500">Created {formatDate(prescription.createdAt)}</p></div>
                <div className="flex items-center gap-3"><PrescriptionStatus status={prescription.status} /><Link href={`/patient/prescriptions/${prescription.id}`} className="text-sm font-semibold text-blue-700 hover:text-blue-900">View</Link></div>
              </div>
            ))}
          </div>
        )}
      </Card>
    </div>
  );
}

function PageHeading({ patientName, onRefresh, isLoading }: { patientName?: string; onRefresh?: () => void; isLoading?: boolean }) {
  return <div className="flex flex-col gap-4 border-b border-gray-200 pb-4 sm:flex-row sm:items-center sm:justify-between"><div><p className="text-sm font-medium uppercase tracking-wide text-blue-600">Patient</p><h1 className="text-2xl font-bold text-gray-900">Your health overview</h1><p className="mt-1 text-sm text-gray-500">{patientName ? `Welcome back, ${patientName}.` : 'Review your prescriptions and fulfillment status.'}</p></div>{onRefresh && <Button variant="secondary" size="sm" onClick={onRefresh} isLoading={isLoading}>Refresh</Button>}</div>;
}

function MetricCard({ label, value, detail, tone = 'blue' }: { label: string; value: number; detail: string; tone?: 'blue' | 'green' | 'yellow' }) {
  const tones = { blue: 'border-blue-100 bg-blue-50/30 text-blue-900', green: 'border-green-200 bg-green-50/30 text-green-900', yellow: 'border-yellow-200 bg-yellow-50/30 text-yellow-900' };
  return <Card className={tones[tone]}><CardContent className="p-5"><p className="text-xs font-semibold uppercase tracking-wider text-gray-600">{label}</p><p className="mt-2 text-3xl font-bold">{value}</p><p className="mt-2 text-xs text-gray-600">{detail}</p></CardContent></Card>;
}
