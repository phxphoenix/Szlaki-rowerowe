import Link from "next/link";
import { Bike, Compass, Plus } from "lucide-react";
import { ThemeToggle } from "@/components/layout/ThemeToggle";

export function Navbar() {
  return (
    <header className="sticky top-0 z-40 border-b border-white/10 bg-[var(--bg-carbon)]/95 text-[var(--text-on-dark)] backdrop-blur-md safe-top">
      <div className="h-0.5 w-full bg-gradient-to-r from-[#FF4D1C] via-[#FF7A45] to-transparent" />
      <div className="mx-auto flex h-16 max-w-7xl items-center justify-between gap-2 px-4 sm:px-6 lg:px-8">
        <Link
          href="/"
          className="group flex min-h-[44px] min-w-0 items-center gap-2.5 rounded-xl py-1 pr-1"
          aria-label="Szlaki Rowerowe — Strona główna"
        >
          <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-[#FF4D1C] text-white shadow-sm transition-transform duration-200 group-hover:scale-105">
            <Bike className="h-5 w-5" aria-hidden="true" />
          </span>
          <span className="flex min-w-0 flex-col">
            <span className="truncate font-display text-xl font-extrabold uppercase tracking-wider text-white sm:text-2xl leading-none">
              Szlaki Rowerowe
            </span>
            <span className="hidden font-mono text-[10px] font-semibold uppercase tracking-[0.22em] text-[#FF5E33] sm:block mt-0.5">
              Velo Pulse · Polska
            </span>
          </span>
        </Link>

        <nav
          aria-label="Nawigacja główna"
          className="flex shrink-0 items-center gap-2 sm:gap-3"
        >
          <Link
            href="/"
            className="hidden min-h-[44px] items-center gap-1.5 rounded-xl px-3 text-sm font-semibold text-white/80 transition-colors hover:bg-white/10 hover:text-white md:inline-flex"
          >
            <Compass className="h-4 w-4 text-[#FF4D1C]" aria-hidden="true" />
            Katalog tras
          </Link>

          <ThemeToggle />

          <Link
            href="/dodaj"
            className="inline-flex min-h-[44px] shrink-0 items-center justify-center gap-1.5 rounded-xl bg-[#FF4D1C] px-3 text-sm font-bold text-white shadow-sm transition-all hover:bg-[#E03E12] active:scale-[0.98] sm:px-4"
          >
            <Plus className="h-4 w-4 shrink-0" aria-hidden="true" />
            <span className="whitespace-nowrap">Dodaj szlak</span>
          </Link>
        </nav>
      </div>
    </header>
  );
}
