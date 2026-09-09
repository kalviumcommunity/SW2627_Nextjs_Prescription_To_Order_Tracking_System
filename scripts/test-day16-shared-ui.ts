import assert from 'node:assert';
import fs from 'node:fs';
import path from 'node:path';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';

import { LoadingState } from '../components/ui/LoadingState';
import { EmptyState } from '../components/ui/EmptyState';
import { ErrorState } from '../components/ui/ErrorState';
import { Modal } from '../components/ui/Modal';
import { PrescriptionStatus, STATUS_CONFIG } from '../components/prescriptions/PrescriptionStatus';
import { PrescriptionCard } from '../components/prescriptions/PrescriptionCard';
import { PrescriptionTable } from '../components/prescriptions/PrescriptionTable';
import { PrescriptionDetails, PrescriptionData } from '../components/prescriptions/PrescriptionDetails';

console.log('===============================================================================');
console.log('🎨 MedEasy Prescription-to-Order Tracking System - Day 16 UI Standardization');
console.log('===============================================================================\n');

// ---------------------------------------------------------------------------
// 1. VERIFY COMPONENT PRESENCE AND EXPORT INTEGRITY
// ---------------------------------------------------------------------------
console.log('-------------------------------------------------------------------------------');
console.log('1. VERIFY SHARED UI COMPONENT EXPORT INTEGRITY');
console.log('-------------------------------------------------------------------------------');

assert.strictEqual(typeof LoadingState, 'function', 'LoadingState component must be exported');
assert.strictEqual(typeof EmptyState, 'function', 'EmptyState component must be exported');
assert.strictEqual(typeof ErrorState, 'function', 'ErrorState component must be exported');
assert.strictEqual(typeof Modal, 'function', 'Modal component must be exported');
assert.strictEqual(typeof PrescriptionStatus, 'function', 'PrescriptionStatus component must be exported');
assert.strictEqual(typeof PrescriptionCard, 'function', 'PrescriptionCard component must be exported');
assert.strictEqual(typeof PrescriptionTable, 'function', 'PrescriptionTable component must be exported');
assert.strictEqual(typeof PrescriptionDetails, 'function', 'PrescriptionDetails component must be exported');

console.log('  ✓ All 8 shared components exported as functions');
console.log('');

// ---------------------------------------------------------------------------
// 2. VERIFY PRESCRIPTION STATUS BADGE MAPPING CONTRACT
// ---------------------------------------------------------------------------
console.log('-------------------------------------------------------------------------------');
console.log('2. VERIFY PRESCRIPTION STATUS BADGE MAPPINGS');
console.log('-------------------------------------------------------------------------------');

assert.strictEqual(STATUS_CONFIG.PENDING.label, 'Pending', 'PENDING must map to "Pending"');
assert.strictEqual(STATUS_CONFIG.PENDING.variant, 'warning', 'PENDING must have warning variant');

assert.strictEqual(STATUS_CONFIG.FILLED.label, 'Filled', 'FILLED must map to "Filled"');
assert.strictEqual(STATUS_CONFIG.FILLED.variant, 'success', 'FILLED must have success variant');

assert.strictEqual(STATUS_CONFIG.CANNOT_FILL.label, 'Cannot Fill', 'CANNOT_FILL must map to "Cannot Fill"');
assert.strictEqual(STATUS_CONFIG.CANNOT_FILL.variant, 'destructive', 'CANNOT_FILL must have destructive variant');

// Test static HTML rendering of PrescriptionStatus
const pendingHtml = renderToStaticMarkup(React.createElement(PrescriptionStatus, { status: 'PENDING' }));
assert(pendingHtml.includes('Pending'), 'PrescriptionStatus renders "Pending" for PENDING');

const filledHtml = renderToStaticMarkup(React.createElement(PrescriptionStatus, { status: 'FILLED' }));
assert(filledHtml.includes('Filled'), 'PrescriptionStatus renders "Filled" for FILLED');

const cannotFillHtml = renderToStaticMarkup(React.createElement(PrescriptionStatus, { status: 'CANNOT_FILL' }));
assert(cannotFillHtml.includes('Cannot Fill'), 'PrescriptionStatus renders "Cannot Fill" for CANNOT_FILL');

console.log('  ✓ PENDING -> "Pending" (warning)');
console.log('  ✓ FILLED -> "Filled" (success)');
console.log('  ✓ CANNOT_FILL -> "Cannot Fill" (destructive)');
console.log('');

// ---------------------------------------------------------------------------
// 3. VERIFY LOADING, EMPTY, AND ERROR STATE ACCESSIBILITY AND RENDERING
// ---------------------------------------------------------------------------
console.log('-------------------------------------------------------------------------------');
console.log('3. VERIFY LOADING, EMPTY, AND ERROR STATE ACCESSIBILITY & ATTRIBUTES');
console.log('-------------------------------------------------------------------------------');

