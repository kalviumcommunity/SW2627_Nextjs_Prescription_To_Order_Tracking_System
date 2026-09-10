'use client';

import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { PrescriptionData, PrescriptionDetails } from '@/components/prescriptions/PrescriptionDetails';
import { Button } from '@/components/ui/Button';
import { LoadingState } from '@/components/ui/LoadingState';
import { ErrorState } from '@/components/ui/ErrorState';
import { EmptyState } from '@/components/ui/EmptyState';
import { getApiErrorMessage } from '@/lib/client-errors';

export default function PatientPrescriptionDetailPage({ params }: { params: { id: string } }) {
  const [prescription, setPrescription] = useState<PrescriptionData | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchPrescription = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      const response = await fetch(`/api/patient/prescriptions/${params.id}`);
      const payload = await response.json().catch(() => ({}));
      if (!response.ok) {
        throw new Error(response.status === 404 ? 'Prescription not found.' : getApiErrorMessage(payload, 'Unable to load prescription details.'));
      }
      setPrescription(payload.prescription);
    } catch (requestError) {
      setPrescription(null);
      setError(requestError instanceof Error ? requestError.message : 'Unable to load prescription details.');
    } finally {
      setIsLoading(false);
    }
  }, [params.id]);

  useEffect(() => {
    fetchPrescription();
  }, [fetchPrescription]);

  if (isLoading) {
    return (
      <div className="py-8">
        <LoadingState message="Loading prescription details..." />
      </div>
    );
  }

  if (error) {
    return (
      <div className="space-y-6">
        <PageHeader />
        <ErrorState
          title="Unable to load prescription"
          message={error}
          onRetry={fetchPrescription}
        />
      </div>
    );
  }

  if (!prescription) {
    return (
      <div className="space-y-6">
        <PageHeader />
        <EmptyState
          title="Prescription not found"
          description="This prescription may have been removed or is not available for your account."
          action={
            <Link href="/patient/prescriptions">
              <Button variant="primary" size="sm">Back to prescriptions</Button>
            </Link>
          }
        />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <PageHeader />
      <PrescriptionDetails prescription={prescription} viewerRole="PATIENT" />
    </div>
  );
}

function PageHeader() {
  return (
    <div className="flex flex-col gap-3 border-b border-gray-200 pb-4 sm:flex-row sm:items-center sm:justify-between">
      <div>
        <p className="text-sm font-medium uppercase tracking-wide text-blue-600">Patient</p>
        <h1 className="text-2xl font-bold text-gray-900">Prescription details</h1>
        <p className="mt-1 text-sm text-gray-500">Review the instructions and fulfillment information for this prescription.</p>
      </div>
      <Link href="/patient/prescriptions">
        <Button variant="secondary" size="sm">Back to prescriptions</Button>
      </Link>
    </div>
  );
}