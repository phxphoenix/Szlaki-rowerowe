"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { Check, Download, ExternalLink, Navigation, Share2 } from "lucide-react";
import { generateGpxXml } from "@/lib/gpx/parser";
import { cn } from "@/lib/utils/cn";
import type { Trail } from "@/types/trail";
import { buildGoogleMapsDirectionsUrl } from "@/components/map/utils";

export interface MapActionsBarProps {
  trail: Trail;
  className?: string;
}

function triggerBlobDownload(content: BlobPart, filename: string, mimeType: string) {
  const blob = new Blob([content], { type: mimeType });
  const objectUrl = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = objectUrl;
  anchor.download = filename;
  anchor.style.display = "none";
  document.body.appendChild(anchor);
  anchor.click();
  document.body.removeChild(anchor);
  setTimeout(() => URL.revokeObjectURL(objectUrl), 1000);
}

export function MapActionsBar({ trail, className }: MapActionsBarProps) {
  const [copied, setCopied] = useState(false);
  const [isDownloadingGpx, setIsDownloadingGpx] = useState(false);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    return () => {
      if (timerRef.current) {
        clearTimeout(timerRef.current);
      }
    };
  }, []);

  const directionsUrl = useMemo(() => buildGoogleMapsDirectionsUrl(trail), [trail]);
  const hasRoutePoints = trail.routePoints.length >= 2;
  const canDownloadGpx = Boolean(trail.gpxUrl) || hasRoutePoints;
  const gpxFilename = `${trail.slug || "szlak"}.gpx`;

  const handleGeneratedOrRemoteGpxDownload = async () => {
    if (!canDownloadGpx || isDownloadingGpx) return;

    if (trail.gpxUrl) {
      setIsDownloadingGpx(true);
      try {
        const response = await fetch(trail.gpxUrl);
        if (response.ok) {
          const text = await response.text();
          triggerBlobDownload(text, gpxFilename, "application/gpx+xml");
          return;
        }
      } catch {
        // Fallback below if cross-origin fetch fails
      } finally {
        setIsDownloadingGpx(false);
      }

      if (hasRoutePoints) {
        const xml = generateGpxXml({
          title: trail.title,
          shortDescription: trail.shortDescription,
          routePoints: trail.routePoints,
        });
        triggerBlobDownload(xml, gpxFilename, "application/gpx+xml");
        return;
      }

      window.open(trail.gpxUrl, "_blank", "noopener,noreferrer");
      return;
    }

    const xml = generateGpxXml({
      title: trail.title,
      shortDescription: trail.shortDescription,
      routePoints: trail.routePoints,
    });
    triggerBlobDownload(xml, gpxFilename, "application/gpx+xml");
  };

  const markCopied = () => {
    setCopied(true);
    if (timerRef.current) {
      clearTimeout(timerRef.current);
    }
    timerRef.current = setTimeout(() => {
      setCopied(false);
    }, 2500);
  };

  const handleShare = async () => {
    const shareUrl =
      typeof window !== "undefined" ? window.location.href : `/szlaki/${trail.slug}`;

    if (
      typeof navigator !== "undefined" &&
      typeof navigator.share === "function"
    ) {
      try {
        await navigator.share({
          title: trail.title,
          text: trail.shortDescription,
          url: shareUrl,
        });
        return;
      } catch (err) {
        if (err instanceof Error && err.name === "AbortError") {
          return;
        }
      }
    }

    if (
      typeof navigator !== "undefined" &&
      navigator.clipboard &&
      typeof navigator.clipboard.writeText === "function"
    ) {
      try {
        await navigator.clipboard.writeText(shareUrl);
        markCopied();
      } catch {
        // Ignore clipboard denial in restricted environments
      }
    }
  };

  return (
    <div
      data-testid="map-actions-bar"
      className={cn(
        "fixed inset-x-0 bottom-0 z-30 border-t border-[var(--border-subtle)] bg-[var(--bg-surface)]/95 px-3 pt-2.5 shadow-[0_-8px_24px_rgba(17,22,26,0.12)] backdrop-blur-md safe-bottom md:static md:z-auto md:rounded-2xl md:border md:p-4 md:shadow-sm",
        className,
      )}
    >
      <div className="mx-auto flex max-w-7xl items-center justify-between gap-2 sm:gap-3">
        <div className="flex min-w-0 flex-1 items-center gap-2 sm:flex-initial sm:gap-3">
          {/* Primary Field CTA: Google Maps Directions */}
          <a
            href={directionsUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex min-h-[44px] flex-1 items-center justify-center gap-1.5 rounded-xl bg-[var(--accent-primary)] px-3 py-2 text-xs font-bold text-white shadow-sm transition-all hover:bg-[var(--accent-primary-hover)] active:scale-[0.98] sm:flex-initial sm:px-5 sm:text-sm"
          >
            <Navigation className="h-4 w-4 shrink-0" aria-hidden="true" />
            <span className="truncate">Otwórz w Google Maps</span>
            <ExternalLink
              className="hidden h-3.5 w-3.5 shrink-0 opacity-85 sm:inline"
              aria-hidden="true"
            />
          </a>

          {/* Secondary Action: Download GPX */}
          {trail.gpxUrl && trail.gpxUrl.startsWith("/") ? (
            <a
              href={trail.gpxUrl}
              download={gpxFilename}
              className="inline-flex min-h-[44px] shrink-0 items-center justify-center gap-1.5 rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-surface-muted)] px-3 py-2 text-xs font-semibold text-[var(--text-primary)] transition-colors hover:bg-[var(--border-subtle)] sm:px-4 sm:text-sm"
            >
              <Download
                className="h-4 w-4 shrink-0 text-[var(--accent-telemetry)]"
                aria-hidden="true"
              />
              <span className="whitespace-nowrap">Pobierz GPX</span>
            </a>
          ) : (
            <button
              type="button"
              onClick={handleGeneratedOrRemoteGpxDownload}
              disabled={!canDownloadGpx || isDownloadingGpx}
              className="inline-flex min-h-[44px] shrink-0 cursor-pointer items-center justify-center gap-1.5 rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-surface-muted)] px-3 py-2 text-xs font-semibold text-[var(--text-primary)] transition-colors hover:bg-[var(--border-subtle)] disabled:cursor-not-allowed disabled:opacity-50 sm:px-4 sm:text-sm"
            >
              <Download
                className="h-4 w-4 shrink-0 text-[var(--accent-telemetry)]"
                aria-hidden="true"
              />
              <span className="whitespace-nowrap">Pobierz GPX</span>
            </button>
          )}
        </div>

        <div className="flex shrink-0 items-center gap-2">
          {trail.sourceUrl && (
            <a
              href={trail.sourceUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="hidden min-h-[44px] items-center gap-1.5 rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-surface)] px-3.5 py-2 text-sm font-medium text-[var(--text-secondary)] transition-colors hover:bg-[var(--bg-surface-muted)] hover:text-[var(--text-primary)] lg:inline-flex"
            >
              <span>{trail.sourceName || "Źródło trasy"}</span>
              <ExternalLink className="h-3.5 w-3.5" aria-hidden="true" />
            </a>
          )}

          {/* Share / Copy Link */}
          <button
            type="button"
            onClick={handleShare}
            aria-label={copied ? "Skopiowano link do szlaku" : "Udostępnij szlak"}
            className={cn(
              "inline-flex min-h-[44px] min-w-[44px] cursor-pointer items-center justify-center gap-1.5 rounded-xl border px-3 py-2 text-xs font-semibold transition-colors sm:px-4 sm:text-sm",
              copied
                ? "border-[#16A34A]/40 bg-[#16A34A]/15 text-[#16A34A]"
                : "border-[var(--border-subtle)] bg-[var(--bg-surface)] text-[var(--text-primary)] hover:bg-[var(--bg-surface-muted)]",
            )}
          >
            {copied ? (
              <>
                <Check className="h-4 w-4 shrink-0" aria-hidden="true" />
                <span>Skopiowano</span>
              </>
            ) : (
              <>
                <Share2 className="h-4 w-4 shrink-0" aria-hidden="true" />
                <span className="sr-only sm:not-sr-only">Udostępnij</span>
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
}
