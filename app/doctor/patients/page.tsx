'use client';

import React, { useEffect, useState, useCallback, useMemo } from 'react';
import Link from 'next/link';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { getApiErrorMessage } from '@/lib/client-errors';

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

interface AvailablePatient {
  id: string;
  name: string;
  age: number;
  gender: string;
  contactInfo: string;
}

// ─── Assign Patient Modal ────────────────────────────────────────────────────

function AssignPatientModal({
  onClose,
  onAssigned,
}: {
  onClose: () => void;
  onAssigned: (patient: Patient) => void;
}) {
  const [availablePatients, setAvailablePatients] = useState<AvailablePatient[]>([]);
  const [loadingPatients, setLoadingPatients] = useState(true);
  const [fetchError, setFetchError] = useState<string | null>(null);

  const [searchQuery, setSearchQuery] = useState('');
  const [selectedPatientId, setSelectedPatientId] = useState('');
  const [assigning, setAssigning] = useState(false);
  const [assignError, setAssignError] = useState<string | null>(null);

  // Fetch all unassigned patients when modal opens
  useEffect(() => {
    const fetchAvailable = async () => {
      try {
        const res = await fetch('/api/doctor/patients/available');
        if (!res.ok) {
          const errJson = await res.json().catch(() => ({}));
          throw new Error(getApiErrorMessage(errJson, 'Failed to load available patients.'));
        }
        const json = await res.json();
        setAvailablePatients(json.patients ?? []);
      } catch (err) {
        setFetchError(err instanceof Error ? err.message : 'Failed to load patients.');
      } finally {
        setLoadingPatients(false);
      }
    };
    fetchAvailable();
  }, []);

  const filteredPatients = useMemo(() => {
    if (!searchQuery.trim()) return availablePatients;
    const q = searchQuery.toLowerCase();
    return availablePatients.filter(
      (p) =>
        p.name.toLowerCase().includes(q) ||
        p.gender.toLowerCase().includes(q) ||
        p.contactInfo.toLowerCase().includes(q)
    );
  }, [availablePatients, searchQuery]);

  const handleAssign = async () => {
    if (!selectedPatientId) {
      setAssignError('Please select a patient to assign.');
      return;
    }
    setAssignError(null);
    setAssigning(true);
    try {
      const res = await fetch('/api/doctor/patients/assign', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ patientId: selectedPatientId }),
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) {
        throw new Error(getApiErrorMessage(json, 'Failed to assign patient.'));
      }
      // Pass the full patient object back so the roster updates immediately
      onAssigned({
        ...json.patient,
        createdAt: json.patient.createdAt ?? new Date().toISOString(),
      });
    } catch (err) {
      setAssignError(err instanceof Error ? err.message : 'Failed to assign patient.');
    } finally {
      setAssigning(false);
    }
  };

  // Close on Escape key
  useEffect(() => {
    const handler = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [onClose]);

  const selectedPatient = availablePatients.find((p) => p.id === selectedPatientId);

  return (
    /* Backdrop */
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm p-4"
      onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg border border-gray-200 overflow-hidden">
        {/* Modal Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100 bg-gradient-to-r from-blue-50 to-white">
          <div>
            <h2 className="text-lg font-bold text-gray-900">Assign Patient to Roster</h2>
            <p className="text-xs text-gray-500 mt-0.5">
              Search and select a patient to add to your care roster.
            </p>
          </div>
          <button
            onClick={onClose}
            className="w-8 h-8 flex items-center justify-center rounded-full text-gray-400 hover:bg-gray-100 hover:text-gray-600 transition-colors"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Modal Body */}
        <div className="px-6 py-5 space-y-4">
          {fetchError ? (
            <div className="rounded-lg bg-red-50 border border-red-200 p-4 text-sm text-red-700">
              {fetchError}
            </div>
          ) : loadingPatients ? (
            <div className="space-y-3">
              {[1, 2, 3].map((i) => (
                <div key={i} className="h-10 bg-gray-100 rounded-lg animate-pulse" />
              ))}
            </div>
          ) : availablePatients.length === 0 ? (
            <div className="text-center py-8 space-y-2">
              <div className="w-12 h-12 rounded-full bg-gray-100 text-gray-400 flex items-center justify-center mx-auto">
                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5}
                    d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0z"
                  />
                </svg>
              </div>
              <p className="text-sm font-medium text-gray-700">All patients are already assigned</p>
              <p className="text-xs text-gray-500">No unassigned patients exist in the system.</p>
            </div>
          ) : (
            <>
              {/* Search */}
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-gray-400">
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                      d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"
                    />
                  </svg>
                </div>
                <input
                  type="text"
                  value={searchQuery}
                  onChange={(e) => { setSearchQuery(e.target.value); setSelectedPatientId(''); }}
                  placeholder="Search by name, gender, or contact..."
                  className="w-full pl-9 pr-4 py-2 text-sm border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                />
                {searchQuery && (
                  <button
                    onClick={() => { setSearchQuery(''); setSelectedPatientId(''); }}
                    className="absolute inset-y-0 right-0 pr-3 flex items-center text-xs text-gray-400 hover:text-gray-600"
                  >
                    Clear
                  </button>
                )}
              </div>

              {/* Patient list */}
              <div className="border border-gray-200 rounded-lg overflow-hidden">
                {filteredPatients.length === 0 ? (
                  <div className="p-4 text-center text-sm text-gray-500">
                    No patients match &quot;{searchQuery}&quot;
                  </div>
                ) : (
                  <ul className="divide-y divide-gray-100 max-h-60 overflow-y-auto">
                    {filteredPatients.map((patient) => (
                      <li key={patient.id}>
                        <button
                          type="button"
                          onClick={() => setSelectedPatientId(patient.id)}
                          className={`w-full text-left px-4 py-3 flex items-center gap-3 transition-colors ${
                            selectedPatientId === patient.id
                              ? 'bg-blue-50 border-l-2 border-blue-500'
                              : 'hover:bg-gray-50 border-l-2 border-transparent'
                          }`}
                        >
                          <div
                            className={`w-9 h-9 rounded-full flex items-center justify-center text-sm font-bold flex-shrink-0 ${
                              selectedPatientId === patient.id
                                ? 'bg-blue-500 text-white'
                                : 'bg-gray-100 text-gray-600'
                            }`}
                          >
                            {patient.name.charAt(0)}
                          </div>
                          <div className="min-w-0">
                            <div className="font-semibold text-sm text-gray-900 truncate">{patient.name}</div>
                            <div className="text-xs text-gray-500 truncate">
                              {patient.age} yrs &bull; {patient.gender} &bull; {patient.contactInfo}
                            </div>
                          </div>
                          {selectedPatientId === patient.id && (
                            <div className="ml-auto flex-shrink-0">
                              <svg className="w-5 h-5 text-blue-500" fill="currentColor" viewBox="0 0 20 20">
                                <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                              </svg>
                            </div>
                          )}
                        </button>
                      </li>
                    ))}
                  </ul>
                )}
              </div>

              {/* Selected preview */}
              {selectedPatient && (
                <div className="bg-blue-50 border border-blue-200 rounded-lg px-4 py-3 flex items-center gap-3">
                  <div className="w-8 h-8 rounded-full bg-blue-500 text-white font-bold flex items-center justify-center text-sm flex-shrink-0">
                    {selectedPatient.name.charAt(0)}
                  </div>
                  <div>
                    <p className="text-sm font-semibold text-blue-900">{selectedPatient.name}</p>
                    <p className="text-xs text-blue-700">{selectedPatient.age} yrs &bull; {selectedPatient.gender}</p>
                  </div>
                  <span className="ml-auto text-xs font-medium text-blue-600 bg-blue-100 px-2 py-0.5 rounded-full">
                    Selected
                  </span>
                </div>
              )}

              {/* Error message */}
              {assignError && (
                <div className="rounded-lg bg-red-50 border border-red-200 px-4 py-3 text-sm text-red-700">
                  {assignError}
                </div>
              )}
            </>
          )}
        </div>

        {/* Modal Footer */}
        {!fetchError && !loadingPatients && availablePatients.length > 0 && (
          <div className="flex items-center justify-end gap-3 px-6 py-4 border-t border-gray-100 bg-gray-50">
            <Button variant="secondary" size="sm" onClick={onClose} disabled={assigning}>
              Cancel
            </Button>
            <Button
              variant="primary"
              size="sm"
              onClick={handleAssign}
              isLoading={assigning}
              disabled={!selectedPatientId || assigning}
              className="min-w-[120px]"
            >
              {assigning ? 'Assigning...' : 'Assign to Roster'}
            </Button>
          </div>
        )}
      </div>
    </div>
  );
}

