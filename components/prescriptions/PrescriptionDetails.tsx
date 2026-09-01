'use client';

import React from 'react';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/Card';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';

export interface PrescriptionMedicineItem {
  id?: string;
  dosage: string;
  frequency: string;
  duration: string;
  medicine: {
    id: string;
    name: string;
    genericName?: string;
    stockStatus?: boolean;
  };
}

export interface PrescriptionPatientInfo {
  id?: string;
  name: string;
  age?: number;
  gender?: string;
  contactInfo?: string;
}

export interface PrescriptionDoctorInfo {
  id?: string;
  name?: string;
  specialization?: string;
  licenseNumber?: string;
  phone?: string;
  user?: {
    name?: string | null;
    email?: string | null;
  };
}

export interface PrescriptionFillInfo {
  id?: string;
  filledAt: string | Date;
  notes?: string | null;
  pharmacy?: {
    pharmacyName: string;
    phone?: string;
  } | null;
}

export interface PrescriptionData {
  id: string;
  doctorId?: string;
  patientId?: string;
  diagnosis?: string | null;
  documentRef?: string | null;
  status: 'PENDING' | 'FILLED' | 'CANNOT_FILL';
  createdAt: string | Date;
  updatedAt?: string | Date;
  patient?: PrescriptionPatientInfo | null;
  doctor?: PrescriptionDoctorInfo | null;
  prescriptionMedicines: PrescriptionMedicineItem[];
  fill?: PrescriptionFillInfo | null;
}

export type PrescriptionViewerRole = 'DOCTOR' | 'PHARMACY' | 'PATIENT' | 'ADMIN';

export interface PrescriptionDetailsProps {
  prescription: PrescriptionData;
  viewerRole?: PrescriptionViewerRole;
  onClose?: () => void;
  isModal?: boolean;
}

