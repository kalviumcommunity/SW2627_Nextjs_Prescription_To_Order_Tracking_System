'use client';

import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/Card';

type Status = 'PENDING' | 'FILLED' | 'CANNOT_FILL';

interface HistoryItem {
  prescriptionId: string;
  patientName: string;
  doctorName: string;
  status: Status;
  createdAt: string;
  fulfilledAt: string | null;
}

interface HistoryData {
  pharmacy?: { pharmacyName?: string };
  history?: unknown;
}

function isStatus(value: unknown): value is Status {
  return value === 'PENDING' || value === 'FILLED' || value === 'CANNOT_FILL';
}

function normalizeHistory(value: unknown): HistoryItem[] {
  if (!Array.isArray(value)) return [];
  return value.flatMap((item) => {
    if (!item || typeof item !== 'object') return [];
    const record = item as Record<string, unknown>;
    if (typeof record.prescriptionId !== 'string' || !isStatus(record.status)) return [];
    return [{
      prescriptionId: record.prescriptionId,
      patientName: typeof record.patientName === 'string' ? record.patientName : 'Unknown patient',
      doctorName: typeof record.doctorName === 'string' ? record.doctorName : 'Unknown doctor',
      status: record.status,
      createdAt: typeof record.createdAt === 'string' ? record.createdAt : '',
      fulfilledAt: typeof record.fulfilledAt === 'string' ? record.fulfilledAt : null,
    }];
  });
}

function formatDate(value: string | null) {
  if (!value) return '—';
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? '—' : date.toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' });
}

function statusBadge(status: Status) {
  const labels = { PENDING: 'Pending', FILLED: 'Filled', CANNOT_FILL: 'Cannot fill' };
  const variants = { PENDING: 'warning', FILLED: 'success', CANNOT_FILL: 'destructive' } as const;
  return <Badge variant={variants[status]}>{labels[status]}</Badge>;
}

export default function PharmacyHistoryPage() {
  const [data, setData] = useState<HistoryData | null>(null);
  const [history, setHistory] = useState<HistoryItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const loadHistory = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const response = await fetch('/api/pharmacy/history', { cache: 'no-store' });
      const body = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(typeof body.error === 'string' ? body.error : `Unable to load history (HTTP ${response.status})`);
      setData(body);
      setHistory(normalizeHistory(body.history));
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : 'Unable to load pharmacy history.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { loadHistory(); }, [loadHistory]);

  if (loading && !data) {
    return <div className="space-y-6 animate-pulse" aria-label="Loading filled history"><div className="h-10 bg-gray-200 rounded w-1/3" /><div className="h-96 bg-gray-200 rounded-lg" /></div>;
  }

  if (error && !data) {
    return <div className="rounded-lg border border-red-200 bg-red-50 p-8 text-center space-y-3"><h2 className="text-lg font-semibold text-red-900">Unable to load filled history</h2><p className="text-sm text-red-700">{error}</p><Button onClick={loadHistory} size="sm">Try again</Button></div>;
  }

  return <div className="space-y-6">
    <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 border-b border-gray-200 pb-5">
      <div><h1 className="text-2xl font-bold text-gray-900">Filled History</h1><p className="text-sm text-gray-500 mt-1">{data?.pharmacy?.pharmacyName || 'Pharmacy'} prescription activity</p></div>
      <Button onClick={loadHistory} variant="secondary" size="sm" isLoading={loading}>Refresh</Button>
    </div>
    <Card>
      <CardHeader><CardTitle>Prescription history</CardTitle></CardHeader>
      <CardContent className="p-0">
        {history.length === 0 ? <div className="p-10 text-center"><h3 className="font-semibold text-gray-900">No prescription history yet</h3><p className="text-sm text-gray-500 mt-1">Fulfillment activity will appear here as prescriptions move through the pharmacy workflow.</p></div> : <div className="overflow-x-auto"><table className="w-full min-w-[700px] text-left text-sm"><thead className="bg-gray-50 text-xs uppercase text-gray-500"><tr><th className="px-6 py-3">Prescription</th><th className="px-6 py-3">Patient</th><th className="px-6 py-3">Doctor</th><th className="px-6 py-3">Created</th><th className="px-6 py-3">Fulfilled</th><th className="px-6 py-3">Status</th></tr></thead><tbody className="divide-y divide-gray-100">{history.map((item) => <tr key={item.prescriptionId} className="hover:bg-gray-50"><td className="px-6 py-4"><Link href={`/pharmacy/prescriptions/${item.prescriptionId}`} className="font-mono text-xs font-semibold text-blue-700 hover:underline">#{item.prescriptionId.slice(-8).toUpperCase()}</Link></td><td className="px-6 py-4 text-gray-700">{item.patientName}</td><td className="px-6 py-4 text-gray-700">{item.doctorName}</td><td className="px-6 py-4 text-gray-600">{formatDate(item.createdAt)}</td><td className="px-6 py-4 text-gray-600">{formatDate(item.fulfilledAt)}</td><td className="px-6 py-4">{statusBadge(item.status)}</td></tr>)}</tbody></table></div>}
      </CardContent>
    </Card>
  </div>;
}
