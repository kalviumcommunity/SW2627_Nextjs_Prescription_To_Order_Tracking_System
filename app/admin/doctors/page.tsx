'use client';

import React, { useEffect, useState, useCallback, useMemo } from 'react';
import { Card, CardContent } from '@/components/ui/Card';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { LoadingState } from '@/components/ui/LoadingState';
import { EmptyState } from '@/components/ui/EmptyState';
import { ErrorState } from '@/components/ui/ErrorState';
import { getApiErrorMessage } from '@/lib/client-errors';

interface DoctorItem {
  id: string;
  userId: string;
  name: string;
  email: string;
  specialization: string;
  licenseNumber: string;
  phone: string;
  totalPrescriptions?: number;
  assignedPatientsCount?: number;
  createdAt: string;
  updatedAt: string;
}

interface DoctorsResponse {
  doctors: DoctorItem[];
}

export default function AdminDoctorsPage() {
  const [doctors, setDoctors] = useState<DoctorItem[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState<string>('');

  const fetchDoctors = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      const res = await fetch('/api/admin/doctors', { cache: 'no-store' });
      if (!res.ok) {
        const errJson = await res.json().catch(() => ({}));
        throw new Error(getApiErrorMessage(errJson, `Failed to fetch doctors (HTTP ${res.status})`));
      }
      const json: DoctorsResponse = await res.json();
      setDoctors(json.doctors || []);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'An unexpected error occurred.');
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchDoctors();
  }, [fetchDoctors]);

  const filteredDoctors = useMemo(() => {
    if (!searchQuery.trim()) {
      return doctors;
    }
    const q = searchQuery.toLowerCase().trim();
    return doctors.filter(
      (doc) =>
        doc.name.toLowerCase().includes(q) ||
        doc.email.toLowerCase().includes(q) ||
        doc.specialization.toLowerCase().includes(q) ||
        doc.licenseNumber.toLowerCase().includes(q) ||
        doc.phone.toLowerCase().includes(q)
    );
  }, [doctors, searchQuery]);

  const formatDate = (isoString?: string) => {
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

  return (
    <div className="space-y-8 p-4 sm:p-6 max-w-7xl mx-auto">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-gray-200">
        <div>
          <h1 className="text-2xl sm:text-3xl font-bold text-gray-900 tracking-tight">
            Doctor Directory
          </h1>
          <p className="text-sm text-gray-500 mt-1">
            Administrative registry of credentialed doctors, specialties, licenses, and practice volume.
          </p>
        </div>
        <div className="flex items-center gap-3">
          <Button
            variant="secondary"
            size="sm"
            onClick={fetchDoctors}
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

      {/* Summary KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <Card>
          <CardContent className="p-5">
            <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider">
              Total Doctors
            </p>
            <p className="text-2xl font-bold text-gray-900 mt-1">{doctors.length}</p>
            <p className="text-xs text-gray-500 mt-1">Verified clinician accounts</p>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-5">
            <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider">
              Active Specialties
            </p>
            <p className="text-2xl font-bold text-blue-600 mt-1">
              {new Set(doctors.map((d) => d.specialization)).size}
            </p>
            <p className="text-xs text-gray-500 mt-1">Clinical departments represented</p>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-5">
            <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider">
              Total Authored Prescriptions
            </p>
            <p className="text-2xl font-bold text-indigo-600 mt-1">
              {doctors.reduce((acc, curr) => acc + (curr.totalPrescriptions || 0), 0)}
            </p>
            <p className="text-xs text-gray-500 mt-1">Across all clinician rosters</p>
          </CardContent>
        </Card>
      </div>

      {/* ERROR STATE */}
      {error && (
        <ErrorState
          title="Unable to load doctor directory"
          message={error}
          onRetry={fetchDoctors}
        />
      )}

      {/* SEARCH AND FILTER BAR */}
      <div className="flex flex-col sm:flex-row items-center justify-between gap-4">
        <div className="relative w-full sm:max-w-md">
          <input
            type="text"
            placeholder="Search by doctor name, specialty, license, or phone..."
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
        <div className="text-xs text-gray-500 font-medium">
          Showing {filteredDoctors.length} of {doctors.length} doctors
        </div>
      </div>

      {/* LOADING SKELETON */}
      {isLoading && (
        <div className="py-8" aria-label="loading">
          <LoadingState message="Loading doctor directory..." />
        </div>
      )}

      {/* DOCTORS TABLE */}
      {!isLoading && !error && (
        <Card className="overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm text-gray-600">
              <thead className="bg-gray-50 text-xs font-semibold uppercase tracking-wider text-gray-500 border-b border-gray-200">
                <tr>
                  <th scope="col" className="px-6 py-3.5">
                    Doctor
                  </th>
                  <th scope="col" className="px-6 py-3.5">
                    Specialization
                  </th>
                  <th scope="col" className="px-6 py-3.5">
                    License Number
                  </th>
                  <th scope="col" className="px-6 py-3.5">
                    Contact Phone
                  </th>
                  <th scope="col" className="px-6 py-3.5">
                    Registered Date
                  </th>
                  <th scope="col" className="px-6 py-3.5 text-right">
                    Prescriptions
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200">
                {filteredDoctors.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="p-6">
                      <EmptyState
                        title="No doctors found"
                        description={
                          searchQuery
                            ? 'Try adjusting your search criteria.'
                            : 'No registered doctors in the system.'
                        }
                        action={
                          searchQuery ? (
                            <Button
                              variant="secondary"
                              size="sm"
                              onClick={() => setSearchQuery('')}
                            >
                              Clear Search
                            </Button>
                          ) : undefined
                        }
                      />
                    </td>
                  </tr>
                ) : (
                  filteredDoctors.map((doc) => (
                    <tr key={doc.id} className="hover:bg-gray-50/75 transition-colors">
                      <td className="px-6 py-4">
                        <div className="font-semibold text-gray-900">{doc.name}</div>
                        <div className="text-xs text-gray-500 font-mono mt-0.5">{doc.email}</div>
                      </td>
                      <td className="px-6 py-4">
                        <Badge variant="info" className="font-medium">
                          {doc.specialization}
                        </Badge>
                      </td>
                      <td className="px-6 py-4 font-mono text-xs font-semibold text-gray-700">
                        {doc.licenseNumber}
                      </td>
                      <td className="px-6 py-4 text-gray-700">{doc.phone || '—'}</td>
                      <td className="px-6 py-4 text-gray-500">{formatDate(doc.createdAt)}</td>
                      <td className="px-6 py-4 text-right">
                        <span className="font-semibold text-gray-900">
                          {doc.totalPrescriptions ?? 0}
                        </span>{' '}
                        <span className="text-xs text-gray-500">Rx</span>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </Card>
      )}
    </div>
  );
}