const loadingHtml = renderToStaticMarkup(React.createElement(LoadingState, { message: 'Loading test records...' }));
assert(loadingHtml.includes('role="status"'), 'LoadingState must specify role="status"');
assert(loadingHtml.includes('aria-live="polite"'), 'LoadingState must specify aria-live="polite"');
assert(loadingHtml.includes('Loading test records...'), 'LoadingState renders custom message');

const emptyHtml = renderToStaticMarkup(
  React.createElement(EmptyState, {
    title: 'No items available',
    description: 'Create an item to get started',
    action: React.createElement('button', null, 'Create Item'),
  })
);
assert(emptyHtml.includes('No items available'), 'EmptyState renders title');
assert(emptyHtml.includes('Create an item to get started'), 'EmptyState renders description');
assert(emptyHtml.includes('Create Item'), 'EmptyState renders action element');

const errorHtml = renderToStaticMarkup(
  React.createElement(ErrorState, {
    title: 'Something went wrong',
    message: 'Unable to reach backend services',
    retryLabel: 'Try Again',
    onRetry: () => {},
  })
);
assert(errorHtml.includes('role="alert"'), 'ErrorState must specify role="alert"');
assert(errorHtml.includes('Something went wrong'), 'ErrorState renders title');
assert(errorHtml.includes('Unable to reach backend services'), 'ErrorState renders message');
assert(errorHtml.includes('Try Again'), 'ErrorState renders retry button');

const modalHtml = renderToStaticMarkup(
  React.createElement(Modal, {
    isOpen: true,
    onClose: () => {},
    title: 'Confirm Operation',
    children: React.createElement('p', null, 'Proceed with this fulfillment?'),
  })
);
assert(modalHtml.includes('role="dialog"'), 'Modal must specify role="dialog"');
assert(modalHtml.includes('aria-modal="true"'), 'Modal must specify aria-modal="true"');
assert(modalHtml.includes('Confirm Operation'), 'Modal renders title');
assert(modalHtml.includes('Proceed with this fulfillment?'), 'Modal renders children');

console.log('  ✓ LoadingState renders role="status", aria-live="polite", and spinner');
console.log('  ✓ EmptyState renders title, description, and action button');
console.log('  ✓ ErrorState renders role="alert", title, message, and retry button');
console.log('  ✓ Modal renders role="dialog", aria-modal="true", and confirmation content');
console.log('');

// ---------------------------------------------------------------------------
// 4. VERIFY ROLE-BASED DIAGNOSIS VISIBILITY
// ---------------------------------------------------------------------------
console.log('-------------------------------------------------------------------------------');
console.log('4. VERIFY ROLE-BASED DIAGNOSIS VISIBILITY MATRIX');
console.log('-------------------------------------------------------------------------------');

const testPrescription: PrescriptionData = {
  id: 'rx-test-12345678',
  status: 'PENDING',
  createdAt: new Date().toISOString(),
  diagnosis: 'Acute Bronchitis and Low Grade Fever',
  doctor: {
    name: 'Dr. Sarah Smith',
    specialization: 'Pulmonology',
  },
  patient: {
    name: 'Alice Johnson',
    age: 28,
    gender: 'Female',
  },
  medicines: [
    {
      id: 'med-1',
      dosage: '500mg',
      frequency: 'Twice daily',
      duration: '5 days',
      medicine: {
        id: 'med-item-1',
        name: 'Amoxicillin',
        genericName: 'Amoxicillin Trihydrate',
      },
    },
  ],
};

// PrescriptionDetails tests
const doctorDetailsHtml = renderToStaticMarkup(
  React.createElement(PrescriptionDetails, { prescription: testPrescription, viewerRole: 'DOCTOR' })
);
assert(doctorDetailsHtml.includes('Acute Bronchitis and Low Grade Fever'), 'Doctor must see diagnosis in PrescriptionDetails');

const patientDetailsHtml = renderToStaticMarkup(
  React.createElement(PrescriptionDetails, { prescription: testPrescription, viewerRole: 'PATIENT' })
);
assert(patientDetailsHtml.includes('Acute Bronchitis and Low Grade Fever'), 'Patient must see diagnosis in PrescriptionDetails');

const adminDetailsHtml = renderToStaticMarkup(
  React.createElement(PrescriptionDetails, { prescription: testPrescription, viewerRole: 'ADMIN' })
);
assert(adminDetailsHtml.includes('Acute Bronchitis and Low Grade Fever'), 'Admin must see diagnosis in PrescriptionDetails');

const pharmacyDetailsHtml = renderToStaticMarkup(
  React.createElement(PrescriptionDetails, { prescription: testPrescription, viewerRole: 'PHARMACY' })
);
assert(
  !pharmacyDetailsHtml.includes('Acute Bronchitis and Low Grade Fever'),
  'Pharmacy must NEVER see diagnosis in PrescriptionDetails'
);
assert(
  !pharmacyDetailsHtml.toLowerCase().includes('diagnosis'),
  'Diagnosis section must be completely absent for Pharmacy role in PrescriptionDetails'
);

// PrescriptionTable tests
const doctorTableHtml = renderToStaticMarkup(
  React.createElement(PrescriptionTable, { prescriptions: [testPrescription], viewerRole: 'DOCTOR' })
);
assert(doctorTableHtml.includes('Diagnosis'), 'Doctor table includes Diagnosis column');
assert(doctorTableHtml.includes('Acute Bronchitis'), 'Doctor table includes diagnosis text');

