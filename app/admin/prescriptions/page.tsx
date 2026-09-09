'use client';

import React, { useEffect, useState, useCallback, useMemo } from 'react';
import { Card } from '@/components/ui/Card';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { Modal } from '@/components/ui/Modal';
import { LoadingState } from '@/components/ui/LoadingState';
import { EmptyState } from '@/components/ui/EmptyState';
import { ErrorState } from '@/components/ui/ErrorState';
import { PrescriptionStatus } from '@/components/prescriptions/PrescriptionStatus';
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
    <div className="space-y-8 p-4 sm:p-6 max-w-7xl mx-auto">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-gray-200">
        <div>
          <div className="flex items-center gap-3">
            <h1 className="text-2xl sm:text-3xl font-bold text-gray-900 tracking-tight">
              Prescription Management
            </h1>
            <Badge variant="info">Audited</Badge>
          </div>
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
        <ErrorState
          title="Unable to load prescriptions"
          message={error}
          onRetry={fetchPrescriptions}
        />
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
        <div className="py-8" aria-label="loading">
          <LoadingState message="Loading prescriptions..." />
        </div>
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
                    <td colSpan={7} className="p-6">
                      <EmptyState
                        title="No prescriptions found"
                        description={
                          searchQuery || statusFilter !== 'ALL'
                            ? 'Try changing the status filter or clearing your search.'
                            : 'No prescriptions have been authored yet.'
                        }
                        action={
                          (searchQuery || statusFilter !== 'ALL') ? (
                            <Button
                              variant="secondary"
                              size="sm"
                              onClick={() => {
                                setStatusFilter('ALL');
                                setSearchQuery('');
                              }}
                            >
                              Reset Filters
                            </Button>
                          ) : undefined
                        }
                      />
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
                      <td className="px-6 py-4"><PrescriptionStatus status={rx.status} /></td>
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
          <div className="py-8">
            <LoadingState message="Loading prescription projection..." />
          </div>
        )}

        {detailError && (
          <ErrorState
            title="Unable to load prescription detail"
            message={detailError}
          />
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
    </div>
  );
}
