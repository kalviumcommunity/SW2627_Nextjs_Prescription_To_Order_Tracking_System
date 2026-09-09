import React from 'react';
import { Badge, BadgeVariant } from '@/components/ui/Badge';

export type PrescriptionStatusType = 'PENDING' | 'FILLED' | 'CANNOT_FILL' | string;

export interface PrescriptionStatusProps {
  status: PrescriptionStatusType;
  className?: string;
}

export const STATUS_CONFIG: Record<string, { label: string; variant: BadgeVariant }> = {
  PENDING: { label: 'Pending', variant: 'warning' },
  FILLED: { label: 'Filled', variant: 'success' },
  CANNOT_FILL: { label: 'Cannot Fill', variant: 'destructive' },
};

export function PrescriptionStatus({ status, className = '' }: PrescriptionStatusProps) {
  const normalized = (status || '').toUpperCase();
  const config = STATUS_CONFIG[normalized] || {
    label: status || 'Unknown',
    variant: 'default' as BadgeVariant,
  };

  return (
    <Badge variant={config.variant} className={className}>
      {config.label}
    </Badge>
  );
}