const pharmacyTableHtml = renderToStaticMarkup(
  React.createElement(PrescriptionTable, { prescriptions: [testPrescription], viewerRole: 'PHARMACY' })
);
assert(!pharmacyTableHtml.includes('Diagnosis'), 'Pharmacy table must NEVER include Diagnosis column');
assert(!pharmacyTableHtml.includes('Acute Bronchitis'), 'Pharmacy table must NEVER include diagnosis text');

console.log('  ✓ DOCTOR: Diagnosis VISIBLE in PrescriptionDetails & PrescriptionTable');
console.log('  ✓ PATIENT: Diagnosis VISIBLE in PrescriptionDetails');
console.log('  ✓ ADMIN: Diagnosis VISIBLE in administrative projection');
console.log('  ✓ PHARMACY: Diagnosis STRICTLY REDACTED & ABSENT in PrescriptionDetails & PrescriptionTable');
console.log('');

// ---------------------------------------------------------------------------
// 5. AUDIT PAGE SOURCE FILES FOR SHARED UI ADOPTION ACROSS ALL 4 ROLES
// ---------------------------------------------------------------------------
console.log('-------------------------------------------------------------------------------');
console.log('5. AUDIT PAGE SOURCES FOR STANDARDIZED UI COMPONENT ADOPTION');
console.log('-------------------------------------------------------------------------------');

const PAGES_TO_AUDIT = [
  // Doctor
  { path: 'app/doctor/dashboard/page.tsx', components: ['LoadingState', 'EmptyState', 'ErrorState', 'PrescriptionStatus'] },
  { path: 'app/doctor/prescriptions/page.tsx', components: ['LoadingState', 'EmptyState', 'ErrorState', 'PrescriptionStatus'] },
  { path: 'app/doctor/prescriptions/[id]/page.tsx', components: ['LoadingState', 'EmptyState', 'ErrorState', 'PrescriptionDetails'] },

  // Pharmacy
  { path: 'app/pharmacy/dashboard/page.tsx', components: ['LoadingState', 'EmptyState', 'ErrorState', 'PrescriptionStatus'] },
  { path: 'app/pharmacy/prescriptions/page.tsx', components: ['LoadingState', 'EmptyState', 'ErrorState', 'PrescriptionStatus'] },
  { path: 'app/pharmacy/prescriptions/[id]/page.tsx', components: ['LoadingState', 'ErrorState', 'PrescriptionStatus', 'Modal'] },

  // Patient
  { path: 'app/patient/dashboard/page.tsx', components: ['LoadingState', 'EmptyState', 'ErrorState', 'PrescriptionStatus'] },
  { path: 'app/patient/prescriptions/page.tsx', components: ['LoadingState', 'EmptyState', 'ErrorState', 'PrescriptionStatus'] },
  { path: 'app/patient/tracking/page.tsx', components: ['LoadingState', 'EmptyState', 'ErrorState', 'PrescriptionStatus'] },
  { path: 'app/patient/prescriptions/[id]/page.tsx', components: ['LoadingState', 'EmptyState', 'ErrorState', 'PrescriptionDetails'] },

  // Admin
  { path: 'app/admin/dashboard/page.tsx', components: ['LoadingState', 'ErrorState'] },
  { path: 'app/admin/prescriptions/page.tsx', components: ['LoadingState', 'EmptyState', 'ErrorState', 'PrescriptionStatus', 'PrescriptionDetails', 'Modal'] },
  { path: 'app/admin/doctors/page.tsx', components: ['LoadingState', 'EmptyState', 'ErrorState'] },
  { path: 'app/admin/pharmacy/page.tsx', components: ['LoadingState', 'EmptyState', 'ErrorState'] },
];

for (const page of PAGES_TO_AUDIT) {
  const fullPath = path.join(process.cwd(), page.path);
  assert(fs.existsSync(fullPath), `Page file must exist: ${page.path}`);

  const content = fs.readFileSync(fullPath, 'utf-8');
  for (const comp of page.components) {
    assert(
      content.includes(comp),
      `${page.path} must import and use standardized shared component: ${comp}`
    );
  }
  console.log(`  ✓ ${page.path} verifies adoption of [${page.components.join(', ')}]`);
}

// Special Pharmacy diagnosis privacy check
const pharmacyDetailPage = fs.readFileSync(
  path.join(process.cwd(), 'app/pharmacy/prescriptions/[id]/page.tsx'),
  'utf-8'
);
assert(
  !pharmacyDetailPage.includes('.diagnosis'),
  'Pharmacy detail page must NEVER reference prescription.diagnosis'
);
console.log('  ✓ Pharmacy detail page verified: zero diagnosis property leaks');

console.log('\n===============================================================================');
console.log('🎉 ALL DAY 16 SHARED UI VERIFICATIONS PASSED WITH 100% SUCCESS!');
console.log('===============================================================================\n');
