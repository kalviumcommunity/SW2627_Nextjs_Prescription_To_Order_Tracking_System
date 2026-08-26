import { PrismaClient, UserRole, PrescriptionStatus } from "@prisma/client";

const prisma = new PrismaClient();

async function main() {
  console.log("🌱 Starting database seeding for MedEasy Prescription-to-Order Tracking System...\n");

  // ---------------------------------------------------------------------------
  // 1. CLEANUP (Idempotent: reverse dependency order)
  // ---------------------------------------------------------------------------
  console.log("🧹 Cleaning up existing data...");
  await prisma.fill.deleteMany({});
  await prisma.prescriptionMedicine.deleteMany({});
  await prisma.prescription.deleteMany({});
  await prisma.doctorPatient.deleteMany({});
  await prisma.medicine.deleteMany({});
  await prisma.doctorProfile.deleteMany({});
  await prisma.pharmacyProfile.deleteMany({});
  await prisma.patientProfile.deleteMany({});
  await prisma.user.deleteMany({});
  console.log("✓ Existing records cleaned.\n");

  // Fixed reference date to ensure deterministic relative dates
  const now = new Date();
  const daysAgo = (days: number, hoursOffset: number = 0) => {
    const d = new Date(now.getTime() - days * 24 * 60 * 60 * 1000 - hoursOffset * 60 * 60 * 1000);
    return d;
  };

  // ---------------------------------------------------------------------------
  // 2. ADMIN USER
  // ---------------------------------------------------------------------------
  console.log("👤 Seeding Admin user...");
  const adminUser = await prisma.user.create({
    data: {
      email: "admin@medeasy.demo",
      password: "DemoAdminPassword123!",
      role: UserRole.ADMIN,
    },
  });
  console.log(`✓ Admin created: ${adminUser.email}`);

  // ---------------------------------------------------------------------------
  // 3. DOCTORS & PROFILES
  // ---------------------------------------------------------------------------
  console.log("\n🩺 Seeding Doctors...");
  const doctor1User = await prisma.user.create({
    data: {
      email: "dr.sarah@medeasy.demo",
      password: "DemoDoctorPassword123!",
      role: UserRole.DOCTOR,
      doctorProfile: {
        create: {
          specialization: "General Medicine",
          licenseNumber: "DOC-LIC-1001",
          phone: "+1-555-0101",
        },
      },
    },
    include: { doctorProfile: true },
  });

  const doctor2User = await prisma.user.create({
    data: {
      email: "dr.john@medeasy.demo",
      password: "DemoDoctorPassword123!",
      role: UserRole.DOCTOR,
      doctorProfile: {
        create: {
          specialization: "Pediatrics & Family Medicine",
          licenseNumber: "DOC-LIC-1002",
          phone: "+1-555-0102",
        },
      },
    },
    include: { doctorProfile: true },
  });

  const doctor1 = doctor1User.doctorProfile!;
  const doctor2 = doctor2User.doctorProfile!;
  console.log(`✓ Doctor 1 created: Dr. Sarah Smith (${doctor1User.email}) - Spec: ${doctor1.specialization}`);
  console.log(`✓ Doctor 2 created: Dr. John Davis (${doctor2User.email}) - Spec: ${doctor2.specialization}`);

  // ---------------------------------------------------------------------------
  // 4. PHARMACY & PROFILE (Single Pre-Provisioned Pharmacy per PRD)
  // ---------------------------------------------------------------------------
  console.log("\n💊 Seeding Pharmacy...");
  const pharmacyUser = await prisma.user.create({
    data: {
      email: "pharmacy@medeasy.demo",
      password: "DemoPharmacyPassword123!",
      role: UserRole.PHARMACY,
      pharmacyProfile: {
        create: {
          pharmacyName: "MedEasy Central Pharmacy",
          pharmacyType: "Retail & Hospital Dispensing",
          licenseNumber: "PHARM-LIC-5001",
          phone: "+1-555-0201",
        },
      },
    },
    include: { pharmacyProfile: true },
  });

  const pharmacy = pharmacyUser.pharmacyProfile!;
  console.log(`✓ Pharmacy created: ${pharmacy.pharmacyName} (${pharmacyUser.email})`);

  // ---------------------------------------------------------------------------
  // 5. PATIENTS & PROFILES
  // ---------------------------------------------------------------------------
  console.log("\n🧑‍🤝‍🧑 Seeding Patients...");
  const patientData = [
    {
      email: "patient.alice@medeasy.demo",
      name: "Alice Johnson",
      age: 34,
      gender: "Female",
      contactInfo: "+1-555-0301, 101 Maple Street, Springfield",
    },
    {
      email: "patient.robert@medeasy.demo",
      name: "Robert Miller",
      age: 52,
      gender: "Male",
      contactInfo: "+1-555-0302, 204 Oak Avenue, Springfield",
    },
    {
      email: "patient.clara@medeasy.demo",
      name: "Clara Oswald",
      age: 28,
      gender: "Female",
      contactInfo: "+1-555-0303, 305 Pine Road, Springfield",
    },
    {
      email: "patient.david@medeasy.demo",
      name: "David Brown",
      age: 67,
      gender: "Male",
      contactInfo: "+1-555-0304, 408 Elm Boulevard, Springfield",
    },
    {
      email: "patient.emma@medeasy.demo",
      name: "Emma Watson",
      age: 19,
      gender: "Female",
      contactInfo: "+1-555-0305, 512 Birch Drive, Springfield",
    },
  ];

  const patients = [];
  for (const p of patientData) {
    const user = await prisma.user.create({
      data: {
        email: p.email,
        password: "DemoPatientPassword123!",
        role: UserRole.PATIENT,
        patientProfile: {
          create: {
            name: p.name,
            age: p.age,
            gender: p.gender,
            contactInfo: p.contactInfo,
          },
        },
      },
      include: { patientProfile: true },
    });
    patients.push(user.patientProfile!);
    console.log(`✓ Patient created: ${p.name} (${p.email}) - Age: ${p.age}`);
  }

  const [patientAlice, patientRobert, patientClara, patientDavid, patientEmma] = patients;

  // ---------------------------------------------------------------------------
  // 6. DOCTOR-PATIENT RELATIONSHIPS
  // ---------------------------------------------------------------------------
  console.log("\n📋 Seeding Doctor-Patient Rosters...");
  const doctorPatientLinks = [
    // Dr. Sarah's Patients
    { doctorId: doctor1.id, patientId: patientAlice.id },
    { doctorId: doctor1.id, patientId: patientRobert.id },
    { doctorId: doctor1.id, patientId: patientClara.id },
    { doctorId: doctor1.id, patientId: patientDavid.id },
    // Dr. John's Patients (Overlapping rosters: Clara and David see both doctors)
    { doctorId: doctor2.id, patientId: patientClara.id },
    { doctorId: doctor2.id, patientId: patientDavid.id },
    { doctorId: doctor2.id, patientId: patientEmma.id },
  ];

  for (const link of doctorPatientLinks) {
    await prisma.doctorPatient.create({
      data: link,
    });
  }
  console.log(`✓ Created ${doctorPatientLinks.length} Doctor-Patient care relationships.`);

  // ---------------------------------------------------------------------------
  // 7. MEDICINES CATALOG (PRD examples + clinical stock states)
  // ---------------------------------------------------------------------------
  console.log("\n💊 Seeding Medicine Catalog...");
  const medicineList = [
    {
      name: "Paracetamol 500mg",
      genericName: "Paracetamol",
      stockStatus: true,
    },
    {
      name: "Amoxicillin 500mg",
      genericName: "Amoxicillin Trihydrate",
      stockStatus: true,
    },
    {
      name: "Ibuprofen 400mg",
      genericName: "Ibuprofen",
      stockStatus: true,
    },
    {
      name: "Cetirizine 10mg",
      genericName: "Cetirizine Hydrochloride",
      stockStatus: false, // Seeded out-of-stock for scenario simulation
    },
    {
      name: "Metformin 500mg",
      genericName: "Metformin Hydrochloride",
      stockStatus: true,
    },
    {
      name: "Azithromycin 250mg",
      genericName: "Azithromycin Monohydrate",
      stockStatus: false, // Seeded out-of-stock for scenario simulation
    },
  ];

  const medicines: Record<string, { id: string; name: string; genericName: string; stockStatus: boolean }> = {};
  for (const med of medicineList) {
    const created = await prisma.medicine.create({
      data: med,
    });
    medicines[med.name] = created;
    console.log(`✓ Medicine created: ${created.name} (${created.genericName}) [In Stock: ${created.stockStatus}]`);
  }

  // ---------------------------------------------------------------------------
  // 8. PRESCRIPTIONS, MEDICINES & FILLS (All required scenarios + analytics data)
  // ---------------------------------------------------------------------------
  console.log("\n📝 Seeding Prescriptions and Fulfillment Records...");

  // --- Scenario 1: Pending Multi-Medicine Prescription ---
  const rx1 = await prisma.prescription.create({
    data: {
      doctorId: doctor1.id,
      patientId: patientAlice.id,
      diagnosis: "Acute Upper Respiratory Tract Infection",
      documentRef: "rx-docs/alice-urti-2026.pdf",
      status: PrescriptionStatus.PENDING,
      createdAt: daysAgo(2),
      updatedAt: daysAgo(2),
      prescriptionMedicines: {
        create: [
          {
            medicineId: medicines["Paracetamol 500mg"].id,
            dosage: "500mg",
            frequency: "1 tablet three times daily after food",
            duration: "5 days",
            createdAt: daysAgo(2),
          },
          {
            medicineId: medicines["Amoxicillin 500mg"].id,
            dosage: "500mg",
            frequency: "1 capsule twice daily with full glass of water",
            duration: "7 days",
            createdAt: daysAgo(2),
          },
        ],
      },
    },
  });
  console.log(`✓ [Scenario 1 - Pending Multi-Med] Rx ID: ${rx1.id} for Alice Johnson (Paracetamol + Amoxicillin)`);

  // --- Scenario 2: Pending Single Medicine Prescription ---
  const rx2 = await prisma.prescription.create({
    data: {
      doctorId: doctor2.id,
      patientId: patientEmma.id,
      diagnosis: "Mild Seasonal Allergic Rhinitis",
      documentRef: "rx-docs/emma-rhinitis-2026.pdf",
      status: PrescriptionStatus.PENDING,
      createdAt: daysAgo(1),
      updatedAt: daysAgo(1),
      prescriptionMedicines: {
        create: [
          {
            medicineId: medicines["Cetirizine 10mg"].id,
            dosage: "10mg",
            frequency: "1 tablet once daily at bedtime",
            duration: "14 days",
            createdAt: daysAgo(1),
          },
        ],
      },
    },
  });
  console.log(`✓ [Scenario 2 - Pending Single-Med] Rx ID: ${rx2.id} for Emma Watson (Cetirizine)`);

  // --- Scenario 3: Filled Multi-Medicine Prescription ---
  const rx3Created = daysAgo(5);
  const rx3Filled = daysAgo(4, 2);
  const rx3 = await prisma.prescription.create({
    data: {
      doctorId: doctor1.id,
      patientId: patientRobert.id,
      diagnosis: "Musculoskeletal Lower Back Pain & Strain",
      documentRef: "rx-docs/robert-backpain-2026.pdf",
      status: PrescriptionStatus.FILLED,
      filledAt: rx3Filled,
      createdAt: rx3Created,
      updatedAt: rx3Filled,
      prescriptionMedicines: {
        create: [
          {
            medicineId: medicines["Ibuprofen 400mg"].id,
            dosage: "400mg",
            frequency: "1 tablet twice daily with food",
            duration: "10 days",
            createdAt: rx3Created,
          },
          {
            medicineId: medicines["Paracetamol 500mg"].id,
            dosage: "500mg",
            frequency: "1 tablet as needed for breakthrough pain (max 3/day)",
            duration: "5 days",
            createdAt: rx3Created,
          },
        ],
      },
      fill: {
        create: {
          pharmacyId: pharmacy.id,
          notes: "Dispensed 20 tablets of Ibuprofen and 15 tablets of Paracetamol. Patient counseled on GI precautions.",
          filledAt: rx3Filled,
          createdAt: rx3Filled,
          updatedAt: rx3Filled,
        },
      },
    },
  });
  console.log(`✓ [Scenario 3 - Filled Multi-Med] Rx ID: ${rx3.id} for Robert Miller (Ibuprofen + Paracetamol)`);

  // --- Scenario 4: Filled Single Medicine Prescription ---
  const rx4Created = daysAgo(7);
  const rx4Filled = daysAgo(6, 4);
  const rx4 = await prisma.prescription.create({
    data: {
      doctorId: doctor2.id,
      patientId: patientClara.id,
      diagnosis: "Type 2 Diabetes Mellitus Maintenance",
      documentRef: "rx-docs/clara-diabetes-2026.pdf",
      status: PrescriptionStatus.FILLED,
      filledAt: rx4Filled,
      createdAt: rx4Created,
      updatedAt: rx4Filled,
      prescriptionMedicines: {
        create: [
          {
            medicineId: medicines["Metformin 500mg"].id,
            dosage: "500mg",
            frequency: "1 tablet twice daily with breakfast and dinner",
            duration: "30 days",
            createdAt: rx4Created,
          },
        ],
      },
      fill: {
        create: {
          pharmacyId: pharmacy.id,
          notes: "Standard monthly refill of 60 Metformin tablets dispensed. Advised regular blood glucose tracking.",
          filledAt: rx4Filled,
          createdAt: rx4Filled,
          updatedAt: rx4Filled,
        },
      },
    },
  });
  console.log(`✓ [Scenario 4 - Filled Single-Med] Rx ID: ${rx4.id} for Clara Oswald (Metformin)`);

  // --- Scenario 5: Cannot Fill Prescription (Out of Stock items) ---
  const rx5 = await prisma.prescription.create({
    data: {
      doctorId: doctor2.id,
      patientId: patientDavid.id,
      diagnosis: "Severe Allergic Dermatitis & Secondary Infection Flare",
      documentRef: "rx-docs/david-dermatitis-2026.pdf",
      status: PrescriptionStatus.CANNOT_FILL,
      createdAt: daysAgo(3),
      updatedAt: daysAgo(3),
      prescriptionMedicines: {
        create: [
          {
            medicineId: medicines["Cetirizine 10mg"].id,
            dosage: "10mg",
            frequency: "1 tablet daily in the evening",
            duration: "30 days",
            createdAt: daysAgo(3),
          },
          {
            medicineId: medicines["Azithromycin 250mg"].id,
            dosage: "250mg",
            frequency: "1 capsule once daily",
            duration: "3 days",
            createdAt: daysAgo(3),
          },
        ],
      },
    },
  });
  console.log(`✓ [Scenario 5 - Cannot Fill] Rx ID: ${rx5.id} for David Brown (Cetirizine + Azithromycin - Out of stock)`);

  // --- Scenario 6: Multi-Medicine Triple Prescription (Filled) ---
  const rx6Created = daysAgo(12);
  const rx6Filled = daysAgo(11, 1);
  const rx6 = await prisma.prescription.create({
    data: {
      doctorId: doctor1.id,
      patientId: patientClara.id,
      diagnosis: "Post-Viral Arthralgia and Metabolic Routine",
      documentRef: "rx-docs/clara-arthralgia-2026.pdf",
      status: PrescriptionStatus.FILLED,
      filledAt: rx6Filled,
      createdAt: rx6Created,
      updatedAt: rx6Filled,
      prescriptionMedicines: {
        create: [
          {
            medicineId: medicines["Paracetamol 500mg"].id,
            dosage: "500mg",
            frequency: "1 tablet three times daily",
            duration: "7 days",
            createdAt: rx6Created,
          },
          {
            medicineId: medicines["Ibuprofen 400mg"].id,
            dosage: "400mg",
            frequency: "1 tablet twice daily with food",
            duration: "5 days",
            createdAt: rx6Created,
          },
          {
            medicineId: medicines["Metformin 500mg"].id,
            dosage: "500mg",
            frequency: "1 tablet twice daily",
            duration: "30 days",
            createdAt: rx6Created,
          },
        ],
      },
      fill: {
        create: {
          pharmacyId: pharmacy.id,
          notes: "All three medications dispensed in full. Patient advised regarding combination analgesics.",
          filledAt: rx6Filled,
          createdAt: rx6Filled,
          updatedAt: rx6Filled,
        },
      },
    },
  });
  console.log(`✓ [Scenario 6 - Triple-Med Filled] Rx ID: ${rx6.id} for Clara Oswald (Paracetamol + Ibuprofen + Metformin)`);

  // --- Scenarios 7-11: Historical Filled / Cannot Fill Records for Analytics ---
  console.log("\n📊 Seeding Historical Scenarios for Analytics Baseline...");

  // Historical 1 (60 days ago - Filled)
  const h1Created = daysAgo(60);
  const h1Filled = daysAgo(59);
  await prisma.prescription.create({
    data: {
      doctorId: doctor1.id,
      patientId: patientAlice.id,
      diagnosis: "Acute Streptococcal Tonsillitis",
      status: PrescriptionStatus.FILLED,
      filledAt: h1Filled,
      createdAt: h1Created,
      updatedAt: h1Filled,
      prescriptionMedicines: {
        create: [
          {
            medicineId: medicines["Amoxicillin 500mg"].id,
            dosage: "500mg",
            frequency: "1 capsule three times daily",
            duration: "10 days",
            createdAt: h1Created,
          },
        ],
      },
      fill: {
        create: {
          pharmacyId: pharmacy.id,
          notes: "Full 10-day antibiotic course fulfilled.",
          filledAt: h1Filled,
          createdAt: h1Filled,
          updatedAt: h1Filled,
        },
      },
    },
  });

  // Historical 2 (45 days ago - Filled)
  const h2Created = daysAgo(45);
  const h2Filled = daysAgo(44);
  await prisma.prescription.create({
    data: {
      doctorId: doctor1.id,
      patientId: patientRobert.id,
      diagnosis: "Tension Headache",
      status: PrescriptionStatus.FILLED,
      filledAt: h2Filled,
      createdAt: h2Created,
      updatedAt: h2Filled,
      prescriptionMedicines: {
        create: [
          {
            medicineId: medicines["Paracetamol 500mg"].id,
            dosage: "500mg",
            frequency: "1 tablet every 6 hours as needed",
            duration: "3 days",
            createdAt: h2Created,
          },
        ],
      },
      fill: {
        create: {
          pharmacyId: pharmacy.id,
          notes: "Dispensed 12 tablets of Paracetamol.",
          filledAt: h2Filled,
          createdAt: h2Filled,
          updatedAt: h2Filled,
        },
      },
    },
  });

  // Historical 3 (30 days ago - Filled)
  const h3Created = daysAgo(30);
  const h3Filled = daysAgo(30, 2);
  await prisma.prescription.create({
    data: {
      doctorId: doctor2.id,
      patientId: patientClara.id,
      diagnosis: "Post-Dental Extraction Pain",
      status: PrescriptionStatus.FILLED,
      filledAt: h3Filled,
      createdAt: h3Created,
      updatedAt: h3Filled,
      prescriptionMedicines: {
        create: [
          {
            medicineId: medicines["Ibuprofen 400mg"].id,
            dosage: "400mg",
            frequency: "1 tablet every 8 hours with meals",
            duration: "5 days",
            createdAt: h3Created,
          },
        ],
      },
      fill: {
        create: {
          pharmacyId: pharmacy.id,
          notes: "Dispensed 15 tablets of Ibuprofen 400mg post-extraction.",
          filledAt: h3Filled,
          createdAt: h3Filled,
          updatedAt: h3Filled,
        },
      },
    },
  });

  // Historical 4 (20 days ago - Cannot Fill due to Cetirizine supply)
  const h4Created = daysAgo(20);
  await prisma.prescription.create({
    data: {
      doctorId: doctor2.id,
      patientId: patientDavid.id,
      diagnosis: "Chronic Allergic Urticaria",
      status: PrescriptionStatus.CANNOT_FILL,
      createdAt: h4Created,
      updatedAt: h4Created,
      prescriptionMedicines: {
        create: [
          {
            medicineId: medicines["Cetirizine 10mg"].id,
            dosage: "10mg",
            frequency: "1 tablet once daily",
            duration: "30 days",
            createdAt: h4Created,
          },
        ],
      },
    },
  });

  // Historical 5 (15 days ago - Filled)
  const h5Created = daysAgo(15);
  const h5Filled = daysAgo(14);
  await prisma.prescription.create({
    data: {
      doctorId: doctor1.id,
      patientId: patientEmma.id,
      diagnosis: "Acute Bronchitis",
      status: PrescriptionStatus.FILLED,
      filledAt: h5Filled,
      createdAt: h5Created,
      updatedAt: h5Filled,
      prescriptionMedicines: {
        create: [
          {
            medicineId: medicines["Amoxicillin 500mg"].id,
            dosage: "500mg",
            frequency: "1 capsule twice daily",
            duration: "7 days",
            createdAt: h5Created,
          },
        ],
      },
      fill: {
        create: {
          pharmacyId: pharmacy.id,
          notes: "14 capsules of Amoxicillin dispensed.",
          filledAt: h5Filled,
          createdAt: h5Filled,
          updatedAt: h5Filled,
        },
      },
    },
  });

  // Historical 6 (8 days ago - Cannot Fill due to Azithromycin supply)
  const h6Created = daysAgo(8);
  await prisma.prescription.create({
    data: {
      doctorId: doctor2.id,
      patientId: patientDavid.id,
      diagnosis: "Atypical Respiratory Infection",
      status: PrescriptionStatus.CANNOT_FILL,
      createdAt: h6Created,
      updatedAt: h6Created,
      prescriptionMedicines: {
        create: [
          {
            medicineId: medicines["Azithromycin 250mg"].id,
            dosage: "250mg",
            frequency: "1 tablet daily",
            duration: "6 days",
            createdAt: h6Created,
          },
        ],
      },
    },
  });

  console.log("✓ Created 6 historical prescription & fulfillment records across a 60-day timeline.");

  console.log("\n============================================================");
  console.log("🎉 Database seeding completed successfully!");
  console.log("============================================================");
}

main()
  .catch((e) => {
    console.error("❌ Seeding failed with error:", e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
