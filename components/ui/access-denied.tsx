import Link from 'next/link';

export function AccessDenied({
  roleLabel,
  dashboardHref,
  attemptedPath,
}: {
  roleLabel: string;
  dashboardHref: string;
  attemptedPath: string;
}) {
  return (
    <div
      style={{
        maxWidth: '720px',
        background: '#fff',
        border: '1px solid #e2e8f0',
        borderRadius: '18px',
        padding: '32px',
        boxShadow: '0 16px 48px rgba(15, 23, 42, 0.08)',
      }}
    >
      <div style={{ fontSize: '0.83rem', letterSpacing: '0.14em', textTransform: 'uppercase', color: '#ef4444', fontWeight: 700 }}>
        Access denied
      </div>
      <h2 style={{ margin: '12px 0 8px', fontSize: '2rem', color: '#0f172a' }}>You do not have access to this area.</h2>
      <p style={{ color: '#475569', fontSize: '1rem', lineHeight: 1.6, margin: '0 0 20px' }}>
        The page <strong>{attemptedPath}</strong> is not available for the {roleLabel.toLowerCase()} role.
      </p>
      <p style={{ color: '#475569', fontSize: '1rem', lineHeight: 1.6, margin: '0 0 24px' }}>
        This is a frontend UX guard only. The actual security check still happens on the server.
      </p>
      <Link
        href={dashboardHref}
        style={{
          display: 'inline-flex',
          alignItems: 'center',
          justifyContent: 'center',
          background: '#2563eb',
          color: '#fff',
          borderRadius: '10px',
          padding: '12px 18px',
          textDecoration: 'none',
          fontWeight: 600,
        }}
      >
        Go to my dashboard
      </Link>
    </div>
  );
}
