'use client';

import React, { useEffect, useState, useCallback } from 'react';
import Link from 'next/link';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/Card';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';

interface AnalyticsData {
  doctor: {
    id: string;
    specialization: string;
    licenseNumber: string;
    phone: string;
  };
  summary: {
    totalPrescriptions: number;
    filledPrescriptions: number;
    pendingPrescriptions: number;
    cannotFillPrescriptions: number;
    overallFillRate: number;
  };
  statusBreakdown: Array<{
    status: 'FILLED' | 'PENDING' | 'CANNOT_FILL';
    count: number;
    percentage: number;
  }>;
  medicineFillRates: Array<{
    medicineId: string;
    name: string;
    genericName: string;
    stockStatus: boolean;
    prescribed: number;
    filled: number;
    pending: number;
    cannotFill: number;
    fillRate: number;
  }>;
  topMedicines: Array<{
    medicineId: string;
    name: string;
    genericName: string;
    stockStatus: boolean;
    prescriptionsCount: number;
    percentageOfTotal: number;
    fillRate: number;
  }>;
  trend: Array<{
    period: string;
    label: string;
    total: number;
    filled: number;
    pending: number;
    cannotFill: number;
    fillRate: number;
  }>;
}

function getFillRatePresentation(fillRate: number) {
  if (fillRate === 0) {
    return { text: 'text-rose-600', bar: 'bg-rose-500', label: 'No fills', variant: 'destructive' as const };
  }

  if (fillRate === 100) {
    return { text: 'text-emerald-600', bar: 'bg-emerald-500', label: 'Fully filled', variant: 'success' as const };
  }

  return { text: 'text-amber-600', bar: 'bg-amber-500', label: 'Partial', variant: 'warning' as const };
}

