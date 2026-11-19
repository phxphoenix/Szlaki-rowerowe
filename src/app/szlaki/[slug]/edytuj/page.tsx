import type { Metadata } from "next";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { ArrowLeft, Edit3 } from "lucide-react";
import { LogoutButton } from "@/components/forms/LogoutButton";
import { TrailForm } from "@/components/forms/TrailForm";
import { getSessionFromCookies } from "@/lib/auth/session";
import { getTrailByIdOrSlug } from "@/lib/trails/repository";
import { isBlobTokenConfigured } from "@/lib/upload/validation";

export const dynamic = "force-dynamic";

interface EditTrailPageProps {
  params: Promise<{ slug: string }>;
}

export async function generateMetadata({
  params,
}: EditTrailPageProps): Promise<Metadata> {
  const { slug } = await params;
  return {
    title: `Edytuj szlak — ${slug}`,
    robots: {
      index: false,
      follow: false,
    },
  };
}

export default async function EditTrailPage({ params }: EditTrailPageProps) {
  const { slug } = await params;
  const session = await getSessionFromCookies();

  if (!session) {
    redirect(`/logowanie?next=/szlaki/${encodeURIComponent(slug)}/edytuj`);
  }

  const trail = await getTrailByIdOrSlug(slug, { includeUnpublished: true });
  if (!trail) {
    notFound();
  }

  return (
    <main className="mx-auto w-full max-w-5xl px-4 py-6 sm:px-6 sm:py-8 lg:px-8">
      <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
        <Link
          href={`/szlaki/${trail.slug}`}
          className="inline-flex min-h-[44px] items-center gap-2 rounded-xl px-2.5 text-sm font-semibold text-[var(--text-secondary)] transition-colors hover:bg-[var(--bg-surface-muted)] hover:text-[var(--text-primary)]"
        >
          <ArrowLeft className="h-4 w-4 text-[var(--accent-primary)]" aria-hidden="true" />
          <span>Wróć do widoku szlaku</span>
        </Link>

        <LogoutButton />
      </div>

      <header className="mb-6 flex items-start gap-3.5">
        <span className="mt-0.5 flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-[var(--bg-carbon)] text-[#FF5E33] shadow-sm">
          <Edit3 className="h-6 w-6" aria-hidden="true" />
        </span>
        <div className="min-w-0">
          <p className="font-mono text-xs font-semibold uppercase tracking-[0.18em] text-[var(--accent-primary)]">
            Edycja szlaku
          </p>
          <h1 className="font-display text-3xl font-extrabold uppercase leading-tight tracking-wide text-[var(--text-primary)] sm:text-4xl">
            {trail.title}
          </h1>
          <p className="mt-1 text-sm text-[var(--text-secondary)]">
            Zaktualizuj opis, parametry trasy, ślad GPX, galerię zdjęć lub punkty POI.
          </p>
        </div>
      </header>

      <TrailForm
        mode="edit"
        initialTrail={trail}
        blobConfigured={isBlobTokenConfigured()}
      />
    </main>
  );
}
