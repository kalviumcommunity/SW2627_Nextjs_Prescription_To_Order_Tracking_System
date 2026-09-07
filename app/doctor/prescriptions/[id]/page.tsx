'use client';

import React, { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import { Button } from '@/components/ui/Button';
import { Card, CardContent } from '@/components/ui/Card';
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
      <div className="space-y-6">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div className="h-8 w-48 animate-pulse rounded bg-gray-200" />
          <div className="h-10 w-32 animate-pulse rounded bg-gray-200" />
        </div>
        <Card>
          <CardContent className="space-y-4 p-6">
            <div className="h-6 w-1/3 animate-pulse rounded bg-gray-200" />
            <div className="h-20 animate-pulse rounded bg-gray-100" />
            <div className="h-24 animate-pulse rounded bg-gray-100" />
            <div className="h-24 animate-pulse rounded bg-gray-100" />
          </CardContent>
        </Card>
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

        <div className="rounded-lg border border-red-200 bg-red-50 p-6 text-center">
          <h2 className="text-lg font-semibold text-red-900">Unable to load prescription</h2>
          <p className="mt-2 text-sm text-red-700">{error}</p>
          <div className="mt-4 flex justify-center gap-3">
            <Button variant="secondary" size="sm" onClick={fetchPrescription}>
              Try again
            </Button>
            <Link href="/doctor/prescriptions">
              <Button variant="primary" size="sm">
                Return to list
              </Button>
            </Link>
          </div>
        </div>
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

        <div className="rounded-lg border border-gray-200 bg-white p-6 text-center">
          <h2 className="text-lg font-semibold text-gray-900">Prescription not found</h2>
          <p className="mt-2 text-sm text-gray-600">
            The requested prescription could not be located or you do not have access to it.
          </p>
          <div className="mt-4 flex justify-center">
            <Link href="/doctor/prescriptions">
              <Button variant="primary" size="sm">
                View all prescriptions
              </Button>
            </Link>
          </div>
        </div>
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
