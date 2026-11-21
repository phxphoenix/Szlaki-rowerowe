"use client";

import { useMemo, useState } from "react";
import { Compass, ExternalLink, MapPin, Navigation, X } from "lucide-react";
import {
  POI_CATEGORY_LABELS,
  TRAIL_COLOR_META,
  getRegionInfo,
  type PoiCategory,
} from "@/lib/constants/regions";
import { cn } from "@/lib/utils/cn";
import { formatDistance } from "@/lib/utils/format";
import type { Trail, TrailPoi } from "@/types/trail";
import {
  buildGoogleMapsRouteUrl,
  buildGoogleMapsStartNavigationUrl,
  formatCoordinate,
  getRouteBoundsAndCenter,
  getTrailOutlineColor,
  getTrailStrokeColor,
  projectRouteToSvg,
} from "@/components/map/utils";

export interface MapFallbackProps {
  trail: Trail;
  activePointIndex?: number | null;
  className?: string;
}

const SVG_WIDTH = 800;
const SVG_HEIGHT = 440;

function getPoiLabel(category: string | null): string {
  if (!category) return "Punkt na trasie";
  if (Object.prototype.hasOwnProperty.call(POI_CATEGORY_LABELS, category)) {
    return POI_CATEGORY_LABELS[category as PoiCategory];
  }
  return "Punkt na trasie";
}

