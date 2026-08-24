import React from 'react';

export const metadata = {
  title: 'MedEasy',
  description: 'Role-based prescription-to-order tracking system',
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
