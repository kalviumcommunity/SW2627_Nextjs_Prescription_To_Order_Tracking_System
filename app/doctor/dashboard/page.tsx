'use client';

import React, { useEffect, useState, useCallback } from 'react';
import Link from 'next/link';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/Card';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { PrescriptionDetails } from '@/components/prescriptions/PrescriptionDetails';

interface MedicineItem {
  id: string;
  dosage: string;
  frequency: string;
  duration: string;
  medicine: {
    id: string;
    name: string;
    genericName: string;
    stockStatus: boolean;
  };
}

interface PatientInfo {
  id: string;
  name: string;
  age?: number;
  gender?: string;
  contactInfo?: string;
}

interface FillInfo {
  id: string;
  filledAt: string;
  notes?: string | null;
  pharmacy?: {
    pharmacyName: string;
    phone: string;
  } | null;
}

interface RecentPrescription {
  id: string;
  doctorId: string;
  patientId: string;
  diagnosis: string;
  status: 'PENDING' | 'FILLED' | 'CANNOT_FILL';
  createdAt: string;
  patient: PatientInfo;
  prescriptionMedicines: MedicineItem[];
  fill?: FillInfo | null;
}

interface DashboardData {
  doctor: {
    id: string;
    specialization: string;
    licenseNumber: string;
    phone?: string;
  };
  stats: {
    totalPrescriptions: number;
    pendingCount: number;
    filledCount: number;
    totalPatients: number;
  };
  recentPrescriptions: RecentPrescription[];
}

