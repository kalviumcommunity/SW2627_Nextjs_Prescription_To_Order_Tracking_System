import Link from 'next/link';
import { getAllowedNavItems, getDashboardPath, mockSessionUser } from '@/lib/auth-session';
import { ROLE_LABELS, type UserRole } from '@/types/user-role';

type AppShellProps = {
  role?: UserRole;
  children: React.ReactNode;
  title?: string;
};

const createNavHref = (href: string) => href;

export function AppShell({ role = mockSessionUser.role, children, title = 'MedEasy' }: AppShellProps) {
  const navItems = getAllowedNavItems(role);
  const dashboardPath = getDashboardPath(role);

  return (
    <div style={{ minHeight: '100vh', background: '#f8fafc', color: '#0f172a' }}>
      <aside
        style={{
          width: '260px',
          background: '#0f172a',
          color: '#e2e8f0',
          padding: '24px 16px',
          position: 'fixed',
          inset: 0,
          left: 0,
          display: 'flex',
          flexDirection: 'column',
          gap: '24px',
        }}
      >
        <div>
          <div style={{ fontSize: '12px', letterSpacing: '0.14em', textTransform: 'uppercase', opacity: 0.75 }}>
            MedEasy
          </div>
          <h2 style={{ margin: '8px 0 0', fontSize: '1.35rem' }}>{ROLE_LABELS[role]}</h2>
        </div>

        <nav style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
          {navItems.map((item) => {
            const isCurrent = item.href === dashboardPath || item.href === '/logout';
            const isLogout = item.label === 'Logout';

            return (
              <Link
                key={item.label}
                href={createNavHref(item.href)}
                style={{
                  padding: '10px 12px',
                  borderRadius: '10px',
                  textDecoration: 'none',
                  color: isLogout ? '#fecaca' : isCurrent ? '#0f172a' : '#e2e8f0',
                  background: isCurrent ? '#e2e8f0' : isLogout ? '#7f1d1d' : 'transparent',
                  fontWeight: isCurrent ? 700 : 500,
                  display: 'block',
                }}
              >
                {item.label}
              </Link>
            );
          })}
        </nav>

        <div style={{ marginTop: 'auto', borderTop: '1px solid rgba(148,163,184,0.35)', paddingTop: '16px' }}>
          <div style={{ fontSize: '0.8rem', opacity: 0.82 }}>Signed in as</div>
          <div style={{ fontWeight: 600 }}>{mockSessionUser.email}</div>
        </div>
      </aside>

      <main style={{ marginLeft: '260px', padding: '32px 40px' }}>
        <header style={{ marginBottom: '24px' }}>
          <h1 style={{ margin: 0, fontSize: '2rem' }}>{title}</h1>
        </header>
        {children}
      </main>
    </div>
  );
}
