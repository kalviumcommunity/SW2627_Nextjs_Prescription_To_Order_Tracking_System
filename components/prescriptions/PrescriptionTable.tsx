import React from 'react';
import Link from 'next/link';
import { Button } from '@/components/ui/Button';
import { PrescriptionData, PrescriptionViewerRole } from './PrescriptionDetails';
import { PrescriptionStatus } from './PrescriptionStatus';

export interface PrescriptionTableProps {
  prescriptions: PrescriptionData[];
  viewerRole?: PrescriptionViewerRole;
  hrefFor?: (prescription: PrescriptionData) => string;
  onView?: (prescription: PrescriptionData) => void;
  className?: string;
}

export function PrescriptionTable({
  prescriptions,
  viewerRole = 'DOCTOR',
  hrefFor,
  onView,
  className = '',
}: PrescriptionTableProps) {
  // Respect role-based visibility: Diagnosis must NEVER appear for PHARMACY viewer
  const showDiagnosis = viewerRole !== 'PHARMACY';

  return (
    <div className={`overflow-x-auto ${className}`}>
      <table className="w-full min-w-[640px] text-left text-sm text-gray-600">
        <thead className="border-b border-gray-200 bg-gray-50 text-xs uppercase text-gray-500">
          <tr>
            <th scope="col" className="px-6 py-3 font-semibold">
              Prescription ID
            </th>
            <th scope="col" className="px-6 py-3 font-semibold">
              Patient
            </th>
            {showDiagnosis && (
              <th scope="col" className="px-6 py-3 font-semibold">
                Diagnosis
              </th>
            )}
            <th scope="col" className="px-6 py-3 font-semibold">
              Medicines
            </th>
            <th scope="col" className="px-6 py-3 font-semibold">
              Status
            </th>
            <th scope="col" className="px-6 py-3 text-right font-semibold">
              Action
            </th>
          </tr>
        </thead>
        <tbody className="divide-y divide-gray-100">
          {prescriptions.map((prescription) => {
            const medicines =
              prescription.prescriptionMedicines || prescription.medicines || [];

            return (
              <tr key={prescription.id} className="hover:bg-gray-50/80 transition-colors">
                <td className="px-6 py-4 font-mono text-xs font-bold text-gray-900">
                  #{prescription.id.slice(-8).toUpperCase()}
                </td>
                <td className="px-6 py-4 font-semibold text-gray-900">
                  {prescription.patient?.name || 'Patient record'}
                </td>
                {showDiagnosis && (
                  <td className="max-w-[220px] truncate px-6 py-4 text-gray-700">
                    {prescription.diagnosis || '—'}
                  </td>
                )}
                <td className="px-6 py-4 text-xs text-gray-500">
                  {medicines.length === 0 ? (
                    <span className="text-gray-400">None</span>
                  ) : (
                    <>
                      {medicines
                        .map((m) => m.medicine?.name)
                        .filter(Boolean)
                        .slice(0, 2)
                        .join(', ')}
                      {medicines.length > 2 ? ` +${medicines.length - 2} more` : ''}
                    </>
                  )}
                </td>
                <td className="px-6 py-4">
                  <PrescriptionStatus status={prescription.status} />
                </td>
                <td className="px-6 py-4 text-right">
                  {onView ? (
                    <Button
                      variant="secondary"
                      size="sm"
                      onClick={() => onView(prescription)}
                    >
                      View
                    </Button>
                  ) : hrefFor ? (
                    <Link href={hrefFor(prescription)}>
                      <Button variant="secondary" size="sm">
                        View details
                      </Button>
                    </Link>
                  ) : null}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
