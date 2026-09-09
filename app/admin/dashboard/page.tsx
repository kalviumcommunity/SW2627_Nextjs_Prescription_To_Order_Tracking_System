'use client';

import React, { useEffect, useState, useCallback } from 'react';
import Link from 'next/link';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/Card';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { LoadingState } from '@/components/ui/LoadingState';
import { ErrorState } from '@/components/ui/ErrorState';

interface StatusBreakdownItem {
  status: 'PENDING' | 'FILLED' | 'CANNOT_FILL';
  count: number;
  percentage: number;
}

interface DashboardData {
  totalDoctors: number;
  pharmacyAccountStatus: string;
  totalPatients: number;
  totalPrescriptions: number;
  filledPrescriptions: number;
  pendingPrescriptions: number;
  cannotFillPrescriptions: number;
  overallFulfillmentRate: number;
  pharmacy?: {
    id: string;
    pharmacyName: string;
    pharmacyType: string;
    licenseNumber: string;
    phone: string;
    accountStatus: string;
    email: string;
  } | null;
  statusBreakdown?: StatusBreakdownItem[];
}

export default function AdminDashboardPage() {
  const [data, setData] = useState<DashboardData | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  const fetchDashboardData = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      const res = await fetch('/api/admin/dashboard', { cache: 'no-store' });
      if (!res.ok) {
        const errJson = await res.json().catch(() => ({}));
        throw new Error(errJson.error || `Failed to fetch dashboard (HTTP ${res.status})`);
      }
      const json: DashboardData = await res.json();
      setData(json);
    } catch (err) {
      console.error('Error loading admin dashboard:', err);
      setError(err instanceof Error ? err.message : 'An unexpected error occurred.');
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchDashboardData();
  }, [fetchDashboardData]);

  return (
    <div className="space-y-8 p-4 sm:p-6 max-w-7xl mx-auto">
      {/* Top Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-gray-200">
        <div>
          <div className="flex items-center gap-3">
            <h1 className="text-2xl sm:text-3xl font-bold text-gray-900 tracking-tight">
              Platform Administration
            </h1>
            <Badge variant="info">Live</Badge>
          </div>
          <p className="text-sm text-gray-500 mt-1">
            Real-time platform oversight, provider registries, and fulfillment performance metrics.
          </p>
        </div>
        <div className="flex items-center gap-3">
          <Button
            variant="secondary"
            size="sm"
            onClick={fetchDashboardData}
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
          <Link href="/admin/analytics">
            <Button variant="primary" size="sm" className="flex items-center gap-1.5 shadow-sm">
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z"
                />
              </svg>
              View Analytics
            </Button>
          </Link>
        </div>
      </div>

      {/* ERROR STATE */}
      {error && (
        <ErrorState
          title="Failed to load platform dashboard"
          message={error}
          onRetry={fetchDashboardData}
        />
      )}

      {/* LOADING STATE */}
      {isLoading && !data && (
        <div className="py-8">
          <LoadingState message="Loading platform dashboard..." />
        </div>
      )}

      {/* SUCCESS STATE */}
      {data && (
        <>
          {/* Primary Platform Metrics - 8 Core KPIs */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            {/* Total Doctors */}
            <Card className="hover:shadow-md transition-shadow">
              <CardContent className="p-5">
                <div className="flex items-center justify-between">
                  <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider">
                    Total Doctors
                  </p>
                  <div className="w-8 h-8 rounded-full bg-blue-50 text-blue-600 flex items-center justify-center">
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z"
                      />
                    </svg>
                  </div>
                </div>
                <p className="text-3xl font-bold text-gray-900 mt-2">{data.totalDoctors}</p>
                <div className="mt-2 text-xs text-gray-500 flex items-center justify-between">
                  <span>Registered clinicians</span>
                  <Link href="/admin/doctors" className="text-blue-600 hover:text-blue-800 font-medium">
                    Directory &rarr;
                  </Link>
                </div>
              </CardContent>
            </Card>

            {/* Central Pharmacy Account Status */}
            <Card className="hover:shadow-md transition-shadow">
              <CardContent className="p-5">
                <div className="flex items-center justify-between">
                  <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider">
                    Pharmacy Account
                  </p>
                  <div className="w-8 h-8 rounded-full bg-emerald-50 text-emerald-600 flex items-center justify-center">
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4"
                      />
                    </svg>
                  </div>
                </div>
                <div className="mt-3">
                  <Badge
                    variant={data.pharmacyAccountStatus === 'ACTIVE' ? 'success' : 'destructive'}
                    className="text-sm px-3 py-1 font-semibold tracking-wide"
                  >
                    {data.pharmacyAccountStatus}
                  </Badge>
                </div>
                <div className="mt-2 text-xs text-gray-500 flex items-center justify-between">
                  <span>{data.pharmacy?.pharmacyName || 'Pre-provisioned Pharmacy'}</span>
                  <Link href="/admin/pharmacy" className="text-blue-600 hover:text-blue-800 font-medium">
                    Details &rarr;
                  </Link>
                </div>
              </CardContent>
            </Card>

            {/* Total Patients */}
            <Card className="hover:shadow-md transition-shadow">
              <CardContent className="p-5">
                <div className="flex items-center justify-between">
                  <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider">
                    Total Patients
                  </p>
                  <div className="w-8 h-8 rounded-full bg-purple-50 text-purple-600 flex items-center justify-center">
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z"
                      />
                    </svg>
                  </div>
                </div>
                <p className="text-3xl font-bold text-gray-900 mt-2">{data.totalPatients}</p>
                <p className="text-xs text-gray-500 mt-2">Active patient profiles</p>
              </CardContent>
            </Card>

            {/* Total Prescriptions */}
            <Card className="hover:shadow-md transition-shadow">
              <CardContent className="p-5">
                <div className="flex items-center justify-between">
                  <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider">
                    Total Prescriptions
                  </p>
                  <div className="w-8 h-8 rounded-full bg-indigo-50 text-indigo-600 flex items-center justify-center">
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"
                      />
                    </svg>
                  </div>
                </div>
                <p className="text-3xl font-bold text-gray-900 mt-2">{data.totalPrescriptions}</p>
                <div className="mt-2 text-xs text-gray-500 flex items-center justify-between">
                  <span>Platform-wide volume</span>
                  <Link href="/admin/prescriptions" className="text-blue-600 hover:text-blue-800 font-medium">
                    Manage &rarr;
                  </Link>
                </div>
              </CardContent>
            </Card>

            {/* Overall Fulfillment Rate */}
            <Card className="hover:shadow-md transition-shadow border-emerald-200 bg-emerald-50/20">
              <CardContent className="p-5">
                <div className="flex items-center justify-between">
                  <p className="text-xs font-semibold text-emerald-800 uppercase tracking-wider">
                    Fulfillment Rate
                  </p>
                  <div className="w-8 h-8 rounded-full bg-emerald-100 text-emerald-700 flex items-center justify-center">
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"
                      />
                    </svg>
                  </div>
                </div>
                <p className="text-3xl font-bold text-emerald-900 mt-2">
                  {data.overallFulfillmentRate}%
                </p>
                <div className="w-full bg-emerald-200 rounded-full h-2 mt-3 overflow-hidden">
                  <div
                    className="bg-emerald-600 h-2 rounded-full transition-all duration-500"
                    style={{ width: `${Math.min(100, Math.max(0, data.overallFulfillmentRate))}%` }}
                  />
                </div>
              </CardContent>
            </Card>

            {/* Filled Prescriptions */}
            <Card className="hover:shadow-md transition-shadow">
              <CardContent className="p-5">
                <div className="flex items-center justify-between">
                  <p className="text-xs font-semibold text-green-700 uppercase tracking-wider">
                    Filled Prescriptions
                  </p>
                  <Badge variant="success">Completed</Badge>
                </div>
                <p className="text-3xl font-bold text-green-800 mt-2">{data.filledPrescriptions}</p>
                <p className="text-xs text-gray-500 mt-2">Dispensed by pharmacy</p>
              </CardContent>
            </Card>

            {/* Pending Prescriptions */}
            <Card className="hover:shadow-md transition-shadow">
              <CardContent className="p-5">
                <div className="flex items-center justify-between">
                  <p className="text-xs font-semibold text-yellow-800 uppercase tracking-wider">
                    Pending Prescriptions
                  </p>
                  <Badge variant="warning">In Queue</Badge>
                </div>
                <p className="text-3xl font-bold text-yellow-900 mt-2">{data.pendingPrescriptions}</p>
                <p className="text-xs text-gray-500 mt-2">Awaiting fulfillment</p>
              </CardContent>
            </Card>

            {/* Cannot-Fill Prescriptions */}
            <Card className="hover:shadow-md transition-shadow">
              <CardContent className="p-5">
                <div className="flex items-center justify-between">
                  <p className="text-xs font-semibold text-red-800 uppercase tracking-wider">
                    Cannot Fill
                  </p>
                  <Badge variant="destructive">Declined</Badge>
                </div>
                <p className="text-3xl font-bold text-red-900 mt-2">{data.cannotFillPrescriptions}</p>
                <p className="text-xs text-gray-500 mt-2">Stock or clinical constraint</p>
              </CardContent>
            </Card>
          </div>

          {/* Fulfillment Status Breakdown Bar */}
          <Card>
            <CardHeader>
              <CardTitle className="text-base font-semibold text-gray-900">
                Prescription Lifecycle Breakdown
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="h-4 w-full bg-gray-100 rounded-full flex overflow-hidden">
                <div
                  className="bg-green-500 h-full transition-all"
                  style={{
                    width: `${
                      data.totalPrescriptions > 0
                        ? (data.filledPrescriptions / data.totalPrescriptions) * 100
                        : 0
                    }%`,
                  }}
                  title={`Filled: ${data.filledPrescriptions}`}
                />
                <div
                  className="bg-yellow-400 h-full transition-all"
                  style={{
                    width: `${
                      data.totalPrescriptions > 0
                        ? (data.pendingPrescriptions / data.totalPrescriptions) * 100
                        : 0
                    }%`,
                  }}
                  title={`Pending: ${data.pendingPrescriptions}`}
                />
                <div
                  className="bg-red-500 h-full transition-all"
                  style={{
                    width: `${
                      data.totalPrescriptions > 0
                        ? (data.cannotFillPrescriptions / data.totalPrescriptions) * 100
                        : 0
                    }%`,
                  }}
                  title={`Cannot Fill: ${data.cannotFillPrescriptions}`}
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 pt-2 text-sm">
                <div className="flex items-center gap-2">
                  <div className="w-3 h-3 rounded-full bg-green-500" />
                  <span className="text-gray-600">Filled:</span>
                  <strong className="text-gray-900">
                    {data.filledPrescriptions} (
                    {data.totalPrescriptions > 0
                      ? ((data.filledPrescriptions / data.totalPrescriptions) * 100).toFixed(1)
                      : 0}
                    %)
                  </strong>
                </div>
                <div className="flex items-center gap-2">
                  <div className="w-3 h-3 rounded-full bg-yellow-400" />
                  <span className="text-gray-600">Pending:</span>
                  <strong className="text-gray-900">
                    {data.pendingPrescriptions} (
                    {data.totalPrescriptions > 0
                      ? ((data.pendingPrescriptions / data.totalPrescriptions) * 100).toFixed(1)
                      : 0}
                    %)
                  </strong>
                </div>
                <div className="flex items-center gap-2">
                  <div className="w-3 h-3 rounded-full bg-red-500" />
                  <span className="text-gray-600">Cannot Fill:</span>
                  <strong className="text-gray-900">
                    {data.cannotFillPrescriptions} (
                    {data.totalPrescriptions > 0
                      ? ((data.cannotFillPrescriptions / data.totalPrescriptions) * 100).toFixed(1)
                      : 0}
                    %)
                  </strong>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Quick Administrative Navigation Modules */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            <Link href="/admin/doctors" className="group">
              <Card className="h-full group-hover:border-blue-300 group-hover:shadow-md transition-all">
                <CardContent className="p-5 flex flex-col justify-between h-full">
                  <div>
                    <div className="w-10 h-10 rounded-lg bg-blue-100 text-blue-700 flex items-center justify-center mb-3">
                      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          strokeWidth={2}
                          d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z"
                        />
                      </svg>
                    </div>
                    <h3 className="font-semibold text-gray-900 group-hover:text-blue-600 transition-colors">
                      Doctor Directory
                    </h3>
                    <p className="text-xs text-gray-500 mt-1">
                      Manage registered clinicians, credentials, specialties, and patient care rosters.
                    </p>
                  </div>
                  <span className="text-xs font-medium text-blue-600 mt-4 inline-flex items-center gap-1">
                    Open Directory &rarr;
                  </span>
                </CardContent>
              </Card>
            </Link>

            <Link href="/admin/pharmacy" className="group">
              <Card className="h-full group-hover:border-emerald-300 group-hover:shadow-md transition-all">
                <CardContent className="p-5 flex flex-col justify-between h-full">
                  <div>
                    <div className="w-10 h-10 rounded-lg bg-emerald-100 text-emerald-700 flex items-center justify-center mb-3">
                      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          strokeWidth={2}
                          d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4"
                        />
                      </svg>
                    </div>
                    <h3 className="font-semibold text-gray-900 group-hover:text-emerald-600 transition-colors">
                      Pharmacy Management
                    </h3>
                    <p className="text-xs text-gray-500 mt-1">
                      Inspect pre-provisioned central dispensing facility, licensing, and account readiness.
                    </p>
                  </div>
                  <span className="text-xs font-medium text-emerald-600 mt-4 inline-flex items-center gap-1">
                    Pharmacy Profile &rarr;
                  </span>
                </CardContent>
              </Card>
            </Link>

            <Link href="/admin/prescriptions" className="group">
              <Card className="h-full group-hover:border-indigo-300 group-hover:shadow-md transition-all">
                <CardContent className="p-5 flex flex-col justify-between h-full">
                  <div>
                    <div className="w-10 h-10 rounded-lg bg-indigo-100 text-indigo-700 flex items-center justify-center mb-3">
                      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          strokeWidth={2}
                          d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-3 7h3m-3 4h3m-6-4h.01M9 16h.01"
                        />
                      </svg>
                    </div>
                    <h3 className="font-semibold text-gray-900 group-hover:text-indigo-600 transition-colors">
                      Prescription Monitor
                    </h3>
                    <p className="text-xs text-gray-500 mt-1">
                      Audit all prescriptions across doctors, patients, statuses, and fulfillment notes.
                    </p>
                  </div>
                  <span className="text-xs font-medium text-indigo-600 mt-4 inline-flex items-center gap-1">
                    Manage Orders &rarr;
                  </span>
                </CardContent>
              </Card>
            </Link>

            <Link href="/admin/analytics" className="group">
              <Card className="h-full group-hover:border-purple-300 group-hover:shadow-md transition-all">
                <CardContent className="p-5 flex flex-col justify-between h-full">
                  <div>
                    <div className="w-10 h-10 rounded-lg bg-purple-100 text-purple-700 flex items-center justify-center mb-3">
                      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          strokeWidth={2}
                          d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z"
                        />
                      </svg>
                    </div>
                    <h3 className="font-semibold text-gray-900 group-hover:text-purple-600 transition-colors">
                      Platform Analytics
                    </h3>
                    <p className="text-xs text-gray-500 mt-1">
                      Explore doctor activity, pharmacy workload, medication trends, and timelines.
                    </p>
                  </div>
                  <span className="text-xs font-medium text-purple-600 mt-4 inline-flex items-center gap-1">
                    Explore Trends &rarr;
                  </span>
                </CardContent>
              </Card>
            </Link>
          </div>
        </>
      )}
    </div>
  );
}
