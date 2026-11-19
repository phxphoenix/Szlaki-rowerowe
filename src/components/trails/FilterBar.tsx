"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { RotateCcw, Search, SlidersHorizontal, X } from "lucide-react";
import { RegionPills } from "@/components/trails/RegionPills";
import { SortSelect } from "@/components/trails/SortSelect";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import {
  DIFFICULTIES,
  DIFFICULTY_LABELS,
  SORT_OPTIONS,
  SURFACES,
  SURFACE_LABELS,
  isValidRegionSlug,
  type Difficulty,
  type RegionSlug,
  type SortOption,
  type Surface,
} from "@/lib/constants/regions";
import { cn } from "@/lib/utils/cn";

export interface FilterBarProps {
  regionCounts: Record<RegionSlug, number>;
  totalResults: number;
}

type DistanceBucket = "" | "under_25" | "25_50" | "50_100" | "over_100";

const DISTANCE_OPTIONS: ReadonlyArray<{
  value: DistanceBucket;
  label: string;
  min: string | null;
  max: string | null;
}> = [
  { value: "", label: "Dowolny dystans", min: null, max: null },
  { value: "under_25", label: "< 25 km", min: null, max: "25" },
  { value: "25_50", label: "25–50 km", min: "25", max: "50" },
  { value: "50_100", label: "50–100 km", min: "50", max: "100" },
  { value: "over_100", label: "> 100 km", min: "100", max: null },
];

function getDistanceBucket(
  minDistance: string | null,
  maxDistance: string | null,
): DistanceBucket {
  if (!minDistance && maxDistance === "25") return "under_25";
  if (minDistance === "25" && maxDistance === "50") return "25_50";
  if (minDistance === "50" && maxDistance === "100") return "50_100";
  if (minDistance === "100" && !maxDistance) return "over_100";
  return "";
}

function formatTrailsCountPl(count: number): string {
  if (count === 1) return "1 szlak";
  const mod10 = count % 10;
  const mod100 = count % 100;
  if (mod10 >= 2 && mod10 <= 4 && (mod100 < 12 || mod100 > 14)) {
    return `${count} szlaki`;
  }
  return `${count} szlaków`;
}