export default function DoctorDashboardPage() {
  const [data, setData] = useState<DashboardData | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedPrescription, setSelectedPrescription] = useState<RecentPrescription | null>(null);
  const [showQuickActionNotice, setShowQuickActionNotice] = useState(false);

  const fetchDashboardData = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      const res = await fetch('/api/doctor/dashboard');
      if (!res.ok) {
        const errJson = await res.json().catch(() => ({}));
        throw new Error(errJson.error || `Failed to fetch dashboard (HTTP ${res.status})`);
      }
      const json: DashboardData = await res.json();
      setData(json);
    } catch (err) {
      console.error('Error loading doctor dashboard:', err);
      setError(err instanceof Error ? err.message : 'An unexpected error occurred.');
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchDashboardData();
  }, [fetchDashboardData]);

  const getStatusBadge = (status: RecentPrescription['status']) => {
    switch (status) {
      case 'FILLED':
        return <Badge variant="success">Filled</Badge>;
      case 'PENDING':
        return <Badge variant="warning">Pending</Badge>;
      case 'CANNOT_FILL':
        return <Badge variant="destructive">Cannot Fill</Badge>;
      default:
        return <Badge variant="default">{status}</Badge>;
    }
  };

  const formatDate = (isoString: string) => {
    try {
      const date = new Date(isoString);
      return date.toLocaleDateString(undefined, {
        month: 'short',
        day: 'numeric',
        year: 'numeric',
      });
    } catch {
      return isoString;
    }
  };

  return (
    <div className="space-y-6">
      {/* Top Header & Doctor Profile Summary */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-2 border-b border-gray-200">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Clinical Dashboard</h1>
          <p className="text-sm text-gray-500 mt-1">
            {data ? (
              <span>
                Dr. Overview &bull; Spec:{' '}
                <strong className="text-gray-700">{data.doctor.specialization}</strong> &bull; License:{' '}
                <span className="font-mono text-gray-700">{data.doctor.licenseNumber}</span>
              </span>
            ) : (
              'Real-time overview of your patient roster and authored prescriptions.'
            )}
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
          <Button
            variant="primary"
            size="sm"
            onClick={() => setShowQuickActionNotice(true)}
            className="flex items-center gap-1.5 shadow-sm"
          >
            <svg
              className="w-4 h-4 text-white"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
            </svg>
            New Prescription
          </Button>
        </div>
      </div>

      {/* Quick Action Info Banner (Day 8 Notice) */}
      {showQuickActionNotice && (
        <div className="bg-blue-50 border-l-4 border-blue-500 p-4 rounded-r-md flex items-start justify-between">
          <div className="flex items-start">
            <svg
              className="w-5 h-5 text-blue-500 mt-0.5 mr-3 flex-shrink-0"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
              />
            </svg>
            <div>
              <p className="text-sm font-semibold text-blue-900">
                Prescription Creation Workflow
              </p>
              <p className="text-xs text-blue-700 mt-0.5">
                Full prescription authoring, medicine catalog picker, and PDF document generation will be available in Day 8 PR #21. You can inspect existing prescriptions in the list below.
              </p>
            </div>
          </div>
          <button
            onClick={() => setShowQuickActionNotice(false)}
            className="text-blue-400 hover:text-blue-600 text-sm font-bold ml-4"
          >
            &times;
          </button>
        </div>
      )}

      {/* ERROR STATE */}
      {error && (
        <div className="bg-red-50 border border-red-200 rounded-lg p-6 text-center space-y-3">
          <div className="w-12 h-12 rounded-full bg-red-100 text-red-600 flex items-center justify-center mx-auto">
            <svg
              className="w-6 h-6"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"
              />
            </svg>
          </div>
          <h3 className="text-lg font-medium text-red-900">Unable to load dashboard data</h3>
          <p className="text-sm text-red-700 max-w-md mx-auto">{error}</p>
          <Button variant="primary" size="sm" onClick={fetchDashboardData}>
            Try Again
          </Button>
        </div>
      )}

      {/* LOADING STATE (Skeletons) */}
      {isLoading && !data && (
        <div className="space-y-6">
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            {[1, 2, 3, 4].map((i) => (
              <div
                key={i}
                className="bg-white rounded-lg border border-gray-200 p-5 shadow-sm animate-pulse space-y-3"
              >
                <div className="h-4 bg-gray-200 rounded w-1/2"></div>
                <div className="h-8 bg-gray-200 rounded w-1/3"></div>
                <div className="h-3 bg-gray-100 rounded w-3/4"></div>
              </div>
            ))}
          </div>
          <div className="bg-white rounded-lg border border-gray-200 p-6 shadow-sm animate-pulse space-y-4">
            <div className="h-6 bg-gray-200 rounded w-1/4"></div>
            <div className="h-10 bg-gray-100 rounded w-full"></div>
            <div className="h-10 bg-gray-100 rounded w-full"></div>
            <div className="h-10 bg-gray-100 rounded w-full"></div>
          </div>
        </div>
      )}

      {/* SUCCESS STATE */}
      {data && (
        <>
          {/* Metrics Overview Cards */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            {/* Total Prescriptions */}
            <Card className="hover:shadow-md transition-shadow">
              <CardContent className="p-5">
                <div className="flex items-center justify-between">
                  <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider">
                    Total Prescriptions
                  </p>
                  <div className="w-8 h-8 rounded-full bg-blue-50 text-blue-600 flex items-center justify-center">
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
                <p className="text-3xl font-bold text-gray-900 mt-2">
                  {data.stats.totalPrescriptions}
                </p>
                <div className="mt-2 text-xs text-gray-500 flex items-center justify-between">
                  <span>Authored by you</span>
                  <Link
                    href="/doctor/prescriptions"
                    className="text-blue-600 hover:text-blue-800 font-medium"
                  >
                    View all &rarr;
                  </Link>
                </div>
              </CardContent>
            </Card>

            {/* Pending Prescriptions */}
            <Card className="hover:shadow-md transition-shadow border-yellow-200 bg-yellow-50/20">
              <CardContent className="p-5">
                <div className="flex items-center justify-between">
                  <p className="text-xs font-semibold text-yellow-800 uppercase tracking-wider">
                    Pending Fulfillment
                  </p>
                  <div className="w-8 h-8 rounded-full bg-yellow-100 text-yellow-700 flex items-center justify-center">
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z"
                      />
                    </svg>
                  </div>
                </div>
                <p className="text-3xl font-bold text-yellow-900 mt-2">
                  {data.stats.pendingCount}
                </p>
                <p className="mt-2 text-xs text-yellow-700">Awaiting pharmacy dispensing</p>
              </CardContent>
            </Card>

            {/* Filled Prescriptions */}
            <Card className="hover:shadow-md transition-shadow border-green-200 bg-green-50/20">
              <CardContent className="p-5">
                <div className="flex items-center justify-between">
                  <p className="text-xs font-semibold text-green-800 uppercase tracking-wider">
                    Filled Prescriptions
                  </p>
                  <div className="w-8 h-8 rounded-full bg-green-100 text-green-700 flex items-center justify-center">
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
                <p className="text-3xl font-bold text-green-900 mt-2">{data.stats.filledCount}</p>
                <div className="mt-2 flex items-center justify-between text-xs text-green-700">
                  <span>
                    Fill rate:{' '}
                    <strong>
                      {data.stats.totalPrescriptions > 0
                        ? Math.round(
                            (data.stats.filledCount / data.stats.totalPrescriptions) * 100
                          )
                        : 0}
                      %
                    </strong>
                  </span>
                </div>
              </CardContent>
            </Card>

            {/* Total Patients */}
            <Card className="hover:shadow-md transition-shadow">
              <CardContent className="p-5">
                <div className="flex items-center justify-between">
                  <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider">
                    Assigned Patients
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
                <p className="text-3xl font-bold text-gray-900 mt-2">
                  {data.stats.totalPatients}
                </p>
                <div className="mt-2 text-xs text-gray-500 flex items-center justify-between">
                  <span>In your roster</span>
                  <Link
                    href="/doctor/patients"
                    className="text-purple-600 hover:text-purple-800 font-medium"
                  >
                    View roster &rarr;
                  </Link>
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Quick Actions & Navigation Bar */}
          <div className="bg-gradient-to-r from-blue-600 to-indigo-700 rounded-lg p-5 text-white shadow-sm flex flex-col md:flex-row md:items-center justify-between gap-4">
            <div className="space-y-1">
              <h3 className="text-lg font-semibold">Clinical Workflow Actions</h3>
              <p className="text-xs text-blue-100">
                Access your linked patient care records or review fulfillment tracking queues.
              </p>
            </div>
            <div className="flex flex-wrap items-center gap-3">
              <Link href="/doctor/patients">
                <Button
                  variant="secondary"
                  size="sm"
                  className="bg-white/10 text-white hover:bg-white/20 border-0"
                >
                  Patient Roster ({data.stats.totalPatients})
                </Button>
              </Link>
              <Link href="/doctor/prescriptions">
                <Button
                  variant="secondary"
                  size="sm"
                  className="bg-white/10 text-white hover:bg-white/20 border-0"
                >
                  All Prescriptions ({data.stats.totalPrescriptions})
                </Button>
              </Link>
            </div>
          </div>

          {/* Recent Prescriptions Table */}
          <Card>
            <CardHeader className="flex flex-row items-center justify-between">
              <div>
                <CardTitle>Recent Prescriptions</CardTitle>
                <p className="text-xs text-gray-500 mt-0.5">
                  Latest prescriptions created by you
                </p>
              </div>
              <Link
                href="/doctor/prescriptions"
                className="text-xs font-semibold text-blue-600 hover:text-blue-800"
              >
                View all &rarr;
              </Link>
            </CardHeader>

            {/* EMPTY STATE */}
            {data.recentPrescriptions.length === 0 ? (
              <CardContent className="p-12 text-center space-y-3">
                <div className="w-12 h-12 rounded-full bg-gray-100 text-gray-400 flex items-center justify-center mx-auto">
                  <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={1.5}
                      d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"
                    />
                  </svg>
                </div>
                <h4 className="text-base font-semibold text-gray-800">No Prescriptions Yet</h4>
                <p className="text-xs text-gray-500 max-w-sm mx-auto">
                  You haven&apos;t created any prescriptions yet. Prescriptions authored by you will appear here with live tracking.
                </p>
              </CardContent>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left text-sm text-gray-600">
                  <thead className="bg-gray-50 text-xs uppercase text-gray-500 border-b border-gray-200">
                    <tr>
                      <th className="px-6 py-3 font-semibold">Prescription ID</th>
                      <th className="px-6 py-3 font-semibold">Patient</th>
                      <th className="px-6 py-3 font-semibold">Diagnosis</th>
                      <th className="px-6 py-3 font-semibold">Medications</th>
                      <th className="px-6 py-3 font-semibold">Status</th>
                      <th className="px-6 py-3 font-semibold">Created Date</th>
                      <th className="px-6 py-3 font-semibold text-right">Action</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100">
                    {data.recentPrescriptions.map((rx) => (
                      <tr key={rx.id} className="hover:bg-gray-50/80 transition-colors">
                        <td className="px-6 py-4 font-mono text-xs text-gray-800 font-semibold">
                          #{rx.id.slice(-8).toUpperCase()}
                        </td>
                        <td className="px-6 py-4">
                          <div className="font-medium text-gray-900">{rx.patient.name}</div>
                          {rx.patient.contactInfo && (
                            <div className="text-xs text-gray-400 truncate max-w-[150px]">
                              {rx.patient.contactInfo}
                            </div>
                          )}
                        </td>
                        <td className="px-6 py-4 max-w-[200px] truncate text-gray-700">
                          {rx.diagnosis}
                        </td>
                        <td className="px-6 py-4">
                          <div className="flex items-center gap-1.5">
                            <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-blue-50 text-blue-700">
                              {rx.prescriptionMedicines.length}{' '}
                              {rx.prescriptionMedicines.length === 1 ? 'med' : 'meds'}
                            </span>
                            <span className="text-xs text-gray-500 truncate max-w-[140px]">
                              {rx.prescriptionMedicines
                                .map((m) => m.medicine.name)
                                .join(', ')}
                            </span>
                          </div>
                        </td>
                        <td className="px-6 py-4">{getStatusBadge(rx.status)}</td>
                        <td className="px-6 py-4 text-xs text-gray-500">
                          {formatDate(rx.createdAt)}
                        </td>
                        <td className="px-6 py-4 text-right">
                          <Button
                            variant="secondary"
                            size="sm"
                            onClick={() => setSelectedPrescription(rx)}
                            className="text-xs h-8 px-2.5"
                          >
                            View
                          </Button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </Card>
        </>
      )}

      {/* PRESCRIPTION DETAIL MODAL */}
      {selectedPrescription && (
        <PrescriptionDetails
          prescription={selectedPrescription}
          viewerRole="DOCTOR"
          isModal={true}
          onClose={() => setSelectedPrescription(null)}
        />
      )}
    </div>
  );
}
