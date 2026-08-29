import Link from "next/link";
import type { ReactNode } from "react";

export function AuthShell({ children, eyebrow, title, description }: { children: ReactNode; eyebrow: string; title: string; description: string }) {
  return (
    <main className="min-h-screen lg:grid lg:grid-cols-[minmax(280px,0.8fr)_minmax(480px,1.2fr)]">
      <aside className="auth-pattern relative overflow-hidden px-8 py-10 text-white lg:flex lg:min-h-screen lg:flex-col lg:justify-between lg:px-14 lg:py-14">
        <div className="relative z-10">
          <Link href="/login" className="inline-flex items-center gap-3 text-xl font-bold tracking-tight">
            <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-white text-lg text-ocean">+</span>
            MedEasy
          </Link>
          <div className="mt-20 max-w-md lg:mt-32">
            <p className="mb-4 text-sm font-bold uppercase tracking-[0.24em] text-white/70">Care, coordinated</p>
            <h1 className="font-display text-5xl leading-[1.05] tracking-tight sm:text-6xl">Healthcare that keeps moving.</h1>
            <p className="mt-6 max-w-sm text-base leading-7 text-white/80">One secure place for prescriptions, people, and the orders that connect them.</p>
          </div>
        </div>
        <p className="relative z-10 mt-14 text-sm text-white/60">MedEasy · Prescription-to-order tracking</p>
      </aside>
      <section className="flex min-h-[calc(100vh-270px)] items-center justify-center px-5 py-12 sm:px-10 lg:min-h-screen lg:px-16">
        <div className="w-full max-w-xl">
          <p className="text-sm font-bold uppercase tracking-[0.2em] text-coral">{eyebrow}</p>
          <h2 className="mt-3 font-display text-4xl leading-tight text-ink">{title}</h2>
          <p className="mt-3 max-w-lg leading-7 text-slate-600">{description}</p>
          <div className="mt-8">{children}</div>
        </div>
      </section>
    </main>
  );
}
