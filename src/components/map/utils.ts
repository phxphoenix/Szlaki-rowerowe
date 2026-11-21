import {
  TRAIL_COLOR_META,
  getRegionInfo,
  type RegionSlug,
  type TrailColor,
} from "@/lib/constants/regions";
import type { RouteBounds, RoutePoint, Trail, TrailPoi } from "@/types/trail";

export interface LatLngPoint {
  lat: number;
  lng: number;
}

export interface DirectionsTrailInput {
  title?: string;
  region?: RegionSlug;
  startLat?: number | null;
  startLng?: number | null;
  endLat?: number | null;
  endLng?: number | null;
  routePoints?: ReadonlyArray<Pick<RoutePoint, "lat" | "lng">>;
  isLoop?: boolean;
  googleMapsEmbedUrl?: string | null;
}

export interface DirectionsUrlOptions {
  origin?: LatLngPoint | null;
  waypoints?: ReadonlyArray<LatLngPoint>;
}

export interface ExtractWaypointsOptions {
  maxWaypoints?: number;
  isLoop?: boolean;
  minSpacingMeters?: number;
  minLoopEndpointMarginMeters?: number;
}

export interface BuildRouteUrlOptions {
  maxWaypoints?: number;
  forceDirections?: boolean;
}

const EARTH_RADIUS_METERS = 6_371_000;
const GOOGLE_MAPS_MAX_URL_LENGTH = 2000;

function isValidCoord(value: number | null | undefined): value is number {
  return typeof value === "number" && Number.isFinite(value);
}

function toRadians(deg: number): number {
  return (deg * Math.PI) / 180;
}

/**
 * Oblicza odległość geodezyjną (Haversine) w metrach między dwoma punktami.
 * Czysta implementacja bez zależności serwerowych (bezpieczna dla bundle klienta).
 */
export function haversineMeters(a: LatLngPoint, b: LatLngPoint): number {
  const dLat = toRadians(b.lat - a.lat);
  const dLng = toRadians(b.lng - a.lng);
  const lat1 = toRadians(a.lat);
  const lat2 = toRadians(b.lat);

  const sinLat = Math.sin(dLat / 2);
  const sinLng = Math.sin(dLng / 2);
  const h =
    sinLat * sinLat + Math.cos(lat1) * Math.cos(lat2) * sinLng * sinLng;
  const c = 2 * Math.atan2(Math.sqrt(h), Math.sqrt(Math.max(0, 1 - h)));
  return EARTH_RADIUS_METERS * c;
}

function formatLatLngParam(point: LatLngPoint): string {
  const lat = Number(point.lat.toFixed(6));
  const lng = Number(point.lng.toFixed(6));
  return `${lat},${lng}`;
}

function resolveStartPoint(trail: DirectionsTrailInput): LatLngPoint | null {
  if (isValidCoord(trail.startLat) && isValidCoord(trail.startLng)) {
    return { lat: trail.startLat, lng: trail.startLng };
  }
  if (trail.routePoints && trail.routePoints.length > 0) {
    const first = trail.routePoints[0];
    if (isValidCoord(first.lat) && isValidCoord(first.lng)) {
      return { lat: first.lat, lng: first.lng };
    }
  }
  if (isValidCoord(trail.endLat) && isValidCoord(trail.endLng)) {
    return { lat: trail.endLat, lng: trail.endLng };
  }
  return null;
}

function resolveEndPoint(
  trail: DirectionsTrailInput,
  fallbackStart: LatLngPoint | null,
): LatLngPoint | null {
  if (isValidCoord(trail.endLat) && isValidCoord(trail.endLng)) {
    return { lat: trail.endLat, lng: trail.endLng };
  }
  if (trail.routePoints && trail.routePoints.length > 0) {
    for (let i = trail.routePoints.length - 1; i >= 0; i -= 1) {
      const pt = trail.routePoints[i];
      if (isValidCoord(pt.lat) && isValidCoord(pt.lng)) {
        return { lat: pt.lat, lng: pt.lng };
      }
    }
  }
  return fallbackStart;
}

/**
 * Wybiera równomiernie rozłożone po skumulowanym dystansie geodezyjnym
 * kluczowe punkty pośrednie (domyślnie maks. 9) z zachowaniem minimalnych odstępów.
 */
