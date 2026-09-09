'use client';

import React, { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import { Button } from '@/components/ui/Button';
import { LoadingState } from '@/components/ui/LoadingState';
import { ErrorState } from '@/components/ui/ErrorState';
import { EmptyState } from '@/components/ui/EmptyState';
import {
  PrescriptionData,
  PrescriptionDetails,
} from '@/components/prescriptions/PrescriptionDetails';

export default function DoctorPrescriptionDetailPage() {
  const params = useParams();
  const prescriptionId = Array.isArray(params.id) ? params.id[0] : params.id;

  const [prescription, setPrescription] = useState<PrescriptionData | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchPrescription = useCallback(async () => {
    if (!prescriptionId) {
      setError('Prescription ID is missing.');
      setIsLoading(false);
      return;
    }

    setIsLoading(true);
    setError(null);

    try {
      const response = await fetch(`/api/doctor/prescriptions/${prescriptionId}`);
      const payload = await response.json().catch(() => ({}));

      if (!response.ok) {
        throw new Error(payload.error || 'Unable to load prescription details.');
      }

      if (!payload.prescription) {
        throw new Error('Prescription not found.');
      }

      setPrescription(payload.prescription);
    } catch (err) {
      console.error('Error loading prescription details:', err);
      setError(err instanceof Error ? err.message : 'Unable to load prescription details.');
      setPrescription(null);
    } finally {
      setIsLoading(false);
    }
  }, [prescriptionId]);

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
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <p className="text-sm font-medium uppercase tracking-wide text-blue-600">Doctor</p>
            <h1 className="text-2xl font-bold text-gray-900">Prescription Details</h1>
          </div>
          <Link href="/doctor/prescriptions">
            <Button variant="secondary" size="sm">
              Back to prescriptions
            </Button>
          </Link>
        </div>

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
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <p className="text-sm font-medium uppercase tracking-wide text-blue-600">Doctor</p>
            <h1 className="text-2xl font-bold text-gray-900">Prescription Details</h1>
          </div>
          <Link href="/doctor/prescriptions">
            <Button variant="secondary" size="sm">
              Back to prescriptions
            </Button>
          </Link>
        </div>

        <EmptyState
          title="Prescription not found"
          description="The requested prescription could not be located or you do not have access to it."
          action={
            <Link href="/doctor/prescriptions">
              <Button variant="primary" size="sm">
                View all prescriptions
              </Button>
            </Link>
          }
        />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-3 border-b border-gray-200 pb-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <p className="text-sm font-medium uppercase tracking-wide text-blue-600">Doctor</p>
          <h1 className="text-2xl font-bold text-gray-900">Prescription Details</h1>
        </div>
        <div className="flex items-center gap-3">
          <Link href="/doctor/prescriptions">
            <Button variant="secondary" size="sm">
              Back to prescriptions
            </Button>
          </Link>
        </div>
      </div>

      <PrescriptionDetails prescription={prescription} viewerRole="DOCTOR" />
    </div>
  );
}
