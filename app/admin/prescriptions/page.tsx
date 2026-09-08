<<<<<<< HEAD
import { EmptyState } from '@/components/ui/EmptyState';
=======
'use client';

import React, { useEffect, useState, useCallback, useMemo } from 'react';
import { Card, CardContent } from '@/components/ui/Card';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { Modal } from '@/components/ui/Modal';
import {
  PrescriptionDetails,
  PrescriptionData,
} from '@/components/prescriptions/PrescriptionDetails';

interface DoctorInfo {
  id: string;
  name: string;
  email: string;
  specialization?: string;
  licenseNumber?: string;
  phone?: string;
}

interface PatientInfo {
  id: string;
  name: string;
  age?: number;
  gender?: string;
  contactInfo?: string;
}

interface PrescriptionListItem {
  id: string;
  prescriptionId: string;
  status: 'PENDING' | 'FILLED' | 'CANNOT_FILL';
  createdAt: string;
  filledAt?: string | null;
  doctor: DoctorInfo;
  doctorName: string;
  patient: PatientInfo;
  patientName: string;
}

interface PrescriptionsResponse {
  prescriptions: PrescriptionListItem[];
}

type StatusFilter = 'ALL' | 'PENDING' | 'FILLED' | 'CANNOT_FILL';
>>>>>>> b4f1fa2b98e4279b1dac767894fa76c5a43470c5