export function extractKeyRouteWaypoints(
  routePoints: ReadonlyArray<LatLngPoint>,
  options?: ExtractWaypointsOptions,
): LatLngPoint[] {
  const validPoints: LatLngPoint[] = [];
  for (const pt of routePoints) {
    if (isValidCoord(pt.lat) && isValidCoord(pt.lng)) {
      validPoints.push({ lat: pt.lat, lng: pt.lng });
    }
  }

  const n = validPoints.length;
  if (n < 2) {
    return [];
  }

  const isLoop = Boolean(options?.isLoop);
  const maxWaypoints = Math.max(
    0,
    Math.min(Math.floor(options?.maxWaypoints ?? 9), 9),
  );
  if (maxWaypoints === 0) {
    return [];
  }

  const minSpacingMeters = Math.max(0, options?.minSpacingMeters ?? 150);
  const minLoopEndpointMarginMeters = Math.max(
    0,
    options?.minLoopEndpointMarginMeters ?? 200,
  );

  const cumMeters = new Array<number>(n);
  cumMeters[0] = 0;
  for (let i = 1; i < n; i += 1) {
    cumMeters[i] =
      cumMeters[i - 1] + haversineMeters(validPoints[i - 1], validPoints[i]);
  }
  const totalMeters = cumMeters[n - 1];
  if (totalMeters <= 0) {
    return [];
  }

  const startPoint = validPoints[0];
  const lastPoint = validPoints[n - 1];
  const startEndGap = haversineMeters(startPoint, lastPoint);
  const isOpenEndpointLoop = isLoop && startEndGap >= minLoopEndpointMarginMeters;

  if (!isLoop && n < 3) {
    return [];
  }

  if (isOpenEndpointLoop) {
    if (maxWaypoints === 1) {
      return [lastPoint];
    }

    const intermediateLimit = maxWaypoints - 1;
    const selected: LatLngPoint[] = [];
    let prevIdx = 0;

    for (let i = 1; i <= intermediateLimit; i += 1) {
      const targetDist = (i / (intermediateLimit + 1)) * totalMeters;
      let bestIdx = -1;
      let bestDiff = Infinity;

      for (let idx = prevIdx + 1; idx < n - 1; idx += 1) {
        const candidate = validPoints[idx];
        if (
          haversineMeters(candidate, startPoint) < minLoopEndpointMarginMeters
        ) {
          continue;
        }
        if (haversineMeters(candidate, lastPoint) < minSpacingMeters) {
          continue;
        }
        const prevAccepted = selected[selected.length - 1];
        if (
          prevAccepted &&
          haversineMeters(candidate, prevAccepted) < minSpacingMeters
        ) {
          continue;
        }

        const diff = Math.abs(cumMeters[idx] - targetDist);
        if (diff < bestDiff) {
          bestDiff = diff;
          bestIdx = idx;
        }
      }

      if (bestIdx !== -1) {
        selected.push(validPoints[bestIdx]);
        prevIdx = bestIdx;
      }
    }

    selected.push(lastPoint);
    return selected;
  }

  const endpointMargin = isLoop ? minLoopEndpointMarginMeters : minSpacingMeters;
  const selected: LatLngPoint[] = [];
  let prevIdx = 0;

  for (let i = 1; i <= maxWaypoints; i += 1) {
    const targetDist = (i / (maxWaypoints + 1)) * totalMeters;
    let bestIdx = -1;
    let bestDiff = Infinity;

    for (let idx = prevIdx + 1; idx < n - 1; idx += 1) {
      const candidate = validPoints[idx];
      if (haversineMeters(candidate, startPoint) < endpointMargin) {
        continue;
      }
      if (haversineMeters(candidate, lastPoint) < endpointMargin) {
        continue;
      }
      const prevAccepted = selected[selected.length - 1];
      if (
        prevAccepted &&
        haversineMeters(candidate, prevAccepted) < minSpacingMeters
      ) {
        continue;
      }

      const diff = Math.abs(cumMeters[idx] - targetDist);
      if (diff < bestDiff) {
        bestDiff = diff;
        bestIdx = idx;
      }
    }

    if (bestIdx !== -1) {
      selected.push(validPoints[bestIdx]);
      prevIdx = bestIdx;
    }
  }

  return selected;
}

/**
 * Sprawdza, czy podany URL jest poprawnym linkiem do mapy Google My Maps
 * (`mymaps.google.com` lub `google.*\/maps\/d\/...`).
 */
