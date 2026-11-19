"use client";

import { useId, useMemo, useRef, useState } from "react";
import { Mountain, TrendingDown, TrendingUp } from "lucide-react";
import { haversineDistanceKm } from "@/lib/gpx/parser";
import { cn } from "@/lib/utils/cn";
import { formatDistance, formatElevation } from "@/lib/utils/format";
import type { RoutePoint } from "@/types/trail";

export interface ElevationChartProps {
  routePoints: RoutePoint[];
  activePointIndex?: number | null;
  onHoverPoint?: (index: number | null) => void;
  className?: string;
}

interface ElevationSample {
  originalIndex: number;
  ele: number;
  distKm: number;
}

const SVG_WIDTH = 800;
const SVG_HEIGHT = 210;
const PAD_LEFT = 54;
const PAD_RIGHT = 20;
const PAD_TOP = 20;
const PAD_BOTTOM = 30;
const PLOT_WIDTH = SVG_WIDTH - PAD_LEFT - PAD_RIGHT;
const PLOT_HEIGHT = SVG_HEIGHT - PAD_TOP - PAD_BOTTOM;

function buildElevationSamples(
  routePoints: readonly RoutePoint[],
): ElevationSample[] {
  if (routePoints.length === 0) return [];

  const samples: ElevationSample[] = [];
  let cumulativeKm = 0;

  for (let i = 0; i < routePoints.length; i += 1) {
    const pt = routePoints[i];
    if (i > 0) {
      cumulativeKm += haversineDistanceKm(routePoints[i - 1], pt);
    }

    if (typeof pt.ele === "number" && Number.isFinite(pt.ele)) {
      const distKm =
        typeof pt.distKm === "number" && Number.isFinite(pt.distKm)
          ? pt.distKm
          : cumulativeKm;

      samples.push({
        originalIndex: i,
        ele: pt.ele,
        distKm,
      });
    }
  }

  return samples;
}

