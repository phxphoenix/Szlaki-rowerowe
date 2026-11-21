"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import {
  Check,
  Compass,
  Download,
  ExternalLink,
  MapPin,
  Navigation,
  Share2,
} from "lucide-react";
import { generateGpxXml } from "@/lib/gpx/parser";
import { cn } from "@/lib/utils/cn";
import type { Trail } from "@/types/trail";
import {
  buildGoogleMapsRouteUrl,
  buildGoogleMapsStartNavigationUrl,
  isGoogleMyMapsUrl,
} from "@/components/map/utils";

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

  const routeUrl = useMemo(
    () => buildGoogleMapsRouteUrl(trail, { forceDirections: true }),
    [trail],
  );
  const startNavUrl = useMemo(
    () => buildGoogleMapsStartNavigationUrl(trail),
    [trail],
  );
  const myMapsUrl = useMemo(
    () =>
      isGoogleMyMapsUrl(trail.googleMapsEmbedUrl)
        ? trail.googleMapsEmbedUrl!.trim()
        : null,
    [trail.googleMapsEmbedUrl],
  );
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
        "fixed inset-x-0 bottom-0 z-30 border-t border-[var(--border-subtle)] bg-[var(--bg-surface)]/95 px-3 pt-2 shadow-[0_-8px_24px_rgba(17,22,26,0.12)] backdrop-blur-md safe-bottom md:static md:z-auto md:rounded-2xl md:border md:p-4 md:shadow-sm",
        className,
      )}
    >
      <div className="mx-auto flex max-w-7xl flex-col gap-2 md:flex-row md:flex-wrap md:items-center md:justify-between md:gap-2.5">
        <div className="flex flex-wrap items-center gap-2 md:flex-initial">
          {/* Primary Field CTA: Full Cycling Route in Google Maps */}
          <a
            href={routeUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex min-h-[44px] flex-auto items-center justify-center gap-1.5 rounded-xl bg-[var(--accent-primary)] px-3 py-2 text-xs font-bold text-white shadow-sm transition-all hover:bg-[var(--accent-primary-hover)] active:scale-[0.98] sm:flex-initial sm:px-4 sm:text-sm"
          >
            <Navigation className="h-4 w-4 shrink-0" aria-hidden="true" />
            <span className="whitespace-nowrap">Otwórz trasę w Google Maps</span>
            <ExternalLink
              className="hidden h-3.5 w-3.5 shrink-0 opacity-85 sm:inline"
              aria-hidden="true"
            />
          </a>

          {/* Secondary Google CTA: Navigate to Trail Start */}
          <a
            href={startNavUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex min-h-[44px] shrink-0 items-center justify-center gap-1.5 rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-surface)] px-3 py-2 text-xs font-semibold text-[var(--text-primary)] transition-colors hover:bg-[var(--bg-surface-muted)] sm:px-3.5 sm:text-sm"
          >
            <MapPin
              className="h-4 w-4 shrink-0 text-[#16A34A]"
              aria-hidden="true"
            />
            <span className="whitespace-nowrap">Dojazd do startu</span>
          </a>

          {/* Optional Google My Maps 1:1 Link */}
          {myMapsUrl && (
            <a
              href={myMapsUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex min-h-[44px] shrink-0 items-center justify-center gap-1.5 rounded-xl border border-[var(--accent-telemetry)]/35 bg-[var(--accent-telemetry)]/10 px-3 py-2 text-xs font-semibold text-[var(--accent-telemetry)] transition-colors hover:bg-[var(--accent-telemetry)]/15 sm:px-3.5 sm:text-sm"
            >
              <Compass className="h-4 w-4 shrink-0" aria-hidden="true" />
              <span className="whitespace-nowrap">Mapa 1:1 (My Maps)</span>
              <ExternalLink
                className="hidden h-3 w-3 shrink-0 opacity-80 sm:inline"
                aria-hidden="true"
              />
            </a>
          )}
        </div>

        <div className="flex flex-wrap items-center justify-between gap-2 md:justify-end">
          {/* Download GPX */}
          {trail.gpxUrl && trail.gpxUrl.startsWith("/") ? (
            <a
              href={trail.gpxUrl}
              download={gpxFilename}
              className="inline-flex min-h-[44px] flex-1 shrink-0 items-center justify-center gap-1.5 rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-surface-muted)] px-3 py-2 text-xs font-semibold text-[var(--text-primary)] transition-colors hover:bg-[var(--border-subtle)] sm:flex-initial sm:px-4 sm:text-sm"
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
              className="inline-flex min-h-[44px] flex-1 shrink-0 cursor-pointer items-center justify-center gap-1.5 rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-surface-muted)] px-3 py-2 text-xs font-semibold text-[var(--text-primary)] transition-colors hover:bg-[var(--border-subtle)] disabled:cursor-not-allowed disabled:opacity-50 sm:flex-initial sm:px-4 sm:text-sm"
            >
              <Download
                className="h-4 w-4 shrink-0 text-[var(--accent-telemetry)]"
                aria-hidden="true"
              />
              <span className="whitespace-nowrap">Pobierz GPX</span>
            </button>
          )}

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
                <span className="sm:not-sr-only">Udostępnij</span>
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
}