export default function DoctorAnalyticsPage() {
  const [data, setData] = useState<AnalyticsData | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  const fetchAnalytics = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      const res = await fetch('/api/doctor/analytics', { cache: 'no-store' });
      if (!res.ok) {
        const errJson = await res.json().catch(() => ({}));
        throw new Error(errJson.error || `Failed to fetch analytics (HTTP ${res.status})`);
      }
      const json: AnalyticsData = await res.json();
      setData(json);
    } catch (err: unknown) {
      console.error('Error loading doctor analytics:', err);
      setError(err instanceof Error ? err.message : 'Failed to load clinical analytics.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchAnalytics();
  }, [fetchAnalytics]);

  if (loading) {
    return (
      <div className="space-y-6 animate-pulse p-4 sm:p-6 max-w-7xl mx-auto">
        <div className="h-8 bg-gray-200 rounded w-1/3 mb-2" />
        <div className="h-4 bg-gray-200 rounded w-1/2 mb-6" />
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {[1, 2, 3, 4].map((i) => (
            <div key={i} className="h-28 bg-gray-200 rounded-xl" />
          ))}
        </div>
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="lg:col-span-2 h-72 bg-gray-200 rounded-xl" />
          <div className="h-72 bg-gray-200 rounded-xl" />
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="max-w-2xl mx-auto mt-12 p-6 bg-red-50 border border-red-200 rounded-xl text-center space-y-4">
        <div className="inline-flex p-3 rounded-full bg-red-100 text-red-600">
          <svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
          </svg>
        </div>
        <h3 className="text-lg font-bold text-red-900">Clinical Analytics Unavailable</h3>
        <p className="text-sm text-red-700">{error}</p>
        <Button onClick={fetchAnalytics} variant="primary" size="md">
          Retry Loading
        </Button>
      </div>
    );
  }

  if (!data) return null;

  const {
    summary,
    statusBreakdown = [],
    medicineFillRates = [],
    topMedicines = [],
    trend = [],
    doctor,
  } = data;
  const hasPrescriptions = summary.totalPrescriptions > 0;

  return (
    <div className="space-y-8 p-4 sm:p-6 max-w-7xl mx-auto">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 border-b border-gray-200 pb-5">
        <div>
          <h1 className="text-2xl sm:text-3xl font-bold text-gray-900 tracking-tight">
            Prescription & Fulfillment Analytics
          </h1>
          <p className="text-sm text-gray-500 mt-1">
            Clinical practice metrics and fulfillment monitoring for {doctor.specialization} &bull; License {doctor.licenseNumber}
          </p>
        </div>
        <div className="flex items-center gap-3">
          <Button onClick={fetchAnalytics} variant="secondary" size="sm">
            Refresh Data
          </Button>
          <Link href="/doctor/prescriptions/new">
            <Button variant="primary" size="sm">
              + New Prescription
            </Button>
          </Link>
        </div>
      </div>

      {/* KPI Summary Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <Card className="border-l-4 border-l-blue-500 shadow-sm">
          <CardContent className="p-5">
            <div className="text-xs font-semibold uppercase tracking-wider text-gray-500">
              Total Authored
            </div>
            <div className="text-3xl font-extrabold text-gray-900 mt-2">
              {summary.totalPrescriptions}
            </div>
            <div className="text-xs text-gray-500 mt-1">All clinical orders</div>
          </CardContent>
        </Card>

        <Card className="border-l-4 border-l-emerald-500 shadow-sm">
          <CardContent className="p-5">
            <div className="text-xs font-semibold uppercase tracking-wider text-gray-500">
              Fill Rate
            </div>
            <div className="text-3xl font-extrabold text-emerald-600 mt-2">
              {summary.overallFillRate}%
            </div>
            <Badge variant={getFillRatePresentation(summary.overallFillRate).variant}>
              {getFillRatePresentation(summary.overallFillRate).label}
            </Badge>
          </CardContent>
        </Card>

        <Card className="border-l-4 border-l-green-500 shadow-sm">
          <CardContent className="p-5">
            <div className="text-xs font-semibold uppercase tracking-wider text-gray-500">
              Filled Orders
            </div>
            <div className="text-3xl font-extrabold text-green-700 mt-2">
              {summary.filledPrescriptions}
            </div>
            <div className="text-xs text-gray-500 mt-1">Dispensed by pharmacy</div>
          </CardContent>
        </Card>

        <Card className="border-l-4 border-l-amber-500 shadow-sm">
          <CardContent className="p-5">
            <div className="text-xs font-semibold uppercase tracking-wider text-gray-500">
              Pending Orders
            </div>
            <div className="text-3xl font-extrabold text-amber-600 mt-2">
              {summary.pendingPrescriptions}
            </div>
            <div className="text-xs text-gray-500 mt-1">Awaiting fulfillment</div>
          </CardContent>
        </Card>

      </div>

      {!hasPrescriptions ? (
        /* Empty State */
        <Card className="p-12 text-center border-dashed border-2 border-gray-300">
          <div className="max-w-md mx-auto space-y-4">
            <div className="p-3 bg-blue-50 text-blue-600 rounded-full inline-flex">
              <svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
              </svg>
            </div>
            <h3 className="text-lg font-bold text-gray-900">No Analytics Data Yet</h3>
            <p className="text-sm text-gray-500">
              You haven&apos;t written any prescriptions yet. Create your first prescription to start tracking fulfillment metrics and medicine performance.
            </p>
            <Link href="/doctor/prescriptions/new">
              <Button variant="primary" size="md">
                Create First Prescription
              </Button>
            </Link>
          </div>
        </Card>
      ) : (
        <>
          {/* Top Row: Most Prescribed & Status Breakdown */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            {/* Top Prescribed Medicines */}
            <Card className="lg:col-span-2 shadow-sm">
              <CardHeader className="border-b border-gray-100 pb-4">
                <CardTitle className="text-lg font-bold text-gray-900 flex items-center justify-between">
                  <span>Most Frequently Prescribed Medicines</span>
                  <span className="text-xs font-normal text-gray-500">Top 5 by order volume</span>
                </CardTitle>
              </CardHeader>
              <CardContent className="p-0">
                <div className="divide-y divide-gray-100">
                  {topMedicines.map((item, idx) => (
                    <div key={item.medicineId} className="p-4 flex items-center justify-between hover:bg-gray-50/70 transition-colors">
                      <div className="flex items-center gap-3">
                        <div className="w-7 h-7 rounded-full bg-blue-50 text-blue-700 font-bold flex items-center justify-center text-xs">
                          {idx + 1}
                        </div>
                        <div>
                          <div className="text-sm font-semibold text-gray-900 flex items-center gap-2">
                            {item.name}
                            {!item.stockStatus && (
                              <span className="text-[10px] font-medium bg-red-100 text-red-700 px-1.5 py-0.5 rounded">
                                Out of Stock
                              </span>
                            )}
                          </div>
                          <div className="text-xs text-gray-500">{item.genericName}</div>
                        </div>
                      </div>
                      <div className="text-right">
                        <div className="text-sm font-bold text-gray-900">
                          {item.prescriptionsCount} {item.prescriptionsCount === 1 ? 'prescription' : 'prescriptions'}
                        </div>
                        <div className="text-xs text-gray-500">
                          {item.percentageOfTotal}% of total &bull; {item.fillRate}% fill rate
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>

            {/* Status Breakdown Widget */}
            <Card className="shadow-sm">
              <CardHeader className="border-b border-gray-100 pb-4">
                <CardTitle className="text-lg font-bold text-gray-900">
                  Fulfillment Distribution
                </CardTitle>
              </CardHeader>
              <CardContent className="p-5 space-y-5">
                {statusBreakdown.map((sb) => {
                  const colorMap = {
                    FILLED: { bar: 'bg-emerald-500', text: 'text-emerald-700', badge: 'bg-emerald-50 text-emerald-700 border-emerald-200' },
                    PENDING: { bar: 'bg-amber-500', text: 'text-amber-700', badge: 'bg-amber-50 text-amber-700 border-amber-200' },
                    CANNOT_FILL: { bar: 'bg-rose-500', text: 'text-rose-700', badge: 'bg-rose-50 text-rose-700 border-rose-200' },
                  }[sb.status];

                  return (
                    <div key={sb.status} className="space-y-1.5">
                      <div className="flex justify-between text-xs font-semibold">
                        <span className="capitalize text-gray-700">
                          {sb.status.toLowerCase().replace('_', ' ')}
                        </span>
                        <span className={colorMap.text}>
                          {sb.count} ({sb.percentage}%)
                        </span>
                      </div>
                      <div className="w-full bg-gray-100 rounded-full h-2.5 overflow-hidden">
                        <div
                          className={`h-2.5 rounded-full ${colorMap.bar} transition-all duration-500`}
                          style={{ width: `${Math.min(100, Math.max(0, sb.percentage))}%` }}
                        />
                      </div>
                    </div>
                  );
                })}

                <div className="pt-4 border-t border-gray-100 text-xs text-gray-500 space-y-1">
                  <p>&bull; <strong>Filled:</strong> Successfully dispensed and confirmed by pharmacy.</p>
                  <p>&bull; <strong>Pending:</strong> Queued or in dispensing review.</p>
                  <p>&bull; <strong>Cannot Fill:</strong> Declined due to stock shortage or clinical conflict.</p>
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Medicine-wise Fill Rate Table */}
          <Card className="shadow-sm">
            <CardHeader className="border-b border-gray-100 pb-4">
              <CardTitle className="text-lg font-bold text-gray-900 flex items-center justify-between">
                <span>Medicine-Wise Fulfillment Rates</span>
                <span className="text-xs font-normal text-gray-500">
                  Evaluated per prescription containing each medicine
                </span>
              </CardTitle>
            </CardHeader>
            <CardContent className="p-0 overflow-x-auto">
              <table className="w-full text-left text-sm">
                <thead className="bg-gray-50/80 text-gray-600 uppercase text-[11px] tracking-wider border-b border-gray-200">
                  <tr>
                    <th className="py-3 px-4 font-semibold">Medicine</th>
                    <th className="py-3 px-4 font-semibold text-center">Prescribed</th>
                    <th className="py-3 px-4 font-semibold text-center">Filled</th>
                    <th className="py-3 px-4 font-semibold text-center">Pending</th>
                    <th className="py-3 px-4 font-semibold text-center">Cannot Fill</th>
                    <th className="py-3 px-4 font-semibold text-right">Fill Rate</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {medicineFillRates.map((med) => {
                    const fillRatePresentation = getFillRatePresentation(med.fillRate);

                    return (
                      <tr key={med.medicineId} className="hover:bg-gray-50/60 transition-colors">
                        <td className="py-3 px-4">
                          <div className="font-semibold text-gray-900 flex items-center gap-2">
                            {med.name}
                            {!med.stockStatus && (
                              <Badge variant="destructive">Out of stock</Badge>
                            )}
                          </div>
                          <div className="text-xs text-gray-500">{med.genericName}</div>
                        </td>
                        <td className="py-3 px-4 text-center font-medium text-gray-900">
                          {med.prescribed}
                        </td>
                        <td className="py-3 px-4 text-center font-medium text-emerald-700">
                          {med.filled}
                        </td>
                        <td className="py-3 px-4 text-center font-medium text-amber-700">
                          {med.pending}
                        </td>
                        <td className="py-3 px-4 text-center font-medium text-rose-700">
                          {med.cannotFill}
                        </td>
                        <td className="py-3 px-4 text-right">
                          <div className="inline-flex items-center gap-2">
                            <div className="w-16 bg-gray-100 rounded-full h-1.5 overflow-hidden">
                              <div
                                className={`h-1.5 rounded-full ${fillRatePresentation.bar}`}
                                style={{ width: `${med.fillRate}%` }}
                              />
                            </div>
                            <span className={`font-bold text-sm ${fillRatePresentation.text}`}>
                              {med.fillRate}%
                            </span>
                            <Badge variant={fillRatePresentation.variant}>
                              {fillRatePresentation.label}
                            </Badge>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </CardContent>
          </Card>

          {/* Fulfillment Trend Timeline */}
          {trend.length > 0 && (
            <Card className="shadow-sm">
              <CardHeader className="border-b border-gray-100 pb-4">
                <CardTitle className="text-lg font-bold text-gray-900">
                  Monthly Prescription & Fulfillment Trend
                </CardTitle>
              </CardHeader>
              <CardContent className="p-6">
                <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
                  {trend.map((t) => (
                    <div key={t.period} className="p-4 rounded-xl border border-gray-200 bg-white shadow-xs space-y-2">
                      <div className="flex justify-between items-center">
                        <span className="text-sm font-bold text-gray-900">{t.label}</span>
                        <span className="text-xs font-semibold px-2 py-0.5 rounded-full bg-blue-50 text-blue-700">
                          {t.total} total
                        </span>
                      </div>
                      <div className="space-y-1 text-xs text-gray-600">
                        <div className="flex justify-between">
                          <span>Filled:</span>
                          <span className="font-semibold text-emerald-700">{t.filled}</span>
                        </div>
                        <div className="flex justify-between">
                          <span>Pending:</span>
                          <span className="font-semibold text-amber-700">{t.pending}</span>
                        </div>
                        <div className="flex justify-between">
                          <span>Cannot Fill:</span>
                          <span className="font-semibold text-rose-700">{t.cannotFill}</span>
                        </div>
                      </div>
                      <div className="pt-2 border-t border-gray-100 flex justify-between items-center text-xs">
                        <span className="text-gray-500">Monthly Fill Rate:</span>
                        <span className="font-extrabold text-gray-900">{t.fillRate}%</span>
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          )}
        </>
      )}
    </div>
  );
}