export function isGoogleMyMapsUrl(url: string | null | undefined): boolean {
  if (!url || typeof url !== "string") {
    return false;
  }
  const trimmed = url.trim();
  if (!trimmed) {
    return false;
  }

  try {
    const parsed = new URL(trimmed);
    if (parsed.protocol !== "https:" && parsed.protocol !== "http:") {
      return false;
    }
    if (parsed.username || parsed.password) {
      return false;
    }
    const host = parsed.hostname.toLowerCase();
    if (host === "mymaps.google.com") {
      return true;
    }
    if (
      /^(www\.|maps\.)?google\.([a-z]{2,3}|co\.[a-z]{2}|com\.[a-z]{2})$/i.test(
        host,
      ) &&
      /^\/maps\/d\/[^/]+/.test(parsed.pathname)
    ) {
      return true;
    }
    return false;
  } catch {
    return false;
  }
}

/**
 * Buduje link Google Maps nawigacji wyłącznie do punktu startowego trasy
 * (z bieżącej pozycji użytkownika: „Dojazd do startu”).
 */
export function buildGoogleMapsStartNavigationUrl(
  trail: DirectionsTrailInput,
): string {
  const url = new URL("https://www.google.com/maps/dir/");
  url.searchParams.set("api", "1");

  const startPoint = resolveStartPoint(trail);
  if (startPoint) {
    url.searchParams.set("destination", formatLatLngParam(startPoint));
  } else if (trail.region) {
    url.searchParams.set(
      "destination",
      formatLatLngParam(getRegionInfo(trail.region).center),
    );
  } else {
    url.searchParams.set("destination", trail.title?.trim() || "Polska");
  }

  url.searchParams.set("travelmode", "bicycling");
  return url.toString();
}

/**
 * Buduje link Google Maps do pełnej wyrysowanej trasy rowerowej
 * (lub zwraca link Google My Maps, jeśli jest skonfigurowany i nie wymuszono trybu directions).
 */
export function buildGoogleMapsRouteUrl(
  trail: DirectionsTrailInput,
  options?: BuildRouteUrlOptions,
): string {
  if (!options?.forceDirections && isGoogleMyMapsUrl(trail.googleMapsEmbedUrl)) {
    return trail.googleMapsEmbedUrl!.trim();
  }

  const routePoints = trail.routePoints ?? [];
  if (routePoints.length < 2) {
    return buildGoogleMapsStartNavigationUrl(trail);
  }

  const startPoint = resolveStartPoint(trail);
  const endPoint = resolveEndPoint(trail, startPoint);
  if (!startPoint || !endPoint) {
    return buildGoogleMapsStartNavigationUrl(trail);
  }

  const isLoop = Boolean(trail.isLoop);
  const destinationPoint = isLoop ? startPoint : endPoint;

  const buildWithMaxWaypoints = (limit: number): string => {
    const url = new URL("https://www.google.com/maps/dir/");
    url.searchParams.set("api", "1");
    url.searchParams.set("origin", formatLatLngParam(startPoint));
    url.searchParams.set("destination", formatLatLngParam(destinationPoint));

    if (limit > 0) {
      const waypoints = extractKeyRouteWaypoints(routePoints, {
        maxWaypoints: limit,
        isLoop,
      });
      if (waypoints.length > 0) {
        url.searchParams.set(
          "waypoints",
          waypoints.map(formatLatLngParam).join("|"),
        );
      }
    }

    url.searchParams.set("travelmode", "bicycling");
    return url.toString();
  };

  let currentMax = Math.max(
    0,
    Math.min(Math.floor(options?.maxWaypoints ?? 9), 9),
  );
  let builtUrl = buildWithMaxWaypoints(currentMax);

  while (builtUrl.length >= GOOGLE_MAPS_MAX_URL_LENGTH && currentMax > 0) {
    currentMax -= 1;
    builtUrl = buildWithMaxWaypoints(currentMax);
  }

  return builtUrl;
}

/**
 * Buduje link Google Maps Directions (`travelmode=bicycling`):
 * - gdy podano jawne `options.origin` lub `options.waypoints` — używa przekazanych parametrów,
 * - gdy trasa ma >= 2 punkty GPX — generuje pełną trasę (`origin`, `destination`, `waypoints`),
 * - w przeciwnym razie (np. pojedynczy punkt POI) — nawiguje do tego punktu.
 */
