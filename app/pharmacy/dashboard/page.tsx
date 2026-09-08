'use client';

import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/Card';

type Status = 'PENDING' | 'FILLED' | 'CANNOT_FILL';

interface ActivityItem {
  id: string;
  status: Status;
  createdAt: string;
  filledAt: string | null;
  doctor: { name: string };
  patient: { name: string };
  medicines: Array<{ medicine: { name: string } }>;
}

interface DashboardData {
  pharmacy: { pharmacyName: string; pharmacyType: string };
  metrics: {
    pendingPrescriptions: number;
    filledPrescriptions: number;
    todayFulfillmentCount: number;
    fulfillmentRate: number;
  };
  pendingCount: number;
  recentActivity: ActivityItem[];
}

function statusBadge(status: Status) {
  const labels = { PENDING: 'Pending', FILLED: 'Filled', CANNOT_FILL: 'Cannot fill' };
  const variants = { PENDING: 'warning', FILLED: 'success', CANNOT_FILL: 'destructive' } as const;
  return <Badge variant={variants[status]}>{labels[status]}</Badge>;
}

function formatDate(value: string) {
  return new Date(value).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' });
}

export default function PharmacyDashboardPage() {
  const [data, setData] = useState<DashboardData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const loadDashboard = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const response = await fetch('/api/pharmacy/dashboard', { cache: 'no-store' });
      if (!response.ok) {
        const body = await response.json().catch(() => ({}));
        throw new Error(body.error || `Unable to load dashboard (HTTP ${response.status})`);
      }
      setData(await response.json());
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : 'Unable to load pharmacy dashboard.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { loadDashboard(); }, [loadDashboard]);

  if (loading && !data) {
    return <div className="space-y-6 animate-pulse" aria-label="Loading pharmacy dashboard">
      <div className="h-10 bg-gray-200 rounded w-1/3" />
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">{[1, 2, 3, 4].map((item) => <div key={item} className="h-32 bg-gray-200 rounded-lg" />)}</div>
      <div className="h-72 bg-gray-200 rounded-lg" />
    </div>;
  }

  if (error && !data) {
    return <div className="rounded-lg border border-red-200 bg-red-50 p-8 text-center space-y-3">
      <h2 className="text-lg font-semibold text-red-900">Unable to load pharmacy dashboard</h2>
      <p className="text-sm text-red-700">{error}</p>
      <Button onClick={loadDashboard} variant="primary" size="sm">Try again</Button>
    </div>;
  }

  if (!data) return null;
  const cards = [
    ['Pending prescriptions', data.metrics.pendingPrescriptions, 'Awaiting processing', 'border-l-amber-500'],
    ['Filled prescriptions', data.metrics.filledPrescriptions, 'Successfully fulfilled', 'border-l-emerald-500'],
    ["Today's fulfillment", data.metrics.todayFulfillmentCount, 'Filled today', 'border-l-blue-500'],
    ['Fulfillment rate', `${data.metrics.fulfillmentRate}%`, 'Across all prescriptions', 'border-l-violet-500'],
  ];

  return <div className="space-y-6">
    <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 border-b border-gray-200 pb-5">
      <div><h1 className="text-2xl font-bold text-gray-900">Pharmacy Dashboard</h1><p className="text-sm text-gray-500 mt-1">{data.pharmacy.pharmacyName} · {data.pharmacy.pharmacyType}</p></div>
      <div className="flex gap-3"><Button onClick={loadDashboard} variant="secondary" size="sm" isLoading={loading}>Refresh</Button><Link href="/pharmacy/prescriptions?status=PENDING"><Button variant="primary" size="sm">View pending ({data.pendingCount})</Button></Link></div>
    </div>

    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">{cards.map(([label, value, caption, color]) => <Card key={label} className={`border-l-4 ${color}`}><CardContent className="p-5"><p className="text-xs font-semibold uppercase tracking-wider text-gray-500">{label}</p><p className="text-3xl font-extrabold text-gray-900 mt-2">{value}</p><p className="text-xs text-gray-500 mt-1">{caption}</p></CardContent></Card>)}</div>

    <Card>
      <CardHeader className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2"><div><CardTitle>Recent activity</CardTitle><p className="text-xs text-gray-500 mt-1">Latest prescription activity across the pharmacy</p></div><Link href="/pharmacy/prescriptions" className="text-sm font-semibold text-blue-700 hover:text-blue-900">View queue</Link></CardHeader>
      <CardContent className="p-0">
        {data.recentActivity.length === 0 ? <div className="p-10 text-center"><h3 className="font-semibold text-gray-900">No prescription activity yet</h3><p className="text-sm text-gray-500 mt-1">New prescriptions will appear here.</p></div> : <div className="overflow-x-auto"><table className="w-full text-left text-sm"><thead className="bg-gray-50 text-xs uppercase text-gray-500"><tr><th className="px-6 py-3">Prescription</th><th className="px-6 py-3">Doctor</th><th className="px-6 py-3">Patient</th><th className="px-6 py-3">Date</th><th className="px-6 py-3">Status</th></tr></thead><tbody className="divide-y divide-gray-100">{data.recentActivity.map((item) => <tr key={item.id} className="hover:bg-gray-50"><td className="px-6 py-4"><Link href={`/pharmacy/prescriptions/${item.id}`} className="font-mono text-xs font-semibold text-blue-700 hover:underline">#{item.id.slice(-8).toUpperCase()}</Link><p className="text-xs text-gray-500 mt-1">{item.medicines.map((medicine) => medicine.medicine.name).join(', ')}</p></td><td className="px-6 py-4 text-gray-700">{item.doctor.name}</td><td className="px-6 py-4 text-gray-700">{item.patient.name}</td><td className="px-6 py-4 text-gray-600">{formatDate(item.createdAt)}</td><td className="px-6 py-4">{statusBadge(item.status)}</td></tr>)}</tbody></table></div>}
      </CardContent>
    </Card>
  </div>;
}
