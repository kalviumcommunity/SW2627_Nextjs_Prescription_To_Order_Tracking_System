<<<<<<< HEAD
export default function PharmacyAnalyticsPage() {
  return (
    <div>
      <h2 className="text-2xl font-bold text-gray-900 mb-2">Analytics</h2>
      <p className="text-gray-600">Pharmacy performance analytics and dispensing insights. Features will be available in upcoming releases.</p>
    </div>
  );
=======
'use client';

import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/Card';

type Status = 'PENDING' | 'FILLED' | 'CANNOT_FILL';
interface Trend { date?: string; week?: string; count?: number }
interface AnalyticsData { pharmacy?: { pharmacyName?: string }; summary?: Record<string, unknown>; trends?: { dailySuccessfulFulfillment?: unknown; weeklySuccessfulFulfillment?: unknown }; medicines?: unknown; statusBreakdown?: Record<string, unknown>; recentActivity?: unknown }
interface MedicineItem { name: string; genericName: string; processedCount: number }
interface ActivityItem { id: string; status: Status; createdAt: string; doctor: { name: string }; patient: { name: string } }

const numberValue = (value: unknown) => typeof value === 'number' && Number.isFinite(value) ? value : 0;
const arrayValue = (value: unknown) => Array.isArray(value) ? value : [];
const formatDate = (value: unknown) => { const date = new Date(typeof value === 'string' ? value : ''); return Number.isNaN(date.getTime()) ? '—' : date.toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' }); };
const statusLabel = (status: Status) => status === 'CANNOT_FILL' ? 'Cannot fill' : status.charAt(0) + status.slice(1).toLowerCase();
const statusVariant = (status: Status) => ({ PENDING: 'warning', FILLED: 'success', CANNOT_FILL: 'destructive' } as const)[status];

function normalizeMedicines(value: unknown): MedicineItem[] {
  return arrayValue(value).flatMap((entry) => {
    if (!entry || typeof entry !== 'object') return [];
    const record = entry as Record<string, unknown>;
    const medicine = record.medicine && typeof record.medicine === 'object' ? record.medicine as Record<string, unknown> : {};
    if (typeof medicine.name !== 'string') return [];
    return [{ name: medicine.name, genericName: typeof medicine.genericName === 'string' ? medicine.genericName : '', processedCount: numberValue(record.processedCount) }];
  });
}

function normalizeActivity(value: unknown): ActivityItem[] {
  return arrayValue(value).flatMap((entry) => {
    if (!entry || typeof entry !== 'object') return [];
    const record = entry as Record<string, unknown>;
    const patient = record.patient && typeof record.patient === 'object' ? record.patient as Record<string, unknown> : {};
    const doctor = record.doctor && typeof record.doctor === 'object' ? record.doctor as Record<string, unknown> : {};
    if (typeof record.id !== 'string' || !['PENDING', 'FILLED', 'CANNOT_FILL'].includes(String(record.status))) return [];
    return [{ id: record.id, status: record.status as Status, createdAt: typeof record.createdAt === 'string' ? record.createdAt : '', patient: { name: typeof patient.name === 'string' ? patient.name : 'Unknown patient' }, doctor: { name: typeof doctor.name === 'string' ? doctor.name : 'Unknown doctor' } }];
  });
}

function TrendList({ items, kind }: { items: unknown; kind: 'daily' | 'weekly' }) {
  const trends = arrayValue(items).flatMap((item) => item && typeof item === 'object' ? [item as Trend] : []);
  const max = Math.max(...trends.map((item) => numberValue(item.count)), 1);
  if (trends.length === 0) return <p className="text-sm text-gray-500">No successful fulfillment data yet.</p>;
  return <div className="space-y-3">{trends.map((item, index) => { const count = numberValue(item.count); return <div key={`${item.date || item.week || index}`}><div className="flex justify-between text-xs text-gray-600"><span>{formatDate(kind === 'daily' ? item.date : item.week)}</span><strong>{count}</strong></div><div className="mt-1 h-2 rounded-full bg-gray-100"><div className="h-2 rounded-full bg-blue-600" style={{ width: `${(count / max) * 100}%` }} /></div></div>; })}</div>;
}

export default function PharmacyAnalyticsPage() {
  const [data, setData] = useState<AnalyticsData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const loadAnalytics = useCallback(async () => { setLoading(true); setError(null); try { const response = await fetch('/api/pharmacy/analytics', { cache: 'no-store' }); const body = await response.json().catch(() => ({})); if (!response.ok) throw new Error(typeof body.error === 'string' ? body.error : `Unable to load analytics (HTTP ${response.status})`); setData(body); } catch (reason) { setError(reason instanceof Error ? reason.message : 'Unable to load pharmacy analytics.'); } finally { setLoading(false); } }, []);
  useEffect(() => { loadAnalytics(); }, [loadAnalytics]);

  if (loading && !data) return <div className="space-y-6 animate-pulse" aria-label="Loading pharmacy analytics"><div className="h-10 bg-gray-200 rounded w-1/3" /><div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4">{[1, 2, 3, 4, 5].map((item) => <div key={item} className="h-28 bg-gray-200 rounded-lg" />)}</div><div className="h-72 bg-gray-200 rounded-lg" /></div>;
  if (error && !data) return <div className="rounded-lg border border-red-200 bg-red-50 p-8 text-center space-y-3"><h2 className="text-lg font-semibold text-red-900">Unable to load pharmacy analytics</h2><p className="text-sm text-red-700">{error}</p><Button onClick={loadAnalytics} size="sm">Try again</Button></div>;
  if (!data) return null;

  const summary = data.summary || {};
  const total = numberValue(summary.totalPrescriptionsReceived);
  const cards = [['Total received', total, 'border-l-blue-500'], ['Pending', numberValue(summary.pendingPrescriptions), 'border-l-amber-500'], ['Filled', numberValue(summary.filledPrescriptions), 'border-l-emerald-500'], ['Cannot fill', numberValue(summary.cannotFillPrescriptions), 'border-l-rose-500'], ['Fulfillment rate', `${numberValue(summary.fulfillmentRate)}%`, 'border-l-violet-500']] as const;
  const medicines = normalizeMedicines(data.medicines);
  const activity = normalizeActivity(data.recentActivity);
  const breakdown = [['PENDING', numberValue(data.statusBreakdown?.pending)], ['FILLED', numberValue(data.statusBreakdown?.filled)], ['CANNOT_FILL', numberValue(data.statusBreakdown?.cannot_fill)]] as const;

  return <div className="space-y-8">
    <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 border-b border-gray-200 pb-5"><div><h1 className="text-2xl sm:text-3xl font-bold text-gray-900">Pharmacy Analytics</h1><p className="text-sm text-gray-500 mt-1">Live fulfillment performance for {data.pharmacy?.pharmacyName || 'this pharmacy'}</p></div><Button onClick={loadAnalytics} variant="secondary" size="sm" isLoading={loading}>Refresh</Button></div>
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4">{cards.map(([label, value, color]) => <Card key={label} className={`border-l-4 ${color}`}><CardContent className="p-5"><p className="text-xs font-semibold uppercase tracking-wider text-gray-500">{label}</p><p className="text-3xl font-extrabold text-gray-900 mt-2">{value}</p></CardContent></Card>)}</div>
    {total === 0 && <Card className="p-8 text-center border-dashed border-2 border-gray-300"><h2 className="text-lg font-bold text-gray-900">No analytics data yet</h2><p className="text-sm text-gray-500 mt-1">Fulfillment metrics will appear when prescriptions enter the pharmacy workflow.</p></Card>}
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-6"><Card className="lg:col-span-2"><CardHeader><CardTitle>Fulfillment trends</CardTitle></CardHeader><CardContent className="grid grid-cols-1 md:grid-cols-2 gap-8"><div><h3 className="text-sm font-semibold text-gray-900 mb-4">Daily successful fulfillment</h3><TrendList items={data.trends?.dailySuccessfulFulfillment} kind="daily" /></div><div><h3 className="text-sm font-semibold text-gray-900 mb-4">Weekly successful fulfillment</h3><TrendList items={data.trends?.weeklySuccessfulFulfillment} kind="weekly" /></div></CardContent></Card><Card><CardHeader><CardTitle>Status breakdown</CardTitle></CardHeader><CardContent className="space-y-4">{breakdown.map(([status, count]) => <div key={status} className="flex items-center justify-between"><span className="text-sm text-gray-700">{statusLabel(status)}</span><Badge variant={statusVariant(status)}>{count}</Badge></div>)}</CardContent></Card></div>
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6"><Card><CardHeader><CardTitle>Most processed medicines</CardTitle></CardHeader><CardContent className="p-0">{medicines.length === 0 ? <p className="p-6 text-sm text-gray-500">No medicine activity yet.</p> : <div className="divide-y divide-gray-100">{medicines.map((item, index) => <div key={`${item.name}-${index}`} className="flex items-center justify-between gap-4 p-4"><div><p className="text-sm font-semibold text-gray-900">{item.name}</p><p className="text-xs text-gray-500">{item.genericName || 'Catalog medicine'}</p></div><span className="text-sm font-bold text-gray-700">{item.processedCount}</span></div>)}</div>}</CardContent></Card><Card><CardHeader><CardTitle>Recent activity</CardTitle></CardHeader><CardContent className="p-0">{activity.length === 0 ? <p className="p-6 text-sm text-gray-500">No recent activity yet.</p> : <div className="divide-y divide-gray-100">{activity.map((item) => <Link href={`/pharmacy/prescriptions/${item.id}`} key={item.id} className="flex items-center justify-between gap-4 p-4 hover:bg-gray-50"><div><p className="text-sm font-semibold text-gray-900">{item.patient.name}</p><p className="text-xs text-gray-500">{item.doctor.name} · {formatDate(item.createdAt)}</p></div><Badge variant={statusVariant(item.status)}>{statusLabel(item.status)}</Badge></Link>)}</div>}</CardContent></Card></div>
  </div>;
>>>>>>> 8cb84a5d07c7faeeded506a6b2a4cb078bb615a2
}