export function ElevationChart({
  routePoints,
  activePointIndex,
  onHoverPoint,
  className,
}: ElevationChartProps) {
  const gradientId = useId();
  const svgRef = useRef<SVGSVGElement | null>(null);
  const [internalIndex, setInternalIndex] = useState<number | null>(null);

  const samples = useMemo(
    () => buildElevationSamples(routePoints),
    [routePoints],
  );

  const chartStats = useMemo(() => {
    if (samples.length < 2) return null;

    let minEle = Infinity;
    let maxEle = -Infinity;
    let gainRaw = 0;

    for (let i = 0; i < samples.length; i += 1) {
      const ele = samples[i].ele;
      if (ele < minEle) minEle = ele;
      if (ele > maxEle) maxEle = ele;
      if (i > 0) {
        const delta = ele - samples[i - 1].ele;
        if (delta > 0) gainRaw += delta;
      }
    }

    const startDist = samples[0].distKm;
    const endDist = samples[samples.length - 1].distKm;
    const distSpan = Math.max(endDist - startDist, 0);

    const rawEleSpan = maxEle - minEle;
    const elePadding = Math.max(rawEleSpan * 0.14, 6);
    const yMin = Math.floor(minEle - elePadding);
    const yMax = Math.ceil(maxEle + elePadding);
    const ySpan = Math.max(yMax - yMin, 1);

    const coords = samples.map((sample, idx) => {
      const xRatio =
        distSpan > 0
          ? (sample.distKm - startDist) / distSpan
          : idx / Math.max(samples.length - 1, 1);
      const yRatio = (sample.ele - yMin) / ySpan;

      const x = PAD_LEFT + xRatio * PLOT_WIDTH;
      const y = PAD_TOP + (1 - yRatio) * PLOT_HEIGHT;

      return {
        ...sample,
        x: Math.round(x * 10) / 10,
        y: Math.round(y * 10) / 10,
      };
    });

    const linePath = coords
      .map((pt, idx) => `${idx === 0 ? "M" : "L"} ${pt.x} ${pt.y}`)
      .join(" ");

    const baselineY = PAD_TOP + PLOT_HEIGHT;
    const firstX = coords[0].x;
    const lastX = coords[coords.length - 1].x;
    const areaPath = `${linePath} L ${lastX} ${baselineY} L ${firstX} ${baselineY} Z`;

    return {
      minEle: Math.round(minEle),
      maxEle: Math.round(maxEle),
      midEle: Math.round((minEle + maxEle) / 2),
      gainM: Math.round(gainRaw),
      startDist,
      endDist,
      distSpan,
      yMin,
      yMax,
      coords,
      linePath,
      areaPath,
    };
  }, [samples]);

  // Hide gracefully when fewer than 2 points have elevation data
  if (!chartStats) {
    return null;
  }

  const effectiveIndex =
    activePointIndex !== undefined ? activePointIndex : internalIndex;

  const activeSample =
    effectiveIndex !== null && effectiveIndex !== undefined
      ? (chartStats.coords.find((c) => c.originalIndex === effectiveIndex) ??
        null)
      : null;

  const updateActiveFromClientX = (clientX: number) => {
    const svgEl = svgRef.current;
    const rect = svgEl?.getBoundingClientRect();

    let svgX: number;
    if (rect && rect.width > 0) {
      svgX = ((clientX - rect.left) / rect.width) * SVG_WIDTH;
    } else {
      // Fallback for JSDOM test environments where getBoundingClientRect().width === 0
      svgX = clientX;
    }

    const clampedRatio = Math.max(
      0,
      Math.min(1, (svgX - PAD_LEFT) / PLOT_WIDTH),
    );

    let nearest = chartStats.coords[0];
    if (chartStats.distSpan > 0) {
      const targetDist =
        chartStats.startDist + clampedRatio * chartStats.distSpan;
      let minDiff = Math.abs(nearest.distKm - targetDist);
      for (let i = 1; i < chartStats.coords.length; i += 1) {
        const diff = Math.abs(chartStats.coords[i].distKm - targetDist);
        if (diff < minDiff) {
          minDiff = diff;
          nearest = chartStats.coords[i];
        }
      }
    } else {
      const idx = Math.round(clampedRatio * (chartStats.coords.length - 1));
      nearest = chartStats.coords[idx];
    }

    setInternalIndex(nearest.originalIndex);
    onHoverPoint?.(nearest.originalIndex);
  };

  const clearHover = () => {
    setInternalIndex(null);
    onHoverPoint?.(null);
  };

  const handleKeyDown = (event: React.KeyboardEvent<SVGSVGElement>) => {
    if (event.key !== "ArrowLeft" && event.key !== "ArrowRight" && event.key !== "Escape") {
      return;
    }

    if (event.key === "Escape") {
      clearHover();
      return;
    }

    event.preventDefault();
    const currentPos = activeSample
      ? chartStats.coords.findIndex(
          (item) => item.originalIndex === activeSample.originalIndex,
        )
      : -1;

    const delta = event.key === "ArrowRight" ? 1 : -1;
    const nextPos =
      currentPos === -1
        ? event.key === "ArrowRight"
          ? 0
          : chartStats.coords.length - 1
        : Math.max(
            0,
            Math.min(chartStats.coords.length - 1, currentPos + delta),
          );

    const nextSample = chartStats.coords[nextPos];
    setInternalIndex(nextSample.originalIndex);
    onHoverPoint?.(nextSample.originalIndex);
  };

  const tooltipWidth = 148;
  const tooltipHeight = 36;
  const tooltipX = activeSample
    ? Math.max(
        PAD_LEFT + 4,
        Math.min(
          SVG_WIDTH - PAD_RIGHT - tooltipWidth,
          activeSample.x - tooltipWidth / 2,
        ),
      )
    : 0;
  const tooltipY = activeSample
    ? activeSample.y > PAD_TOP + 46
      ? activeSample.y - tooltipHeight - 12
      : activeSample.y + 12
    : 0;

  return (
    <div
      data-testid="elevation-chart"
      className={cn(
        "rounded-2xl border border-[var(--border-subtle)] bg-[var(--bg-surface)] p-4 shadow-sm sm:p-5",
        className,
      )}
    >
      {/* Header Telemetry Bar */}
      <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <span className="inline-flex h-8 w-8 items-center justify-center rounded-xl bg-[var(--accent-telemetry)]/15 text-[var(--accent-telemetry)]">
            <Mountain className="h-4 w-4" aria-hidden="true" />
          </span>
          <div>
            <h3 className="font-display text-lg font-bold uppercase tracking-wide text-[var(--text-primary)] leading-none">
              Profil wysokościowy
            </h3>
            <p className="mt-0.5 text-xs text-[var(--text-secondary)]">
              Najedź lub dotknij wykresu, aby zsynchronizować pozycję na mapie
            </p>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2 font-mono text-xs tabular-nums">
          {activeSample ? (
            <span
              data-testid="elevation-active-readout"
              className="inline-flex items-center gap-2 rounded-xl bg-[#11161A] px-3 py-1.5 font-semibold text-white shadow-sm"
            >
              <span className="text-[#FF5E33]">
                {formatDistance(activeSample.distKm)}
              </span>
              <span className="text-white/40">·</span>
              <span>{Math.round(activeSample.ele)} m n.p.m.</span>
            </span>
          ) : null}

          <span className="inline-flex items-center gap-1 rounded-xl bg-[var(--bg-surface-muted)] px-2.5 py-1.5 text-[var(--text-secondary)]">
            <TrendingDown className="h-3.5 w-3.5 text-[var(--accent-telemetry)]" aria-hidden="true" />
            Min: <strong className="text-[var(--text-primary)]">{chartStats.minEle} m</strong>
          </span>

          <span className="inline-flex items-center gap-1 rounded-xl bg-[var(--bg-surface-muted)] px-2.5 py-1.5 text-[var(--text-secondary)]">
            <TrendingUp className="h-3.5 w-3.5 text-[var(--accent-primary)]" aria-hidden="true" />
            Max: <strong className="text-[var(--text-primary)]">{chartStats.maxEle} m</strong>
          </span>

          <span className="inline-flex items-center gap-1 rounded-xl bg-[var(--accent-primary)]/10 px-2.5 py-1.5 font-semibold text-[var(--accent-primary)]">
            {formatElevation(chartStats.gainM)}
          </span>
        </div>
      </div>

      {/* Interactive SVG Area Chart */}
      <div className="relative w-full">
        <svg
          ref={svgRef}
          data-testid="elevation-chart-svg"
          viewBox={`0 0 ${SVG_WIDTH} ${SVG_HEIGHT}`}
          role="img"
          tabIndex={0}
          aria-label={`Profil wysokościowy trasy od ${chartStats.minEle} m do ${chartStats.maxEle} m n.p.m.`}
          className="h-44 w-full touch-pan-y select-none overflow-visible rounded-xl focus-visible:outline-2 focus-visible:outline-[var(--accent-primary)] sm:h-52"
          onMouseMove={(e) => updateActiveFromClientX(e.clientX)}
          onMouseLeave={clearHover}
          onTouchStart={(e) => {
            if (e.touches[0]) updateActiveFromClientX(e.touches[0].clientX);
          }}
          onTouchMove={(e) => {
            if (e.touches[0]) updateActiveFromClientX(e.touches[0].clientX);
          }}
          onTouchEnd={clearHover}
          onKeyDown={handleKeyDown}
        >
          <defs>
            <linearGradient id={gradientId} x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#FF4D1C" stopOpacity="0.42" />
              <stop offset="55%" stopColor="#0284C7" stopOpacity="0.18" />
              <stop offset="100%" stopColor="#0284C7" stopOpacity="0.02" />
            </linearGradient>
          </defs>

          {/* Horizontal reference gridlines & Y-axis labels */}
          {[
            { ele: chartStats.maxEle, y: PAD_TOP + 6 },
            { ele: chartStats.midEle, y: PAD_TOP + PLOT_HEIGHT / 2 },
            { ele: chartStats.minEle, y: PAD_TOP + PLOT_HEIGHT },
          ].map((tick, idx) => (
            <g key={`${tick.ele}-${idx}`}>
              <line
                x1={PAD_LEFT}
                y1={tick.y}
                x2={SVG_WIDTH - PAD_RIGHT}
                y2={tick.y}
                stroke="currentColor"
                strokeOpacity="0.12"
                strokeDasharray="4 4"
              />
              <text
                x={PAD_LEFT - 8}
                y={tick.y + 4}
                textAnchor="end"
                fill="currentColor"
                opacity="0.62"
                fontSize="11"
                fontFamily="ui-monospace, SFMono-Regular, monospace"
              >
                {tick.ele} m
              </text>
            </g>
          ))}

          {/* X-axis distance labels */}
          {[
            { label: "0 km", x: PAD_LEFT, anchor: "start" as const },
            {
              label: formatDistance(chartStats.endDist / 2),
              x: PAD_LEFT + PLOT_WIDTH / 2,
              anchor: "middle" as const,
            },
            {
              label: formatDistance(chartStats.endDist),
              x: SVG_WIDTH - PAD_RIGHT,
              anchor: "end" as const,
            },
          ].map((tick, idx) => (
            <text
              key={`${tick.label}-${idx}`}
              x={tick.x}
              y={SVG_HEIGHT - 8}
              textAnchor={tick.anchor}
              fill="currentColor"
              opacity="0.62"
              fontSize="11"
              fontFamily="ui-monospace, SFMono-Regular, monospace"
            >
              {tick.label}
            </text>
          ))}

          {/* Gradient Area + Elevation Curve */}
          <path d={chartStats.areaPath} fill={`url(#${gradientId})`} />
          <path
            d={chartStats.linePath}
            fill="none"
            stroke="#FF4D1C"
            strokeWidth="2.75"
            strokeLinecap="round"
            strokeLinejoin="round"
          />

          {/* Active Cursor + Floating Tooltip */}
          {activeSample && (
            <g data-testid="elevation-chart-tooltip">
              <line
                x1={activeSample.x}
                y1={PAD_TOP}
                x2={activeSample.x}
                y2={PAD_TOP + PLOT_HEIGHT}
                stroke="#0284C7"
                strokeWidth="1.5"
                strokeDasharray="3 3"
              />
              <circle
                cx={activeSample.x}
                cy={activeSample.y}
                r="8"
                fill="#FF4D1C"
                fillOpacity="0.25"
              />
              <circle
                cx={activeSample.x}
                cy={activeSample.y}
                r="4.5"
                fill="#FF4D1C"
                stroke="#FFFFFF"
                strokeWidth="2"
              />
              <g transform={`translate(${tooltipX}, ${tooltipY})`}>
                <rect
                  width={tooltipWidth}
                  height={tooltipHeight}
                  rx="8"
                  fill="#11161A"
                  stroke="#334155"
                  strokeWidth="1"
                />
                <text
                  x={tooltipWidth / 2}
                  y="15"
                  textAnchor="middle"
                  fill="#FF7A59"
                  fontSize="11"
                  fontWeight="700"
                  fontFamily="ui-monospace, monospace"
                >
                  {formatDistance(activeSample.distKm)}
                </text>
                <text
                  x={tooltipWidth / 2}
                  y="29"
                  textAnchor="middle"
                  fill="#F8FAF7"
                  fontSize="11"
                  fontWeight="600"
                  fontFamily="ui-monospace, monospace"
                >
                  {Math.round(activeSample.ele)} m n.p.m.
                </text>
              </g>
            </g>
          )}
        </svg>
      </div>
    </div>
  );
}
