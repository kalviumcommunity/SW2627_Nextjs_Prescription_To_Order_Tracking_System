'use client';

import React, { useEffect, useState, useCallback, useMemo } from 'react';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';

interface Patient {
  id: string;
  name: string;
  age: number;
  gender: string;
  contactInfo: string;
  createdAt: string;
}

interface DoctorInfo {
  id: string;
  specialization: string;
  licenseNumber: string;
}

interface PatientsResponse {
  doctor: DoctorInfo;
  patients: Patient[];
}

export default function DoctorPatientsPage() {
  const [data, setData] = useState<PatientsResponse | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');

  const fetchPatients = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      const res = await fetch('/api/doctor/patients');
      if (!res.ok) {
        const errJson = await res.json().catch(() => ({}));
        throw new Error(errJson.error || `Failed to fetch patients (HTTP ${res.status})`);
      }
      const json: PatientsResponse = await res.json();
      setData(json);
    } catch (err) {
      console.error('Error fetching doctor patient roster:', err);
      setError(err instanceof Error ? err.message : 'An unexpected error occurred.');
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchPatients();
  }, [fetchPatients]);

  const filteredPatients = useMemo(() => {
    if (!data?.patients) return [];
    if (!searchQuery.trim()) return data.patients;

    const q = searchQuery.toLowerCase();
    return data.patients.filter(
      (p) =>
        p.name.toLowerCase().includes(q) ||
        p.gender.toLowerCase().includes(q) ||
        p.contactInfo.toLowerCase().includes(q) ||
        String(p.age).includes(q)
    );
  }, [data?.patients, searchQuery]);

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
          <h1 className="text-2xl font-bold text-gray-900">Patient Roster</h1>
          <p className="text-sm text-gray-500 mt-1">
            {data ? (
              <span>
                Assigned care roster &bull; {data.patients.length} linked{' '}
                {data.patients.length === 1 ? 'patient' : 'patients'} &bull; Spec:{' '}
                <strong className="text-gray-700">{data.doctor.specialization}</strong>
              </span>
            ) : (
              'Patients explicitly assigned to your clinical care.'
            )}
          </p>
        </div>
        <div className="flex items-center gap-3">
          <Button
            variant="secondary"
            size="sm"
            onClick={fetchPatients}
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
          <h3 className="text-lg font-medium text-red-900">Failed to load patient roster</h3>
          <p className="text-sm text-red-700 max-w-md mx-auto">{error}</p>
          <Button variant="primary" size="sm" onClick={fetchPatients}>
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
            {[1, 2, 3, 4].map((i) => (
              <div key={i} className="h-12 bg-gray-100 rounded w-full"></div>
            ))}
          </div>
        </div>
      )}

      {/* SUCCESS CONTENT */}
      {data && (
        <div className="space-y-4">
          {/* Search & Summary Bar */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-white p-4 rounded-lg border border-gray-200 shadow-sm">
            <div className="relative flex-1 max-w-md">
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
                placeholder="Search by name, contact, or gender..."
                className="w-full pl-9 pr-4 py-2 text-sm border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
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
            <div className="text-xs text-gray-500 flex items-center gap-2">
              <span>Showing:</span>
              <span className="font-semibold text-gray-900 bg-gray-100 px-2 py-0.5 rounded">
                {filteredPatients.length} of {data.patients.length} patients
              </span>
            </div>
          </div>

          {/* Patient Roster Table */}
          <Card>
            <CardHeader className="flex flex-row items-center justify-between">
              <div>
                <CardTitle>Assigned Patients</CardTitle>
                <p className="text-xs text-gray-500 mt-0.5">
                  Patients linked to your care roster via clinical assignment
                </p>
              </div>
            </CardHeader>

            {/* EMPTY ROSTER (Doctor has 0 patients) */}
            {data.patients.length === 0 ? (
              <CardContent className="p-12 text-center space-y-3">
                <div className="w-12 h-12 rounded-full bg-gray-100 text-gray-400 flex items-center justify-center mx-auto">
                  <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={1.5}
                      d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z"
                    />
                  </svg>
                </div>
                <h4 className="text-base font-semibold text-gray-800">No Patients in Roster</h4>
                <p className="text-xs text-gray-500 max-w-sm mx-auto">
                  You do not have any patients linked to your roster yet. New patients will appear here when assigned.
                </p>
              </CardContent>
            ) : filteredPatients.length === 0 ? (
              /* EMPTY FILTER RESULTS */
              <CardContent className="p-8 text-center space-y-2">
                <p className="text-sm font-medium text-gray-700">No matching patients found</p>
                <p className="text-xs text-gray-500">
                  No patient names or contact records matched &quot;{searchQuery}&quot;.
                </p>
                <Button
                  variant="secondary"
                  size="sm"
                  onClick={() => setSearchQuery('')}
                  className="mt-2 text-xs"
                >
                  Clear Search
                </Button>
              </CardContent>
            ) : (
              /* PATIENTS TABLE */
              <div className="overflow-x-auto">
                <table className="w-full text-left text-sm text-gray-600">
                  <thead className="bg-gray-50 text-xs uppercase text-gray-500 border-b border-gray-200">
                    <tr>
                      <th className="px-6 py-3 font-semibold">Patient Name</th>
                      <th className="px-6 py-3 font-semibold">Age / Gender</th>
                      <th className="px-6 py-3 font-semibold">Contact & Address</th>
                      <th className="px-6 py-3 font-semibold">Care Since</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100">
                    {filteredPatients.map((patient) => (
                      <tr key={patient.id} className="hover:bg-gray-50/80 transition-colors">
                        <td className="px-6 py-4">
                          <div className="flex items-center gap-3">
                            <div className="w-8 h-8 rounded-full bg-blue-100 text-blue-700 font-bold flex items-center justify-center text-xs">
                              {patient.name.charAt(0)}
                            </div>
                            <div>
                              <div className="font-semibold text-gray-900">{patient.name}</div>
                              <div className="font-mono text-xs text-gray-400">
                                ID: #{patient.id.slice(-6).toUpperCase()}
                              </div>
                            </div>
                          </div>
                        </td>
                        <td className="px-6 py-4">
                          <div className="text-gray-900 font-medium">{patient.age} yrs</div>
                          <div className="text-xs text-gray-500 capitalize">{patient.gender}</div>
                        </td>
                        <td className="px-6 py-4 text-xs text-gray-700 max-w-xs">
                          {patient.contactInfo || 'No contact info provided'}
                        </td>
                        <td className="px-6 py-4 text-xs text-gray-500">
                          {formatDate(patient.createdAt)}
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
    </div>
  );
}