export function buildGoogleMapsDirectionsUrl(
  trail: DirectionsTrailInput,
  options?: DirectionsUrlOptions,
): string {
  const hasExplicitOverrides = Boolean(
    options?.origin || (options?.waypoints && options.waypoints.length > 0),
  );

  if (!hasExplicitOverrides) {
    if (trail.routePoints && trail.routePoints.length >= 2) {
      return buildGoogleMapsRouteUrl(trail, { forceDirections: true });
    }
    return buildGoogleMapsStartNavigationUrl(trail);
  }

  const url = new URL("https://www.google.com/maps/dir/");
  url.searchParams.set("api", "1");

  const startPoint = resolveStartPoint(trail);
  const endPoint = resolveEndPoint(trail, startPoint);

  if (
    options?.origin &&
    isValidCoord(options.origin.lat) &&
    isValidCoord(options.origin.lng)
  ) {
    url.searchParams.set("origin", formatLatLngParam(options.origin));
  }

  const destinationPoint = options?.origin ? (endPoint ?? startPoint) : startPoint;

  if (destinationPoint) {
    url.searchParams.set("destination", formatLatLngParam(destinationPoint));
  } else if (trail.region) {
    url.searchParams.set(
      "destination",
      formatLatLngParam(getRegionInfo(trail.region).center),
    );
  } else {
    url.searchParams.set("destination", trail.title?.trim() || "Polska");
  }

  if (options?.waypoints && options.waypoints.length > 0) {
    const validWaypoints = options.waypoints
      .filter((pt) => isValidCoord(pt.lat) && isValidCoord(pt.lng))
      .slice(0, 9);
    if (validWaypoints.length > 0) {
      url.searchParams.set(
        "waypoints",
        validWaypoints.map(formatLatLngParam).join("|"),
      );
    }
  }

  url.searchParams.set("travelmode", "bicycling");
  return url.toString();
}

/**
 * Mapuje kolor szlaku PTTK na kontrastowy kolor linii trasy na mapie.
 */
export function getTrailStrokeColor(
  trailColor: TrailColor | null | undefined,
): string {
  switch (trailColor) {
    case "red":
      return TRAIL_COLOR_META.red.hex;
    case "blue":
      return TRAIL_COLOR_META.blue.hex;
    case "green":
      return TRAIL_COLOR_META.green.hex;
    case "yellow":
      return TRAIL_COLOR_META.yellow.hex;
    case "black":
      return TRAIL_COLOR_META.black.hex;
    case "none":
    default:
      return TRAIL_COLOR_META.none.hex;
  }
}

/**
 * Dobiera kolor obwódki (casing) linii trasy dla maksymalnego kontrastu
 * na podkładzie terenowym, drogowym i satelitarnym.
 */
export function getTrailOutlineColor(
  trailColor: TrailColor | null | undefined,
): string {
  if (trailColor === "yellow") {
    return "#11161A";
  }
  return "#FFFFFF";
}

export function formatCoordinate(value: number, axis: "lat" | "lng"): string {
  const hemisphere =
    axis === "lat" ? (value >= 0 ? "N" : "S") : value >= 0 ? "E" : "W";
  return `${Math.abs(value).toFixed(4)}° ${hemisphere}`;
}

export interface RouteGeometrySummary {
  bounds: RouteBounds | null;
  center: LatLngPoint;
  startPoint: LatLngPoint | null;
  endPoint: LatLngPoint | null;
}