export function FilterBar({ regionCounts, totalResults }: FilterBarProps) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  const rawRegion = searchParams.get("region") ?? "all";
  const activeRegion: RegionSlug | "all" = isValidRegionSlug(rawRegion)
    ? rawRegion
    : "all";

  const rawSort = searchParams.get("sort") ?? "newest";
  const activeSort: SortOption = (SORT_OPTIONS as readonly string[]).includes(
    rawSort,
  )
    ? (rawSort as SortOption)
    : "newest";

  const rawDifficulty = searchParams.get("difficulty") ?? "";
  const activeDifficulty: Difficulty | "" = (
    DIFFICULTIES as readonly string[]
  ).includes(rawDifficulty)
    ? (rawDifficulty as Difficulty)
    : "";

  const rawSurface = searchParams.get("surface") ?? "";
  const activeSurface: Surface | "" = (SURFACES as readonly string[]).includes(
    rawSurface,
  )
    ? (rawSurface as Surface)
    : "";

  const activeDistanceBucket = getDistanceBucket(
    searchParams.get("minDistance"),
    searchParams.get("maxDistance"),
  );

  const urlQuery = searchParams.get("q") ?? "";

  const [prevUrlQuery, setPrevUrlQuery] = useState(urlQuery);
  const [searchValue, setSearchValue] = useState(urlQuery);
  const [mobileFiltersOpen, setMobileFiltersOpen] = useState(false);

  if (prevUrlQuery !== urlQuery) {
    setPrevUrlQuery(urlQuery);
    setSearchValue(urlQuery);
  }

  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const pushUpdatedParams = useCallback(
    (updates: Record<string, string | null>) => {
      const next = new URLSearchParams(searchParams.toString());
      next.delete("page");

      for (const [key, value] of Object.entries(updates)) {
        if (
          value === null ||
          value === "" ||
          (key === "region" && value === "all") ||
          (key === "sort" && value === "newest")
        ) {
          next.delete(key);
        } else {
          next.set(key, value);
        }
      }

      const qs = next.toString();
      router.push(qs ? `${pathname}?${qs}` : pathname, { scroll: false });
    },
    [pathname, router, searchParams],
  );

  useEffect(() => {
    return () => {
      if (debounceRef.current) {
        clearTimeout(debounceRef.current);
      }
    };
  }, []);

  const handleSearchChange = (nextValue: string) => {
    setSearchValue(nextValue);
    if (debounceRef.current) {
      clearTimeout(debounceRef.current);
    }
    debounceRef.current = setTimeout(() => {
      const trimmed = nextValue.trim();
      pushUpdatedParams({ q: trimmed.length > 0 ? trimmed : null });
    }, 250);
  };

  const handleSearchSubmit = (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (debounceRef.current) {
      clearTimeout(debounceRef.current);
    }
    const trimmed = searchValue.trim();
    pushUpdatedParams({ q: trimmed.length > 0 ? trimmed : null });
  };

  const handleClearSearch = () => {
    if (debounceRef.current) {
      clearTimeout(debounceRef.current);
    }
    setSearchValue("");
    pushUpdatedParams({ q: null });
  };

  const handleDistanceChange = (bucket: DistanceBucket) => {
    const selected = DISTANCE_OPTIONS.find((opt) => opt.value === bucket);
    pushUpdatedParams({
      minDistance: selected?.min ?? null,
      maxDistance: selected?.max ?? null,
    });
  };

  const handleResetAll = () => {
    if (debounceRef.current) {
      clearTimeout(debounceRef.current);
    }
    setSearchValue("");
    router.push(pathname, { scroll: false });
  };

  const extraFiltersCount =
    (activeDifficulty ? 1 : 0) +
    (activeSurface ? 1 : 0) +
    (activeDistanceBucket ? 1 : 0);

  const hasActiveFilters =
    activeRegion !== "all" ||
    activeDifficulty !== "" ||
    activeSurface !== "" ||
    activeDistanceBucket !== "" ||
    urlQuery.length > 0 ||
    activeSort !== "newest";

  return (
    <section
      aria-label="Filtrowanie i sortowanie szlaków"
      className="sticky top-16 z-30 border-b border-[var(--border-subtle)] bg-[var(--bg-surface)]/95 backdrop-blur-md shadow-xs"
    >
      <div className="mx-auto max-w-7xl px-4 py-3 sm:px-6 lg:px-8">
        {/* Row 1: Search, Sort, Extra filters toggle (mobile) */}
        <div className="flex flex-col gap-2.5 md:flex-row md:items-center">
          <form
            onSubmit={handleSearchSubmit}
            className="relative flex-1"
            role="search"
          >
            <label htmlFor="trail-search-input" className="sr-only">
              Szukaj szlaku
            </label>
            <Search
              className="pointer-events-none absolute top-1/2 left-3.5 h-4 w-4 -translate-y-1/2 text-[var(--text-secondary)]"
              aria-hidden="true"
            />
            <Input
              id="trail-search-input"
              type="search"
              value={searchValue}
              onChange={(event) => handleSearchChange(event.target.value)}
              placeholder="Szukaj szlaku, pasma, miejscowości..."
              className="pr-11 pl-10"
            />
            {searchValue.length > 0 && (
              <button
                type="button"
                onClick={handleClearSearch}
                aria-label="Wyczyść wyszukiwanie"
                className="absolute top-1/2 right-1.5 inline-flex h-9 w-9 -translate-y-1/2 items-center justify-center rounded-lg text-[var(--text-secondary)] transition-colors hover:bg-[var(--bg-surface-muted)] hover:text-[var(--text-primary)] cursor-pointer"
              >
                <X className="h-4 w-4" aria-hidden="true" />
              </button>
            )}
          </form>

          <div className="flex items-center gap-2">
            <SortSelect
              value={activeSort}
              onChange={(nextSort) => pushUpdatedParams({ sort: nextSort })}
              className="flex-1 md:w-56 md:flex-none"
            />

            <button
              type="button"
              onClick={() => setMobileFiltersOpen((prev) => !prev)}
              aria-expanded={mobileFiltersOpen}
              aria-controls="extra-trail-filters"
              className={cn(
                "inline-flex min-h-[44px] shrink-0 items-center gap-2 rounded-xl border px-3.5 text-sm font-semibold transition-colors cursor-pointer md:hidden",
                mobileFiltersOpen || extraFiltersCount > 0
                  ? "border-[var(--accent-primary)] bg-[var(--accent-primary)]/10 text-[var(--accent-primary)]"
                  : "border-[var(--border-subtle)] bg-[var(--bg-surface-muted)] text-[var(--text-primary)]",
              )}
            >
              <SlidersHorizontal className="h-4 w-4" aria-hidden="true" />
              <span>Filtry</span>
              {extraFiltersCount > 0 && (
                <span className="inline-flex h-5 min-w-5 items-center justify-center rounded-full bg-[var(--accent-primary)] px-1.5 font-mono text-xs font-bold text-white">
                  {extraFiltersCount}
                </span>
              )}
            </button>
          </div>
        </div>

        {/* Row 2: Extra filters (inline on desktop, collapsible on mobile) */}
        <div
          id="extra-trail-filters"
          className={cn(
            "mt-2.5 grid grid-cols-1 gap-2 sm:grid-cols-3",
            mobileFiltersOpen ? "grid" : "hidden md:grid",
          )}
        >
          <div>
            <label htmlFor="filter-difficulty" className="sr-only">
              Poziom trudności
            </label>
            <Select
              id="filter-difficulty"
              aria-label="Poziom trudności"
              value={activeDifficulty}
              onChange={(event) =>
                pushUpdatedParams({ difficulty: event.target.value || null })
              }
            >
              <option value="">Poziom trudności: Wszystkie</option>
              {DIFFICULTIES.map((diff) => (
                <option key={diff} value={diff}>
                  {DIFFICULTY_LABELS[diff]}
                </option>
              ))}
            </Select>
          </div>

          <div>
            <label htmlFor="filter-surface" className="sr-only">
              Nawierzchnia
            </label>
            <Select
              id="filter-surface"
              aria-label="Nawierzchnia"
              value={activeSurface}
              onChange={(event) =>
                pushUpdatedParams({ surface: event.target.value || null })
              }
            >
              <option value="">Nawierzchnia: Wszystkie</option>
              {SURFACES.map((surface) => (
                <option key={surface} value={surface}>
                  {SURFACE_LABELS[surface]}
                </option>
              ))}
            </Select>
          </div>

          <div>
            <label htmlFor="filter-distance" className="sr-only">
              Dystans
            </label>
            <Select
              id="filter-distance"
              aria-label="Dystans"
              value={activeDistanceBucket}
              onChange={(event) =>
                handleDistanceChange(event.target.value as DistanceBucket)
              }
            >
              {DISTANCE_OPTIONS.map((opt) => (
                <option key={opt.value || "all"} value={opt.value}>
                  {opt.value === "" ? "Dystans: Wszystkie" : `Dystans: ${opt.label}`}
                </option>
              ))}
            </Select>
          </div>
        </div>

        {/* Row 3: 16 Polish Voivodeships Pills */}
        <div className="mt-2.5">
          <RegionPills
            activeRegion={activeRegion}
            regionCounts={regionCounts}
            onSelectRegion={(nextRegion) =>
              pushUpdatedParams({ region: nextRegion })
            }
          />
        </div>

        {/* Row 4: Results counter & Reset */}
        <div className="mt-2 flex flex-wrap items-center justify-between gap-2 border-t border-[var(--border-subtle)]/70 pt-2">
          <p className="text-xs font-medium text-[var(--text-secondary)] sm:text-sm">
            Znaleziono{" "}
            <span className="font-mono font-bold text-[var(--text-primary)] tabular-nums">
              {formatTrailsCountPl(totalResults)}
            </span>
          </p>

          {hasActiveFilters && (
            <button
              type="button"
              onClick={handleResetAll}
              className="inline-flex min-h-[44px] sm:min-h-[36px] items-center gap-1.5 rounded-lg px-2.5 text-xs font-semibold text-[var(--accent-primary)] transition-colors hover:bg-[var(--accent-primary)]/10 cursor-pointer sm:text-sm"
            >
              <RotateCcw className="h-3.5 w-3.5" aria-hidden="true" />
              Wyczyść filtry
            </button>
          )}
        </div>
      </div>
    </section>
  );
}
