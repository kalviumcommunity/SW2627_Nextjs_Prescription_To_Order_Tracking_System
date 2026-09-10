'use client';

import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { Button } from '@/components/ui/Button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/Card';
import { LoadingState } from '@/components/ui/LoadingState';
import { EmptyState } from '@/components/ui/EmptyState';
import { ErrorState } from '@/components/ui/ErrorState';
import { getApiErrorMessage } from '@/lib/client-errors';
import { PrescriptionStatus } from '@/components/prescriptions/PrescriptionStatus';

type Status = 'PENDING' | 'FILLED' | 'CANNOT_FILL';
interface Prescription {
  id: string;
  status: Status;
  createdAt: string;
  fill?: { filledAt: string } | null;
}
interface ResponseData {
  prescriptions: Prescription[];
}

function formatDate(value: string) {
  return new Date(value).toLocaleString(undefined, { dateStyle: 'medium', timeStyle: 'short' });
}

function TrackingMessage({ prescription }: { prescription: Prescription }) {
  if (prescription.status === 'FILLED') {
    return (
      <div className="mt-3 text-sm text-green-800">
        Successfully fulfilled{prescription.fill?.filledAt ? ` on ${formatDate(prescription.fill.filledAt)}` : '.'}
      </div>
    );
  }
  if (prescription.status === 'CANNOT_FILL') {
    return <div className="mt-3 text-sm text-red-800">This prescription is unavailable for fulfillment.</div>;
  }
  return <div className="mt-3 text-sm text-yellow-900">This prescription is waiting for pharmacy fulfillment.</div>;
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
      if (!response.ok) throw new Error(getApiErrorMessage(payload, 'Unable to load tracking information.'));
      setData(payload);
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : 'Unable to load tracking information.');
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchTracking();
  }, [fetchTracking]);

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 border-b border-gray-200 pb-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <p className="text-sm font-medium uppercase tracking-wide text-blue-600">Patient</p>
          <h1 className="text-2xl font-bold text-gray-900">Prescription tracking</h1>
          <p className="mt-1 text-sm text-gray-500">Follow the fulfillment status of your prescriptions.</p>
        </div>
        <Button variant="secondary" size="sm" onClick={fetchTracking} isLoading={isLoading}>
          Refresh
        </Button>
      </div>

      {error && (
        <ErrorState
          title="Unable to load tracking"
          message={error}
          onRetry={fetchTracking}
        />
      )}

      {isLoading && !data && (
        <div className="py-8">
          <LoadingState message="Loading tracking information..." />
        </div>
      )}

      {data && (
        <Card>
          <CardHeader>
            <CardTitle>Fulfillment status</CardTitle>
            <p className="mt-1 text-xs text-gray-500">Status is updated by the pharmacy.</p>
          </CardHeader>
          {data.prescriptions.length === 0 ? (
            <CardContent className="p-6">
              <EmptyState
                title="No prescriptions to track"
                description="Your fulfillment updates will appear here."
              />
            </CardContent>
          ) : (
            <div className="divide-y divide-gray-100">
              {data.prescriptions.map((prescription) => (
                <div key={prescription.id} className="px-6 py-5">
                  <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                    <div>
                      <p className="font-mono text-xs font-semibold text-gray-800">#{prescription.id}</p>
                      <p className="mt-1 text-xs text-gray-500">Created {formatDate(prescription.createdAt)}</p>
                    </div>
                    <div className="flex items-center gap-3">
                      <PrescriptionStatus status={prescription.status} />
                      <Link href={`/patient/prescriptions/${prescription.id}`} className="text-sm font-semibold text-blue-700 hover:text-blue-900">
                        Details
                      </Link>
                    </div>
                  </div>
                  <TrackingMessage prescription={prescription} />
                </div>
              ))}
            </div>
          )}
        </Card>
      )}
    </div>
  );
}