export function MapFallback({
  trail,
  activePointIndex = null,
  className,
}: MapFallbackProps) {
  const [selectedPoi, setSelectedPoi] = useState<TrailPoi | null>(null);

  const routeUrl = useMemo(
    () => buildGoogleMapsRouteUrl(trail, { forceDirections: true }),
    [trail],
  );
  const startNavUrl = useMemo(
    () => buildGoogleMapsStartNavigationUrl(trail),
    [trail],
  );
  const strokeColor = getTrailStrokeColor(trail.trailColor);
  const outlineColor = getTrailOutlineColor(trail.trailColor);
  const trailColorMeta = TRAIL_COLOR_META[trail.trailColor];
  const regionInfo = getRegionInfo(trail.region);

  const geometry = useMemo(() => getRouteBoundsAndCenter(trail), [trail]);

  const projection = useMemo(
    () =>
      projectRouteToSvg(trail.routePoints, trail.pois, {
        width: SVG_WIDTH,
        height: SVG_HEIGHT,
        padding: 58,
      }),
    [trail.routePoints, trail.pois],
  );

  const startProjected = projection.points[0] ?? null;
  const endProjected =
    projection.points.length >= 2
      ? projection.points[projection.points.length - 1]
      : null;

  const activeProjected =
    activePointIndex !== null &&
    activePointIndex !== undefined &&
    activePointIndex >= 0 &&
    activePointIndex < projection.points.length
      ? projection.points[activePointIndex]
      : null;

  const activePoint = activeProjected?.point ?? null;
  const displayCoords = activePoint
    ? { lat: activePoint.lat, lng: activePoint.lng }
    : geometry.startPoint ?? geometry.center;

  return (
    <div
      data-testid="map-fallback"
      className={cn(
        "relative flex h-full w-full flex-col justify-between overflow-hidden bg-[#11161A] text-[#F8FAF7]",
        className,
      )}
    >
      {/* Interactive Topographic Vector Map SVG */}
      <svg
        viewBox={`0 0 ${SVG_WIDTH} ${SVG_HEIGHT}`}
        preserveAspectRatio="xMidYMid meet"
        role="img"
        aria-label={`Wektorowa mapa trasy ${trail.title}`}
        className="h-full w-full flex-1 select-none"
      >
        <defs>
          <radialGradient id="topoGlow" cx="50%" cy="50%" r="60%">
            <stop offset="0%" stopColor="#1E293B" stopOpacity="0.65" />
            <stop offset="100%" stopColor="#0D1114" stopOpacity="0.98" />
          </radialGradient>
          <pattern
            id="topoGrid"
            width="40"
            height="40"
            patternUnits="userSpaceOnUse"
          >
            <path
              d="M 40 0 L 0 0 0 40"
              fill="none"
              stroke="#334155"
              strokeWidth="0.6"
              strokeOpacity="0.35"
            />
          </pattern>
        </defs>

        <rect width={SVG_WIDTH} height={SVG_HEIGHT} fill="url(#topoGlow)" />
        <rect width={SVG_WIDTH} height={SVG_HEIGHT} fill="url(#topoGrid)" />

        {/* Subtle topographic elevation contours */}
        <g fill="none" stroke="#475569" strokeOpacity="0.22" strokeWidth="1">
          <path d="M -40 340 C 140 280, 290 360, 470 270 C 620 195, 730 245, 850 185" />
          <path d="M -40 250 C 120 185, 280 265, 450 175 C 610 95, 710 145, 850 90" />
          <path d="M -40 140 C 130 90, 260 165, 430 95 C 580 35, 700 75, 850 30" />
          <circle cx="640" cy="140" r="115" strokeDasharray="4 6" />
          <circle cx="170" cy="310" r="90" strokeDasharray="4 6" />
        </g>

        {/* Coordinate tick frame */}
        <g
          fill="#94A3B8"
          fontSize="10"
          fontFamily="ui-monospace, SFMono-Regular, monospace"
          opacity="0.7"
        >
          <text x="16" y="22">
            {formatCoordinate(
              projection.bounds?.north ?? geometry.center.lat,
              "lat",
            )}
          </text>
          <text x="16" y={SVG_HEIGHT - 14}>
            {formatCoordinate(
              projection.bounds?.south ?? geometry.center.lat,
              "lat",
            )}
          </text>
          <text x={SVG_WIDTH - 16} y={SVG_HEIGHT - 14} textAnchor="end">
            {formatCoordinate(
              projection.bounds?.east ?? geometry.center.lng,
              "lng",
            )}
          </text>
        </g>

        {/* Trail Polyline (double stroke for high contrast) */}
        {projection.pathD ? (
          <g>
            <path
              d={projection.pathD}
              fill="none"
              stroke={strokeColor}
              strokeWidth="12"
              strokeOpacity="0.2"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
            <path
              d={projection.pathD}
              fill="none"
              stroke={outlineColor}
              strokeWidth="7.5"
              strokeOpacity="0.92"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
            <path
              data-testid="fallback-route-path"
              d={projection.pathD}
              fill="none"
              stroke={strokeColor}
              strokeWidth="4.2"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </g>
        ) : (
          <g transform={`translate(${SVG_WIDTH / 2}, ${SVG_HEIGHT / 2})`}>
            <circle
              r="34"
              fill={strokeColor}
              fillOpacity="0.18"
              stroke={strokeColor}
              strokeWidth="2"
              strokeDasharray="5 5"
            />
            <circle r="7" fill={strokeColor} />
            <text
              y="56"
              textAnchor="middle"
              fill="#CBD5E1"
              fontSize="13"
              fontWeight="600"
            >
              {regionInfo.fullName} — brak wgranego śladu GPX
            </text>
          </g>
        )}

        {/* POI Pins */}
        {projection.pois.map(({ x, y, poi }) => {
          const isSelected = selectedPoi?.id === poi.id;
          return (
            <g
              key={poi.id}
              transform={`translate(${x}, ${y})`}
              className="cursor-pointer"
              onClick={() =>
                setSelectedPoi((prev) => (prev?.id === poi.id ? null : poi))
              }
            >
              <circle
                r={isSelected ? 10 : 7}
                fill="#0284C7"
                stroke="#FFFFFF"
                strokeWidth="2"
              />
              <circle r="2.2" fill="#FFFFFF" />
            </g>
          );
        })}

        {/* META Marker (when not a loop and distinct end point) */}
        {endProjected && !trail.isLoop && (
          <g transform={`translate(${endProjected.x}, ${endProjected.y})`}>
            <circle
              r="9"
              fill="#E11D48"
              stroke="#FFFFFF"
              strokeWidth="2.5"
            />
            <rect
              x="12"
              y="-10"
              width="44"
              height="20"
              rx="6"
              fill="#11161A"
              fillOpacity="0.92"
              stroke="#E11D48"
              strokeWidth="1"
            />
            <text
              x="34"
              y="3"
              textAnchor="middle"
              fill="#FFFFFF"
              fontSize="10"
              fontWeight="700"
              fontFamily="ui-monospace, monospace"
            >
              META
            </text>
          </g>
        )}

        {/* START Marker */}
        {startProjected && (
          <g transform={`translate(${startProjected.x}, ${startProjected.y})`}>
            <circle
              r="14"
              fill="#16A34A"
              fillOpacity="0.25"
            />
            <circle
              r="8.5"
              fill="#16A34A"
              stroke="#FFFFFF"
              strokeWidth="2.5"
            />
            <rect
              x="12"
              y="-10"
              width={trail.isLoop ? 86 : 50}
              height="20"
              rx="6"
              fill="#11161A"
              fillOpacity="0.92"
              stroke="#16A34A"
              strokeWidth="1"
            />
            <text
              x={trail.isLoop ? 55 : 37}
              y="3"
              textAnchor="middle"
              fill="#FFFFFF"
              fontSize="10"
              fontWeight="700"
              fontFamily="ui-monospace, monospace"
            >
              {trail.isLoop ? "START / META" : "START"}
            </text>
          </g>
        )}

        {/* Synchronized Active Elevation Point Indicator */}
        {activeProjected && (
          <g
            data-testid="fallback-active-point"
            transform={`translate(${activeProjected.x}, ${activeProjected.y})`}
          >
            <line
              x1="-16"
              y1="0"
              x2="16"
              y2="0"
              stroke="#38BDF8"
              strokeWidth="1"
              strokeDasharray="3 3"
            />
            <line
              x1="0"
              y1="-16"
              x2="0"
              y2="16"
              stroke="#38BDF8"
              strokeWidth="1"
              strokeDasharray="3 3"
            />
            <circle r="13" fill="#FF4D1C" fillOpacity="0.28" />
            <circle
              r="7"
              fill="#FF4D1C"
              stroke="#FFFFFF"
              strokeWidth="2.5"
            />
          </g>
        )}
      </svg>

      {/* Top-left Mode & API Config Notice (placed cleanly without overlapping HUD right side) */}
      <div className="pointer-events-none absolute top-3 left-3 flex max-w-[calc(100%-1.5rem)] flex-col items-start gap-2 sm:max-w-md">
        <div className="pointer-events-auto inline-flex items-center gap-2 rounded-xl border border-white/15 bg-[#11161A]/88 px-3 py-1.5 text-xs backdrop-blur-md">
          <Compass className="h-3.5 w-3.5 shrink-0 text-[#FF5E33]" aria-hidden="true" />
          <span className="font-semibold text-white sm:hidden">GPX Topo</span>
          <span className="hidden font-semibold text-white sm:inline">
            Podgląd wektorowy GPX
          </span>
          <span
            className="h-2 w-2 rounded-full"
            style={{ backgroundColor: strokeColor }}
            title={trailColorMeta.label}
            aria-hidden="true"
          />
        </div>

        <p className="pointer-events-auto hidden rounded-xl border border-white/10 bg-[#11161A]/80 px-3 py-1.5 text-[11px] leading-snug text-white/70 backdrop-blur-md sm:block">
          Opcjonalnie: dodaj{" "}
          <code className="font-mono text-[#38BDF8]">
            NEXT_PUBLIC_GOOGLE_MAPS_API_KEY
          </code>
          , aby włączyć interaktywne kafelki Google Maps.
        </p>
      </div>

      {/* Selected POI Popover */}
      {selectedPoi && (
        <div className="absolute right-3 bottom-16 z-10 max-w-xs rounded-2xl border border-white/15 bg-[#11161A]/95 p-3.5 text-left shadow-xl backdrop-blur-md sm:bottom-16">
          <div className="flex items-start justify-between gap-2">
            <div>
              <p className="font-mono text-[10px] font-semibold uppercase tracking-wider text-[#38BDF8]">
                {getPoiLabel(selectedPoi.category)}
              </p>
              <h3 className="text-sm font-bold text-white">
                {selectedPoi.name}
              </h3>
            </div>
            <button
              type="button"
              onClick={() => setSelectedPoi(null)}
              aria-label="Zamknij opis punktu"
              className="inline-flex min-h-[44px] min-w-[44px] sm:min-h-[32px] sm:min-w-[32px] items-center justify-center rounded-lg text-white/70 hover:bg-white/10 hover:text-white"
            >
              <X className="h-4 w-4" aria-hidden="true" />
            </button>
          </div>
          {selectedPoi.description && (
            <p className="mt-1 text-xs leading-relaxed text-white/75">
              {selectedPoi.description}
            </p>
          )}
        </div>
      )}

      {/* Bottom Telemetry Strip + Direct Google Maps Link */}
      <div className="flex flex-wrap items-center justify-between gap-2 border-t border-white/10 bg-[#0D1114]/95 px-3 py-2.5 sm:px-4">
        <div className="flex flex-wrap items-center gap-x-4 gap-y-1 font-mono text-xs text-white/80 tabular-nums">
          <span className="inline-flex items-center gap-1.5">
            <MapPin className="h-3.5 w-3.5 text-[#16A34A]" aria-hidden="true" />
            <span>
              {formatCoordinate(displayCoords.lat, "lat")},{" "}
              {formatCoordinate(displayCoords.lng, "lng")}
            </span>
          </span>

          {activePoint && (
            <span className="inline-flex items-center gap-2 rounded-md bg-[#FF4D1C]/20 px-2 py-0.5 text-[#FF7A59]">
              {activePoint.distKm !== undefined && (
                <span>{formatDistance(activePoint.distKm)}</span>
              )}
              {activePoint.ele !== undefined && (
                <span>{Math.round(activePoint.ele)} m n.p.m.</span>
              )}
            </span>
          )}
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <a
            href={routeUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex min-h-[44px] sm:min-h-[36px] items-center gap-1.5 rounded-xl bg-[#FF4D1C] px-3 py-1.5 text-xs font-bold text-white transition-colors hover:bg-[#E03E12]"
          >
            <Navigation className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
            <span>Otwórz trasę w Google Maps</span>
            <ExternalLink className="h-3 w-3 shrink-0 opacity-80" aria-hidden="true" />
          </a>

          <a
            href={startNavUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex min-h-[44px] sm:min-h-[36px] items-center gap-1.5 rounded-xl border border-white/15 bg-white/10 px-2.5 py-1.5 text-xs font-semibold text-white transition-colors hover:bg-white/15"
          >
            <MapPin className="h-3.5 w-3.5 shrink-0 text-[#16A34A]" aria-hidden="true" />
            <span>Dojazd do startu</span>
          </a>
        </div>
      </div>
    </div>
  );
}