export function PrescriptionDetails({
  prescription,
  viewerRole = 'DOCTOR',
  onClose,
  isModal = false,
}: PrescriptionDetailsProps) {
  const canViewDiagnosis = viewerRole !== 'PHARMACY' && Boolean(prescription.diagnosis);

  const formatDate = (dateString?: string | Date | null) => {
    if (!dateString) {
      return '—';
    }

    try {
      const value = new Date(dateString);
      return value.toLocaleString('en-US', {
        month: 'short',
        day: 'numeric',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
      });
    } catch {
      return String(dateString);
    }
  };

  const getStatusBadge = (status: PrescriptionData['status']) => {
    switch (status) {
      case 'FILLED':
        return <Badge variant="success">Filled</Badge>;
      case 'CANNOT_FILL':
        return <Badge variant="destructive">Cannot Fill</Badge>;
      case 'PENDING':
      default:
        return <Badge variant="warning">Pending</Badge>;
    }
  };

  const doctorName =
    prescription.doctor?.name ||
    prescription.doctor?.user?.name ||
    (prescription.doctor?.user?.email ? prescription.doctor.user.email.split('@')[0] : 'Doctor');

  const documentReference = prescription.documentRef?.trim();
  const documentHref = documentReference
    ? documentReference.startsWith('http://') || documentReference.startsWith('https://')
      ? documentReference
      : undefined
    : undefined;

  const content = (
    <div className="space-y-6">
      <div className="border-b border-gray-100 pb-4">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div>
            <span className="text-xs font-semibold uppercase tracking-wider text-blue-600">
              Prescription Details
            </span>
            <h3 className="text-xl font-bold text-gray-900 font-mono">#{prescription.id}</h3>
          </div>
          <div className="flex items-center gap-2">{getStatusBadge(prescription.status)}</div>
        </div>
        <p className="mt-1 text-xs text-gray-500">Created: {formatDate(prescription.createdAt)}</p>
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <div className="rounded-lg bg-gray-50 p-3.5 border border-gray-100">
          <p className="text-xs font-medium text-gray-500 uppercase tracking-wider mb-1">
            Patient
          </p>
          <p className="text-sm font-bold text-gray-900">{prescription.patient?.name || 'Patient record'}</p>
          {(prescription.patient?.age || prescription.patient?.gender) && (
            <p className="text-xs text-gray-600">
              {[
                prescription.patient?.age ? `${prescription.patient.age} yrs` : null,
                prescription.patient?.gender,
              ]
                .filter(Boolean)
                .join(' • ')}
            </p>
          )}
        </div>

        <div className="rounded-lg bg-gray-50 p-3.5 border border-gray-100">
          <p className="text-xs font-medium text-gray-500 uppercase tracking-wider mb-1">
            Doctor
          </p>
          <p className="text-sm font-bold text-gray-900">{doctorName}</p>
          {prescription.doctor?.specialization && (
            <p className="text-xs text-gray-600">Specialization: {prescription.doctor.specialization}</p>
          )}
        </div>
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <div className="rounded-lg bg-gray-50 p-3.5 border border-gray-100">
          <p className="text-xs font-medium text-gray-500 uppercase tracking-wider mb-1">
            Created Timestamp
          </p>
          <p className="text-sm font-medium text-gray-900">{formatDate(prescription.createdAt)}</p>
        </div>
        <div className="rounded-lg bg-gray-50 p-3.5 border border-gray-100">
          <p className="text-xs font-medium text-gray-500 uppercase tracking-wider mb-1">
            Fulfillment Timestamp
          </p>
          <p className="text-sm font-medium text-gray-900">
            {prescription.fill?.filledAt ? formatDate(prescription.fill.filledAt) : 'Not yet fulfilled'}
          </p>
        </div>
      </div>

      {canViewDiagnosis && (
        <div className="rounded-lg bg-blue-50/60 p-3.5 border border-blue-100/80">
          <p className="text-xs font-semibold text-blue-900 uppercase tracking-wider mb-1">
            Diagnosis
          </p>
          <p className="text-sm text-blue-950 whitespace-pre-wrap font-medium">
            {prescription.diagnosis || 'No diagnosis recorded.'}
          </p>
        </div>
      )}

      <div>
        <h4 className="mb-3 text-sm font-bold text-gray-900 uppercase tracking-wider">
          Medicines ({prescription.prescriptionMedicines.length})
        </h4>
        <div className="space-y-2.5">
          {prescription.prescriptionMedicines.length === 0 ? (
            <p className="text-sm text-gray-500">No medicines recorded for this prescription.</p>
          ) : (
            prescription.prescriptionMedicines.map((item, idx) => (
              <div
                key={item.id || idx}
                className="rounded-lg border border-gray-200 bg-white p-3"
              >
                <div className="flex flex-wrap items-center gap-2">
                  <span className="text-sm font-bold text-gray-900">{item.medicine.name}</span>
                  {item.medicine.genericName && (
                    <span className="text-xs text-gray-500 italic">({item.medicine.genericName})</span>
                  )}
                </div>
                <p className="mt-1 text-xs text-gray-600">
                  <span className="font-semibold text-gray-700">Dosage:</span> {item.dosage} •{' '}
                  <span className="font-semibold text-gray-700">Frequency:</span> {item.frequency} •{' '}
                  <span className="font-semibold text-gray-700">Duration:</span> {item.duration}
                </p>
              </div>
            ))
          )}
        </div>
      </div>

      <div className="rounded-lg border border-dashed border-gray-300 bg-gray-50 p-3.5">
        <p className="text-xs font-semibold text-gray-600 uppercase tracking-wider mb-2">
          Prescription Document
        </p>
        {documentReference ? (
          documentHref ? (
            <a
              href={documentHref}
              target="_blank"
              rel="noreferrer"
              className="inline-flex text-sm font-medium text-blue-700 underline underline-offset-2"
            >
              {documentReference}
            </a>
          ) : (
            <p className="text-sm font-medium text-gray-900">{documentReference}</p>
          )
        ) : (
          <p className="text-sm text-gray-500">No document reference attached to this prescription.</p>
        )}
      </div>
    </div>
  );

  if (isModal) {
    return (
      <div className="fixed inset-0 z-50 overflow-y-auto bg-black/50 backdrop-blur-sm flex items-center justify-center p-4">
        <div className="bg-white rounded-xl shadow-2xl max-w-2xl w-full max-h-[90vh] overflow-y-auto border border-gray-200">
          <div className="sticky top-0 bg-white/95 backdrop-blur px-6 py-4 border-b border-gray-200 flex items-center justify-between z-10">
            <h2 className="text-lg font-bold text-gray-900">Prescription Overview</h2>
            {onClose && (
              <button
                onClick={onClose}
                className="text-gray-400 hover:text-gray-600 p-1.5 rounded-lg hover:bg-gray-100 transition-colors"
                aria-label="Close"
              >
                <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            )}
          </div>
          <div className="p-6">{content}</div>
          <div className="sticky bottom-0 bg-gray-50 px-6 py-3.5 border-t border-gray-200 flex justify-end">
            {onClose && (
              <Button variant="secondary" onClick={onClose}>
                Close
              </Button>
            )}
          </div>
        </div>
      </div>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Prescription Overview</CardTitle>
      </CardHeader>
      <CardContent>{content}</CardContent>
    </Card>
  );
}

