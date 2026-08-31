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
  // Pharmacy must NOT see diagnosis per PRD privacy requirements
  const canViewDiagnosis = viewerRole !== 'PHARMACY' && Boolean(prescription.diagnosis);

  const formatDate = (dateString?: string | Date | null) => {
    if (!dateString) return '—';
    try {
      const d = new Date(dateString);
      return d.toLocaleDateString('en-US', {
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
        return <Badge variant="success">FILLED</Badge>;
      case 'CANNOT_FILL':
        return <Badge variant="destructive">CANNOT FILL</Badge>;
      case 'PENDING':
      default:
        return <Badge variant="warning">PENDING</Badge>;
    }
  };

  const content = (
    <div className="space-y-6">
      {/* Header Info */}
      <div className="border-b border-gray-100 pb-4">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div>
            <span className="text-xs font-semibold uppercase tracking-wider text-blue-600">
              Prescription Order
            </span>
            <h3 className="text-xl font-bold text-gray-900 font-mono">
              #{prescription.id}
            </h3>
          </div>
          <div className="flex items-center gap-2">
            {getStatusBadge(prescription.status)}
          </div>
        </div>
        <p className="mt-1 text-xs text-gray-500">
          Authored on {formatDate(prescription.createdAt)}
        </p>
      </div>

      {/* Patient & Clinician Details */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <div className="rounded-lg bg-gray-50 p-3.5 border border-gray-100">
          <p className="text-xs font-medium text-gray-500 uppercase tracking-wider mb-1">
            Patient Information
          </p>
          <p className="text-sm font-bold text-gray-900">
            {prescription.patient?.name || 'Patient Record'}
          </p>
          {(prescription.patient?.age || prescription.patient?.gender) && (
            <p className="text-xs text-gray-600">
              {[
                prescription.patient.age ? `${prescription.patient.age} yrs` : null,
                prescription.patient.gender,
              ]
                .filter(Boolean)
                .join(' • ')}
            </p>
          )}
          {prescription.patient?.contactInfo && (
            <p className="text-xs text-gray-500 mt-1">
              Contact: {prescription.patient.contactInfo}
            </p>
          )}
        </div>

        <div className="rounded-lg bg-gray-50 p-3.5 border border-gray-100">
          <p className="text-xs font-medium text-gray-500 uppercase tracking-wider mb-1">
            Authoring Clinician
          </p>
          <p className="text-sm font-bold text-gray-900">
            {prescription.doctor?.user?.name || (viewerRole === 'DOCTOR' ? 'Dr. Sarah (You)' : 'Attending Physician')}
          </p>
          {prescription.doctor?.specialization && (
            <p className="text-xs text-gray-600">
              Specialization: {prescription.doctor.specialization}
            </p>
          )}
          {prescription.doctor?.licenseNumber && (
            <p className="text-xs text-gray-500 mt-1 font-mono">
              License: {prescription.doctor.licenseNumber}
            </p>
          )}
        </div>
      </div>

      {/* Clinical Diagnosis (Strictly redacted for Pharmacy) */}
      {canViewDiagnosis && (
        <div className="rounded-lg bg-blue-50/60 p-3.5 border border-blue-100/80">
          <p className="text-xs font-semibold text-blue-900 uppercase tracking-wider mb-1">
            Clinical Diagnosis
          </p>
          <p className="text-sm text-blue-950 whitespace-pre-wrap font-medium">
            {prescription.diagnosis}
          </p>
        </div>
      )}

      {/* Itemized Medications */}
      <div>
        <div className="flex items-center justify-between mb-3">
          <h4 className="text-sm font-bold text-gray-900 uppercase tracking-wider">
            Prescribed Medications ({prescription.prescriptionMedicines.length})
          </h4>
        </div>
        <div className="space-y-2.5">
          {prescription.prescriptionMedicines.map((item, idx) => (
            <div
              key={item.id || idx}
              className="flex flex-col sm:flex-row sm:items-center justify-between p-3 rounded-lg border border-gray-200 bg-white hover:border-gray-300 transition-colors gap-2"
            >
              <div>
                <div className="flex items-center gap-2">
                  <span className="text-sm font-bold text-gray-900">
                    {item.medicine.name}
                  </span>
                  {item.medicine.genericName && (
                    <span className="text-xs text-gray-500 italic">
                      ({item.medicine.genericName})
                    </span>
                  )}
                  {item.medicine.stockStatus !== undefined && (
                    <Badge variant={item.medicine.stockStatus ? 'success' : 'destructive'}>
                      {item.medicine.stockStatus ? 'In Stock' : 'Out of Stock'}
                    </Badge>
                  )}
                </div>
                <p className="text-xs text-gray-600 mt-0.5">
                  <span className="font-semibold text-gray-700">Dosage:</span> {item.dosage} •{' '}
                  <span className="font-semibold text-gray-700">Frequency:</span> {item.frequency} •{' '}
                  <span className="font-semibold text-gray-700">Duration:</span> {item.duration}
                </p>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Fulfillment Status & Notes */}
      {prescription.fill ? (
        <div className="rounded-lg bg-emerald-50/70 p-3.5 border border-emerald-100">
          <div className="flex items-center justify-between">
            <p className="text-xs font-semibold text-emerald-900 uppercase tracking-wider">
              Dispensing & Fulfillment Record
            </p>
            <Badge variant="success">Dispensed</Badge>
          </div>
          <p className="text-xs text-emerald-800 mt-1">
            Dispensed on: {formatDate(prescription.fill.filledAt)}
          </p>
          {prescription.fill.pharmacy && (
            <p className="text-xs text-emerald-800 mt-0.5">
              Dispensing Pharmacy: {prescription.fill.pharmacy.pharmacyName}
              {prescription.fill.pharmacy.phone && ` (${prescription.fill.pharmacy.phone})`}
            </p>
          )}
          {prescription.fill.notes && (
            <p className="text-xs text-emerald-900 mt-2 p-2 bg-white/80 rounded border border-emerald-200/50">
              <span className="font-semibold">Pharmacist Notes:</span> {prescription.fill.notes}
            </p>
          )}
        </div>
      ) : (
        <div className="rounded-lg bg-amber-50/60 p-3 border border-amber-100 flex items-center justify-between text-xs text-amber-800">
          <span>Awaiting pharmacy dispensing and fulfillment review.</span>
          <Badge variant="warning">Pending Queue</Badge>
        </div>
      )}
    </div>
  );

  if (isModal) {
    return (
      <div className="fixed inset-0 z-50 overflow-y-auto bg-black/50 backdrop-blur-sm flex items-center justify-center p-4">
        <div className="bg-white rounded-xl shadow-2xl max-w-2xl w-full max-h-[90vh] overflow-y-auto border border-gray-200">
          <div className="sticky top-0 bg-white/95 backdrop-blur px-6 py-4 border-b border-gray-200 flex items-center justify-between z-10">
            <h2 className="text-lg font-bold text-gray-900">
              Prescription Order Overview
            </h2>
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
        <CardTitle>Prescription Order Overview</CardTitle>
      </CardHeader>
      <CardContent>{content}</CardContent>
    </Card>
  );
}
