'use client';

import React, { useEffect, useState, useCallback } from 'react';
import Link from 'next/link';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/Card';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';

interface DoctorActivityItem {
  doctorId: string;
  doctorName: string;
  email: string;
  specialization: string;
  licenseNumber: string;
  totalPrescriptions: number;
  filledPrescriptions: number;
  pendingPrescriptions: number;
  cannotFillPrescriptions: number;
  fulfillmentRate: number;
}

interface PharmacyActivityData {
  pharmacyId: string | null;
  pharmacyName: string;
  pharmacyType: string;
  licenseNumber: string;
  totalFills: number;
  totalCannotFill: number;
  totalPending: number;
  fulfillmentRate: number;
}

interface MedicineTrendItem {
  medicineId: string;
  name: string;
  genericName: string;
  stockStatus: boolean;
  prescribedCount: number;
  filledCount: number;
  pendingCount: number;
  cannotFillCount: number;
  fulfillmentRate: number;
}

interface TimelineItem {
  period: string;
  label: string;
  total: number;
  filled: number;
  pending: number;
  cannotFill: number;
  fulfillmentRate: number;
}

interface AnalyticsData {
  totalPrescriptionsCreated: number;
  totalPrescriptionsFulfilled: number;
  overallFulfillmentRate: number;
  pendingPrescriptionCount: number;
  cannotFillCount: number;
  doctorActivity: DoctorActivityItem[];
  pharmacyActivity: PharmacyActivityData;
  medicineWiseFulfillmentTrends: MedicineTrendItem[];
  prescriptionActivityOverTime: TimelineItem[];
}

