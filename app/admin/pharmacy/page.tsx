'use client';

import React, { useEffect, useState, useCallback } from 'react';
import Link from 'next/link';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/Card';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { LoadingState } from '@/components/ui/LoadingState';
import { EmptyState } from '@/components/ui/EmptyState';
import { ErrorState } from '@/components/ui/ErrorState';

interface PharmacyData {
  id: string;
  userId: string;
  pharmacyName: string;
  pharmacyType: string;
  licenseNumber: string;
  phone: string;
  accountStatus: string;
  email: string;
  totalFills?: number;
  createdAt: string;
  updatedAt: string;
}

interface PharmacyResponse {
  pharmacy: PharmacyData | null;
  accountStatus?: string;
  message?: string;
}

export default function AdminPharmacyPage() {
  const [data, setData] = useState<PharmacyData | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  const fetchPharmacy = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      const res = await fetch('/api/admin/pharmacy', { cache: 'no-store' });
      if (!res.ok) {
        const errJson = await res.json().catch(() => ({}));
        throw new Error(errJson.error || `Failed to fetch pharmacy (HTTP ${res.status})`);
      }
      const json: PharmacyResponse = await res.json();
      setData(json.pharmacy);
    } catch (err) {
      console.error('Error fetching admin pharmacy:', err);
      setError(err instanceof Error ? err.message : 'An unexpected error occurred.');
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchPharmacy();
  }, [fetchPharmacy]);

  const formatDate = (isoString?: string) => {
    if (!isoString) return '—';
    try {
      return new Date(isoString).toLocaleDateString('en-US', {
        month: 'long',
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
            Pharmacy Facility Management
          </h1>
          <p className="text-sm text-gray-500 mt-1">
            Administrative oversight for MedEasy&apos;s pre-provisioned central dispensing facility.
          </p>
        </div>
        <div className="flex items-center gap-3">
          <Button
            variant="secondary"
            size="sm"
            onClick={fetchPharmacy}
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
          <Link href="/admin/prescriptions">
            <Button variant="primary" size="sm" className="flex items-center gap-1.5 shadow-sm">
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2"
                />
              </svg>
              View Order Queue
            </Button>
          </Link>
        </div>
      </div>

      {/* Single Pre-Provisioned Pharmacy Architecture Banner */}
      <div className="bg-blue-50 border-l-4 border-blue-500 p-4 rounded-r-xl flex items-start gap-3">
        <svg
          className="w-5 h-5 text-blue-600 mt-0.5 flex-shrink-0"
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
        <div className="text-sm text-blue-900">
          <strong className="font-semibold">Single Pre-Provisioned Pharmacy Architecture</strong>
          <p className="mt-0.5 text-blue-800 text-xs sm:text-sm">
            The MedEasy platform operates exclusively through a central pre-provisioned dispensing facility. Multi-pharmacy routing and open marketplace registrations are strictly disabled in accordance with the product specification.
          </p>
        </div>
      </div>

      {/* ERROR STATE */}
      {error && (
        <ErrorState
          title="Unable to load pharmacy profile"
          message={error}
          onRetry={fetchPharmacy}
        />
      )}

      {/* LOADING SKELETON */}
      {isLoading && (
        <div className="py-8" aria-label="loading">
          <LoadingState message="Loading pharmacy profile..." />
        </div>
      )}

      {/* PHARMACY PROFILE VIEW */}
      {!isLoading && !error && data && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Main Pharmacy Identity Card */}
          <Card className="lg:col-span-2 shadow-sm">
            <CardHeader className="bg-gray-50/50 pb-4">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                <div>
                  <span className="text-xs font-semibold uppercase tracking-wider text-gray-500">
                    Dispensing Partner
                  </span>
                  <CardTitle className="text-2xl font-bold text-gray-900 mt-1">
                    {data.pharmacyName}
                  </CardTitle>
                </div>
                <Badge
                  variant={data.accountStatus === 'ACTIVE' ? 'success' : 'destructive'}
                  className="text-sm px-3 py-1 font-semibold uppercase tracking-wide w-fit"
                >
                  {data.accountStatus}
                </Badge>
              </div>
            </CardHeader>
            <CardContent className="p-6">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
                <div className="space-y-1">
                  <p className="text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Facility Type
                  </p>
                  <p className="text-base font-semibold text-gray-900">{data.pharmacyType}</p>
                </div>

                <div className="space-y-1">
                  <p className="text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Operating License
                  </p>
                  <p className="font-mono text-base font-bold text-blue-700">
                    {data.licenseNumber}
                  </p>
                </div>

                <div className="space-y-1">
                  <p className="text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Contact Phone
                  </p>
                  <p className="text-base font-medium text-gray-900">{data.phone || '—'}</p>
                </div>

                <div className="space-y-1">
                  <p className="text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Administrative Email
                  </p>
                  <p className="text-base font-mono text-gray-700">{data.email}</p>
                </div>

                <div className="space-y-1">
                  <p className="text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Facility Registration Date
                  </p>
                  <p className="text-sm text-gray-700">{formatDate(data.createdAt)}</p>
                </div>

                <div className="space-y-1">
                  <p className="text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Last Profile Verification
                  </p>
                  <p className="text-sm text-gray-700">{formatDate(data.updatedAt)}</p>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Operational Status & Metrics */}
          <div className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle className="text-base font-semibold text-gray-900">
                  Dispensing Activity
                </CardTitle>
              </CardHeader>
              <CardContent className="p-6 space-y-4">
                <div className="p-4 bg-gray-50 rounded-xl border border-gray-100 flex items-center justify-between">
                  <div>
                    <p className="text-xs font-medium text-gray-500 uppercase">
                      Total Fills Completed
                    </p>
                    <p className="text-2xl font-bold text-gray-900 mt-1">
                      {data.totalFills ?? 0}
                    </p>
                  </div>
                  <div className="w-10 h-10 rounded-full bg-green-100 text-green-700 flex items-center justify-center font-bold">
                    ✓
                  </div>
                </div>

                <div className="pt-2 text-xs text-gray-500 space-y-2">
                  <p className="flex items-center gap-1.5">
                    <span className="w-2 h-2 rounded-full bg-emerald-500" />
                    Live dispensing verification active
                  </p>
                  <p className="flex items-center gap-1.5">
                    <span className="w-2 h-2 rounded-full bg-blue-500" />
                    Clinical diagnosis redaction strictly enforced
                  </p>
                </div>

                <div className="pt-4 border-t border-gray-100 flex flex-col gap-2">
                  <Link href="/admin/analytics">
                    <Button variant="secondary" size="sm" className="w-full justify-center">
                      View Pharmacy Fulfillment Analytics &rarr;
                    </Button>
                  </Link>
                </div>
              </CardContent>
            </Card>
          </div>
        </div>
      )}

      {/* NOT CONFIGURED STATE */}
      {!isLoading && !error && !data && (
        <Card className="p-6">
          <EmptyState
            title="No Pharmacy Account Configured"
            description="The platform expects a pre-provisioned central dispensing facility. Please ensure database seed records are initialized."
          />
        </Card>
      )}
    </div>
  );
}
