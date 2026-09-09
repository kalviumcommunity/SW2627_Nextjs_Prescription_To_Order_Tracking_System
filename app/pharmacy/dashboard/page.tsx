'use client';

import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { Button } from '@/components/ui/Button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/Card';
import { LoadingState } from '@/components/ui/LoadingState';
import { EmptyState } from '@/components/ui/EmptyState';
import { ErrorState } from '@/components/ui/ErrorState';
import { PrescriptionStatus } from '@/components/prescriptions/PrescriptionStatus';

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
    return (
      <div className="py-8">
        <LoadingState message="Loading pharmacy dashboard..." />
      </div>
    );
  }

  if (error && !data) {
    return (
      <ErrorState
        title="Unable to load pharmacy dashboard"
        message={error}
        onRetry={loadDashboard}
      />
    );
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
        {data.recentActivity.length === 0 ? (
          <div className="p-6">
            <EmptyState
              title="No prescription activity yet"
              description="New prescriptions will appear here."
            />
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead className="bg-gray-50 text-xs uppercase text-gray-500">
                <tr>
                  <th className="px-6 py-3">Prescription</th>
                  <th className="px-6 py-3">Doctor</th>
                  <th className="px-6 py-3">Patient</th>
                  <th className="px-6 py-3">Date</th>
                  <th className="px-6 py-3">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {data.recentActivity.map((item) => (
                  <tr key={item.id} className="hover:bg-gray-50">
                    <td className="px-6 py-4">
                      <Link href={`/pharmacy/prescriptions/${item.id}`} className="font-mono text-xs font-semibold text-blue-700 hover:underline">
                        #{item.id.slice(-8).toUpperCase()}
                      </Link>
                      <p className="text-xs text-gray-500 mt-1">{item.medicines.map((medicine) => medicine.medicine.name).join(', ')}</p>
                    </td>
                    <td className="px-6 py-4 text-gray-700">{item.doctor.name}</td>
                    <td className="px-6 py-4 text-gray-700">{item.patient.name}</td>
                    <td className="px-6 py-4 text-gray-600">{formatDate(item.createdAt)}</td>
                    <td className="px-6 py-4"><PrescriptionStatus status={item.status} /></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </CardContent>
    </Card>
  </div>;
}
