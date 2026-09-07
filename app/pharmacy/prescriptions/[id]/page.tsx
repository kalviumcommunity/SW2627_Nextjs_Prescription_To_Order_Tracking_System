'use client';

import React, { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { Card, CardContent } from '@/components/ui/Card';
import { Modal } from '@/components/ui/Modal';
import { Spinner } from '@/components/ui/Spinner';
import { PrescriptionData, PrescriptionDetails } from '@/components/prescriptions/PrescriptionDetails';

type FulfillmentAction = 'FILLED' | 'CANNOT_FILL';

const actionCopy: Record<FulfillmentAction, { title: string; message: string; button: string }> = {
  FILLED: {
    title: 'Confirm marked as Filled',
    message: 'Confirm that this prescription has been fulfilled. This action cannot be undone.',
    button: 'Mark as Filled',
  },
  CANNOT_FILL: {
    title: 'Confirm cannot fulfill',
    message: 'Confirm that this prescription cannot be fulfilled. It will become a terminal prescription.',
    button: 'Mark as Cannot Fill',
  },
};

function getStatusLabel(status: PrescriptionData['status']) {
  if (status === 'FILLED') return <Badge variant="success">Filled</Badge>;
  if (status === 'CANNOT_FILL') return <Badge variant="destructive">Cannot Fill</Badge>;
  return <Badge variant="warning">Pending</Badge>;
}

export default function PharmacyPrescriptionDetailPage() {
  const params = useParams();
  const prescriptionId = Array.isArray(params.id) ? params.id[0] : params.id;
  const [prescription, setPrescription] = useState<PrescriptionData | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [feedback, setFeedback] = useState<string | null>(null);
  const [selectedAction, setSelectedAction] = useState<FulfillmentAction | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const fetchPrescription = useCallback(async () => {
    if (!prescriptionId) {
      setError('Prescription ID is missing.');
      setIsLoading(false);
      return;
    }

    setIsLoading(true);
    setError(null);
    try {
      const response = await fetch(`/api/prescriptions/${prescriptionId}`);
      const payload = await response.json().catch(() => ({}));
      if (!response.ok) {
        throw new Error(
          response.status === 401
            ? 'Your session has expired. Please sign in again.'
            : response.status === 403
              ? 'You do not have permission to view this prescription.'
              : response.status === 404
                ? 'Prescription not found.'
                : payload.error || 'Unable to load prescription details.'
        );
      }
      setPrescription(payload.prescription);
    } catch (requestError) {
      setPrescription(null);
      setError(requestError instanceof Error ? requestError.message : 'Unable to load prescription details.');
    } finally {
      setIsLoading(false);
    }
  }, [prescriptionId]);

  useEffect(() => {
    fetchPrescription();
  }, [fetchPrescription]);

  const submitFulfillment = async () => {
    if (!selectedAction || isSubmitting || prescription?.status !== 'PENDING') return;

    setIsSubmitting(true);
    setError(null);
    try {
      const response = await fetch(`/api/pharmacy/prescriptions/${prescriptionId}/fulfill`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: selectedAction }),
      });
      const payload = await response.json().catch(() => ({}));
      if (!response.ok) {
        const message = response.status === 409
          ? 'This prescription has already been processed. Please refresh the status.'
          : response.status === 401
            ? 'Your session has expired. Please sign in again.'
            : response.status === 403
              ? 'You do not have permission to fulfill this prescription.'
              : response.status === 404
                ? 'Prescription not found. Please refresh the page.'
                : response.status === 400
                  ? payload.error || 'Please choose a valid fulfillment action.'
                  : 'The prescription could not be updated. Please try again.';
        throw new Error(message);
      }

      setPrescription(payload.prescription);
      setSelectedAction(null);
      setFeedback(selectedAction === 'FILLED' ? 'Prescription marked as Filled.' : 'Prescription marked as Cannot Fill.');
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : 'The prescription could not be updated.');
    } finally {
      setIsSubmitting(false);
    }
  };

  if (isLoading) {
    return <div className="flex min-h-[20rem] items-center justify-center"><Spinner size="lg" /></div>;
  }

  if (error && !prescription) {
    return (
      <div className="space-y-6">
        <PageHeader />
        <Card><CardContent className="p-6 text-center">
          <h2 className="text-lg font-semibold text-red-900">Unable to load prescription</h2>
          <p className="mt-2 text-sm text-red-700">{error}</p>
          <Button className="mt-4" size="sm" onClick={fetchPrescription}>Try again</Button>
        </CardContent></Card>
      </div>
    );
  }

  if (!prescription) return null;

  const copy = selectedAction ? actionCopy[selectedAction] : null;
  return (
    <div className="space-y-6">
      <PageHeader />
      {feedback && <div className="rounded-md border border-green-200 bg-green-50 px-4 py-3 text-sm font-medium text-green-800" role="status">{feedback}</div>}
      {error && <div className="rounded-md border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800" role="alert">{error}</div>}
      <Card>
        <CardContent className="p-4 sm:p-6">
          <div className="mb-5 flex flex-wrap items-center justify-between gap-3 border-b border-gray-100 pb-4">
            <div><p className="text-xs font-semibold uppercase tracking-wider text-blue-600">Pharmacy</p><h1 className="text-xl font-bold text-gray-900">Prescription</h1></div>
            {getStatusLabel(prescription.status)}
          </div>
          <PrescriptionDetails prescription={prescription} viewerRole="PHARMACY" />
          {prescription.status === 'PENDING' && (
            <div className="mt-6 flex flex-col gap-3 border-t border-gray-200 pt-5 sm:flex-row sm:justify-end">
              <Button variant="destructive" disabled={isSubmitting} onClick={() => setSelectedAction('CANNOT_FILL')}>Mark as Cannot Fill</Button>
              <Button disabled={isSubmitting} onClick={() => setSelectedAction('FILLED')}>Mark as Filled</Button>
            </div>
          )}
        </CardContent>
      </Card>
      <Link href="/pharmacy/queue" className="inline-flex text-sm font-medium text-blue-700 underline underline-offset-2">Back to prescription queue</Link>
      <Modal open={Boolean(copy)} title={copy?.title || ''} onClose={() => !isSubmitting && setSelectedAction(null)} closeDisabled={isSubmitting}>
        <p className="text-sm leading-6 text-gray-700">{copy?.message}</p>
        <div className="mt-6 flex flex-col-reverse gap-3 sm:flex-row sm:justify-end">
          <Button variant="secondary" disabled={isSubmitting} onClick={() => setSelectedAction(null)}>Cancel</Button>
          <Button variant={selectedAction === 'CANNOT_FILL' ? 'destructive' : 'primary'} isLoading={isSubmitting} onClick={submitFulfillment}>{copy?.button}</Button>
        </div>
      </Modal>
    </div>
  );
}

function PageHeader() {
  return <div className="flex flex-col gap-3 border-b border-gray-200 pb-4 sm:flex-row sm:items-center sm:justify-between"><div><p className="text-sm font-medium uppercase tracking-wide text-blue-600">Pharmacy</p><h2 className="text-2xl font-bold text-gray-900">Prescription Details</h2></div><Link href="/pharmacy/queue"><Button variant="secondary" size="sm">Back to queue</Button></Link></div>;
}