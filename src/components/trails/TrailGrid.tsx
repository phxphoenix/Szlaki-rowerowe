import Link from "next/link";
import { ChevronLeft, ChevronRight, Compass, RotateCcw } from "lucide-react";
import { TrailCard } from "@/components/trails/TrailCard";
import { buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/utils/cn";
import type { TrailSummary } from "@/types/trail";

export interface TrailGridProps {
  items: TrailSummary[];
  page: number;
  totalPages: number;
  currentQuery?: Record<string, string | undefined>;
}

function buildPageHref(
  targetPage: number,
  currentQuery?: Record<string, string | undefined>,
): string {
  const params = new URLSearchParams();
  if (currentQuery) {
    for (const [key, value] of Object.entries(currentQuery)) {
      if (value && key !== "page") {
        params.set(key, value);
      }
    }
  }
  if (targetPage > 1) {
    params.set("page", String(targetPage));
  }
  const qs = params.toString();
  return qs ? `/?${qs}` : "/";
}

export function TrailGrid({
  items,
  page,
  totalPages,
  currentQuery,
}: TrailGridProps) {
  if (items.length === 0) {
    return (
      <div className="mx-auto flex max-w-lg flex-col items-center justify-center rounded-2xl border border-dashed border-[var(--border-subtle)] bg-[var(--bg-surface)] px-6 py-14 text-center shadow-xs">
        <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-[var(--bg-surface-muted)] text-[var(--accent-primary)]">
          <Compass className="h-7 w-7" aria-hidden="true" />
        </div>
        <h2 className="mt-4 font-display text-2xl font-bold uppercase tracking-wide text-[var(--text-primary)]">
          Brak pasujących szlaków
        </h2>
        <p className="mt-2 text-sm leading-relaxed text-[var(--text-secondary)]">
          Nie znaleziono tras spełniających wybrane kryteria wyszukiwania lub
          filtrowania. Zresetuj filtry, aby zobaczyć całą kolekcję polskich
          szlaków rowerowych.
        </p>
        <Link
          href="/"
          className={cn(buttonVariants({ variant: "default", size: "default" }), "mt-6")}
        >
          <RotateCcw className="h-4 w-4" aria-hidden="true" />
          Wyczyść filtry
        </Link>
      </div>
    );
  }

  return (
    <div>
      <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3">
        {items.map((trail, index) => (
          <TrailCard key={trail.id} trail={trail} priority={index < 3} />
        ))}
      </div>

      {totalPages > 1 && (
        <nav
          aria-label="Paginacja katalogu szlaków"
          className="mt-10 flex items-center justify-center gap-2"
        >
          {page > 1 ? (
            <Link
              href={buildPageHref(page - 1, currentQuery)}
              className={buttonVariants({ variant: "outline", size: "default" })}
            >
              <ChevronLeft className="h-4 w-4" aria-hidden="true" />
              Poprzednia
            </Link>
          ) : (
            <span
              aria-disabled="true"
              className={cn(
                buttonVariants({ variant: "outline", size: "default" }),
                "pointer-events-none opacity-40",
              )}
            >
              <ChevronLeft className="h-4 w-4" aria-hidden="true" />
              Poprzednia
            </span>
          )}

          <div className="flex items-center gap-1.5">
            {Array.from({ length: totalPages }, (_, i) => i + 1).map(
              (pageNum) => {
                const isCurrent = pageNum === page;
                return (
                  <Link
                    key={pageNum}
                    href={buildPageHref(pageNum, currentQuery)}
                    aria-current={isCurrent ? "page" : undefined}
                    className={cn(
                      "inline-flex h-11 min-w-[44px] items-center justify-center rounded-xl border px-3 font-mono text-sm font-semibold tabular-nums transition-colors",
                      isCurrent
                        ? "border-transparent bg-[var(--accent-primary)] text-white shadow-sm"
                        : "border-[var(--border-subtle)] bg-[var(--bg-surface)] text-[var(--text-primary)] hover:bg-[var(--bg-surface-muted)]",
                    )}
                  >
                    {pageNum}
                  </Link>
                );
              },
            )}
          </div>

          {page < totalPages ? (
            <Link
              href={buildPageHref(page + 1, currentQuery)}
              className={buttonVariants({ variant: "outline", size: "default" })}
            >
              Następna
              <ChevronRight className="h-4 w-4" aria-hidden="true" />
            </Link>
          ) : (
            <span
              aria-disabled="true"
              className={cn(
                buttonVariants({ variant: "outline", size: "default" }),
                "pointer-events-none opacity-40",
              )}
            >
              Następna
              <ChevronRight className="h-4 w-4" aria-hidden="true" />
            </span>
          )}
        </nav>
      )}
    </div>
  );
}
