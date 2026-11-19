"use client";

import { useEffect, useState } from "react";
import {
  Compass,
  Layers,
  LocateFixed,
  Map as MapIcon,
  Maximize2,
  Minimize2,
  Mountain,
  Satellite,
} from "lucide-react";
import { TRAIL_COLOR_META } from "@/lib/constants/regions";
import { cn } from "@/lib/utils/cn";
import type { Trail } from "@/types/trail";
import { ElevationChart } from "@/components/map/ElevationChart";
import { MapActionsBar } from "@/components/map/MapActionsBar";
import {
  TrailGoogleMap,
  type MapTypeOption,
} from "@/components/map/TrailGoogleMap";

export interface TrailMapSectionProps {
  trail: Trail;
  apiKey?: string;
  mapId?: string;
}

const MAP_TYPE_OPTIONS: Array<{
  id: MapTypeOption;
  label: string;
  icon: typeof Mountain;
}> = [
  { id: "terrain", label: "Teren", icon: Mountain },
  { id: "roadmap", label: "Mapa", icon: MapIcon },
  { id: "hybrid", label: "Satelita", icon: Satellite },
];

export function TrailMapSection({
  trail,
  apiKey,
  mapId,
}: TrailMapSectionProps) {
  const [mapTypeId, setMapTypeId] = useState<MapTypeOption>("terrain");
  const [activePointIndex, setActivePointIndex] = useState<number | null>(null);
  const [recenterTrigger, setRecenterTrigger] = useState(0);
  const [isFullscreen, setIsFullscreen] = useState(false);

  const trailColorMeta = TRAIL_COLOR_META[trail.trailColor];

  useEffect(() => {
    if (!isFullscreen) return;

    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setIsFullscreen(false);
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => {
      document.body.style.overflow = previousOverflow;
      window.removeEventListener("keydown", handleKeyDown);
    };
  }, [isFullscreen]);

  const handleRecenter = () => {
    setActivePointIndex(null);
    setRecenterTrigger((prev) => prev + 1);
  };

  return (
    <section
      aria-labelledby="trail-map-heading"
      className="space-y-4"
    >
      {/* Map Section Header */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2.5">
          <span className="inline-flex h-9 w-9 items-center justify-center rounded-xl bg-[var(--accent-primary)]/12 text-[var(--accent-primary)]">
            <Compass className="h-5 w-5" aria-hidden="true" />
          </span>
          <div>
            <h2
              id="trail-map-heading"
              className="font-display text-2xl font-bold uppercase tracking-wide text-[var(--text-primary)] leading-none sm:text-3xl"
            >
              Interaktywna mapa trasy
            </h2>
            <p className="mt-1 text-xs text-[var(--text-secondary)] sm:text-sm">
              Przebieg śladu GPX, punkty szczególne (POI) i profil wysokościowy
            </p>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <span className="inline-flex items-center gap-1.5 rounded-full border border-[var(--border-subtle)] bg-[var(--bg-surface)] px-3 py-1 text-xs font-semibold text-[var(--text-primary)]">
            <span
              className="h-2.5 w-2.5 rounded-full ring-1 ring-black/15"
              style={{ backgroundColor: trailColorMeta.hex }}
              aria-hidden="true"
            />
            {trailColorMeta.label}
          </span>

          {trail.routePoints.length >= 2 && (
            <span className="inline-flex items-center gap-1 rounded-full border border-[var(--border-subtle)] bg-[var(--bg-surface-muted)] px-3 py-1 font-mono text-xs font-medium text-[var(--text-secondary)] tabular-nums">
              <Layers className="h-3.5 w-3.5 text-[var(--accent-telemetry)]" aria-hidden="true" />
              {trail.routePoints.length} pkt GPX
            </span>
          )}
        </div>
      </div>

      {/* Central Map Container (Normal vs Fullscreen) */}
      <div
        className={cn(
          "relative overflow-hidden border border-[var(--border-subtle)] bg-[#11161A] shadow-md transition-all",
          isFullscreen
            ? "fixed inset-0 z-50 h-dvh w-screen rounded-none border-0 safe-top safe-bottom"
            : "h-[420px] w-full rounded-3xl md:h-[540px]",
        )}
      >
        {/* Floating Map HUD */}
        <div
          role="toolbar"
          aria-label="Narzędzia mapy"
          className="pointer-events-none absolute top-3 right-3 z-20 flex max-w-[calc(100%-7.5rem)] flex-wrap items-center justify-end gap-1.5 sm:max-w-none sm:gap-2"
        >
          {/* Map Type Switcher: Teren / Mapa / Satelita */}
          <div className="pointer-events-auto inline-flex items-center rounded-xl border border-white/15 bg-[#11161A]/88 p-1 shadow-lg backdrop-blur-md">
            {MAP_TYPE_OPTIONS.map((option) => {
              const Icon = option.icon;
              const isActive = mapTypeId === option.id;
              return (
                <button
                  key={option.id}
                  type="button"
                  onClick={() => setMapTypeId(option.id)}
                  aria-pressed={isActive}
                  className={cn(
                    "inline-flex min-h-[44px] cursor-pointer items-center gap-1 rounded-lg px-2 text-[11px] font-semibold transition-colors sm:min-h-[36px] sm:px-2.5 sm:text-xs",
                    isActive
                      ? "bg-[#FF4D1C] text-white shadow-sm"
                      : "text-white/80 hover:bg-white/10 hover:text-white",
                  )}
                >
                  <Icon className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
                  <span>{option.label}</span>
                </button>
              );
            })}
          </div>

          {/* Recenter + Fullscreen controls */}
          <div className="pointer-events-auto inline-flex items-center gap-1.5">
            <button
              type="button"
              onClick={handleRecenter}
              title="Wyśrodkuj trasę"
              aria-label="Wyśrodkuj trasę"
              className="inline-flex min-h-[44px] min-w-[44px] cursor-pointer items-center justify-center gap-1.5 rounded-xl border border-white/15 bg-[#11161A]/88 px-2.5 text-xs font-semibold text-white shadow-lg backdrop-blur-md transition-colors hover:bg-[#1C242B] sm:min-h-[42px] sm:px-3"
            >
              <LocateFixed
                className="h-4 w-4 text-[#FF5E33]"
                aria-hidden="true"
              />
              <span className="hidden lg:inline">Wyśrodkuj trasę</span>
            </button>

            <button
              type="button"
              onClick={() => setIsFullscreen((prev) => !prev)}
              title={isFullscreen ? "Wyjdź z pełnego ekranu" : "Pełny ekran"}
              aria-label={
                isFullscreen ? "Zamknij pełny ekran mapy" : "Pełny ekran mapy"
              }
              aria-pressed={isFullscreen}
              className="inline-flex min-h-[44px] min-w-[44px] cursor-pointer items-center justify-center gap-1.5 rounded-xl border border-white/15 bg-[#11161A]/88 px-2.5 text-xs font-semibold text-white shadow-lg backdrop-blur-md transition-colors hover:bg-[#1C242B] sm:min-h-[42px] sm:px-3"
            >
              {isFullscreen ? (
                <>
                  <Minimize2
                    className="h-4 w-4 text-[#FF5E33]"
                    aria-hidden="true"
                  />
                  <span className="hidden sm:inline">Zamknij</span>
                </>
              ) : (
                <>
                  <Maximize2 className="h-4 w-4" aria-hidden="true" />
                  <span className="hidden lg:inline">Pełny ekran</span>
                </>
              )}
            </button>
          </div>
        </div>

        {/* Google Maps or Topographic Vector Fallback */}
        <TrailGoogleMap
          trail={trail}
          apiKey={apiKey}
          mapId={mapId}
          mapTypeId={mapTypeId}
          activePointIndex={activePointIndex}
          recenterTrigger={recenterTrigger}
          className="h-full w-full"
        />
      </div>

      {/* Synchronized Elevation Profile */}
      <ElevationChart
        routePoints={trail.routePoints}
        activePointIndex={activePointIndex}
        onHoverPoint={setActivePointIndex}
      />

      {/* Field Actions Bar (sticky bottom on iPhone, inline on desktop) */}
      <MapActionsBar trail={trail} />
    </section>
  );
}
