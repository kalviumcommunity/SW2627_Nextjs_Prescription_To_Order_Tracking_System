import React from 'react';
import Link from 'next/link';
import { Button } from '@/components/ui/Button';
import { Card, CardContent } from '@/components/ui/Card';
import { PrescriptionData } from './PrescriptionDetails';
import { PrescriptionStatus } from './PrescriptionStatus';

interface PrescriptionCardProps {
  prescription: PrescriptionData;
  href?: string;
  onView?: () => void;
  showDiagnosis?: boolean;
}

export function PrescriptionCard({ prescription, href, onView, showDiagnosis = false }: PrescriptionCardProps) {
  const action = onView ? (
    <Button variant="secondary" size="sm" onClick={onView}>View details</Button>
  ) : href ? (
    <Link href={href}><Button variant="secondary" size="sm">View details</Button></Link>
  ) : null;

  return (
    <Card>
      <CardContent className="space-y-4 p-5">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <p className="font-mono text-xs font-bold text-gray-700">#{prescription.id.slice(-8).toUpperCase()}</p>
            <p className="mt-1 text-sm font-semibold text-gray-900">{prescription.patient?.name || 'Patient record'}</p>
          </div>
          <PrescriptionStatus status={prescription.status} />
        </div>
        {showDiagnosis && prescription.diagnosis && (
          <p className="line-clamp-2 text-sm text-gray-600">{prescription.diagnosis}</p>
        )}
        <div className="flex items-center justify-between gap-3 text-xs text-gray-500">
          <span>{prescription.prescriptionMedicines.length} {prescription.prescriptionMedicines.length === 1 ? 'medicine' : 'medicines'}</span>
          {action}
        </div>
      </CardContent>
    </Card>
  );
}
