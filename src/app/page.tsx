import { Suspense } from "react";
import { Compass, MapPin, Mountain, Route } from "lucide-react";
import { FilterBar } from "@/components/trails/FilterBar";
import { TrailGrid } from "@/components/trails/TrailGrid";
import { REGIONS, getRegionInfo } from "@/lib/constants/regions";
import { getCollectionStats, listTrails } from "@/lib/trails/repository";
import { formatDistance } from "@/lib/utils/format";
import { trailQuerySchema } from "@/lib/validation/trail";

export const dynamic = "force-dynamic";

type RawSearchParams = Record<string, string | string[] | undefined>;

function getSingleParam(
  params: RawSearchParams,
  key: string,
): string | undefined {
  const value = params[key];
  if (Array.isArray(value)) {
    return value[0];
  }
  return value;
}

export default async function HomePage({
  searchParams,
}: {
  searchParams: Promise<RawSearchParams>;
}) {
  const rawParams = await searchParams;

  const queryInput = {
    region: getSingleParam(rawParams, "region"),
    difficulty: getSingleParam(rawParams, "difficulty"),
    surface: getSingleParam(rawParams, "surface"),
    minDistance: getSingleParam(rawParams, "minDistance"),
    maxDistance: getSingleParam(rawParams, "maxDistance"),
    q: getSingleParam(rawParams, "q"),
    sort: getSingleParam(rawParams, "sort"),
    page: getSingleParam(rawParams, "page"),
  };

  const parsedQuery = trailQuerySchema.parse(queryInput);

  const [trailsData, stats] = await Promise.all([
    listTrails(parsedQuery),
    getCollectionStats(),
  ]);

  const activeRegionInfo =
    parsedQuery.region !== "all" ? getRegionInfo(parsedQuery.region) : null;

  const currentQuery: Record<string, string | undefined> = {
    region: parsedQuery.region !== "all" ? parsedQuery.region : undefined,
    difficulty: parsedQuery.difficulty,
    surface: parsedQuery.surface,
    minDistance:
      parsedQuery.minDistance !== undefined
        ? String(parsedQuery.minDistance)
        : undefined,
    maxDistance:
      parsedQuery.maxDistance !== undefined
        ? String(parsedQuery.maxDistance)
        : undefined,
    q: parsedQuery.q,
    sort: parsedQuery.sort !== "newest" ? parsedQuery.sort : undefined,
  };

  return (
    <div className="flex flex-col">
      {/* Compact Sporty Hero — Velo Pulse Deep Carbon */}
      <section className="relative overflow-hidden bg-[var(--bg-carbon)] text-[var(--text-on-dark)]">
        {/* Subtle topographic contour SVG pattern */}
        <svg
          aria-hidden="true"
          viewBox="0 0 1200 340"
          fill="none"
          preserveAspectRatio="xMidYMid slice"
          className="pointer-events-none absolute inset-0 h-full w-full opacity-25"
        >
          <path
            d="M-60 280C120 210 260 250 420 190C580 130 740 165 920 105C1060 60 1160 85 1260 45"
            stroke="#FF4D1C"
            strokeWidth="1.5"
            strokeOpacity="0.65"
          />
          <path
            d="M-60 320C140 255 290 285 460 225C630 165 780 200 960 140C1090 95 1180 120 1260 85"
            stroke="#334155"
            strokeWidth="1.25"
          />
          <path
            d="M-60 210C100 155 240 185 390 125C540 65 710 105 890 45C1020 5 1130 35 1260 -10"
            stroke="#334155"
            strokeWidth="1"
          />
          <circle cx="960" cy="140" r="140" stroke="#FF4D1C" strokeOpacity="0.18" strokeWidth="1" />
          <circle cx="960" cy="140" r="220" stroke="#334155" strokeOpacity="0.4" strokeWidth="1" />
        </svg>

        <div
          aria-hidden="true"
          className="pointer-events-none absolute -top-24 right-0 h-72 w-72 rounded-full bg-[#FF4D1C]/15 blur-3xl"
        />

        <div className="relative mx-auto max-w-7xl px-4 py-7 sm:px-6 sm:py-9 lg:px-8">
          <div className="flex flex-col gap-6 lg:flex-row lg:items-end lg:justify-between">
            <div className="max-w-2xl">
              <div className="inline-flex items-center gap-2 rounded-full border border-white/15 bg-white/5 px-3 py-1 text-xs font-semibold uppercase tracking-[0.16em] text-[#FF5E33]">
                <Compass className="h-3.5 w-3.5" aria-hidden="true" />
                <span>Polska Kolekcja Tras · Velo Pulse</span>
              </div>

              <h1 className="mt-3 font-display text-[clamp(2.15rem,4.6vw,3.6rem)] font-extrabold uppercase leading-[0.96] tracking-tight text-white">
                Szlaki rowerowe{" "}
                <span className="text-[#FF4D1C]">w całej Polsce</span>
              </h1>

              <p className="mt-2.5 max-w-xl text-sm leading-relaxed text-white/75 sm:text-base">
                Odkrywaj wyselekcjonowane trasy z podziałem na 16 województw — z
                mapą Google Maps, profilem wysokościowym, śladem GPX i
                szczegółową telemetrią.
              </p>
            </div>

            {/* Collection Telemetry Stats */}
            <dl className="grid grid-cols-3 gap-2.5 sm:gap-3 lg:w-[440px] lg:shrink-0">
              <div className="rounded-2xl border border-white/10 bg-[var(--bg-carbon-elevated)]/90 px-3.5 py-3 backdrop-blur-sm">
                <dt className="flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-wider text-white/60">
                  <Route
                    className="h-3.5 w-3.5 text-[#FF4D1C]"
                    aria-hidden="true"
                  />
                  <span>Szlaki</span>
                </dt>
                <dd className="mt-1 font-mono text-xl font-bold text-white tabular-nums sm:text-2xl">
                  {stats.totalTrails}
                </dd>
              </div>

              <div className="rounded-2xl border border-white/10 bg-[var(--bg-carbon-elevated)]/90 px-3.5 py-3 backdrop-blur-sm">
                <dt className="flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-wider text-white/60">
                  <Mountain
                    className="h-3.5 w-3.5 text-[#38BDF8]"
                    aria-hidden="true"
                  />
                  <span>Dystans</span>
                </dt>
                <dd className="mt-1 font-mono text-xl font-bold text-white tabular-nums sm:text-2xl">
                  {formatDistance(stats.totalDistanceKm)}
                </dd>
              </div>

              <div className="rounded-2xl border border-white/10 bg-[var(--bg-carbon-elevated)]/90 px-3.5 py-3 backdrop-blur-sm">
                <dt className="flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-wider text-white/60">
                  <MapPin
                    className="h-3.5 w-3.5 text-[#22C55E]"
                    aria-hidden="true"
                  />
                  <span>Regiony</span>
                </dt>
                <dd className="mt-1 font-mono text-xl font-bold text-white tabular-nums sm:text-2xl">
                  {stats.activeRegionsCount}
                  <span className="text-sm font-medium text-white/45">
                    /{REGIONS.length}
                  </span>
                </dd>
              </div>
            </dl>
          </div>
        </div>
      </section>

      {/* Sticky Filter Bar + 16 Voivodeships */}
      <Suspense
        fallback={
          <div className="h-32 border-b border-[var(--border-subtle)] bg-[var(--bg-surface)]" />
        }
      >
        <FilterBar
          regionCounts={trailsData.regionCounts}
          totalResults={trailsData.total}
        />
      </Suspense>

      {/* Catalog Grid */}
      <main
        id="katalog"
        className="mx-auto w-full max-w-7xl px-4 pt-6 sm:px-6 sm:pt-8 lg:px-8"
      >
        {activeRegionInfo && (
          <div className="mb-6 flex flex-wrap items-baseline justify-between gap-2">
            <div>
              <p className="font-mono text-xs font-semibold uppercase tracking-[0.18em] text-[var(--accent-primary)]">
                Wybrany region
              </p>
              <h2 className="font-display text-2xl font-bold uppercase tracking-wide text-[var(--text-primary)] sm:text-3xl">
                {activeRegionInfo.fullName}
              </h2>
            </div>
          </div>
        )}

        <TrailGrid
          items={trailsData.items}
          page={trailsData.page}
          totalPages={trailsData.totalPages}
          currentQuery={currentQuery}
        />
      </main>
    </div>
  );
}
