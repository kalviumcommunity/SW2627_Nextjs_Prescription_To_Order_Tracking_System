import Link from 'next/link';

export default function HomePage() {
  return (
    <main style={{ minHeight: '100vh', display: 'grid', placeItems: 'center', background: '#f8fafc' }}>
      <div style={{ maxWidth: '720px', textAlign: 'center', padding: '32px' }}>
        <p style={{ textTransform: 'uppercase', letterSpacing: '0.18em', color: '#2563eb', fontWeight: 700, marginBottom: '12px' }}>
          MedEasy
        </p>
        <h1 style={{ margin: '0 0 16px', fontSize: '2.5rem', color: '#0f172a' }}>Prescription-to-Order Tracking System</h1>
        <p style={{ color: '#475569', fontSize: '1.05rem', lineHeight: 1.7, marginBottom: '24px' }}>
          Frontend role-aware navigation and access UX are ready for the Day 6 implementation.
        </p>
        <div style={{ display: 'flex', justifyContent: 'center', gap: '12px', flexWrap: 'wrap' }}>
          <Link href="/doctor/dashboard" style={{ background: '#0f172a', color: '#fff', padding: '12px 18px', borderRadius: '10px', textDecoration: 'none', fontWeight: 600 }}>Doctor Dashboard</Link>
          <Link href="/pharmacy/dashboard" style={{ background: '#2563eb', color: '#fff', padding: '12px 18px', borderRadius: '10px', textDecoration: 'none', fontWeight: 600 }}>Pharmacy Dashboard</Link>
          <Link href="/patient/dashboard" style={{ background: '#16a34a', color: '#fff', padding: '12px 18px', borderRadius: '10px', textDecoration: 'none', fontWeight: 600 }}>Patient Dashboard</Link>
          <Link href="/admin/dashboard" style={{ background: '#7c3aed', color: '#fff', padding: '12px 18px', borderRadius: '10px', textDecoration: 'none', fontWeight: 600 }}>Admin Dashboard</Link>
        </div>
      </div>
    </main>
  );
}