export default function AdminAnalyticsPage() {
  const [data, setData] = useState<AnalyticsData | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  const fetchAnalytics = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      const res = await fetch('/api/admin/analytics', { cache: 'no-store' });
      if (!res.ok) {
        const errJson = await res.json().catch(() => ({}));
        throw new Error(errJson.error || `Failed to fetch analytics (HTTP ${res.status})`);
      }
      const json: AnalyticsData = await res.json();
      setData(json);
    } catch (err) {
      console.error('Error fetching admin analytics:', err);
      setError(err instanceof Error ? err.message : 'An unexpected error occurred.');
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchAnalytics();
  }, [fetchAnalytics]);

  return (
    <div className="space-y-8 p-4 sm:p-6 max-w-7xl mx-auto">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-gray-200">
        <div>
          <h1 className="text-2xl sm:text-3xl font-bold text-gray-900 tracking-tight">
            Platform Analytics &amp; Insights
          </h1>
          <p className="text-sm text-gray-500 mt-1">
            Real database aggregations of clinical authoring, pharmacy dispensing, and medication trends.
          </p>
        </div>
        <div className="flex items-center gap-3">
          <Button
            variant="secondary"
            size="sm"
            onClick={fetchAnalytics}
            isLoading={isLoading}
            className="flex items-center gap-1.5"
          >
            <svg
              className="w-4 h-4 text-gray-600"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"
              />
            </svg>
            Refresh
          </Button>
          <Link href="/admin/dashboard">
            <Button variant="primary" size="sm">
              Dashboard &rarr;
            </Button>
          </Link>
        </div>
      </div>

      {/* ERROR STATE */}
      {error && (
        <div className="bg-red-50 border border-red-200 rounded-xl p-6 text-center space-y-3">
          <div className="w-12 h-12 rounded-full bg-red-100 text-red-600 flex items-center justify-center mx-auto">
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"
              />
            </svg>
          </div>
          <h3 className="text-lg font-bold text-red-900">Unable to load platform analytics</h3>
          <p className="text-sm text-red-700 max-w-md mx-auto">{error}</p>
          <Button variant="primary" size="sm" onClick={fetchAnalytics}>
            Retry
          </Button>
        </div>
      )}

      {/* LOADING SKELETON */}
      {isLoading && !data && (
        <div className="space-y-6 animate-pulse">
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4">
            {[1, 2, 3, 4, 5].map((i) => (
              <div key={i} className="h-28 bg-gray-200 rounded-xl" />
            ))}
          </div>
          <div className="h-72 bg-gray-200 rounded-xl" />
          <div className="h-72 bg-gray-200 rounded-xl" />
        </div>
      )}

      {/* SUCCESS STATE */}
      {data && (
        <>
          {/* Top Summary Metrics */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4">
            <Card>
              <CardContent className="p-5">
                <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider">
                  Total Prescriptions
                </p>
                <p className="text-3xl font-bold text-gray-900 mt-2">
                  {data.totalPrescriptionsCreated}
                </p>
                <p className="text-xs text-gray-500 mt-1">Platform volume</p>
              </CardContent>
            </Card>

            <Card>
              <CardContent className="p-5">
                <p className="text-xs font-semibold text-green-700 uppercase tracking-wider">
                  Filled
                </p>
                <p className="text-3xl font-bold text-green-800 mt-2">
                  {data.totalPrescriptionsFulfilled}
                </p>
                <p className="text-xs text-gray-500 mt-1">Dispensed successfully</p>
              </CardContent>
            </Card>

            <Card>
              <CardContent className="p-5">
                <p className="text-xs font-semibold text-yellow-800 uppercase tracking-wider">
                  Pending
                </p>
                <p className="text-3xl font-bold text-yellow-900 mt-2">
                  {data.pendingPrescriptionCount}
                </p>
                <p className="text-xs text-gray-500 mt-1">Awaiting fulfillment</p>
              </CardContent>
            </Card>

            <Card>
              <CardContent className="p-5">
                <p className="text-xs font-semibold text-red-800 uppercase tracking-wider">
                  Cannot Fill
                </p>
                <p className="text-3xl font-bold text-red-900 mt-2">{data.cannotFillCount}</p>
                <p className="text-xs text-gray-500 mt-1">Declined or constrained</p>
              </CardContent>
            </Card>

            <Card className="border-emerald-200 bg-emerald-50/20">
              <CardContent className="p-5">
                <p className="text-xs font-semibold text-emerald-800 uppercase tracking-wider">
                  Fulfillment Rate
                </p>
                <p className="text-3xl font-bold text-emerald-900 mt-2">
                  {data.overallFulfillmentRate}%
                </p>
                <div className="w-full bg-emerald-200 rounded-full h-1.5 mt-2 overflow-hidden">
                  <div
                    className="bg-emerald-600 h-1.5 rounded-full"
                    style={{
                      width: `${Math.min(100, Math.max(0, data.overallFulfillmentRate))}%`,
                    }}
                  />
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Doctor Activity & Pharmacy Activity Section */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            {/* Doctor Activity Breakdown */}
            <Card className="lg:col-span-2 shadow-sm">
              <CardHeader>
                <CardTitle className="text-base font-semibold text-gray-900">
                  Doctor Clinical Activity
                </CardTitle>
              </CardHeader>
              <CardContent className="p-0">
                <div className="overflow-x-auto">
                  <table className="w-full text-left text-sm text-gray-600">
                    <thead className="bg-gray-50 text-xs font-semibold uppercase tracking-wider text-gray-500 border-y border-gray-200">
                      <tr>
                        <th scope="col" className="px-6 py-3">
                          Doctor
                        </th>
                        <th scope="col" className="px-6 py-3">
                          Specialization
                        </th>
                        <th scope="col" className="px-6 py-3 text-center">
                          Total Rx
                        </th>
                        <th scope="col" className="px-6 py-3 text-center">
                          Filled
                        </th>
                        <th scope="col" className="px-6 py-3 text-center">
                          Pending
                        </th>
                        <th scope="col" className="px-6 py-3 text-right">
                          Fulfillment Rate
                        </th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-200">
                      {data.doctorActivity.length === 0 ? (
                        <tr>
                          <td colSpan={6} className="px-6 py-8 text-center text-gray-500">
                            No doctor activity records found.
                          </td>
                        </tr>
                      ) : (
                        data.doctorActivity.map((doc) => (
                          <tr key={doc.doctorId} className="hover:bg-gray-50/75">
                            <td className="px-6 py-3.5 font-semibold text-gray-900">
                              {doc.doctorName}
                            </td>
                            <td className="px-6 py-3.5 text-xs text-gray-600">
                              {doc.specialization}
                            </td>
                            <td className="px-6 py-3.5 text-center font-bold text-gray-900">
                              {doc.totalPrescriptions}
                            </td>
                            <td className="px-6 py-3.5 text-center text-emerald-700 font-medium">
                              {doc.filledPrescriptions}
                            </td>
                            <td className="px-6 py-3.5 text-center text-yellow-700 font-medium">
                              {doc.pendingPrescriptions}
                            </td>
                            <td className="px-6 py-3.5 text-right font-bold text-emerald-700">
                              {doc.fulfillmentRate}%
                            </td>
                          </tr>
                        ))
                      )}
                    </tbody>
                  </table>
                </div>
              </CardContent>
            </Card>

            {/* Pharmacy Activity Card */}
            <Card className="shadow-sm">
              <CardHeader>
                <CardTitle className="text-base font-semibold text-gray-900">
                  Central Pharmacy Workload
                </CardTitle>
              </CardHeader>
              <CardContent className="p-6 space-y-4">
                <div>
                  <h4 className="font-semibold text-gray-900">
                    {data.pharmacyActivity.pharmacyName}
                  </h4>
                  <p className="text-xs text-gray-500 mt-0.5">
                    License: <span className="font-mono">{data.pharmacyActivity.licenseNumber}</span>
                  </p>
                </div>

                <div className="grid grid-cols-2 gap-3 pt-2">
                  <div className="p-3 bg-green-50 rounded-lg border border-green-100">
                    <p className="text-xs text-green-700 font-medium">Total Fills</p>
                    <p className="text-xl font-bold text-green-900 mt-1">
                      {data.pharmacyActivity.totalFills}
                    </p>
                  </div>
                  <div className="p-3 bg-yellow-50 rounded-lg border border-yellow-100">
                    <p className="text-xs text-yellow-800 font-medium">In Queue</p>
                    <p className="text-xl font-bold text-yellow-900 mt-1">
                      {data.pharmacyActivity.totalPending}
                    </p>
                  </div>
                  <div className="p-3 bg-red-50 rounded-lg border border-red-100">
                    <p className="text-xs text-red-700 font-medium">Cannot Fill</p>
                    <p className="text-xl font-bold text-red-900 mt-1">
                      {data.pharmacyActivity.totalCannotFill}
                    </p>
                  </div>
                  <div className="p-3 bg-emerald-50 rounded-lg border border-emerald-100">
                    <p className="text-xs text-emerald-800 font-medium">Fulfillment Rate</p>
                    <p className="text-xl font-bold text-emerald-900 mt-1">
                      {data.pharmacyActivity.fulfillmentRate}%
                    </p>
                  </div>
                </div>

                <div className="pt-2 text-xs text-gray-500">
                  Verified central pharmacy handling 100% of platform fulfillment traffic.
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Medicine-Wise Fulfillment Trends */}
          <Card className="shadow-sm">
            <CardHeader>
              <CardTitle className="text-base font-semibold text-gray-900">
                Medicine-Wise Fulfillment Trends
              </CardTitle>
            </CardHeader>
            <CardContent className="p-0">
              <div className="overflow-x-auto">
                <table className="w-full text-left text-sm text-gray-600">
                  <thead className="bg-gray-50 text-xs font-semibold uppercase tracking-wider text-gray-500 border-y border-gray-200">
                    <tr>
                      <th scope="col" className="px-6 py-3">
                        Medication
                      </th>
                      <th scope="col" className="px-6 py-3">
                        Generic Name
                      </th>
                      <th scope="col" className="px-6 py-3 text-center">
                        Prescribed
                      </th>
                      <th scope="col" className="px-6 py-3 text-center">
                        Filled
                      </th>
                      <th scope="col" className="px-6 py-3 text-center">
                        Pending
                      </th>
                      <th scope="col" className="px-6 py-3 text-center">
                        Cannot Fill
                      </th>
                      <th scope="col" className="px-6 py-3 text-right">
                        Fill Rate
                      </th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-200">
                    {data.medicineWiseFulfillmentTrends.length === 0 ? (
                      <tr>
                        <td colSpan={7} className="px-6 py-8 text-center text-gray-500">
                          No medication fulfillment data available.
                        </td>
                      </tr>
                    ) : (
                      data.medicineWiseFulfillmentTrends.map((med) => (
                        <tr key={med.medicineId} className="hover:bg-gray-50/75">
                          <td className="px-6 py-3.5 font-semibold text-gray-900">{med.name}</td>
                          <td className="px-6 py-3.5 text-xs text-gray-500">{med.genericName}</td>
                          <td className="px-6 py-3.5 text-center font-bold text-gray-900">
                            {med.prescribedCount}
                          </td>
                          <td className="px-6 py-3.5 text-center text-emerald-700 font-medium">
                            {med.filledCount}
                          </td>
                          <td className="px-6 py-3.5 text-center text-yellow-700 font-medium">
                            {med.pendingCount}
                          </td>
                          <td className="px-6 py-3.5 text-center text-red-700 font-medium">
                            {med.cannotFillCount}
                          </td>
                          <td className="px-6 py-3.5 text-right font-bold text-emerald-700">
                            {med.fulfillmentRate}%
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </CardContent>
          </Card>

          {/* Prescription Activity Over Time */}
          <Card className="shadow-sm">
            <CardHeader>
              <CardTitle className="text-base font-semibold text-gray-900">
                Prescription Activity Over Time
              </CardTitle>
            </CardHeader>
            <CardContent className="p-6">
              {data.prescriptionActivityOverTime.length === 0 ? (
                <div className="py-8 text-center text-gray-500 text-sm">
                  No chronological timeline activity recorded yet.
                </div>
              ) : (
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                  {data.prescriptionActivityOverTime.map((item) => (
                    <div
                      key={item.period}
                      className="p-4 bg-gray-50 rounded-xl border border-gray-200 hover:shadow-sm transition-shadow space-y-3"
                    >
                      <div className="flex items-center justify-between">
                        <h4 className="font-bold text-gray-900 text-base">{item.label}</h4>
                        <Badge variant="info">{item.period}</Badge>
                      </div>

                      <div className="space-y-1.5 text-xs">
                        <div className="flex justify-between text-gray-600">
                          <span>Total Volume:</span>
                          <strong className="text-gray-900">{item.total}</strong>
                        </div>
                        <div className="flex justify-between text-emerald-700">
                          <span>Filled:</span>
                          <strong>{item.filled}</strong>
                        </div>
                        <div className="flex justify-between text-yellow-700">
                          <span>Pending:</span>
                          <strong>{item.pending}</strong>
                        </div>
                        <div className="flex justify-between text-red-700">
                          <span>Cannot Fill:</span>
                          <strong>{item.cannotFill}</strong>
                        </div>
                      </div>

                      <div className="pt-2 border-t border-gray-200 flex items-center justify-between">
                        <span className="text-xs text-gray-500 font-medium">Fulfillment Rate:</span>
                        <span className="text-sm font-bold text-emerald-700">
                          {item.fulfillmentRate}%
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </>
      )}
    </div>
  );
}
