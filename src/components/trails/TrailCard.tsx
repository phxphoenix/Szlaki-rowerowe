"use client";

import { useState } from "react";
import Image from "next/image";
import Link from "next/link";
import {
  ExternalLink,
  Layers,
  MapPin,
  Repeat,
  Route,
  TrendingUp,
} from "lucide-react";
import { RouteMiniMap } from "@/components/trails/RouteMiniMap";
import { Badge } from "@/components/ui/badge";
import {
  DIFFICULTY_LABELS,
  SURFACE_SHORT_LABELS,
  TRAIL_COLOR_META,
  getRegionInfo,
} from "@/lib/constants/regions";
import { formatDistance, formatElevation } from "@/lib/utils/format";
import { shouldUseUnoptimizedImage } from "@/lib/utils/image";
import type { TrailSummary } from "@/types/trail";

export interface TrailCardProps {
  trail: TrailSummary;
  priority?: boolean;
}

export function TrailCard({ trail, priority = false }: TrailCardProps) {
  const [failedCoverUrl, setFailedCoverUrl] = useState<string | null>(null);

  const regionInfo = getRegionInfo(trail.region);
  const trailColorMeta = TRAIL_COLOR_META[trail.trailColor];
  const difficultyLabel = DIFFICULTY_LABELS[trail.difficulty];
  const surfaceLabel = SURFACE_SHORT_LABELS[trail.surface];

  const coverImageUrl = trail.coverImageUrl?.trim() ?? "";
  const imgError = Boolean(coverImageUrl) && failedCoverUrl === coverImageUrl;
  const hasCoverImage = Boolean(coverImageUrl) && !imgError;

  const routePreviewPoints = Array.isArray(trail.routePreviewPoints)
    ? trail.routePreviewPoints
    : [];
  const hasRoutePreview = routePreviewPoints.length >= 2;

  return (
    <article className="h-full">
      <Link
        href={`/szlaki/${trail.slug}`}
        className="group relative flex h-full flex-col overflow-hidden rounded-2xl border border-[var(--border-subtle)] bg-[var(--bg-surface)] shadow-sm transition-all duration-200 hover:-translate-y-1 hover:shadow-lg focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--accent-primary)]"
      >
        {/* Cover Image 16:10 */}
        <div className="relative aspect-[16/10] w-full overflow-hidden bg-[var(--bg-carbon)]">
          {hasCoverImage ? (
            <>
              <Image
                src={coverImageUrl}
                alt={trail.title}
                fill
                sizes="(max-width: 640px) 100vw, (max-width: 1024px) 50vw, 33vw"
                priority={priority}
                unoptimized={shouldUseUnoptimizedImage(coverImageUrl)}
                onError={() => setFailedCoverUrl(coverImageUrl)}
                className="object-cover transition-transform duration-500 ease-out group-hover:scale-105"
              />

              <div
                className="pointer-events-none absolute inset-0 bg-gradient-to-t from-[#11161A]/65 via-transparent to-[#11161A]/25"
                aria-hidden="true"
              />

              {hasRoutePreview && (
                <RouteMiniMap
                  points={routePreviewPoints}
                  trailColor={trail.trailColor}
                  isLoop={trail.isLoop}
                  variant="overlay"
                  className="pointer-events-none absolute right-2.5 bottom-2.5 z-10"
                />
              )}
            </>
          ) : (
            <>
              <RouteMiniMap
                points={routePreviewPoints}
                trailColor={trail.trailColor}
                isLoop={trail.isLoop}
                variant="full"
                className="h-full w-full"
              />

              <div
                className="pointer-events-none absolute inset-0 bg-gradient-to-t from-[#11161A]/55 via-transparent to-[#11161A]/35"
                aria-hidden="true"
              />
            </>
          )}

          {/* Top-left: Region + PTTK color dot */}
          <div className="absolute top-3 left-3 z-10 flex max-w-[62%] items-center gap-1.5">
            <Badge variant="carbon" className="truncate py-1 pr-3 pl-2">
              <span
                className="h-2.5 w-2.5 shrink-0 rounded-full ring-1 ring-white/60"
                style={{ backgroundColor: trailColorMeta.hex }}
                title={trailColorMeta.label}
                aria-hidden="true"
              />
              <span className="truncate">{regionInfo.name}</span>
            </Badge>
          </div>

          {/* Top-right: Semantic Difficulty */}
          <div className="absolute top-3 right-3 z-10">
            <Badge variant={trail.difficulty}>{difficultyLabel}</Badge>
          </div>

          {/* Bottom-left: Optional Loop indicator */}
          {trail.isLoop && (
            <div className="absolute bottom-3 left-3 z-10">
              <span className="inline-flex items-center gap-1 rounded-full bg-[#11161A]/75 px-2.5 py-0.5 text-[11px] font-semibold text-white/95 backdrop-blur-sm">
                <Repeat className="h-3 w-3 text-[#FF5E33]" aria-hidden="true" />
                Pętla
              </span>
            </div>
          )}
        </div>

        {/* Body */}
        <div className="flex flex-1 flex-col p-5">
          {(trail.subregion || trail.sourceName) && (
            <div className="mb-2 flex flex-wrap items-center justify-between gap-2 text-xs text-[var(--text-secondary)]">
              {trail.subregion ? (
                <span className="inline-flex min-w-0 items-center gap-1 font-medium">
                  <MapPin
                    className="h-3.5 w-3.5 shrink-0 text-[var(--accent-primary)]"
                    aria-hidden="true"
                  />
                  <span className="truncate">{trail.subregion}</span>
                </span>
              ) : (
                <span />
              )}

              {trail.sourceName && (
                <span className="inline-flex shrink-0 items-center gap-1 rounded-md bg-[var(--bg-surface-muted)] px-2 py-0.5 font-mono text-[11px] font-semibold text-[var(--text-secondary)]">
                  <ExternalLink className="h-3 w-3" aria-hidden="true" />
                  {trail.sourceName}
                </span>
              )}
            </div>
          )}

          <h2 className="text-xl font-bold leading-snug text-[var(--text-primary)] line-clamp-2 transition-colors group-hover:text-[var(--accent-primary)]">
            {trail.title}
          </h2>

          <p className="mt-2 flex-1 text-sm leading-relaxed text-[var(--text-secondary)] line-clamp-2">
            {trail.shortDescription}
          </p>

          {/* Telemetry Bar (3 columns) */}
          <div className="mt-4 grid grid-cols-3 gap-2 border-t border-[var(--border-subtle)] pt-3.5">
            <div className="flex flex-col">
              <span className="flex items-center gap-1 text-[11px] font-medium text-[var(--text-secondary)]">
                <Route
                  className="h-3.5 w-3.5 text-[var(--accent-primary)]"
                  aria-hidden="true"
                />
                Dystans
              </span>
              <span className="mt-0.5 font-mono text-sm font-semibold text-[var(--text-primary)] tabular-nums">
                {formatDistance(trail.distanceKm)}
              </span>
            </div>

            <div className="flex flex-col">
              <span className="flex items-center gap-1 text-[11px] font-medium text-[var(--text-secondary)]">
                <TrendingUp
                  className="h-3.5 w-3.5 text-[var(--accent-telemetry)]"
                  aria-hidden="true"
                />
                Podjazdy
              </span>
              <span className="mt-0.5 font-mono text-sm font-semibold text-[var(--text-primary)] tabular-nums">
                {formatElevation(trail.elevationGainM)}
              </span>
            </div>

            <div className="flex flex-col">
              <span className="flex items-center gap-1 text-[11px] font-medium text-[var(--text-secondary)]">
                <Layers
                  className="h-3.5 w-3.5 text-[var(--accent-warning)]"
                  aria-hidden="true"
                />
                Nawierzchnia
              </span>
              <span className="mt-0.5 truncate font-mono text-sm font-semibold text-[var(--text-primary)]">
                {surfaceLabel}
              </span>
            </div>
          </div>
        </div>

        {/* Sporty hover bottom accent bar */}
        <div
          className="h-1 w-full origin-left scale-x-0 bg-[var(--accent-primary)] transition-transform duration-200 group-hover:scale-x-100"
          aria-hidden="true"
        />
      </Link>
    </article>
  );
}
