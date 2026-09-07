'use client';

import React, { useEffect, useState, useCallback, useMemo } from 'react';
import { Card, CardContent } from '@/components/ui/Card';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';

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
        throw new Error(errJson.error || `Failed to fetch doctors (HTTP ${res.status})`);
      }
      const json: DoctorsResponse = await res.json();
      setDoctors(json.doctors || []);
    } catch (err) {
      console.error('Error fetching admin doctors:', err);
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
          <h3 className="text-lg font-bold text-red-900">Unable to load doctor directory</h3>
          <p className="text-sm text-red-700 max-w-md mx-auto">{error}</p>
          <Button variant="primary" size="sm" onClick={fetchDoctors}>
            Retry
          </Button>
        </div>
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
        <Card className="animate-pulse">
          <CardContent className="p-6 space-y-4">
            <div className="h-6 bg-gray-200 rounded w-1/4" />
            <div className="h-10 bg-gray-100 rounded w-full" />
            <div className="h-10 bg-gray-100 rounded w-full" />
            <div className="h-10 bg-gray-100 rounded w-full" />
          </CardContent>
        </Card>
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
                    <td colSpan={6} className="px-6 py-12 text-center text-gray-500">
                      <div className="w-12 h-12 rounded-full bg-gray-100 text-gray-400 flex items-center justify-center mx-auto mb-3">
                        <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            strokeWidth={2}
                            d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z"
                          />
                        </svg>
                      </div>
                      <p className="text-base font-semibold text-gray-700">No doctors found</p>
                      <p className="text-xs text-gray-500 mt-1">
                        {searchQuery ? 'Try adjusting your search criteria.' : 'No registered doctors in the system.'}
                      </p>
                      {searchQuery && (
                        <Button
                          variant="secondary"
                          size="sm"
                          onClick={() => setSearchQuery('')}
                          className="mt-3"
                        >
                          Clear Search
                        </Button>
                      )}
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
