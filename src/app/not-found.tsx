import Link from "next/link";
import { ArrowLeft, Compass, MapPinOff } from "lucide-react";

export default function NotFound() {
  return (
    <main className="mx-auto flex min-h-[calc(100dvh-16rem)] w-full max-w-4xl items-center justify-center px-4 py-12 sm:px-6 lg:px-8">
      <section className="relative w-full overflow-hidden rounded-3xl border border-white/10 bg-[var(--bg-carbon)] px-6 py-12 text-center text-[var(--text-on-dark)] shadow-xl sm:px-12 sm:py-16">
        {/* Subtle topographic lines */}
        <svg
          aria-hidden="true"
          viewBox="0 0 800 320"
          fill="none"
          preserveAspectRatio="xMidYMid slice"
          className="pointer-events-none absolute inset-0 h-full w-full opacity-20"
        >
          <path
            d="M-40 260C110 200 240 245 390 175C530 110 660 155 840 85"
            stroke="#FF4D1C"
            strokeWidth="1.5"
          />
          <path
            d="M-40 295C130 235 280 275 430 210C580 145 700 185 840 125"
            stroke="#475569"
            strokeWidth="1.2"
          />
          <circle cx="650" cy="110" r="120" stroke="#FF4D1C" strokeOpacity="0.25" />
        </svg>

        <div className="relative mx-auto flex max-w-lg flex-col items-center">
          <span className="inline-flex h-16 w-16 items-center justify-center rounded-2xl bg-[#FF4D1C]/15 text-[#FF5E33] ring-1 ring-[#FF4D1C]/40">
            <MapPinOff className="h-8 w-8" aria-hidden="true" />
          </span>

          <p className="mt-6 font-mono text-xs font-semibold uppercase tracking-[0.22em] text-[#FF5E33]">
            Błąd 404 · Poza wyznaczonym śladem
          </p>

          <h1 className="mt-2 font-display text-5xl font-extrabold uppercase tracking-tight text-white sm:text-6xl">
            Nie znaleziono szlaku
          </h1>

          <p className="mt-4 text-sm leading-relaxed text-white/75 sm:text-base">
            Trasa, której szukasz, mogła zmienić adres, zostać usunięta lub
            jeszcze nie pojawiła się w naszym katalogu. Wróć na główną mapę
            kolekcji i wybierz inne województwo.
          </p>

          <div className="mt-8 flex flex-wrap items-center justify-center gap-3">
            <Link
              href="/"
              className="inline-flex min-h-[44px] items-center justify-center gap-2 rounded-xl bg-[#FF4D1C] px-6 py-3 text-sm font-bold text-white shadow-sm transition-all hover:bg-[#E03E12] active:scale-[0.98]"
            >
              <ArrowLeft className="h-4 w-4" aria-hidden="true" />
              Wróć do katalogu tras
            </Link>

            <Link
              href="/?region=slaskie"
              className="inline-flex min-h-[44px] items-center justify-center gap-2 rounded-xl border border-white/15 bg-white/5 px-5 py-3 text-sm font-semibold text-white/90 transition-colors hover:bg-white/10"
            >
              <Compass className="h-4 w-4 text-[#FF5E33]" aria-hidden="true" />
              Odkryj szlaki w Śląskiem
            </Link>
          </div>
        </div>
      </section>
    </main>
  );
}
