# Data Model

This document describes the entities and constraints in `prisma/schema.prisma`. No entities outside the approved prescription, user-profile, medicine, and fill model are included.

## User

**Purpose:** Stores the shared account and authentication identity for doctors, pharmacies, patients, and administrators.

**Important fields:** `id`, unique `email`, `password`, `role` (`UserRole`), `createdAt`, and `updatedAt`.

**Relationships:** Has optional one-to-one relations to `DoctorProfile`, `PharmacyProfile`, and `PatientProfile`.

**Important constraints:** `id` is the primary key; `email` is unique; `role` is indexed. The role values are `DOCTOR`, `PHARMACY`, `PATIENT`, and `ADMIN`.

## DoctorProfile

**Purpose:** Stores doctor-specific professional information.

**Important fields:** `id`, unique `userId`, `specialization`, unique `licenseNumber`, `phone`, `createdAt`, and `updatedAt`.

**Relationships:** Belongs to one `User`; has many `DoctorPatient` records and many `Prescription` records.

**Important constraints:** `userId` and `licenseNumber` are unique. Deleting the related `User` cascades to this profile. `specialization` is indexed.

## PharmacyProfile

**Purpose:** Stores pharmacy-specific business and contact information.

**Important fields:** `id`, unique `userId`, `pharmacyName`, `pharmacyType`, unique `licenseNumber`, `phone`, `createdAt`, and `updatedAt`.

**Relationships:** Belongs to one `User`; performs many `Fill` records.

**Important constraints:** `userId` and `licenseNumber` are unique. Deleting the related `User` cascades to this profile. `pharmacyName` is indexed.

## PatientProfile

**Purpose:** Stores patient demographic and contact information.

**Important fields:** `id`, unique `userId`, `name`, `age`, `gender`, `contactInfo`, `createdAt`, and `updatedAt`.

**Relationships:** Belongs to one `User`; has many `DoctorPatient` records and many `Prescription` records.

**Important constraints:** `userId` is unique. Deleting the related `User` cascades to this profile. `name` is indexed.

## DoctorPatient

**Purpose:** Represents the doctor-patient roster or care relationship.

**Important fields:** `id`, `doctorId`, `patientId`, `createdAt`, and `updatedAt`.

**Relationships:** Each record belongs to one `DoctorProfile` and one `PatientProfile`. A doctor and a patient can participate in many roster records with other parties.

**Important constraints:** The composite pair `doctorId` and `patientId` is unique, preventing duplicate roster entries. Both foreign keys are indexed. Deleting either related profile cascades to the roster record.

### Why `DoctorPatient` exists

It is the explicit association between doctors and patients. Neither profile can store the relationship reliably as a single foreign key because one doctor can care for many patients and one patient can be associated with many doctors. Keeping the association as its own model also gives the relationship its own timestamps and a place for future relationship-level data without changing either profile.

## Medicine

**Purpose:** Stores the medicine catalog referenced by prescriptions.

**Important fields:** `id`, `name`, `genericName`, `stockStatus`, `createdAt`, and `updatedAt`.

**Relationships:** Has many `PrescriptionMedicine` records.

**Important constraints:** `name` and `genericName` are indexed. `stockStatus` defaults to `true`.

`stockStatus` exists only for seeded demo purposes. It supports simple demonstration data and availability states; it is not an inventory model and does not represent stock movements, quantities, suppliers, or orders.

## Prescription

**Purpose:** Records a doctor's prescription for a patient and tracks its high-level fulfillment status.

**Important fields:** `id`, `doctorId`, `patientId`, `diagnosis`, optional `documentRef`, `status` (`PrescriptionStatus`), optional `filledAt`, `createdAt`, and `updatedAt`.

**Relationships:** Belongs to one `DoctorProfile` and one `PatientProfile`; contains many `PrescriptionMedicine` records; has zero or one `Fill`.

**Important constraints:** `status` defaults to `PENDING` and can be `PENDING`, `FILLED`, or `CANNOT_FILL`. Doctor, patient, status, and creation time are indexed. Doctor and patient deletion is restricted; prescription item deletion cascades from the prescription.

## PrescriptionMedicine

**Purpose:** Records each medicine prescribed on a prescription, including its instructions.

**Important fields:** `id`, `prescriptionId`, `medicineId`, `dosage`, `frequency`, `duration`, `createdAt`, and `updatedAt`.

**Relationships:** Belongs to one `Prescription` and one `Medicine`.

**Important constraints:** The composite pair `prescriptionId` and `medicineId` is unique, so the same medicine cannot be listed twice on one prescription. Both foreign keys are indexed. Deleting a prescription cascades to its items; deleting a medicine referenced by an item is restricted.

### Why `PrescriptionMedicine` exists

It is the junction model between `Prescription` and `Medicine`. A prescription can contain many medicines, and a medicine can appear on many prescriptions, which is a many-to-many relationship. The junction model also stores relationship-specific fields such as `dosage`, `frequency`, and `duration`.

## Fill

**Purpose:** Records a pharmacy's successful fulfillment of a prescription.

**Important fields:** `id`, unique `prescriptionId`, `pharmacyId`, optional `notes`, `filledAt`, `createdAt`, and `updatedAt`.

**Relationships:** Belongs to one `Prescription` and one `PharmacyProfile`.

**Important constraints:** `prescriptionId` is unique, so each prescription can have at most one successful `Fill`. `pharmacyId` and `filledAt` are indexed. Deleting a prescription cascades to its fill; deleting a pharmacy is restricted when fills reference it.

### Why `Fill.prescriptionId` is unique

The model treats a `Fill` as the successful fulfillment outcome for a prescription, not as an unbounded event log. A unique foreign key enforces the one-to-zero-or-one relationship at the database level and prevents two successful fill records from being attached to the same prescription.

## Core Concepts

### What an ER diagram is

An entity-relationship (ER) diagram is a visual representation of database entities, their key fields, and the relationships and cardinalities between them. It makes the model easier to review before implementation.

### Why design relationships before APIs

API behavior depends on ownership, cardinality, foreign keys, and lifecycle rules. Designing these first prevents endpoints from exposing contradictory assumptions and helps validation, queries, and error handling follow one consistent model.

### What a junction table is

A junction table, or junction model, stores links between records in two entities when both sides can have many related records. It can also hold attributes of that link, as `PrescriptionMedicine` does with dosage, frequency, and duration.

### Why `DoctorPatient` is necessary

It models the many-to-many doctor-patient association explicitly, enforces one relationship per doctor-patient pair, and gives that association timestamps independent of either profile.

### Why `PrescriptionMedicine` is necessary

It models the many-to-many prescription-medicine association and stores the instructions that apply to a medicine within one particular prescription.