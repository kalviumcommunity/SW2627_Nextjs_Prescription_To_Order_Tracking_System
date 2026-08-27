import bcrypt from "bcryptjs";
import { prisma } from "@/lib/prisma";
import { UserRole } from "@prisma/client";

const BCRYPT_SALT_ROUNDS = 10;

/**
 * Hashes a plaintext password using bcrypt with standard salt rounds.
 */
export async function hashPassword(password: string): Promise<string> {
  return await bcrypt.hash(password, BCRYPT_SALT_ROUNDS);
}

/**
 * Verifies a plaintext password against a stored bcrypt hash.
 */
export async function verifyPassword(password: string, hash: string): Promise<boolean> {
  return await bcrypt.compare(password, hash);
}

export interface DoctorRegistrationInput {
  email: string;
  password: string;
  specialization: string;
  licenseNumber: string;
  phone: string;
}

export interface PatientRegistrationInput {
  email: string;
  password: string;
  name: string;
  age: number;
  gender: string;
  contactInfo: string;
}

/**
 * Registers a new Doctor account and DoctorProfile within a transaction.
 */
export async function registerDoctor(input: DoctorRegistrationInput) {
  const email = input.email.toLowerCase().trim();

  // Check if a user with this email already exists
  const existingUser = await prisma.user.findUnique({
    where: { email },
  });

  if (existingUser) {
    throw new Error("A user with this email already exists.");
  }

  // Check if license number is already registered
  const existingLicense = await prisma.doctorProfile.findUnique({
    where: { licenseNumber: input.licenseNumber.trim() },
  });

  if (existingLicense) {
    throw new Error("A doctor with this license number already exists.");
  }

  const hashedPassword = await hashPassword(input.password);

  return await prisma.user.create({
    data: {
      email,
      password: hashedPassword,
      role: UserRole.DOCTOR,
      doctorProfile: {
        create: {
          specialization: input.specialization.trim(),
          licenseNumber: input.licenseNumber.trim(),
          phone: input.phone.trim(),
        },
      },
    },
    select: {
      id: true,
      email: true,
      role: true,
      createdAt: true,
      doctorProfile: true,
    },
  });
}

/**
 * Registers a new Patient account and PatientProfile within a transaction.
 */
export async function registerPatient(input: PatientRegistrationInput) {
  const email = input.email.toLowerCase().trim();

  // Check if a user with this email already exists
  const existingUser = await prisma.user.findUnique({
    where: { email },
  });

  if (existingUser) {
    throw new Error("A user with this email already exists.");
  }

  const hashedPassword = await hashPassword(input.password);

  return await prisma.user.create({
    data: {
      email,
      password: hashedPassword,
      role: UserRole.PATIENT,
      patientProfile: {
        create: {
          name: input.name.trim(),
          age: input.age,
          gender: input.gender.trim(),
          contactInfo: input.contactInfo.trim(),
        },
      },
    },
    select: {
      id: true,
      email: true,
      role: true,
      createdAt: true,
      patientProfile: true,
    },
  });
}
