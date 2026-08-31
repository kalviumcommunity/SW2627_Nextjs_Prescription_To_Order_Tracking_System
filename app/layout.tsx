import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "MedEasy | Prescription-to-Order Tracking",
  description: "Secure access to MedEasy healthcare workflows.",
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
