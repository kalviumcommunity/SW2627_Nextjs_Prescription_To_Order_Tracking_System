# MedEasy Database Seed Scenarios

This document describes the deterministic seed data created for the MedEasy Prescription-to-Order Tracking System development and testing database. The seeded dataset is designed to support specific workflows, manual testing scenarios, and analytics verification without requiring random or arbitrary records.

## Table of Contents

1. [Seeded Users](#seeded-users)
2. [Doctor-Patient Relationships](#doctor-patient-relationships)
3. [Medicines Catalog](#medicines-catalog)
4. [Stock Status](#stock-status)
5. [Prescription Scenarios](#prescription-scenarios)
6. [Fulfillment & History Scenarios](#fulfillment--history-scenarios)
7. [Analytics Verification Scenarios](#analytics-verification-scenarios)
8. [Testing Guidelines](#testing-guidelines)

---

## Seeded Users

All seeded users share a common password pattern for demo environments: `Demo[Role]Password123!`

### Admin User

| Field | Value |
|-------|-------|
| Email | `admin@medeasy.demo` |
| Password | `DemoAdminPassword123!` |
| Role | ADMIN |

**Purpose:** System administration, monitoring, and audit trail access.

### Doctors

#### Doctor 1: Dr. Sarah Smith

| Field | Value |
|-------|-------|
| Email | `dr.sarah@medeasy.demo` |
| Password | `DemoDoctorPassword123!` |
| Role | DOCTOR |
| Specialization | General Medicine |
| License Number | `DOC-LIC-1001` |
| Phone | `+1-555-0101` |

**Purpose:** Primary clinician for testing prescription workflows. Provides a breadth of clinical scenarios across multiple specialties.

#### Doctor 2: Dr. John Davis

| Field | Value |
|-------|-------|
| Email | `dr.john@medeasy.demo` |
| Password | `DemoDoctorPassword123!` |
| Role | DOCTOR |
| Specialization | Pediatrics & Family Medicine |
| License Number | `DOC-LIC-1002` |
| Phone | `+1-555-0102` |

**Purpose:** Secondary clinician for testing multi-doctor scenarios and overlapping patient rosters.

### Pharmacy

#### MedEasy Central Pharmacy

| Field | Value |
|-------|-------|
| Email | `pharmacy@medeasy.demo` |
| Password | `DemoPharmacyPassword123!` |
| Role | PHARMACY |
| Pharmacy Name | `MedEasy Central Pharmacy` |
| Pharmacy Type | Retail & Hospital Dispensing |
| License Number | `PHARM-LIC-5001` |
| Phone | `+1-555-0201` |

**Purpose:** Single pre-provisioned pharmacy per PRD requirements. Handles all fulfillment operations in the demo dataset.

### Patients

| # | Name | Age | Gender | Email | Contact Info | Notes |
|---|------|-----|--------|-------|--------------|-------|
| 1 | Alice Johnson | 34 | Female | `patient.alice@medeasy.demo` | +1-555-0301, 101 Maple Street, Springfield | Patient of Dr. Sarah |
| 2 | Robert Miller | 52 | Male | `patient.robert@medeasy.demo` | +1-555-0302, 204 Oak Avenue, Springfield | Patient of Dr. Sarah |
| 3 | Clara Oswald | 28 | Female | `patient.clara@medeasy.demo` | +1-555-0303, 305 Pine Road, Springfield | **Overlapping:** Patient of both Dr. Sarah and Dr. John |
| 4 | David Brown | 67 | Male | `patient.david@medeasy.demo` | +1-555-0304, 408 Elm Boulevard, Springfield | **Overlapping:** Patient of both Dr. Sarah and Dr. John |
| 5 | Emma Watson | 19 | Female | `patient.emma@medeasy.demo` | +1-555-0305, 512 Birch Drive, Springfield | Patient of Dr. John |

**Password for all patients:** `DemoPatientPassword123!`

---

## Doctor-Patient Relationships

The seeded doctor-patient roster is intentionally structured to support multi-doctor scenarios:

| Doctor | Patients |
|--------|----------|
| **Dr. Sarah (General Medicine)** | Alice, Robert, Clara*, David* |
| **Dr. John (Pediatrics & Family)** | Clara*, David*, Emma |

*Asterisk indicates overlapping patient rosters. Clara and David see both doctors, enabling testing of:
- Multi-doctor prescriptions for the same patient
- Cross-doctor referral patterns
- Patient care coordination scenarios

**Why This Matters:**
- **7 Doctor-Patient relationships** provide comprehensive coverage of single and multi-doctor workflows
- **Overlapping rosters** enable testing of prescription handoff and multi-specialist care scenarios
- **Age diversity** (19-67) supports specialty-specific testing (pediatrics, geriatric care)

---

## Medicines Catalog

The medicine catalog contains 6 medications spanning common treatment categories:

| # | Name | Generic Name | Stock Status | Clinical Category | Seeding Rationale |
|---|------|--------------|--------------|-------------------|-------------------|
| 1 | Paracetamol 500mg | Paracetamol | ✓ In Stock | Analgesic / Antipyretic | Common over-the-counter medication; used in multiple scenarios |
| 2 | Amoxicillin 500mg | Amoxicillin Trihydrate | ✓ In Stock | Antibiotic | Standard first-line antibiotic; tests prescription + fulfillment flow |
| 3 | Ibuprofen 400mg | Ibuprofen | ✓ In Stock | NSAID | Anti-inflammatory; used in multi-medicine scenarios |
| 4 | Cetirizine 10mg | Cetirizine Hydrochloride | ✗ **Out of Stock** | Antihistamine | Tests CANNOT_FILL scenario when prescribed alone or in combination |
| 5 | Metformin 500mg | Metformin Hydrochloride | ✓ In Stock | Antidiabetic | Chronic maintenance medication; tests long-duration prescriptions |
| 6 | Azithromycin 250mg | Azithromycin Monohydrate | ✗ **Out of Stock** | Macrolide Antibiotic | Tests CANNOT_FILL scenario; demonstrates supply-chain constraints |

**Key Design Principle:**
- **2 out-of-stock medicines** (Cetirizine, Azithromycin) enable testing of fulfillment failures without modifying the database schema or stock management logic
- **4 in-stock medicines** provide variety for successful prescription fulfillment
- **3 analgesics** (Paracetamol, Ibuprofen, Metformin) allow combination testing
- **2 antibiotics** (Amoxicillin, Azithromycin) support acute condition workflows

---

## Stock Status

### In-Stock Medicines

- ✓ Paracetamol 500mg
- ✓ Amoxicillin 500mg
- ✓ Ibuprofen 400mg
- ✓ Metformin 500mg

### Out-of-Stock Medicines

- ✗ Cetirizine 10mg
- ✗ Azithromycin 250mg

**Testing Implications:**
- Any prescription requesting **only in-stock medicines** can be fulfilled
- Any prescription requesting **one or more out-of-stock medicines** will have status `CANNOT_FILL`
- This simulates real-world supply constraints without requiring inventory management logic

---

## Prescription Scenarios

The prescription dataset includes **6 current/active scenarios** and **6 historical scenarios** (described below). Each is designed for a specific workflow or product feature.

### Scenario 1: PENDING Multi-Medicine Prescription

**Prescription ID:** rx1  
**Patient:** Alice Johnson (age 34)  
**Doctor:** Dr. Sarah Smith  
**Diagnosis:** Acute Upper Respiratory Tract Infection  
**Status:** `PENDING`  
**Created:** 2 days ago  
**Medicines:**
1. **Paracetamol 500mg** - 500mg, 1 tablet three times daily after food, 5 days
2. **Amoxicillin 500mg** - 500mg, 1 capsule twice daily with full glass of water, 7 days

**Document Reference:** `rx-docs/alice-urti-2026.pdf`

**Why It Exists:**
- Demonstrates pharmacy **prescription queue** workflow
- Tests **multi-medicine prescription handling** and medication grouping
- Supports **acute care** scenario (URTI is common in GP practice)
- All medicines are **in stock**, so it's actionable by pharmacy

**Product Workflows Supported:**
1. **Pharmacy Queue:** Pharmacist sees pending prescription requiring action
2. **Prescription Details:** Display of multiple related medicines with dosing instructions
3. **Drug Interaction Checking:** Paracetamol + Amoxicillin combination validation

**Who Uses It:**
- **Pharmacist:** Fills the prescription, counsels patient on multi-drug regimen
- **Patient:** Receives complete acute treatment
- **Doctor:** Monitors fulfillment status

---

### Scenario 2: PENDING Single Medicine Prescription

**Prescription ID:** rx2  
**Patient:** Emma Watson (age 19)  
**Doctor:** Dr. John Davis  
**Diagnosis:** Mild Seasonal Allergic Rhinitis  
**Status:** `PENDING`  
**Created:** 1 day ago  
**Medicines:**
1. **Cetirizine 10mg** - 10mg, 1 tablet once daily at bedtime, 14 days

**Document Reference:** `rx-docs/emma-rhinitis-2026.pdf`

**Why It Exists:**
- Tests **single-medicine prescriptions** (common allergy/OTC scenarios)
- Demonstrates **out-of-stock handling**: Cetirizine is OUT OF STOCK
- Shows **delayed/stuck fulfillment** when specific medicine is unavailable
- Supports **young adult** health profile (seasonal allergies in this age group)

**Product Workflows Supported:**
1. **Pharmacy Queue:** Pharmacist encounters out-of-stock constraint
2. **Stock Management:** Alerts when prescribed medicine is unavailable
3. **Patient Notification:** How to inform patient of fulfillment delay

**Who Uses It:**
- **Pharmacist:** Recognizes Cetirizine is out of stock; may contact patient for alternatives
- **Patient:** May need to wait for restock or accept substitute antihistamine
- **System Admin:** Tracks out-of-stock incidents for replenishment

---

### Scenario 3: FILLED Multi-Medicine Prescription (Recent)

**Prescription ID:** rx3  
**Patient:** Robert Miller (age 52)  
**Doctor:** Dr. Sarah Smith  
**Diagnosis:** Musculoskeletal Lower Back Pain & Strain  
**Status:** `FILLED`  
**Created:** 5 days ago  
**Filled At:** 4 days ago  
**Medicines:**
1. **Ibuprofen 400mg** - 400mg, 1 tablet twice daily with food, 10 days
2. **Paracetamol 500mg** - 500mg, 1 tablet as needed for breakthrough pain (max 3/day), 5 days

**Fill Notes:** "Dispensed 20 tablets of Ibuprofen and 15 tablets of Paracetamol. Patient counseled on GI precautions."

**Document Reference:** `rx-docs/robert-backpain-2026.pdf`

**Why It Exists:**
- Demonstrates **successful fulfillment workflow** with recent completion
- Tests **multi-medicine NSAID + analgesic** combination
- Shows **fill history** for analytics dashboard (recent fulfillment trends)
- Supports **chronic pain management** scenario common in 50+ age group

**Product Workflows Supported:**
1. **Fulfillment History:** Display completed fill record with dispensed quantities and counseling notes
2. **Analytics:** Recent fill contribution to fill-rate calculations
3. **Patient Access:** Patient can view filled prescription and counseling notes
4. **Pharmacy Audit:** Complete fulfillment record with pharmacist notes

**Who Uses It:**
- **Patient:** Views filled prescription; accesses counseling notes
- **Pharmacist:** References dispensing history and counseling provided
- **Doctor:** Confirms patient received medication as prescribed
- **Analytics Engine:** Counts toward monthly/weekly fill rates

---

### Scenario 4: FILLED Single Medicine Prescription (Recent)

**Prescription ID:** rx4  
**Patient:** Clara Oswald (age 28)  
**Doctor:** Dr. John Davis  
**Diagnosis:** Type 2 Diabetes Mellitus Maintenance  
**Status:** `FILLED`  
**Created:** 7 days ago  
**Filled At:** 6 days ago  
**Medicines:**
1. **Metformin 500mg** - 500mg, 1 tablet twice daily with breakfast and dinner, 30 days

**Fill Notes:** "Standard monthly refill of 60 Metformin tablets dispensed. Advised regular blood glucose tracking."

**Document Reference:** `rx-docs/clara-diabetes-2026.pdf`

**Why It Exists:**
- Demonstrates **chronic maintenance prescription** (long-term therapy)
- Tests **single-medicine, long-duration** prescription (30 days)
- Shows **recurring prescription pattern** (monthly refill for diabetes management)
- Supports **patient self-management** workflow

**Product Workflows Supported:**
1. **Chronic Care Management:** Tracking long-term maintenance medications
2. **Refill Scheduling:** System can suggest next refill date (30 days from fill date)
3. **Patient Adherence:** Pharmacy counseling on glucose monitoring supports compliance
4. **Analytics:** Predictable refill patterns for demand forecasting

**Who Uses It:**
- **Patient:** Manages chronic diabetes; relies on consistent medication access
- **Pharmacist:** Monitors compliance; counsels on glucose tracking
- **Doctor:** Tracks medication adherence; may adjust based on glycemic control
- **Analytics Engine:** Predicts refill frequency for inventory planning

---

### Scenario 5: CANNOT_FILL Prescription

**Prescription ID:** rx5  
**Patient:** David Brown (age 67)  
**Doctor:** Dr. John Davis  
**Diagnosis:** Severe Allergic Dermatitis & Secondary Infection Flare  
**Status:** `CANNOT_FILL`  
**Created:** 3 days ago  
**Medicines:**
1. **Cetirizine 10mg** - 10mg, 1 tablet daily in the evening, 30 days
2. **Azithromycin 250mg** - 250mg, 1 capsule once daily, 3 days

**Document Reference:** `rx-docs/david-dermatitis-2026.pdf`

**Why It Exists:**
- Demonstrates **out-of-stock / unsuccessful fulfillment branch**
- Both medicines are OUT OF STOCK (Cetirizine + Azithromycin)
- Shows **critical failure scenario**: Cannot complete prescription due to supply constraints
- Tests system behavior when fulfillment is impossible without intervention

**Product Workflows Supported:**
1. **Pharmacy Alert System:** Pharmacist receives alert that prescription cannot be filled
2. **Patient Notification:** System alerts patient of fulfillment failure and next steps
3. **Doctor Notification:** Doctor may need to prescribe alternatives if available
4. **Escalation:** May require manual intervention (substitute drugs, backorder, etc.)

**Who Uses It:**
- **Pharmacist:** Recognizes both items out of stock; escalates to store manager/doctor
- **Patient:** Notified of delay; may need emergency alternatives
- **Doctor:** Can opt to prescribe in-stock alternatives (Paracetamol + Amoxicillin)
- **Inventory Manager:** Tracks high-demand items needing urgent reorder

---

### Scenario 6: FILLED Triple-Medicine Prescription (Historical)

**Prescription ID:** rx6  
**Patient:** Clara Oswald (age 28)  
**Doctor:** Dr. Sarah Smith  
**Diagnosis:** Post-Viral Arthralgia and Metabolic Routine  
**Status:** `FILLED`  
**Created:** 12 days ago  
**Filled At:** 11 days ago  
**Medicines:**
1. **Paracetamol 500mg** - 500mg, 1 tablet three times daily, 7 days
2. **Ibuprofen 400mg** - 400mg, 1 tablet twice daily with food, 5 days
3. **Metformin 500mg** - 500mg, 1 tablet twice daily, 30 days

**Fill Notes:** "All three medications dispensed in full. Patient advised regarding combination analgesics."

**Document Reference:** `rx-docs/clara-arthralgia-2026.pdf`

**Why It Exists:**
- Tests **complex multi-medicine prescription** with 3+ medications
- Demonstrates **relationship validation**: Prescription → PrescriptionMedicine → Medicine
- Shows **polypharmacy handling** (multiple dosing frequencies and durations)
- Validates **pharmacy system capability** to manage complex regimens

**Product Workflows Supported:**
1. **Prescription-Medicine Relationships:** Verifies join table correctly associates medicines with prescription
2. **Counseling Complexity:** Pharmacist documents counseling on combination NSAIDs (Paracetamol + Ibuprofen)
3. **Drug Interaction Checking:** System validates NSAID combination safety
4. **Fulfillment Completeness:** All 3 medicines successfully dispensed

**Who Uses It:**
- **Pharmacist:** Manages complex polypharmacy; counsels on NSAID combination safety
- **Patient:** Receives comprehensive treatment (acute pain + chronic disease management)
- **Doctor:** Coordinates acute and chronic treatments
- **QA/Testing:** Validates system handles 3+ medicine prescriptions correctly

---

## Fulfillment & History Scenarios

### Overview

The seed dataset includes **6 historical prescription records** created at different time intervals over the past 60 days. These provide:

1. **Fulfillment history** for patient/prescription tracking
2. **Analytics baseline** for fill-rate calculations
3. **Time-series data** for trend analysis
4. **Failure patterns** to understand supply constraints

### Historical Scenario 1: H1 - FILLED (60 days ago)

**Patient:** Alice Johnson  
**Doctor:** Dr. Sarah Smith  
**Diagnosis:** Acute Streptococcal Tonsillitis  
**Status:** `FILLED`  
**Created:** 60 days ago | **Filled:** 59 days ago  
**Medicines:**
- **Amoxicillin 500mg** - 500mg, 1 capsule three times daily, 10 days

**Fill Notes:** "Full 10-day antibiotic course fulfilled."

**Analytics Purpose:**
- Oldest fulfillment record; establishes baseline for 60-day analytics window
- Demonstrates short-term acute antibiotic course completion
- Shows patient successfully received treatment for bacterial infection

---

### Historical Scenario 2: H2 - FILLED (45 days ago)

**Patient:** Robert Miller  
**Doctor:** Dr. Sarah Smith  
**Diagnosis:** Tension Headache  
**Status:** `FILLED`  
**Created:** 45 days ago | **Filled:** 44 days ago  
**Medicines:**
- **Paracetamol 500mg** - 500mg, 1 tablet every 6 hours as needed, 3 days

**Fill Notes:** "Dispensed 12 tablets of Paracetamol."

**Analytics Purpose:**
- PRN (as-needed) medication scenario
- Short-term symptom management (3 days)
- Contributes to Paracetamol fill-rate calculations

---

### Historical Scenario 3: H3 - FILLED (30 days ago)

**Patient:** Clara Oswald  
**Doctor:** Dr. John Davis  
**Diagnosis:** Post-Dental Extraction Pain  
**Status:** `FILLED`  
**Created:** 30 days ago | **Filled:** 30 days ago (2 hours offset)  
**Medicines:**
- **Ibuprofen 400mg** - 400mg, 1 tablet every 8 hours with meals, 5 days

**Fill Notes:** "Dispensed 15 tablets of Ibuprofen 400mg post-extraction."

**Analytics Purpose:**
- Post-procedure pain management
- Mid-range historical data point (30 days)
- Demonstrates procedural/acute scenario

---

### Historical Scenario 4: H4 - CANNOT_FILL (20 days ago)

**Patient:** David Brown  
**Doctor:** Dr. John Davis  
**Diagnosis:** Chronic Allergic Urticaria  
**Status:** `CANNOT_FILL`  
**Created:** 20 days ago  
**Medicines:**
- **Cetirizine 10mg** - 10mg, 1 tablet once daily, 30 days

**Analytics Purpose:**
- Recent unfulfilled prescription (out of stock)
- Shows chronic condition where patient still waiting for medication
- Demonstrates system's capability to track failed fulfillments over time

---

### Historical Scenario 5: H5 - FILLED (15 days ago)

**Patient:** Emma Watson  
**Doctor:** Dr. Sarah Smith  
**Diagnosis:** Acute Bronchitis  
**Status:** `FILLED`  
**Created:** 15 days ago | **Filled:** 14 days ago  
**Medicines:**
- **Amoxicillin 500mg** - 500mg, 1 capsule twice daily, 7 days

**Fill Notes:** "14 capsules of Amoxicillin dispensed."

**Analytics Purpose:**
- Recent acute respiratory infection treatment
- Demonstrates short-term antibiotic course in younger patient (19 years old)
- Recent enough to show current fulfillment trends

---

### Historical Scenario 6: H6 - CANNOT_FILL (8 days ago)

**Patient:** David Brown  
**Doctor:** Dr. John Davis  
**Diagnosis:** Atypical Respiratory Infection  
**Status:** `CANNOT_FILL`  
**Created:** 8 days ago  
**Medicines:**
- **Azithromycin 250mg** - 250mg, 1 tablet daily, 6 days

**Analytics Purpose:**
- Very recent unfulfilled prescription (same patient as H4)
- Shows recurring fulfillment failure for single patient
- Demonstrates need for inventory management or substitute therapy
- Suggests David Brown may have underlying supply-chain issue or multiple failed treatments

---

## Analytics Verification Scenarios

The seed dataset supports the following analytics and reporting workflows:

### 1. Medicine-Wise Fill-Rate Calculations

**Test Data:**
- **Paracetamol 500mg**: Appears in rx1 (pending), rx3 (filled), rx6 (filled), h2 (filled)
  - Fill Rate: 3 of 4 = **75%**
  - Successfully used for pain management across multiple patients

- **Amoxicillin 500mg**: Appears in rx1 (pending), h1 (filled), h5 (filled)
  - Fill Rate: 2 of 3 = **66.7%**
  - Most common antibiotic in dataset; good uptake

- **Ibuprofen 400mg**: Appears in rx3 (filled), rx6 (filled), h3 (filled)
  - Fill Rate: 3 of 3 = **100%**
  - Strong performance; always in stock

- **Cetirizine 10mg**: Appears in rx2 (pending), rx5 (cannot_fill), h4 (cannot_fill)
  - Fill Rate: 0 of 3 = **0%**
  - OUT OF STOCK; all requests fail

- **Metformin 500mg**: Appears in rx4 (filled), rx6 (filled)
  - Fill Rate: 2 of 2 = **100%**
  - Chronic medication; reliable fulfillment

- **Azithromycin 250mg**: Appears in rx5 (cannot_fill), h6 (cannot_fill)
  - Fill Rate: 0 of 2 = **0%**
  - OUT OF STOCK; all requests fail

**Dashboard Insights:**
- **High-performing medicines:** Ibuprofen, Metformin (100% fill rate)
- **Problem medicines:** Cetirizine, Azithromycin (0% fill rate; out of stock)
- **Moderate performance:** Paracetamol, Amoxicillin (66-75% fill rate)

### 2. Fulfillment Success Rate by Time Period

**Last 7 days (rx1-rx6, recent scenarios):**
- Total prescriptions: 6
- Filled: 3 (rx3, rx4, rx6)
- Pending: 2 (rx1, rx2)
- Cannot Fill: 1 (rx5)
- **Success Rate: 50%** (3 of 6 completed)

**Last 60 days (including historical):**
- Total prescriptions: 12
- Filled: 7 (rx3, rx4, rx6, h1, h2, h3, h5)
- Pending: 2 (rx1, rx2)
- Cannot Fill: 3 (rx5, h4, h6)
- **Overall Success Rate: 58.3%** (7 of 12 completed)

### 3. Patient-Level Analytics

**Alice Johnson (34, Female, Dr. Sarah):**
- Prescriptions: rx1 (pending, multi-med), h1 (filled, antibiotic)
- Fulfillment: 50% (1 of 2)
- Conditions: URTI (acute), Strep throat (acute) → Acute care focus

**Robert Miller (52, Male, Dr. Sarah):**
- Prescriptions: rx3 (filled, multi-med), h2 (filled, PRN)
- Fulfillment: 100% (2 of 2)
- Conditions: Back pain, tension headache → Pain management focus

**Clara Oswald (28, Female, Dr. Sarah & Dr. John):**
- Prescriptions: rx4 (filled, chronic), rx6 (filled, multi-med), h3 (filled, acute)
- Fulfillment: 100% (3 of 3)
- Conditions: Diabetes (chronic), arthralgia (acute), dental pain (acute) → Highest activity; multi-doctor patient

**David Brown (67, Male, Dr. Sarah & Dr. John):**
- Prescriptions: rx5 (cannot_fill, multi-med), h4 (cannot_fill, chronic), h6 (cannot_fill, acute)
- Fulfillment: 0% (0 of 3)
- Conditions: Dermatitis, allergic urticaria, respiratory infection → All prescriptions blocked by out-of-stock medicines
- **Alert:** This patient has 3 consecutive unfulfilled prescriptions; likely needs intervention

**Emma Watson (19, Female, Dr. John):**
- Prescriptions: rx2 (pending, single-med), h5 (filled, acute)
- Fulfillment: 50% (1 of 2)
- Conditions: Allergic rhinitis (pending), bronchitis (filled) → Allergy/respiratory focus

### 4. Doctor Performance Comparison

**Dr. Sarah Smith (General Medicine):**
- Patients: 4 (Alice, Robert, Clara, David)
- Prescriptions issued: 6 (rx1, rx3, rx6, h1, h2, and h3 via Dr. John but Clara is shared)
- Fulfillment rate: ~67% (4 of 6 filled)

**Dr. John Davis (Pediatrics & Family Medicine):**
- Patients: 3 (Clara, David, Emma)
- Prescriptions issued: 5 (rx2, rx4, rx5, h4, h6)
- Fulfillment rate: ~40% (2 of 5 filled)
- **Note:** Lower rate due to prescribing out-of-stock Cetirizine/Azithromycin

### 5. Time-Series Fill Pattern

```
Timeline (oldest → newest):
|----60d----|----45d----|----30d----|----20d----|----15d----|----8d-----| TODAY
H1 Filled   H2 Filled   H3 Filled   H4 Cannot   H5 Filled   H6 Cannot   |
                                                                    RX1-6 (current)
```

**Observation:** There's a slight uptick in fulfillment success in the middle period (45-15 days ago), then a recent increase in unfulfilled prescriptions (8 days ago), followed by mixed results in current period.

---

## Testing Guidelines

### Manual Testing Workflows

#### 1. Pharmacy Prescription Queue Testing

**Use Scenario:** rx1 (PENDING Multi-Medicine) or rx2 (PENDING Single-Medicine)

**Steps:**
1. Log in as **pharmacy@medeasy.demo**
2. Navigate to Prescription Queue
3. Find Alice Johnson's pending URTI prescription (rx1) or Emma's allergy prescription (rx2)
4. Verify prescription displays all medicines, dosages, and frequencies
5. For rx1: Test multi-medicine selection and bundling
6. For rx2: Test out-of-stock handling (Cetirizine unavailable)

**Expected Outcomes:**
- rx1: All medicines available; can proceed with fulfillment
- rx2: Cetirizine flagged as out of stock; pharmacist offered alternatives or backorder option

---

#### 2. Fulfillment History Testing

**Use Scenario:** rx3 (FILLED Multi-Medicine), rx4 (FILLED Single-Medicine), rx6 (FILLED Triple-Medicine)

**Steps:**
1. Log in as **patient.robert@medeasy.demo** (or patient.clara@medeasy.demo)
2. Navigate to Prescription History
3. View completed prescriptions
4. Verify dispensed quantities, counseling notes, and fill dates match seed data
5. For rx3/rx6: Verify multi-medicine display and related medications grouped together

**Expected Outcomes:**
- Filled prescriptions display with accurate metadata
- Counseling notes visible (e.g., "Patient counseled on GI precautions" for rx3)
- Fill dates and pharmacy information correct

---

#### 3. Out-of-Stock Scenario Testing

**Use Scenario:** rx5 (CANNOT_FILL), rx2 (PENDING with out-of-stock), h4/h6 (historical cannot_fill)

**Steps:**
1. Log in as **pharmacy@medeasy.demo**
2. Attempt to fill David Brown's prescription (rx5) containing Cetirizine + Azithromycin
3. Verify system detects both medicines are out of stock
4. Check patient notification (if implemented)
5. Review analytics dashboard showing 0% fill rate for these medicines

**Expected Outcomes:**
- rx5 marked as CANNOT_FILL
- Pharmacy system blocks fulfillment
- Prescription remains in queue for manual resolution (substitute, backorder, etc.)

---

#### 4. Multi-Doctor Patient Testing

**Use Scenario:** Clara Oswald (Patient of Dr. Sarah & Dr. John)

**Steps:**
1. Log in as **patient.clara@medeasy.demo**
2. View all prescriptions (should see rx4 from Dr. John, rx6 from Dr. Sarah, h3 from Dr. John)
3. Log in as **dr.sarah@medeasy.demo**
4. Verify Clara appears in patient roster
5. Log in as **dr.john@medeasy.demo**
6. Verify Clara appears in patient roster
7. Review prescription history for Clara (should see combined history from both doctors)

**Expected Outcomes:**
- Clara's prescriptions show correct prescribing doctor for each
- Patient roster correctly lists both doctors
- Prescription history includes all doctors' prescriptions

---

#### 5. Analytics Testing

**Use Scenario:** All prescriptions (rx1-6, h1-6)

**Steps:**
1. Log in as **admin@medeasy.demo**
2. Navigate to Analytics/Reporting Dashboard
3. Generate medicine fill-rate report
4. Verify calculations match Analytics Verification Scenarios section:
   - Paracetamol: 75% (3 of 4)
   - Ibuprofen: 100% (3 of 3)
   - Cetirizine: 0% (0 of 3)
5. Filter by time period (7-day, 30-day, 60-day windows)
6. Generate patient-level analytics for Clara Oswald (highest activity)
7. Generate doctor performance comparison

**Expected Outcomes:**
- Fill rates calculated correctly
- Time-period filtering works accurately
- Patient-level metrics accessible and accurate

---

#### 6. Chronic vs. Acute Prescription Testing

**Acute Prescriptions (Short Duration):**
- rx1 (5-7 days), rx2 (14 days), rx5 (3-30 days, but out of stock)
- Use to test: Quick fulfillment, PRN dosing, short-term patient engagement

**Chronic Prescriptions (Long Duration):**
- rx4 (30 days), rx6 (30-day component)
- Use to test: Refill scheduling, medication adherence, recurring therapy

---

### Why Seed Scenarios Should Be Purposeful Rather Than Random

1. **Deterministic Testing:**
   - Fixed seed data ensures consistent test results across environments
   - Every run produces the same outcomes, enabling reliable regression testing
   - No flaky tests due to randomly ordered or missing data

2. **Scenario Coverage:**
   - Each prescription addresses a specific product workflow or edge case
   - Out-of-stock medicines intentionally demonstrate failure scenarios
   - Multi-medicine prescriptions validate complex data relationships
   - Overlapping patient rosters test multi-doctor coordination

3. **Analytics Baseline:**
   - 60-day history enables time-series analysis and trend detection
   - Controlled fill rates (75%, 100%, 0%) allow expected value validation
   - Patient-level variability (Clara 100%, David 0%) tests segmentation logic

4. **Documentation & Maintenance:**
   - Each scenario has documented purpose, workflow, and testing steps
   - New team members can understand dataset intent without reverse-engineering
   - Reduces mystery data and improves system onboarding
   - Makes it easier to identify why tests pass/fail

5. **Reproducibility:**
   - Developers can reproduce exact scenarios locally
   - QA can manually test specific workflows without generating test data
   - Support team can reference known dataset for troubleshooting
   - Analytics can validate calculations against documented expected values

---

### How Seed Data Supports Manual Testing

1. **Immediate Action Items:**
   - rx1 & rx2 are in PENDING status, ready for pharmacist action
   - No need to create prescriptions; pharmacy queue is pre-populated
   - Pharmacist can immediately test queue filtering, acceptance, and rejection flows

2. **Complex Scenario Simulation:**
   - rx5 (CANNOT_FILL) simulates supply-chain failure without modifying database
   - Multi-medicine prescriptions test grouping and counseling without creating new data
   - Overlapping patient rosters enable multi-doctor workflow testing

3. **Complete Patient Journeys:**
   - Clara Oswald has prescription history spanning acute, chronic, and multi-doctor scenarios
   - Robert Miller shows pain management progression (recent filled + historical)
   - David Brown demonstrates chronic fulfillment failure requiring intervention

4. **Edge Case Coverage:**
   - Out-of-stock medicines (Cetirizine, Azithromycin) test inventory constraints
   - Combination NSAIDs (rx3, rx6) test drug interaction logic
   - PRN medications (h2) test dosing frequency variations
   - Long-term refills (rx4, rx6) test chronic disease management

---

### How Seed Data Supports Analytics Testing

1. **Medicine-Level Metrics:**
   - Calculate fill rates: Paracetamol 75%, Ibuprofen 100%, Cetirizine 0%
   - Identify problem medicines: Cetirizine and Azithromycin consistently unavailable
   - Validate inventory alerts based on zero fill rate

2. **Time-Period Analysis:**
   - 60-day baseline with 12 prescriptions
   - 30-day window with 6 prescriptions (rx1-6)
   - 7-day recent window with 6 prescriptions showing mix of pending/filled/cannot_fill
   - Validate time-filtering logic in analytics engine

3. **Patient Segmentation:**
   - High-activity patient (Clara: 3 prescriptions)
   - Low-activity patients (Alice, Emma: 2 each)
   - Problem patient (David: 3 consecutive unfulfilled)
   - Multi-doctor patient (Clara, David) vs. single-doctor patients

4. **Doctor Performance:**
   - Dr. Sarah: 67% fulfillment rate (4 of 6 filled)
   - Dr. John: 40% fulfillment rate (2 of 5 filled)
   - Validate ranking and filtering in doctor leaderboards

5. **Trend Detection:**
   - 60-day timeline shows fulfillment pattern evolution
   - Recent increase in CANNOT_FILL (h6: 8 days ago) indicates supply issue
   - Enable testing of time-series anomaly detection
   - Validate forecasting algorithms for demand prediction

6. **Cohort Analysis:**
   - Age-based: Younger patient (Emma) vs. older patient (David)
   - Specialty-based: Dr. Sarah (General Medicine) vs. Dr. John (Pediatrics & Family)
   - Condition-based: Acute infections (URTI, bronchitis) vs. chronic (diabetes)
   - Validate segmentation and comparison logic

---

## Summary

The MedEasy seed dataset is a **carefully designed, purposeful collection** of user profiles, medicines, and prescription scenarios that:

- ✓ **Eliminates guesswork:** Each record has documented reason and testing use case
- ✓ **Covers major workflows:** Pharmacy queue, fulfillment, history, analytics
- ✓ **Simulates real constraints:** Out-of-stock items, complex polypharmacy, multi-doctor care
- ✓ **Enables reproducible testing:** Deterministic data for reliable regression testing
- ✓ **Supports manual & automated testing:** Ready-made scenarios for QA and CI/CD pipelines
- ✓ **Provides analytics baseline:** 60-day history with known expected values for validation

By maintaining this seed dataset as documentation, the team ensures that:
1. New developers understand system workflows through real examples
2. QA can execute test plans without creating test data ad-hoc
3. Analytics team can validate calculations against expected values
4. Support can troubleshoot issues using known, consistent data
5. System behavior remains predictable across environments

