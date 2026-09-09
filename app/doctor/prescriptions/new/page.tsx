'use client';

import React, { useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/Button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/Card';

interface Patient {
  id: string;
  name: string;
  age?: number;
  gender?: string;
  contactInfo?: string;
}

interface MedicineOption {
  id: string;
  name: string;
  genericName: string;
  stockStatus: boolean;
}

interface MedicineRow {
  id: string;
  medicineId: string;
  dosage: string;
  frequency: string;
  duration: string;
}

type RowValidationErrors = Partial<Record<'medicineId' | 'dosage' | 'frequency' | 'duration', string>>;

interface FormErrors {
  patientId?: string;
  diagnosis?: string;
  medicines?: string;
  date?: string;
}

const emptyMedicineRow = (): MedicineRow => ({
  id: crypto.randomUUID(),
  medicineId: '',
  dosage: '',
  frequency: '',
  duration: '',
});

export default function NewPrescriptionPage() {
  const router = useRouter();
  const [patients, setPatients] = useState<Patient[]>([]);
  const [medicines, setMedicines] = useState<MedicineOption[]>([]);
  const [patientId, setPatientId] = useState('');
  const [diagnosis, setDiagnosis] = useState('');
  const [prescriptionDate, setPrescriptionDate] = useState('');
  const [rows, setRows] = useState<MedicineRow[]>([emptyMedicineRow()]);
  const [loadingRoster, setLoadingRoster] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [submitMessage, setSubmitMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);
  const [validationErrors, setValidationErrors] = useState<FormErrors>({});
  const [rowErrors, setRowErrors] = useState<Record<string, RowValidationErrors>>({});

  useEffect(() => {
    const fetchRoster = async () => {
      try {
        const response = await fetch('/api/doctor/roster');
        if (!response.ok) {
          const payload = await response.json().catch(() => ({}));
          throw new Error(payload.error || 'Unable to load patient roster.');
        }

        const data = await response.json();
        setPatients(data.patients ?? []);
      } catch (error) {
        console.error('Error loading roster:', error);
        setSubmitMessage({
          type: 'error',
          text: error instanceof Error ? error.message : 'Unable to load the patient roster.',
        });
      } finally {
        setLoadingRoster(false);
      }
    };

    const fetchMedicines = async () => {
      try {
        const response = await fetch('/api/doctor/medicines');
        if (!response.ok) {
          const payload = await response.json().catch(() => ({}));
          throw new Error(payload.error || 'Unable to load medicine catalog.');
        }

        const data = await response.json();
        setMedicines(data.medicines ?? []);
      } catch (error) {
        console.error('Error loading medicines:', error);
        setSubmitMessage({
          type: 'error',
          text: error instanceof Error ? error.message : 'Unable to load the medicine catalog.',
        });
      }
    };

    fetchRoster();
    fetchMedicines();
  }, []);

  const selectedPatientName = useMemo(
    () => patients.find((patient) => patient.id === patientId)?.name ?? 'No patient selected',
    [patientId, patients]
  );

  const validateRow = (row: MedicineRow, idx: number): RowValidationErrors => {
    const errors: RowValidationErrors = {};

    if (!row.medicineId.trim()) {
      errors.medicineId = `Medicine ${idx + 1} is required.`;
    }
    if (!row.dosage.trim()) {
      errors.dosage = `Dosage for medicine ${idx + 1} is required.`;
    }
    if (!row.frequency.trim()) {
      errors.frequency = `Frequency for medicine ${idx + 1} is required.`;
    }
    if (!row.duration.trim()) {
      errors.duration = `Duration for medicine ${idx + 1} is required.`;
    }

    return errors;
  };

  const validateForm = (): boolean => {
    const nextErrors: FormErrors = {};
    const nextRowErrors: Record<string, RowValidationErrors> = {};

    if (!patientId.trim()) {
      nextErrors.patientId = 'Select a patient from your roster.';
    }

    if (!diagnosis.trim()) {
      nextErrors.diagnosis = 'Diagnosis is required.';
    }

    if (!prescriptionDate.trim()) {
      nextErrors.date = 'Prescription date is required.';
    }

    if (rows.length === 0) {
      nextErrors.medicines = 'At least one medicine is required.';
    }

    rows.forEach((row, idx) => {
      const rowValidation = validateRow(row, idx);
      if (Object.keys(rowValidation).length > 0) {
        nextRowErrors[row.id] = rowValidation;
      }
    });

    if (Object.keys(nextRowErrors).length > 0) {
      nextErrors.medicines = 'Please complete all medicine rows before submitting.';
    }

    setRowErrors(nextRowErrors);
    setValidationErrors(nextErrors);
    return Object.keys(nextErrors).length === 0;
  };

  const updateRow = (id: string, field: keyof MedicineRow, value: string) => {
    setRows((current) =>
      current.map((row) => (row.id === id ? { ...row, [field]: value } : row))
    );

    setRowErrors((current) => {
      const next = { ...current };
      const rowErrors = next[id];
      if (!rowErrors) return next;

      delete rowErrors[field as keyof RowValidationErrors];
      if (Object.keys(rowErrors).length === 0) {
        delete next[id];
      }
      return next;
    });

    setValidationErrors((current) => {
      const next = { ...current };
      if (field === 'medicineId' || field === 'dosage' || field === 'frequency' || field === 'duration') {
        delete next.medicines;
      }
      return next;
    });
  };

  const addMedicineRow = () => {
    setRows((current) => [...current, emptyMedicineRow()]);
  };

  const removeMedicineRow = (id: string) => {
    if (rows.length === 1) {
      setRows([emptyMedicineRow()]);
      setRowErrors({});
      return;
    }

    setRows((current) => current.filter((row) => row.id !== id));
    setRowErrors((current) => {
      const next = { ...current };
      delete next[id];
      return next;
    });
  };

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    setSubmitMessage(null);

    if (!validateForm()) {
      setSubmitMessage({
        type: 'error',
        text: 'Please fix the highlighted validation errors before submitting.',
      });
      return;
    }

    const payload = {
      patientId,
      diagnosis: diagnosis.trim(),
      documentRef: null,
      date: prescriptionDate,
      medicines: rows.map((row) => ({
        medicineId: row.medicineId,
        dosage: row.dosage.trim(),
        frequency: row.frequency.trim(),
        duration: row.duration.trim(),
      })),
    };

    try {
      setSubmitting(true);
      const response = await fetch('/api/doctor/prescriptions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      const data = await response.json().catch(() => ({}));

      if (!response.ok) {
        if (response.status === 401 || response.status === 403) {
          throw new Error(data.error || 'You are not authorized to create prescriptions.');
        }

        if (response.status >= 400 && response.status < 500) {
          throw new Error(data.error || 'The prescription could not be created because the request is invalid.');
        }

        throw new Error(data.error || 'The server encountered an issue while creating the prescription.');
      }

      setSubmitMessage({
        type: 'success',
        text: 'Prescription created successfully.',
      });

      router.push('/doctor/prescriptions');
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Something went wrong.';
      setSubmitMessage({ type: 'error', text: message });
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-2 border-b border-gray-200 pb-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <p className="text-sm font-medium uppercase tracking-wide text-blue-600">Doctor</p>
          <h1 className="text-2xl font-bold text-gray-900">Create Prescription</h1>
        </div>
        <Button type="button" variant="secondary" size="sm" onClick={() => router.push('/doctor/prescriptions')}>
          Back to list
        </Button>
      </div>

      <form onSubmit={handleSubmit} className="space-y-6">
        <Card>
          <CardHeader>
            <CardTitle>1. Patient Information</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid gap-4 md:grid-cols-2">
              <div className="space-y-1">
                <label className="block text-sm font-medium text-gray-700">Patient</label>
                <select
                  value={patientId}
                  onChange={(event) => setPatientId(event.target.value)}
                  disabled={loadingRoster}
                  className={`w-full rounded-md border border-gray-300 bg-white px-3 py-2 text-sm ${
                    validationErrors.patientId ? 'border-red-500' : ''
                  }`}
                >
                  <option value="">Select patient from roster</option>
                  {patients.map((patient) => (
                    <option key={patient.id} value={patient.id}>
                      {patient.name} {patient.age ? `(${patient.age})` : ''}
                    </option>
                  ))}
                </select>
                {validationErrors.patientId ? (
                  <p className="text-xs text-red-500">{validationErrors.patientId}</p>
                ) : (
                  <p className="text-xs text-gray-500">Must be a patient on your existing roster.</p>
                )}
              </div>

              <div className="space-y-1">
                <label className="block text-sm font-medium text-gray-700">Selected patient</label>
                <div className="flex h-10 items-center rounded-md border border-gray-200 bg-gray-100 px-3 text-sm text-gray-700">
                  {selectedPatientName}
                </div>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>2. Diagnosis / Notes</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-1">
              <label className="block text-sm font-medium text-gray-700">Diagnosis</label>
              <textarea
                value={diagnosis}
                onChange={(event) => setDiagnosis(event.target.value)}
                rows={5}
                className={`w-full rounded-md border border-gray-300 bg-white px-3 py-2 text-sm ${
                  validationErrors.diagnosis ? 'border-red-500' : ''
                }`}
                placeholder="Describe the diagnosis and clinical notes..."
              />
              {validationErrors.diagnosis ? (
                <p className="text-xs text-red-500">{validationErrors.diagnosis}</p>
              ) : (
                <p className="text-xs text-gray-500">Clinical diagnosis is required before submission.</p>
              )}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>3. Medicines</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {rows.map((row, idx) => {
              const rowIssues = rowErrors[row.id] ?? {};

              return (
                <div key={row.id} className="rounded-lg border border-gray-200 bg-gray-50 p-4">
                  <div className="mb-3 flex items-center justify-between">
                    <h3 className="text-sm font-semibold text-gray-700">Medicine {idx + 1}</h3>
                    {rows.length > 1 && (
                      <button
                        type="button"
                        onClick={() => removeMedicineRow(row.id)}
                        className="text-sm text-red-600 hover:text-red-700"
                      >
                        Remove
                      </button>
                    )}
                  </div>

                  <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
                    <div className="space-y-1">
                      <label className="block text-sm font-medium text-gray-700">Medicine</label>
                      <select
                        value={row.medicineId}
                        onChange={(event) => updateRow(row.id, 'medicineId', event.target.value)}
                        className={`w-full rounded-md border border-gray-300 bg-white px-3 py-2 text-sm ${
                          rowIssues.medicineId ? 'border-red-500' : ''
                        }`}
                      >
                        <option value="">Select medicine</option>
                        {medicines.map((medicine) => (
                          <option key={medicine.id} value={medicine.id}>
                            {medicine.name} {medicine.genericName ? `(${medicine.genericName})` : ''}
                          </option>
                        ))}
                      </select>
                      {rowIssues.medicineId && <p className="text-xs text-red-500">{rowIssues.medicineId}</p>}
                    </div>

                    <div className="space-y-1">
                      <label className="block text-sm font-medium text-gray-700">Dosage</label>
                      <input
                        value={row.dosage}
                        onChange={(event) => updateRow(row.id, 'dosage', event.target.value)}
                        placeholder="e.g. 500mg"
                        className={`w-full rounded-md border border-gray-300 bg-white px-3 py-2 text-sm ${
                          rowIssues.dosage ? 'border-red-500' : ''
                        }`}
                      />
                      {rowIssues.dosage && <p className="text-xs text-red-500">{rowIssues.dosage}</p>}
                    </div>

                    <div className="space-y-1">
                      <label className="block text-sm font-medium text-gray-700">Frequency</label>
                      <input
                        value={row.frequency}
                        onChange={(event) => updateRow(row.id, 'frequency', event.target.value)}
                        placeholder="e.g. Twice daily"
                        className={`w-full rounded-md border border-gray-300 bg-white px-3 py-2 text-sm ${
                          rowIssues.frequency ? 'border-red-500' : ''
                        }`}
                      />
                      {rowIssues.frequency && <p className="text-xs text-red-500">{rowIssues.frequency}</p>}
                    </div>

                    <div className="space-y-1">
                      <label className="block text-sm font-medium text-gray-700">Duration</label>
                      <input
                        value={row.duration}
                        onChange={(event) => updateRow(row.id, 'duration', event.target.value)}
                        placeholder="e.g. 7 days"
                        className={`w-full rounded-md border border-gray-300 bg-white px-3 py-2 text-sm ${
                          rowIssues.duration ? 'border-red-500' : ''
                        }`}
                      />
                      {rowIssues.duration && <p className="text-xs text-red-500">{rowIssues.duration}</p>}
                    </div>
                  </div>
                </div>
              );
            })}

            <div className="flex flex-col gap-2 pt-2">
              <Button type="button" variant="secondary" size="sm" onClick={addMedicineRow}>
                Add Medicine
              </Button>
              {validationErrors.medicines && (
                <p className="text-xs text-red-500">{validationErrors.medicines}</p>
              )}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>4. Prescription Date</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="max-w-sm space-y-1">
              <label className="block text-sm font-medium text-gray-700">Date</label>
              <input
                type="date"
                value={prescriptionDate}
                onChange={(event) => setPrescriptionDate(event.target.value)}
                className={`w-full rounded-md border border-gray-300 bg-white px-3 py-2 text-sm ${
                  validationErrors.date ? 'border-red-500' : ''
                }`}
              />
              {validationErrors.date ? (
                <p className="text-xs text-red-500">{validationErrors.date}</p>
              ) : (
                <p className="text-xs text-gray-500">The prescription issue date is required.</p>
              )}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>5. Prescription Document</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="rounded-md border border-dashed border-gray-300 bg-gray-50 p-4 text-sm text-gray-600">
              Document attachment support is not enabled in the current storage abstraction. This field is reserved for a future PDF/document reference.
            </div>
          </CardContent>
        </Card>

        <div className="flex flex-col gap-3 border-t border-gray-200 pt-6 sm:flex-row sm:justify-end">
          <Button type="button" variant="secondary" onClick={() => router.push('/doctor/prescriptions')}>
            Cancel
          </Button>
          <Button type="submit" variant="primary" isLoading={submitting}>
            Save Prescription
          </Button>
        </div>

        {submitMessage && (
          <div
            className={`rounded-md border p-3 text-sm ${
              submitMessage.type === 'success'
                ? 'border-green-200 bg-green-50 text-green-700'
                : 'border-red-200 bg-red-50 text-red-700'
            }`}
          >
            {submitMessage.text}
          </div>
        )}
      </form>
    </div>
  );
}
