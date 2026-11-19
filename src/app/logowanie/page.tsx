import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { ArrowLeft, Bike, LockKeyhole } from "lucide-react";
import { LoginForm } from "@/components/forms/LoginForm";
import { sanitizeNextPath } from "@/lib/auth/redirect";
import { getSessionFromCookies, isAuthConfigured } from "@/lib/auth/session";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Logowanie właściciela",
  description: "Zaloguj się, aby dodawać i edytować szlaki rowerowe w kolekcji.",
  robots: {
    index: false,
    follow: false,
  },
};

interface LoginPageProps {
  searchParams: Promise<{ next?: string | string[] }>;
}

export default async function LoginPage({ searchParams }: LoginPageProps) {
  const resolvedSearchParams = await searchParams;
  const safeNext = sanitizeNextPath(resolvedSearchParams.next, "/dodaj");
  const session = await getSessionFromCookies();

  if (session) {
    redirect(safeNext);
  }

  const authConfigured = isAuthConfigured();

  return (
    <main className="mx-auto flex w-full max-w-7xl flex-1 flex-col justify-center px-4 py-10 sm:px-6 sm:py-16 lg:px-8">
      <div className="mx-auto w-full max-w-md space-y-6">
        <Link
          href="/"
          className="inline-flex min-h-[44px] items-center gap-2 rounded-xl px-2 text-sm font-semibold text-[var(--text-secondary)] transition-colors hover:bg-[var(--bg-surface-muted)] hover:text-[var(--text-primary)]"
        >
          <ArrowLeft className="h-4 w-4 text-[var(--accent-primary)]" aria-hidden="true" />
          <span>Wróć do katalogu tras</span>
        </Link>

        <section className="overflow-hidden rounded-3xl border border-[var(--border-subtle)] bg-[var(--bg-surface)] shadow-lg">
          {/* Sporty Carbon Header */}
          <div className="relative bg-[var(--bg-carbon)] px-6 py-7 text-[var(--text-on-dark)] sm:px-8">
            <div
              aria-hidden="true"
              className="pointer-events-none absolute inset-x-0 top-0 h-1 bg-gradient-to-r from-[#FF4D1C] via-[#FF7A45] to-transparent"
            />
            <div className="flex items-center gap-3">
              <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-[#FF4D1C]/20 text-[#FF5E33] ring-1 ring-[#FF4D1C]/40">
                <LockKeyhole className="h-5 w-5" aria-hidden="true" />
              </span>
              <div>
                <p className="font-mono text-[11px] font-semibold uppercase tracking-[0.2em] text-[#FF7A59]">
                  Panel właściciela
                </p>
                <h1 className="font-display text-3xl font-extrabold uppercase leading-none tracking-wide text-white">
                  Logowanie
                </h1>
              </div>
            </div>
            <p className="mt-3 text-sm leading-relaxed text-white/75">
              Zaloguj się hasłem administratora, aby dodawać nowe trasy, importować dane ze stron i wgrywać ślady GPX.
            </p>
          </div>

          <div className="p-6 sm:p-8">
            <LoginForm nextPath={safeNext} authConfigured={authConfigured} />
          </div>

          <div className="flex items-center justify-between border-t border-[var(--border-subtle)] bg-[var(--bg-canvas)]/70 px-6 py-3.5 text-xs text-[var(--text-secondary)] sm:px-8">
            <span className="inline-flex items-center gap-1.5 font-mono uppercase tracking-wider">
              <Bike className="h-3.5 w-3.5 text-[var(--accent-primary)]" aria-hidden="true" />
              Velo Pulse Admin
            </span>
            <span>Cel: {safeNext}</span>
          </div>
        </section>
      </div>
    </main>
  );
}
