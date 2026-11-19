import Link from "next/link";
import { Bike, Compass, MapPin, PlusCircle } from "lucide-react";

const FEATURED_REGIONS = [
  { slug: "slaskie", label: "Śląskie" },
  { slug: "malopolskie", label: "Małopolskie" },
  { slug: "dolnoslaskie", label: "Dolnośląskie" },
  { slug: "podlaskie", label: "Podlaskie" },
  { slug: "pomorskie", label: "Pomorskie" },
  { slug: "zachodniopomorskie", label: "Zachodniopomorskie" },
] as const;

export function Footer() {
  const year = new Date().getFullYear();

  return (
    <footer className="mt-16 border-t border-white/10 bg-[var(--bg-carbon)] text-[var(--text-on-dark)] safe-bottom">
      <div className="mx-auto max-w-7xl px-4 py-10 sm:px-6 lg:px-8">
        <div className="grid grid-cols-1 gap-8 md:grid-cols-12">
          <div className="md:col-span-5">
            <Link
              href="/"
              className="inline-flex items-center gap-2.5 text-white"
            >
              <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-[#FF4D1C] text-white">
                <Bike className="h-5 w-5" aria-hidden="true" />
              </span>
              <span className="font-display text-2xl font-extrabold uppercase tracking-wider">
                Szlaki Rowerowe
              </span>
            </Link>
            <p className="mt-3 max-w-md text-sm leading-relaxed text-white/70">
              Prywatna, sportowa kolekcja sprawdzonych szlaków rowerowych w
              całej Polsce — z mapami Google Maps, plikami GPX, profilami
              wysokościowymi i opisami terenowymi.
            </p>
          </div>

          <div className="md:col-span-4">
            <h2 className="font-display text-sm font-bold uppercase tracking-[0.18em] text-[#FF5E33]">
              Popularne województwa
            </h2>
            <ul className="mt-3 grid grid-cols-2 gap-2">
              {FEATURED_REGIONS.map((region) => (
                <li key={region.slug}>
                  <Link
                    href={`/?region=${region.slug}`}
                    className="inline-flex min-h-[44px] sm:min-h-[36px] items-center gap-1.5 text-sm text-white/75 transition-colors hover:text-white"
                  >
                    <MapPin
                      className="h-3.5 w-3.5 text-[#FF4D1C]"
                      aria-hidden="true"
                    />
                    {region.label}
                  </Link>
                </li>
              ))}
            </ul>
          </div>

          <div className="md:col-span-3">
            <h2 className="font-display text-sm font-bold uppercase tracking-[0.18em] text-[#FF5E33]">
              Nawigacja
            </h2>
            <ul className="mt-3 flex flex-col gap-2">
              <li>
                <Link
                  href="/"
                  className="inline-flex min-h-[44px] sm:min-h-[36px] items-center gap-2 text-sm text-white/75 transition-colors hover:text-white"
                >
                  <Compass
                    className="h-4 w-4 text-[#FF4D1C]"
                    aria-hidden="true"
                  />
                  Wszystkie szlaki w Polsce
                </Link>
              </li>
              <li>
                <Link
                  href="/dodaj"
                  className="inline-flex min-h-[44px] sm:min-h-[36px] items-center gap-2 text-sm text-white/75 transition-colors hover:text-white"
                >
                  <PlusCircle
                    className="h-4 w-4 text-[#FF4D1C]"
                    aria-hidden="true"
                  />
                  Dodaj nowy szlak
                </Link>
              </li>
            </ul>
          </div>
        </div>

        <div className="mt-8 flex flex-col items-start justify-between gap-3 border-t border-white/10 pt-6 text-xs text-white/55 sm:flex-row sm:items-center">
          <p className="font-mono tabular-nums">
            © {year} Szlaki Rowerowe · Velo Pulse — Alpine Telemetry
          </p>
          <p>16 województw Polski · GPX &amp; Google Maps</p>
        </div>
      </div>
    </footer>
  );
}
