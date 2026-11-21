import { useId } from "react";
import {
  getTrailOutlineColor,
  getTrailStrokeColor,
  projectRouteToSvg,
} from "@/components/map/utils";
import type { TrailColor } from "@/lib/constants/regions";
import { cn } from "@/lib/utils/cn";
import type { RoutePoint } from "@/types/trail";

export interface RouteMiniMapProps {
  points: ReadonlyArray<{ lat: number; lng: number }>;
  trailColor: TrailColor;
  isLoop: boolean;
  variant: "overlay" | "full";
  className?: string;
}

const OVERLAY_WIDTH = 120;
const OVERLAY_HEIGHT = 76;
const OVERLAY_PADDING = 12;

const FULL_WIDTH = 400;
const FULL_HEIGHT = 250;
const FULL_PADDING = 28;

export function RouteMiniMap({
  points,
  trailColor,
  isLoop,
  variant,
  className,
}: RouteMiniMapProps) {
  const rawId = useId();
  const safeId = rawId.replace(/[^a-zA-Z0-9_-]/g, "");

  const width = variant === "overlay" ? OVERLAY_WIDTH : FULL_WIDTH;
  const height = variant === "overlay" ? OVERLAY_HEIGHT : FULL_HEIGHT;
  const padding = variant === "overlay" ? OVERLAY_PADDING : FULL_PADDING;

  const routePoints: RoutePoint[] = points
    .filter(
      (point) =>
        Number.isFinite(point.lat) &&
        Number.isFinite(point.lng),
    )
    .map((point) => ({ lat: point.lat, lng: point.lng }));

  const projection = projectRouteToSvg(routePoints, [], {
    width,
    height,
    padding,
  });

  const hasValidRoute = routePoints.length >= 2 && Boolean(projection.pathD);

  if (variant === "overlay" && !hasValidRoute) {
    return null;
  }

  const strokeColor = getTrailStrokeColor(trailColor);
  const outlineColor = getTrailOutlineColor(trailColor);

  const startPoint = projection.points[0] ?? null;
  const endPoint =
    !isLoop && projection.points.length >= 2
      ? projection.points[projection.points.length - 1]
      : null;

  const glowId = `minimap-glow-${safeId}`;
  const gridId = `minimap-grid-${safeId}`;

  if (variant === "overlay") {
    return (
      <div
        data-testid="trail-card-route-minimap"
        data-variant="overlay"
        className={cn(
          "h-[60px] w-[96px] overflow-hidden rounded-xl border border-white/15 bg-[#11161A]/80 shadow-md backdrop-blur-md sm:h-[70px] sm:w-[112px]",
          className,
        )}
      >
        <svg
          viewBox={`0 0 ${OVERLAY_WIDTH} ${OVERLAY_HEIGHT}`}
          preserveAspectRatio="xMidYMid meet"
          aria-hidden="true"
          className="h-full w-full select-none"
        >
          <defs>
            <pattern
              id={gridId}
              width="20"
              height="20"
              patternUnits="userSpaceOnUse"
            >
              <path
                d="M 20 0 L 0 0 0 20"
                fill="none"
                stroke="#334155"
                strokeWidth="0.5"
                strokeOpacity="0.35"
              />
            </pattern>
          </defs>

          <rect
            width={OVERLAY_WIDTH}
            height={OVERLAY_HEIGHT}
            fill={`url(#${gridId})`}
          />

          <path
            d={projection.pathD}
            fill="none"
            stroke={outlineColor}
            strokeWidth={5}
            strokeOpacity={0.92}
            strokeLinecap="round"
            strokeLinejoin="round"
          />
          <path
            data-testid="trail-card-route-path"
            d={projection.pathD}
            fill="none"
            stroke={strokeColor}
            strokeWidth={2.75}
            strokeLinecap="round"
            strokeLinejoin="round"
          />

          {endPoint && (
            <circle
              cx={endPoint.x}
              cy={endPoint.y}
              r={3.8}
              fill="#E11D48"
              stroke="#FFFFFF"
              strokeWidth={1.4}
            />
          )}

          {startPoint && (
            <g>
              <circle
                cx={startPoint.x}
                cy={startPoint.y}
                r={6.2}
                fill="#16A34A"
                fillOpacity={0.28}
              />
              <circle
                cx={startPoint.x}
                cy={startPoint.y}
                r={3.8}
                fill="#16A34A"
                stroke="#FFFFFF"
                strokeWidth={1.4}
              />
            </g>
          )}
        </svg>
      </div>
    );
  }

  return (
    <div
      data-testid="trail-card-route-minimap"
      data-variant="full"
      className={cn(
        "relative overflow-hidden bg-[#11161A] text-[#F8FAF7]",
        className,
      )}
    >
      <svg
        viewBox={`0 0 ${FULL_WIDTH} ${FULL_HEIGHT}`}
        preserveAspectRatio="xMidYMid meet"
        role="img"
        aria-label={
          hasValidRoute
            ? "Podgląd wektorowy przebiegu trasy GPX"
            : "Brak śladu GPX"
        }
        className="h-full w-full select-none"
      >
        <defs>
          <radialGradient id={glowId} cx="50%" cy="50%" r="60%">
            <stop offset="0%" stopColor="#1E293B" stopOpacity="0.65" />
            <stop offset="100%" stopColor="#0D1114" stopOpacity="0.98" />
          </radialGradient>
          <pattern
            id={gridId}
            width="28"
            height="28"
            patternUnits="userSpaceOnUse"
          >
            <path
              d="M 28 0 L 0 0 0 28"
              fill="none"
              stroke="#334155"
              strokeWidth="0.6"
              strokeOpacity="0.35"
            />
          </pattern>
        </defs>

        <rect width={FULL_WIDTH} height={FULL_HEIGHT} fill={`url(#${glowId})`} />
        <rect width={FULL_WIDTH} height={FULL_HEIGHT} fill={`url(#${gridId})`} />

        <g fill="none" stroke="#475569" strokeOpacity="0.22" strokeWidth="1">
          <path d="M -20 195 C 70 160, 145 205, 235 155 C 310 112, 365 140, 425 105" />
          <path d="M -20 140 C 60 105, 140 150, 225 100 C 305 55, 355 82, 425 50" />
          <circle cx="320" cy="80" r="65" strokeDasharray="4 6" />
          <circle cx="85" cy="175" r="52" strokeDasharray="4 6" />
        </g>

        {hasValidRoute ? (
          <g>
            <path
              d={projection.pathD}
              fill="none"
              stroke={strokeColor}
              strokeWidth={10}
              strokeOpacity={0.2}
              strokeLinecap="round"
              strokeLinejoin="round"
            />
            <path
              d={projection.pathD}
              fill="none"
              stroke={outlineColor}
              strokeWidth={6.5}
              strokeOpacity={0.92}
              strokeLinecap="round"
              strokeLinejoin="round"
            />
            <path
              data-testid="trail-card-route-path"
              d={projection.pathD}
              fill="none"
              stroke={strokeColor}
              strokeWidth={3.6}
              strokeLinecap="round"
              strokeLinejoin="round"
            />

            {endPoint && (
              <circle
                cx={endPoint.x}
                cy={endPoint.y}
                r={6}
                fill="#E11D48"
                stroke="#FFFFFF"
                strokeWidth={2}
              />
            )}

            {startPoint && (
              <g>
                <circle
                  cx={startPoint.x}
                  cy={startPoint.y}
                  r={10}
                  fill="#16A34A"
                  fillOpacity={0.25}
                />
                <circle
                  cx={startPoint.x}
                  cy={startPoint.y}
                  r={6}
                  fill="#16A34A"
                  stroke="#FFFFFF"
                  strokeWidth={2}
                />
              </g>
            )}
          </g>
        ) : (
          <g transform={`translate(${FULL_WIDTH / 2}, ${FULL_HEIGHT / 2})`}>
            <circle
              r="26"
              fill={strokeColor}
              fillOpacity="0.18"
              stroke={strokeColor}
              strokeWidth="2"
              strokeDasharray="5 5"
            />
            <circle r="5.5" fill={strokeColor} />
            <text
              y="44"
              textAnchor="middle"
              fill="#CBD5E1"
              fontSize="12"
              fontWeight="600"
            >
              Brak śladu GPX
            </text>
          </g>
        )}
      </svg>
    </div>
  );
}