// ─── Main Page ───────────────────────────────────────────────────────────────

export default function DoctorPatientsPage() {
  const [data, setData] = useState<PatientsResponse | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [showAssignModal, setShowAssignModal] = useState(false);
  const [assignSuccessMessage, setAssignSuccessMessage] = useState<string | null>(null);

  const fetchPatients = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      const res = await fetch('/api/doctor/patients');
      if (!res.ok) {
        const errJson = await res.json().catch(() => ({}));
        throw new Error(getApiErrorMessage(errJson, `Failed to fetch patients (HTTP ${res.status})`));
      }
      const json: PatientsResponse = await res.json();
      setData(json);
    } catch (err) {
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
      return new Date(isoString).toLocaleDateString(undefined, {
        month: 'short',
        day: 'numeric',
        year: 'numeric',
      });
    } catch {
      return isoString;
    }
  };

  // Called by modal after successful assignment — updates roster immediately
  const handlePatientAssigned = (newPatient: Patient) => {
    setShowAssignModal(false);
    setData((prev) =>
      prev
        ? {
            ...prev,
            patients: [newPatient, ...prev.patients],
          }
        : prev
    );
    setAssignSuccessMessage(`${newPatient.name} has been added to your care roster.`);
    setTimeout(() => setAssignSuccessMessage(null), 5000);
  };

  return (
    <div className="space-y-6">
      {/* Assign Patient Modal */}
      {showAssignModal && (
        <AssignPatientModal
          onClose={() => setShowAssignModal(false)}
          onAssigned={handlePatientAssigned}
        />
      )}

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
            <svg className="w-4 h-4 text-gray-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"
              />
            </svg>
            Refresh
          </Button>

          {/* NEW: Assign Patient Button */}
          <Button
            variant="secondary"
            size="sm"
            onClick={() => { setAssignSuccessMessage(null); setShowAssignModal(true); }}
            className="flex items-center gap-1.5 border-emerald-300 text-emerald-700 hover:bg-emerald-50"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                d="M18 9v3m0 0v3m0-3h3m-3 0h-3m-2-5a4 4 0 11-8 0 4 4 0 018 0zM3 20a6 6 0 0112 0v1H3v-1z"
              />
            </svg>
            Assign Patient
          </Button>

          <Link href="/doctor/prescriptions/new">
            <Button variant="primary" size="sm" className="flex items-center gap-1.5 shadow-sm">
              <svg className="w-4 h-4 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
              </svg>
              New Prescription
            </Button>
          </Link>
        </div>
      </div>

      {/* SUCCESS TOAST */}
      {assignSuccessMessage && (
        <div className="flex items-center gap-3 bg-emerald-50 border border-emerald-200 rounded-lg px-4 py-3 text-sm text-emerald-800">
          <svg className="w-5 h-5 text-emerald-600 flex-shrink-0" fill="currentColor" viewBox="0 0 20 20">
            <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
          </svg>
          <span>{assignSuccessMessage}</span>
          <button
            onClick={() => setAssignSuccessMessage(null)}
            className="ml-auto text-emerald-600 hover:text-emerald-800 text-xs font-semibold"
          >
            Dismiss
          </button>
        </div>
      )}

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

            {/* EMPTY ROSTER */}
            {data.patients.length === 0 ? (
              <CardContent className="p-12 text-center space-y-4">
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
                  You do not have any patients linked to your roster yet. Use the{' '}
                  <strong className="text-emerald-600">&quot;Assign Patient&quot;</strong> button above to add one.
                </p>
                <Button
                  variant="primary"
                  size="sm"
                  onClick={() => setShowAssignModal(true)}
                  className="mx-auto flex items-center gap-1.5"
                >
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                      d="M18 9v3m0 0v3m0-3h3m-3 0h-3m-2-5a4 4 0 11-8 0 4 4 0 018 0zM3 20a6 6 0 0112 0v1H3v-1z"
                    />
                  </svg>
                  Assign First Patient
                </Button>
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
                      <th className="px-6 py-3 font-semibold">Contact &amp; Address</th>
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
