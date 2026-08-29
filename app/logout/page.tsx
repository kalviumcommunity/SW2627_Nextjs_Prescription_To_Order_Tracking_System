import Link from 'next/link';

export default function LogoutPage() {
  return (
    <main style={{ minHeight: '100vh', display: 'grid', placeItems: 'center', background: '#f8fafc' }}>
      <div style={{ maxWidth: '520px', background: '#fff', border: '1px solid #e2e8f0', borderRadius: '18px', padding: '32px', textAlign: 'center' }}>
        <h1 style={{ marginTop: 0, color: '#0f172a' }}>Logged out</h1>
        <p style={{ color: '#475569', lineHeight: 1.6 }}>
          Your session ends here. This frontend sign-out view is intentionally non-sensitive and does not grant any backend privileges.
        </p>
        <Link href="/" style={{ display: 'inline-block', marginTop: '12px', background: '#2563eb', color: '#fff', padding: '12px 18px', borderRadius: '10px', textDecoration: 'none', fontWeight: 600 }}>
          Return to home
        </Link>
      </div>
    </main>
  );
}