export default function AdminPrescriptionsPage() {
  const [prescriptions, setPrescriptions] = useState<PrescriptionListItem[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('ALL');
  const [searchQuery, setSearchQuery] = useState<string>('');

  // Selected prescription modal state
  const [selectedPrescription, setSelectedPrescription] = useState<PrescriptionData | null>(null);
  const [isDetailLoading, setIsDetailLoading] = useState<boolean>(false);
  const [detailError, setDetailError] = useState<string | null>(null);
  const [isModalOpen, setIsModalOpen] = useState<boolean>(false);

  const fetchPrescriptions = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      const res = await fetch('/api/admin/prescriptions', { cache: 'no-store' });
      if (!res.ok) {
        const errJson = await res.json().catch(() => ({}));
        throw new Error(errJson.error || `Failed to fetch prescriptions (HTTP ${res.status})`);
      }
      const json: PrescriptionsResponse = await res.json();
      setPrescriptions(json.prescriptions || []);
    } catch (err) {
      console.error('Error fetching admin prescriptions:', err);
      setError(err instanceof Error ? err.message : 'An unexpected error occurred.');
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchPrescriptions();
  }, [fetchPrescriptions]);

  const handleOpenDetail = async (prescriptionId: string) => {
    setIsModalOpen(true);
    setIsDetailLoading(true);
    setDetailError(null);
    setSelectedPrescription(null);

    try {
      const res = await fetch(`/api/admin/prescriptions/${prescriptionId}`, {
        cache: 'no-store',
      });
      if (!res.ok) {
        const errJson = await res.json().catch(() => ({}));
        throw new Error(errJson.error || 'Failed to load prescription detail.');
      }
      const json = await res.json();
      const rx = json.prescription;
      const medicines = rx.prescriptionMedicines || rx.medicines || [];
      setSelectedPrescription({
        ...rx,
        prescriptionMedicines: medicines,
        medicines: medicines,
      });
    } catch (err) {
      console.error('Error loading prescription detail:', err);
      setDetailError(err instanceof Error ? err.message : 'Failed to load detail projection.');
    } finally {
      setIsDetailLoading(false);
    }
  };

  const handleCloseModal = () => {
    setIsModalOpen(false);
    setSelectedPrescription(null);
    setDetailError(null);
  };

  const filteredPrescriptions = useMemo(() => {
    return prescriptions.filter((rx) => {
      // 1. Status Filter
      if (statusFilter !== 'ALL' && rx.status !== statusFilter) {
        return false;
      }

      // 2. Search Query Filter
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase().trim();
        const matchesId = rx.id.toLowerCase().includes(q);
        const matchesPatient = rx.patientName?.toLowerCase().includes(q);
        const matchesDoctor = rx.doctorName?.toLowerCase().includes(q);
        const matchesSpec = rx.doctor?.specialization?.toLowerCase().includes(q);
        return matchesId || matchesPatient || matchesDoctor || matchesSpec;
      }

      return true;
    });
  }, [prescriptions, statusFilter, searchQuery]);

  const getStatusBadge = (status: PrescriptionListItem['status']) => {
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

  const formatDate = (isoString?: string | null) => {
    if (!isoString) return '—';
    try {
      return new Date(isoString).toLocaleDateString('en-US', {
        month: 'short',
        day: 'numeric',
        year: 'numeric',
      });
    } catch {
      return isoString;
    }
  };

  const statusCounts = useMemo(() => {
    return {
      all: prescriptions.length,
      pending: prescriptions.filter((rx) => rx.status === 'PENDING').length,
      filled: prescriptions.filter((rx) => rx.status === 'FILLED').length,
      cannotFill: prescriptions.filter((rx) => rx.status === 'CANNOT_FILL').length,
    };
  }, [prescriptions]);

  return (
<<<<<<< HEAD
    <div>
      <h2 className="text-2xl font-bold text-gray-900 mb-2">Prescriptions</h2>
      <EmptyState title="No prescription records to show" description="Platform-wide prescription oversight and audit records will appear here." />
=======
    <div className="space-y-8 p-4 sm:p-6 max-w-7xl mx-auto">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-gray-200">
        <div>
          <h1 className="text-2xl sm:text-3xl font-bold text-gray-900 tracking-tight">
            Prescription Management
          </h1>
          <p className="text-sm text-gray-500 mt-1">
            Platform-wide audit, lifecycle tracking, and clinical compliance monitoring.
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
          <h3 className="text-lg font-bold text-red-900">Unable to load prescriptions</h3>
          <p className="text-sm text-red-700 max-w-md mx-auto">{error}</p>
          <Button variant="primary" size="sm" onClick={fetchPrescriptions}>
            Retry
          </Button>
        </div>
      )}

      {/* FILTER TABS & SEARCH BAR */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        {/* Status Filter Tabs */}
        <div className="flex items-center gap-1.5 p-1 bg-gray-100 rounded-lg w-fit overflow-x-auto max-w-full">
          {(
            [
              { key: 'ALL', label: 'All', count: statusCounts.all },
              { key: 'PENDING', label: 'Pending', count: statusCounts.pending },
              { key: 'FILLED', label: 'Filled', count: statusCounts.filled },
              { key: 'CANNOT_FILL', label: 'Cannot Fill', count: statusCounts.cannotFill },
            ] as const
          ).map((tab) => (
            <button
              key={tab.key}
              onClick={() => setStatusFilter(tab.key)}
              className={`px-3 py-1.5 rounded-md text-xs font-semibold transition-all whitespace-nowrap ${
                statusFilter === tab.key
                  ? 'bg-white text-gray-900 shadow-sm'
                  : 'text-gray-600 hover:text-gray-900'
              }`}
            >
              {tab.label} ({tab.count})
            </button>
          ))}
        </div>

        {/* Search Input */}
        <div className="relative w-full md:max-w-xs">
          <input
            type="text"
            placeholder="Search by ID, patient, doctor..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 bg-white"
          />
          <svg
            className="w-5 h-5 text-gray-400 absolute left-3 top-2.5"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"
            />
          </svg>
        </div>
      </div>

      {/* LOADING SKELETON */}
      {isLoading && (
        <Card className="animate-pulse">
          <CardContent className="p-6 space-y-4">
            <div className="h-6 bg-gray-200 rounded w-1/4" />
            <div className="h-12 bg-gray-100 rounded w-full" />
            <div className="h-12 bg-gray-100 rounded w-full" />
            <div className="h-12 bg-gray-100 rounded w-full" />
          </CardContent>
        </Card>
      )}

      {/* PRESCRIPTIONS TABLE */}
      {!isLoading && !error && (
        <Card className="overflow-hidden shadow-sm">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm text-gray-600">
              <thead className="bg-gray-50 text-xs font-semibold uppercase tracking-wider text-gray-500 border-b border-gray-200">
                <tr>
                  <th scope="col" className="px-6 py-3.5">
                    Prescription ID
                  </th>
                  <th scope="col" className="px-6 py-3.5">
                    Patient
                  </th>
                  <th scope="col" className="px-6 py-3.5">
                    Authoring Doctor
                  </th>
                  <th scope="col" className="px-6 py-3.5">
                    Created Date
                  </th>
                  <th scope="col" className="px-6 py-3.5">
                    Status
                  </th>
                  <th scope="col" className="px-6 py-3.5">
                    Fulfillment
                  </th>
                  <th scope="col" className="px-6 py-3.5 text-right">
                    Action
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200">
                {filteredPrescriptions.length === 0 ? (
                  <tr>
                    <td colSpan={7} className="px-6 py-12 text-center text-gray-500">
                      <div className="w-12 h-12 rounded-full bg-gray-100 text-gray-400 flex items-center justify-center mx-auto mb-3">
                        <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            strokeWidth={2}
                            d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"
                          />
                        </svg>
                      </div>
                      <p className="text-base font-semibold text-gray-700">No prescriptions found</p>
                      <p className="text-xs text-gray-500 mt-1">
                        {searchQuery || statusFilter !== 'ALL'
                          ? 'Try changing the status filter or clearing your search.'
                          : 'No prescriptions have been authored yet.'}
                      </p>
                      {(searchQuery || statusFilter !== 'ALL') && (
                        <Button
                          variant="secondary"
                          size="sm"
                          onClick={() => {
                            setStatusFilter('ALL');
                            setSearchQuery('');
                          }}
                          className="mt-3"
                        >
                          Reset Filters
                        </Button>
                      )}
                    </td>
                  </tr>
                ) : (
                  filteredPrescriptions.map((rx) => (
                    <tr key={rx.id} className="hover:bg-gray-50/75 transition-colors">
                      <td className="px-6 py-4 font-mono text-xs font-semibold text-gray-800">
                        {rx.id.slice(0, 10)}...
                      </td>
                      <td className="px-6 py-4">
                        <div className="font-semibold text-gray-900">{rx.patientName}</div>
                        <div className="text-xs text-gray-500">
                          {rx.patient?.gender ? `${rx.patient.gender}, ` : ''}
                          {rx.patient?.age ? `${rx.patient.age} yrs` : ''}
                        </div>
                      </td>
                      <td className="px-6 py-4">
                        <div className="font-semibold text-gray-900">{rx.doctorName}</div>
                        <div className="text-xs text-gray-500">{rx.doctor?.specialization || 'Clinical'}</div>
                      </td>
                      <td className="px-6 py-4 text-xs text-gray-600">{formatDate(rx.createdAt)}</td>
                      <td className="px-6 py-4">{getStatusBadge(rx.status)}</td>
                      <td className="px-6 py-4 text-xs text-gray-600">
                        {rx.status === 'FILLED' ? (
                          <span className="text-emerald-700 font-medium">
                            {formatDate(rx.filledAt)}
                          </span>
                        ) : rx.status === 'CANNOT_FILL' ? (
                          <span className="text-rose-600 font-medium">Declined</span>
                        ) : (
                          <span className="text-yellow-700 font-medium">In Queue</span>
                        )}
                      </td>
                      <td className="px-6 py-4 text-right">
                        <Button
                          variant="secondary"
                          size="sm"
                          onClick={() => handleOpenDetail(rx.id)}
                          className="text-xs font-semibold"
                        >
                          View Details
                        </Button>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </Card>
      )}

      {/* DETAIL MODAL PROJECTION */}
      <Modal
        isOpen={isModalOpen}
        onClose={handleCloseModal}
        title="Administrative Prescription Detail"
        maxWidth="3xl"
        footer={
          <Button variant="secondary" size="sm" onClick={handleCloseModal}>
            Close
          </Button>
        }
      >
        {isDetailLoading && (
          <div className="py-12 text-center space-y-3">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto" />
            <p className="text-xs text-gray-500">Loading prescription projection...</p>
          </div>
        )}

        {detailError && (
          <div className="p-4 bg-red-50 text-red-700 rounded-lg text-sm text-center">
            {detailError}
          </div>
        )}

        {!isDetailLoading && !detailError && selectedPrescription && (
          <div className="max-h-[70vh] overflow-y-auto pr-1">
            <PrescriptionDetails
              prescription={selectedPrescription}
              viewerRole="ADMIN"
              isModal={true}
              onClose={handleCloseModal}
            />
          </div>
        )}
      </Modal>
>>>>>>> b4f1fa2b98e4279b1dac767894fa76c5a43470c5
    </div>
  );
}
