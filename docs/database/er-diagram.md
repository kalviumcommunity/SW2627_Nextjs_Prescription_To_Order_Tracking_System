# Entity-Relationship Diagram

This diagram represents the approved Prisma database model for the MedEasy Prescription-to-Order Tracking System.

```mermaid
erDiagram
    User {
        String id PK
        String email UK
        String password
        UserRole role
        DateTime createdAt
        DateTime updatedAt
    }
    DoctorProfile {
        String id PK
        String userId FK_UK
        String specialization
        String licenseNumber UK
        String phone
        DateTime createdAt
        DateTime updatedAt
    }
    PharmacyProfile {
        String id PK
        String userId FK_UK
        String pharmacyName
        String pharmacyType
        String licenseNumber UK
        String phone
        DateTime createdAt
        DateTime updatedAt
    }
    PatientProfile {
        String id PK
        String userId FK_UK
        String name
        Int age
        String gender
        String contactInfo
        DateTime createdAt
        DateTime updatedAt
    }
    DoctorPatient {
        String id PK
        String doctorId FK
        String patientId FK
        DateTime createdAt
        DateTime updatedAt
    }
    Medicine {
        String id PK
        String name
        String genericName
        Boolean stockStatus
        DateTime createdAt
        DateTime updatedAt
    }
    Prescription {
        String id PK
        String doctorId FK
        String patientId FK
        String diagnosis
        String documentRef
        PrescriptionStatus status
        DateTime filledAt
        DateTime createdAt
        DateTime updatedAt
    }
    PrescriptionMedicine {
        String id PK
        String prescriptionId FK
        String medicineId FK
        String dosage
        String frequency
        String duration
        DateTime createdAt
        DateTime updatedAt
    }
    Fill {
        String id PK
        String prescriptionId FK_UK
        String pharmacyId FK
        String notes
        DateTime filledAt
        DateTime createdAt
        DateTime updatedAt
    }

    User ||--o| DoctorProfile : "has"
    User ||--o| PharmacyProfile : "has"
    User ||--o| PatientProfile : "has"
    DoctorProfile ||--o{ DoctorPatient : "is assigned"
    PatientProfile ||--o{ DoctorPatient : "is assigned"
    DoctorProfile ||--o{ Prescription : "writes"
    PatientProfile ||--o{ Prescription : "receives"
    Prescription ||--|{ PrescriptionMedicine : "contains"
    Medicine ||--o{ PrescriptionMedicine : "appears in"
    Prescription ||--o| Fill : "has successful fill"
    PharmacyProfile ||--o{ Fill : "performs"
```

## Cardinality Notes

- A `User` has zero or one role-specific profile of each profile type. `userId` is unique in each profile model.
- A doctor can have many `Prescription` records, and a patient can have many `Prescription` records.
- `DoctorPatient` records associate doctors and patients; the pair is unique.
- Each `Prescription` contains one or more `PrescriptionMedicine` records in the intended domain workflow. The schema permits an empty collection until items are added.
- A `Medicine` may appear in many prescriptions through `PrescriptionMedicine`.
- A `Prescription` has zero or one `Fill`. A `Fill` represents the successful fulfillment record, and unique `Fill.prescriptionId` prevents more than one successful fill for the same prescription.
- A `PharmacyProfile` can perform many fills.