"use client";

import { REGIONS, type RegionSlug } from "@/lib/constants/regions";
import { cn } from "@/lib/utils/cn";

export interface RegionPillsProps {
  activeRegion: RegionSlug | "all";
  regionCounts: Record<RegionSlug, number>;
  onSelectRegion: (region: RegionSlug | "all") => void;
}

export function RegionPills({
  activeRegion,
  regionCounts,
  onSelectRegion,
}: RegionPillsProps) {
  const totalCount = REGIONS.reduce(
    (sum, region) => sum + (regionCounts[region.slug] ?? 0),
    0,
  );

  const isAllActive = activeRegion === "all";

  return (
    <div
      role="group"
      aria-label="Filtruj według województwa"
      className="flex items-center gap-2 overflow-x-auto snap-x snap-mandatory no-scrollbar py-1 -mx-1 px-1"
    >
      <button
        type="button"
        aria-pressed={isAllActive}
        onClick={() => onSelectRegion("all")}
        className={cn(
          "inline-flex min-h-[44px] shrink-0 snap-start items-center gap-2 rounded-full border px-4 py-2 text-sm font-semibold transition-all cursor-pointer select-none",
          isAllActive
            ? "border-transparent bg-[var(--accent-primary)] text-white shadow-sm"
            : "border-[var(--border-subtle)] bg-[var(--bg-surface-muted)] text-[var(--text-primary)] hover:border-[var(--accent-primary)]/50 hover:bg-[var(--bg-surface)]",
        )}
      >
        <span className="whitespace-nowrap">Cała Polska</span>
        <span
          className={cn(
            "rounded-full px-2 py-0.5 font-mono text-xs font-semibold tabular-nums",
            isAllActive
              ? "bg-white/20 text-white"
              : "bg-[var(--bg-surface)] text-[var(--text-secondary)]",
          )}
        >
          {totalCount}
        </span>
      </button>

      {REGIONS.map((region) => {
        const count = regionCounts[region.slug] ?? 0;
        const isActive = activeRegion === region.slug;

        return (
          <button
            key={region.slug}
            type="button"
            aria-pressed={isActive}
            onClick={() => onSelectRegion(region.slug)}
            className={cn(
              "inline-flex min-h-[44px] shrink-0 snap-start items-center gap-2 rounded-full border px-3.5 py-2 text-sm font-semibold transition-all cursor-pointer select-none",
              isActive
                ? "border-transparent bg-[var(--accent-primary)] text-white shadow-sm"
                : count > 0
                  ? "border-[var(--border-subtle)] bg-[var(--bg-surface-muted)] text-[var(--text-primary)] hover:border-[var(--accent-primary)]/50 hover:bg-[var(--bg-surface)]"
                  : "border-[var(--border-subtle)] bg-[var(--bg-surface-muted)]/60 text-[var(--text-secondary)] hover:border-[var(--accent-primary)]/40 hover:text-[var(--text-primary)]",
            )}
          >
            <span className="whitespace-nowrap">{region.name}</span>
            <span
              className={cn(
                "rounded-full px-1.5 py-0.5 font-mono text-xs font-semibold tabular-nums",
                isActive
                  ? "bg-white/20 text-white"
                  : "bg-[var(--bg-surface)] text-[var(--text-secondary)]",
              )}
            >
              {count}
            </span>
          </button>
        );
      })}
    </div>
  );
}
