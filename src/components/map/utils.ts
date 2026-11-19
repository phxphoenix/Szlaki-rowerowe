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
}

export interface DirectionsUrlOptions {
  origin?: LatLngPoint | null;
  waypoints?: ReadonlyArray<LatLngPoint>;
}

function isValidCoord(value: number | null | undefined): value is number {
  return typeof value === "number" && Number.isFinite(value);
}

function formatLatLngParam(point: LatLngPoint): string {
  const lat = Number(point.lat.toFixed(6));
  const lng = Number(point.lng.toFixed(6));
  return `${lat},${lng}`;
}

/**
 * Buduje link Google Maps Directions (`travelmode=bicycling`) do punktu startu
 * trasy (lub pełnej trasy, jeśli przekazano `origin` / `waypoints`).
 */
export function buildGoogleMapsDirectionsUrl(
  trail: DirectionsTrailInput,
  options?: DirectionsUrlOptions,
): string {
  const url = new URL("https://www.google.com/maps/dir/");
  url.searchParams.set("api", "1");

  const startPoint: LatLngPoint | null =
    isValidCoord(trail.startLat) && isValidCoord(trail.startLng)
      ? { lat: trail.startLat, lng: trail.startLng }
      : trail.routePoints && trail.routePoints.length > 0
        ? { lat: trail.routePoints[0].lat, lng: trail.routePoints[0].lng }
        : isValidCoord(trail.endLat) && isValidCoord(trail.endLng)
          ? { lat: trail.endLat, lng: trail.endLng }
          : null;

  const lastRoutePoint =
    trail.routePoints && trail.routePoints.length > 0
      ? trail.routePoints[trail.routePoints.length - 1]
      : null;

  const endPoint: LatLngPoint | null =
    isValidCoord(trail.endLat) && isValidCoord(trail.endLng)
      ? { lat: trail.endLat, lng: trail.endLng }
      : lastRoutePoint
        ? { lat: lastRoutePoint.lat, lng: lastRoutePoint.lng }
        : startPoint;

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
