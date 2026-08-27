import { NextAuthOptions } from "next-auth";
import CredentialsProvider from "next-auth/providers/credentials";
import bcrypt from "bcryptjs";
import { prisma } from "@/lib/prisma";
import { UserRole } from "@prisma/client";

export const authOptions: NextAuthOptions = {
  session: {
    strategy: "jwt",
  },
  secret: process.env.NEXTAUTH_SECRET,
  providers: [
    CredentialsProvider({
      name: "Credentials",
      credentials: {
        email: { label: "Email", type: "email", placeholder: "user@medeasy.demo" },
        password: { label: "Password", type: "password" },
      },
      async authorize(credentials) {
        if (!credentials?.email || !credentials?.password) {
          return null;
        }

        const email = credentials.email.toLowerCase().trim();

        // 1. Fetch user by email including 1-to-1 profile relations
        const user = await prisma.user.findUnique({
          where: { email },
          include: {
            doctorProfile: true,
            pharmacyProfile: true,
            patientProfile: true,
          },
        });

        // 2. Safely handle missing user or user without password
        if (!user || !user.password) {
          return null;
        }

        // 3. Verify entered password against stored bcrypt hash (never compare in plaintext)
        const isPasswordValid = await bcrypt.compare(credentials.password, user.password);
        if (!isPasswordValid) {
          return null;
        }

        // 4. Resolve user display name based on role / profile
        let displayName = user.email;
        if (user.role === UserRole.PATIENT && user.patientProfile?.name) {
          displayName = user.patientProfile.name;
        } else if (user.role === UserRole.PHARMACY && user.pharmacyProfile?.pharmacyName) {
          displayName = user.pharmacyProfile.pharmacyName;
        } else if (user.role === UserRole.DOCTOR) {
          const emailName = user.email.split("@")[0].replace(/^dr\./i, "").replace(/\./g, " ");
          const capitalized = emailName
            .split(" ")
            .map((s) => s.charAt(0).toUpperCase() + s.slice(1))
            .join(" ");
          displayName = `Dr. ${capitalized}`;
        } else if (user.role === UserRole.ADMIN) {
          displayName = "System Administrator";
        }

        // 5. Return sanitized user object for JWT callback
        return {
          id: user.id,
          email: user.email,
          name: displayName,
          role: user.role,
        };
      },
    }),
  ],
  callbacks: {
    async jwt({ token, user }) {
      // When a user signs in, copy id, role, name, and email into the JWT token
      if (user) {
        token.id = user.id;
        token.role = user.role;
        token.name = user.name;
        token.email = user.email;
      }
      return token;
    },
    async session({ session, token }) {
      // Expose id, role, name, and email in the authenticated session
      if (token && session.user) {
        session.user.id = token.id as string;
        session.user.role = token.role as UserRole;
        session.user.name = token.name as string;
        session.user.email = token.email as string;
      }
      return session;
    },
  },
  pages: {
    signIn: "/login",
  },
};
