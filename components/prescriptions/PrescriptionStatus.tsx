import React from 'react';
import { Badge } from '@/components/ui/Badge';

type PrescriptionStatusValue = 'PENDING' | 'FILLED' | 'CANNOT_FILL';

export function PrescriptionStatus({ status }: { status: PrescriptionStatusValue }) {
  const presentation = {
    PENDING: { label: 'Pending', variant: 'warning' as const },
    FILLED: { label: 'Filled', variant: 'success' as const },
    CANNOT_FILL: { label: 'Cannot Fill', variant: 'destructive' as const },
  }[status];

  return <Badge variant={presentation.variant}>{presentation.label}</Badge>;
}
