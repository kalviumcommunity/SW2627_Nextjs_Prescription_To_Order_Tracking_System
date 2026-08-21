import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "MedEasy | Prescription-to-Order Tracking System",
  description: "Seamless prescription lifecycle management and tracking system built with Next.js App Router.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
