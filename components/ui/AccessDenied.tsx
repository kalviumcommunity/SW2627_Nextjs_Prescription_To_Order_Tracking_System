'use client';

import React from "react";
import Link from "next/link";
import { useSession } from "next-auth/react";
import { UserRole } from "@prisma/client";
import { getDefaultDashboardPath } from "@/lib/navigation";

export interface AccessDeniedProps {
  /** Optional message to display. Defaults to a generic access-denied message. */
  message?: string;
}

export function AccessDenied({ message }: AccessDeniedProps) {
  const { data: session } = useSession();
  const userRole = session?.user?.role as UserRole | undefined;
  const dashboardPath = getDefaultDashboardPath(userRole);

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50 px-4">
      <div className="max-w-md w-full text-center">
        <div className="bg-white rounded-lg shadow-md p-8 border border-gray-200">
          {/* Shield icon */}
          <div className="mx-auto flex items-center justify-center h-16 w-16 rounded-full bg-red-100 mb-6">
            <svg
              className="h-8 w-8 text-red-600"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
              strokeWidth={2}
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4.5c-.77-.833-2.694-.833-3.464 0L3.34 16.5c-.77.833.192 2.5 1.732 2.5z"
              />
            </svg>
          </div>

          <h2 className="text-xl font-bold text-gray-900 mb-2">
            Access Denied
          </h2>

          <p className="text-sm text-gray-600 mb-6">
            {message || "You do not have permission to access this page. Please navigate to your authorized dashboard."}
          </p>

          <div className="flex flex-col gap-3">
            <Link
              href={dashboardPath}
              className="inline-flex items-center justify-center px-4 py-2 bg-blue-600 text-white text-sm font-medium rounded-md hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 transition-colors"
            >
              Go to My Dashboard
            </Link>
            <Link
              href="/login"
              className="inline-flex items-center justify-center px-4 py-2 bg-white text-gray-700 text-sm font-medium rounded-md border border-gray-300 hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 transition-colors"
            >
              Sign in as Different User
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}
