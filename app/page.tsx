export default function Home() {
  const userRoles = [
    {
      title: "Doctor",
      icon: "🩺",
      description: "Issue digital prescriptions, review patient histories, and manage active treatment plans.",
      status: "Sprint 2 Initial Target",
    },
    {
      title: "Pharmacy",
      icon: "💊",
      description: "Fulfill incoming prescription orders, track inventory, and verify patient dispensations.",
      status: "Sprint 3 Target",
    },
    {
      title: "Patient",
      icon: "👤",
      description: "Track prescription status live, place refill orders, and view order fulfillment timeline.",
      status: "Sprint 3 Target",
    },
    {
      title: "Admin",
      icon: "🛡️",
      description: "Manage system access, audit security compliance, and oversee platform performance.",
      status: "Sprint 4 Target",
    },
  ];

  return (
    <div className="main-container">
      <div className="bg-decor-top" />

      {/* Header */}
      <header className="header-nav">
        <a href="#" className="brand-logo">
          <div className="brand-icon">+</div>
          <span>MedEasy</span>
        </a>
        <div className="status-pill">
          <span className="status-pulse" />
          <span>App Router System Active</span>
        </div>
      </header>

      {/* Hero Section */}
      <main style={{ display: "flex", flexDirection: "column", gap: "2rem" }}>
        <section className="hero-card">
          <span className="hero-badge">Day 1 • Project Foundation</span>
          <h1 className="hero-title">
            Prescription-to-Order Tracking System
          </h1>
          <p className="hero-subtitle">
            Welcome to MedEasy. The core Next.js application foundation is successfully configured and running with TypeScript and App Router.
          </p>
        </section>

        {/* System Roles Architecture Overview */}
        <section>
          <h2 className="section-title">
            <span>System User Roles</span>
          </h2>
          <div className="roles-grid">
            {userRoles.map((role) => (
              <div className="role-card" key={role.title}>
                <span className="role-icon">{role.icon}</span>
                <h3 className="role-name">{role.title} Role</h3>
                <p className="role-desc">{role.description}</p>
                <span className="role-tag">{role.status}</span>
              </div>
            ))}
          </div>
        </section>

        {/* Technical Specs Card */}
        <section className="specs-card">
          <h2 className="section-title">Foundation Status</h2>
          <div className="specs-grid">
            <div className="spec-item">
              <span className="spec-label">Framework</span>
              <span className="spec-value">Next.js App Router</span>
            </div>
            <div className="spec-item">
              <span className="spec-label">Language</span>
              <span className="spec-value">TypeScript (Strict)</span>
            </div>
            <div className="spec-item">
              <span className="spec-label">Linter</span>
              <span className="spec-value">ESLint Configured</span>
            </div>
            <div className="spec-item">
              <span className="spec-label">Styling</span>
              <span className="spec-value">Vanilla CSS System</span>
            </div>
          </div>
        </section>
      </main>

      {/* Footer */}
      <footer className="footer">
        <p>MedEasy Prescription-to-Order Tracking System &copy; 2026 • University Full-Stack Project</p>
      </footer>
    </div>
  );
}
