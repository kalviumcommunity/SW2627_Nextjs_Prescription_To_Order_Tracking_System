'use client';

import React, { useEffect, useState, useCallback, useMemo } from 'react';
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

interface Prescription {
  id: string;
  diagnosis: string;
  status: 'PENDING' | 'FILLED' | 'CANNOT_FILL';
  createdAt: string;
  patient: PatientInfo;
  prescriptionMedicines: MedicineItem[];
  fill?: FillInfo | null;
}

interface PrescriptionsResponse {
  doctor: {
    id: string;
    specialization: string;
  };
  prescriptions: Prescription[];
}

type StatusFilter = 'ALL' | 'PENDING' | 'FILLED' | 'CANNOT_FILL';

export default function DoctorPrescriptionsPage() {
  const [data, setData] = useState<PrescriptionsResponse | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('ALL');
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedPrescription, setSelectedPrescription] = useState<Prescription | null>(null);

  const fetchPrescriptions = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      const res = await fetch('/api/doctor/prescriptions');
      if (!res.ok) {
        const errJson = await res.json().catch(() => ({}));
        throw new Error(errJson.error || `Failed to fetch prescriptions (HTTP ${res.status})`);
      }
      const json: PrescriptionsResponse = await res.json();
      setData(json);
    } catch (err) {
      console.error('Error fetching doctor prescriptions:', err);
      setError(err instanceof Error ? err.message : 'An unexpected error occurred.');
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchPrescriptions();
  }, [fetchPrescriptions]);

  const filteredPrescriptions = useMemo(() => {
    if (!data?.prescriptions) return [];

    return data.prescriptions.filter((rx) => {
      // 1. Status Filter
      if (statusFilter !== 'ALL' && rx.status !== statusFilter) {
        return false;
      }

      // 2. Text Search
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        const matchesPatient = rx.patient.name.toLowerCase().includes(q);
        const matchesId = rx.id.toLowerCase().includes(q);
        const matchesDiagnosis = rx.diagnosis.toLowerCase().includes(q);
        const matchesMed = rx.prescriptionMedicines.some(
          (m) =>
            m.medicine.name.toLowerCase().includes(q) ||
            m.medicine.genericName.toLowerCase().includes(q)
        );

        if (!matchesPatient && !matchesId && !matchesDiagnosis && !matchesMed) {
          return false;
        }
      }

      return true;
    });
  }, [data?.prescriptions, statusFilter, searchQuery]);

  const counts = useMemo(() => {
    if (!data?.prescriptions) return { all: 0, pending: 0, filled: 0, cannotFill: 0 };
    return {
      all: data.prescriptions.length,
      pending: data.prescriptions.filter((rx) => rx.status === 'PENDING').length,
      filled: data.prescriptions.filter((rx) => rx.status === 'FILLED').length,
      cannotFill: data.prescriptions.filter((rx) => rx.status === 'CANNOT_FILL').length,
    };
  }, [data?.prescriptions]);

  const getStatusBadge = (status: Prescription['status']) => {
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
      {/* Top Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-2 border-b border-gray-200">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Authored Prescriptions</h1>
          <p className="text-sm text-gray-500 mt-1">
            {data ? (
              <span>
                Prescriptions issued by your clinical profile &bull; {data.prescriptions.length} total{' '}
                {data.prescriptions.length === 1 ? 'record' : 'records'}
              </span>
            ) : (
              'Manage and inspect your issued prescriptions.'
            )}
          </p>
        </div>
        <div className="flex items-center gap-3">
          <Button
            variant="secondary"
            size="sm"
            onClick={fetchPrescriptions}
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
        </div>
      </div>

      {/* ERROR STATE */}
      {error && (
        <div className="bg-red-50 border border-red-200 rounded-lg p-6 text-center space-y-3">
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
          <h3 className="text-lg font-medium text-red-900">Unable to load prescriptions</h3>
          <p className="text-sm text-red-700 max-w-md mx-auto">{error}</p>
          <Button variant="primary" size="sm" onClick={fetchPrescriptions}>
            Try Again
          </Button>
        </div>
      )}

      {/* LOADING STATE */}
      {isLoading && !data && (
        <div className="space-y-4">
          <div className="h-10 bg-gray-200 rounded-lg animate-pulse w-full max-w-md"></div>
          <div className="bg-white rounded-lg border border-gray-200 p-6 shadow-sm animate-pulse space-y-4">
            <div className="h-6 bg-gray-200 rounded w-1/4"></div>
            {[1, 2, 3, 4, 5].map((i) => (
              <div key={i} className="h-12 bg-gray-100 rounded w-full"></div>
            ))}
          </div>
        </div>
      )}

      {/* SUCCESS CONTENT */}
      {data && (
        <div className="space-y-4">
          {/* Controls Bar: Filters & Search */}
          <div className="bg-white p-4 rounded-lg border border-gray-200 shadow-sm space-y-4 sm:space-y-0 sm:flex sm:items-center sm:justify-between gap-4">
            {/* Filter Tabs */}
            <div className="flex items-center gap-1 bg-gray-100 p-1 rounded-lg">
              <button
                onClick={() => setStatusFilter('ALL')}
                className={`px-3 py-1.5 rounded-md text-xs font-semibold transition-all ${
                  statusFilter === 'ALL'
                    ? 'bg-white text-gray-900 shadow-sm'
                    : 'text-gray-600 hover:text-gray-900'
                }`}
              >
                All ({counts.all})
              </button>
              <button
                onClick={() => setStatusFilter('PENDING')}
                className={`px-3 py-1.5 rounded-md text-xs font-semibold transition-all ${
                  statusFilter === 'PENDING'
                    ? 'bg-yellow-50 text-yellow-900 shadow-sm border border-yellow-200'
                    : 'text-yellow-700 hover:text-yellow-900'
                }`}
              >
                Pending ({counts.pending})
              </button>
              <button
                onClick={() => setStatusFilter('FILLED')}
                className={`px-3 py-1.5 rounded-md text-xs font-semibold transition-all ${
                  statusFilter === 'FILLED'
                    ? 'bg-green-50 text-green-900 shadow-sm border border-green-200'
                    : 'text-green-700 hover:text-green-900'
                }`}
              >
                Filled ({counts.filled})
              </button>
              <button
                onClick={() => setStatusFilter('CANNOT_FILL')}
                className={`px-3 py-1.5 rounded-md text-xs font-semibold transition-all ${
                  statusFilter === 'CANNOT_FILL'
                    ? 'bg-red-50 text-red-900 shadow-sm border border-red-200'
                    : 'text-red-700 hover:text-red-900'
                }`}
              >
                Cannot Fill ({counts.cannotFill})
              </button>
            </div>

            {/* Search Input */}
            <div className="relative flex-1 max-w-sm">
              <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-gray-400">
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"
                  />
                </svg>
              </div>
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search patient, medication, diagnosis..."
                className="w-full pl-9 pr-4 py-1.5 text-xs border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              />
              {searchQuery && (
                <button
                  onClick={() => setSearchQuery('')}
                  className="absolute inset-y-0 right-0 pr-3 flex items-center text-xs text-gray-400 hover:text-gray-600"
                >
                  Clear
                </button>
              )}
            </div>
          </div>

          {/* Prescriptions Table */}
          <Card>
            <CardHeader className="flex flex-row items-center justify-between">
              <div>
                <CardTitle>Prescription Records</CardTitle>
                <p className="text-xs text-gray-500 mt-0.5">
                  Showing {filteredPrescriptions.length} of {data.prescriptions.length} prescriptions
                </p>
              </div>
            </CardHeader>

            {/* EMPTY STATE */}
            {data.prescriptions.length === 0 ? (
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
                <h4 className="text-base font-semibold text-gray-800">No Prescriptions Issued</h4>
                <p className="text-xs text-gray-500 max-w-sm mx-auto">
                  You have not authored any prescriptions yet. Newly created prescriptions will appear here.
                </p>
              </CardContent>
            ) : filteredPrescriptions.length === 0 ? (
              <CardContent className="p-8 text-center space-y-2">
                <p className="text-sm font-medium text-gray-700">No prescriptions match your filter</p>
                <p className="text-xs text-gray-500">
                  Try switching the status filter tab or clearing the search query.
                </p>
                <Button
                  variant="secondary"
                  size="sm"
                  onClick={() => {
                    setStatusFilter('ALL');
                    setSearchQuery('');
                  }}
                  className="mt-2 text-xs"
                >
                  Reset Filters
                </Button>
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
                      <th className="px-6 py-3 font-semibold">Date</th>
                      <th className="px-6 py-3 font-semibold text-right">Action</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100">
                    {filteredPrescriptions.map((rx) => (
                      <tr key={rx.id} className="hover:bg-gray-50/80 transition-colors">
                        <td className="px-6 py-4 font-mono text-xs text-gray-900 font-bold">
                          #{rx.id.slice(-8).toUpperCase()}
                        </td>
                        <td className="px-6 py-4">
                          <div className="font-semibold text-gray-900">{rx.patient.name}</div>
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
                            <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-semibold bg-blue-50 text-blue-700">
                              {rx.prescriptionMedicines.length}{' '}
                              {rx.prescriptionMedicines.length === 1 ? 'item' : 'items'}
                            </span>
                            <span className="text-xs text-gray-500 truncate max-w-[130px]">
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
                            className="text-xs h-8 px-3"
                          >
                            View Details
                          </Button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </Card>
        </div>
      )}

      {/* DETAILED INSPECTION MODAL */}
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