export function getRouteBoundsAndCenter(
  trail: Pick<
    Trail,
    | "region"
    | "bounds"
    | "routePoints"
    | "startLat"
    | "startLng"
    | "endLat"
    | "endLng"
  >,
): RouteGeometrySummary {
  const firstPoint = trail.routePoints[0];
  const lastPoint = trail.routePoints[trail.routePoints.length - 1];

  const startPoint: LatLngPoint | null =
    isValidCoord(trail.startLat) && isValidCoord(trail.startLng)
      ? { lat: trail.startLat, lng: trail.startLng }
      : firstPoint
        ? { lat: firstPoint.lat, lng: firstPoint.lng }
        : null;

  const endPoint: LatLngPoint | null =
    isValidCoord(trail.endLat) && isValidCoord(trail.endLng)
      ? { lat: trail.endLat, lng: trail.endLng }
      : lastPoint
        ? { lat: lastPoint.lat, lng: lastPoint.lng }
        : startPoint;

  let bounds: RouteBounds | null = trail.bounds ? { ...trail.bounds } : null;

  if (!bounds && trail.routePoints.length >= 2) {
    let north = -90;
    let south = 90;
    let east = -180;
    let west = 180;

    for (const pt of trail.routePoints) {
      if (pt.lat > north) north = pt.lat;
      if (pt.lat < south) south = pt.lat;
      if (pt.lng > east) east = pt.lng;
      if (pt.lng < west) west = pt.lng;
    }

    bounds = { north, south, east, west };
  }

  if (bounds) {
    return {
      bounds,
      center: {
        lat: (bounds.north + bounds.south) / 2,
        lng: (bounds.east + bounds.west) / 2,
      },
      startPoint,
      endPoint,
    };
  }

  if (startPoint) {
    return {
      bounds: null,
      center: startPoint,
      startPoint,
      endPoint,
    };
  }

  const regionCenter = getRegionInfo(trail.region).center;
  return {
    bounds: null,
    center: { ...regionCenter },
    startPoint: null,
    endPoint: null,
  };
}

export interface ProjectedPoint {
  x: number;
  y: number;
  point: RoutePoint;
  index: number;
}

export interface ProjectedPoi {
  x: number;
  y: number;
  poi: TrailPoi;
}

export interface SvgProjectionResult {
  pathD: string;
  points: ProjectedPoint[];
  pois: ProjectedPoi[];
  bounds: RouteBounds | null;
}

/**
 * Rzutuje punkty trasy GPX oraz punkty POI do współrzędnych płótna SVG
 * z zachowaniem proporcji geograficznych (korekta cos(lat)).
 */
export function projectRouteToSvg(
  routePoints: readonly RoutePoint[],
  pois: readonly TrailPoi[],
  options: { width: number; height: number; padding?: number },
): SvgProjectionResult {
  const { width, height, padding = 48 } = options;

  const allCoords: LatLngPoint[] = [
    ...routePoints.map((pt) => ({ lat: pt.lat, lng: pt.lng })),
    ...pois.map((poi) => ({ lat: poi.lat, lng: poi.lng })),
  ];

  if (allCoords.length === 0) {
    return { pathD: "", points: [], pois: [], bounds: null };
  }

  let north = -90;
  let south = 90;
  let east = -180;
  let west = 180;

  for (const pt of allCoords) {
    if (pt.lat > north) north = pt.lat;
    if (pt.lat < south) south = pt.lat;
    if (pt.lng > east) east = pt.lng;
    if (pt.lng < west) west = pt.lng;
  }

  const meanLat = (north + south) / 2;
  const lngScale = Math.max(0.2, Math.cos((meanLat * Math.PI) / 180));

  const rawWidth = Math.max((east - west) * lngScale, 0.004);
  const rawHeight = Math.max(north - south, 0.004);

  const usableWidth = Math.max(width - padding * 2, 10);
  const usableHeight = Math.max(height - padding * 2, 10);

  const scale = Math.min(usableWidth / rawWidth, usableHeight / rawHeight);
  const renderedWidth = rawWidth * scale;
  const renderedHeight = rawHeight * scale;

  const offsetX = (width - renderedWidth) / 2;
  const offsetY = (height - renderedHeight) / 2;

  const centerLng = (east + west) / 2;
  const centerLat = (north + south) / 2;

  const projectCoord = (lat: number, lng: number) => {
    const x =
      offsetX + renderedWidth / 2 + (lng - centerLng) * lngScale * scale;
    const y = offsetY + renderedHeight / 2 - (lat - centerLat) * scale;
    return {
      x: Math.round(x * 10) / 10,
      y: Math.round(y * 10) / 10,
    };
  };

  const projectedPoints: ProjectedPoint[] = routePoints.map((point, index) => {
    const { x, y } = projectCoord(point.lat, point.lng);
    return { x, y, point, index };
  });

  const pathD =
    projectedPoints.length >= 2
      ? projectedPoints
          .map((pt, idx) => `${idx === 0 ? "M" : "L"} ${pt.x} ${pt.y}`)
          .join(" ")
      : "";

  const projectedPois: ProjectedPoi[] = pois.map((poi) => {
    const { x, y } = projectCoord(poi.lat, poi.lng);
    return { x, y, poi };
  });

  return {
    pathD,
    points: projectedPoints,
    pois: projectedPois,
    bounds: { north, south, east, west },
  };
}
