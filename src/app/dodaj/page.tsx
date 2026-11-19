import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { ArrowLeft, PlusCircle } from "lucide-react";
import { LogoutButton } from "@/components/forms/LogoutButton";
import { TrailForm } from "@/components/forms/TrailForm";
import { getSessionFromCookies } from "@/lib/auth/session";
import { isBlobTokenConfigured } from "@/lib/upload/validation";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Dodaj nowy szlak",
  description: "Panel właściciela — dodaj nowy szlak rowerowy do kolekcji.",
  robots: {
    index: false,
    follow: false,
  },
};

export default async function AddTrailPage() {
  const session = await getSessionFromCookies();
  if (!session) {
    redirect("/logowanie?next=/dodaj");
  }

  return (
    <main className="mx-auto w-full max-w-5xl px-4 py-6 sm:px-6 sm:py-8 lg:px-8">
      <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
        <Link
          href="/"
          className="inline-flex min-h-[44px] items-center gap-2 rounded-xl px-2.5 text-sm font-semibold text-[var(--text-secondary)] transition-colors hover:bg-[var(--bg-surface-muted)] hover:text-[var(--text-primary)]"
        >
          <ArrowLeft className="h-4 w-4 text-[var(--accent-primary)]" aria-hidden="true" />
          <span>Wróć do katalogu tras</span>
        </Link>

        <LogoutButton />
      </div>

      <header className="mb-6 flex items-start gap-3.5">
        <span className="mt-0.5 flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-[var(--accent-primary)] text-white shadow-sm">
          <PlusCircle className="h-6 w-6" aria-hidden="true" />
        </span>
        <div>
          <p className="font-mono text-xs font-semibold uppercase tracking-[0.18em] text-[var(--accent-primary)]">
            Panel właściciela
          </p>
          <h1 className="font-display text-3xl font-extrabold uppercase leading-tight tracking-wide text-[var(--text-primary)] sm:text-4xl">
            Dodaj nowy szlak rowerowy
          </h1>
          <p className="mt-1 text-sm text-[var(--text-secondary)]">
            Zaimportuj dane z linku lub uzupełnij formularz ręcznie i dołącz ślad GPX.
          </p>
        </div>
      </header>

      <TrailForm mode="create" blobConfigured={isBlobTokenConfigured()} />
    </main>
  );
}
