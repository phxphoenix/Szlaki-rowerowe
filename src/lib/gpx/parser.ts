import { XMLParser, XMLValidator } from "fast-xml-parser";
import {
  DEFAULT_MAX_ROUTE_POINTS,
  simplifyRoutePoints,
} from "@/lib/gpx/simplify";
import type { RouteBounds, RoutePoint } from "@/types/trail";

const EARTH_RADIUS_KM = 6371;
const DEG_TO_RAD = Math.PI / 180;
const LOOP_THRESHOLD_KM = 0.3;

export class GpxParseError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "GpxParseError";
  }
}

export interface ParseGpxOptions {
  maxPoints?: number;
}

export interface ParsedGpxResult {
  name?: string;
  distanceKm: number;
  elevationGainM: number;
  hasElevation: boolean;
  bounds: RouteBounds;
  startLat: number;
  startLng: number;
  endLat: number;
  endLng: number;
  isLoop: boolean;
  routePoints: RoutePoint[];
  originalPointCount: number;
}

export function haversineDistanceKm(
  a: Pick<RoutePoint, "lat" | "lng">,
  b: Pick<RoutePoint, "lat" | "lng">,
): number {
  const dLat = (b.lat - a.lat) * DEG_TO_RAD;
  const dLng = (b.lng - a.lng) * DEG_TO_RAD;
  const lat1 = a.lat * DEG_TO_RAD;
  const lat2 = b.lat * DEG_TO_RAD;

  const sinDLat = Math.sin(dLat / 2);
  const sinDLng = Math.sin(dLng / 2);
  const h =
    sinDLat * sinDLat + Math.cos(lat1) * Math.cos(lat2) * sinDLng * sinDLng;
  const c = 2 * Math.atan2(Math.sqrt(h), Math.sqrt(1 - h));

  return EARTH_RADIUS_KM * c;
}

function toArray<T>(value: T | T[] | undefined | null): T[] {
  if (value === undefined || value === null) return [];
  return Array.isArray(value) ? value : [value];
}

function extractText(value: unknown): string | undefined {
  if (typeof value === "string") {
    const trimmed = value.trim();
    return trimmed.length > 0 ? trimmed : undefined;
  }
  if (typeof value === "number" && Number.isFinite(value)) {
    return String(value);
  }
  if (value && typeof value === "object" && "#text" in value) {
    return extractText((value as Record<string, unknown>)["#text"]);
  }
  return undefined;
}

function parseFiniteNumber(value: unknown): number | null {
  if (typeof value === "number") {
    return Number.isFinite(value) ? value : null;
  }
  const text = extractText(value);
  if (!text) return null;
  const parsed = Number(text);
  return Number.isFinite(parsed) ? parsed : null;
}

function parseXmlPoint(node: unknown): RoutePoint | null {
  if (!node || typeof node !== "object") return null;
  const record = node as Record<string, unknown>;
  const lat = parseFiniteNumber(record["@_lat"]);
  const lng = parseFiniteNumber(record["@_lon"] ?? record["@_lng"]);

  if (lat === null || lng === null) return null;
  if (lat < -90 || lat > 90 || lng < -180 || lng > 180) return null;

  const ele = parseFiniteNumber(record.ele);
  if (ele !== null) {
    return { lat, lng, ele };
  }
  return { lat, lng };
}

function extractTrackPoints(gpxNode: Record<string, unknown>): {
  points: RoutePoint[];
  name?: string;
} {
  const tracks = toArray(gpxNode.trk);
  const points: RoutePoint[] = [];
  let trackName: string | undefined;

  for (const track of tracks) {
    if (!track || typeof track !== "object") continue;
    const trackRecord = track as Record<string, unknown>;
    if (!trackName) {
      trackName = extractText(trackRecord.name);
    }

    const segments = toArray(trackRecord.trkseg);
    for (const segment of segments) {
      if (!segment || typeof segment !== "object") continue;
      const segmentRecord = segment as Record<string, unknown>;
      const trkpts = toArray(segmentRecord.trkpt);
      for (const rawPt of trkpts) {
        const parsed = parseXmlPoint(rawPt);
        if (parsed) points.push(parsed);
      }
    }
  }

  return { points, name: trackName };
}

function extractRoutePoints(gpxNode: Record<string, unknown>): {
  points: RoutePoint[];
  name?: string;
} {
  const routes = toArray(gpxNode.rte);
  const points: RoutePoint[] = [];
  let routeName: string | undefined;

  for (const route of routes) {
    if (!route || typeof route !== "object") continue;
    const routeRecord = route as Record<string, unknown>;
    if (!routeName) {
      routeName = extractText(routeRecord.name);
    }

    const rtepts = toArray(routeRecord.rtept);
    for (const rawPt of rtepts) {
      const parsed = parseXmlPoint(rawPt);
      if (parsed) points.push(parsed);
    }
  }

  return { points, name: routeName };
}

const gpxXmlParser = new XMLParser({
  ignoreAttributes: false,
  attributeNamePrefix: "@_",
  parseAttributeValue: false,
  parseTagValue: false,
  trimValues: true,
  removeNSPrefix: true,
  isArray: (tagName) =>
    tagName === "trk" ||
    tagName === "trkseg" ||
    tagName === "trkpt" ||
    tagName === "rte" ||
    tagName === "rtept",
});

/**
 * Parsuje treść pliku GPX (`<trkpt>` lub `<rtept>`), wylicza metryki geodezyjne
 * na pełnym śladzie i zwraca uproszczoną tablicę punktów trasy (domyślnie max 500 pkt).
 */
export function parseGpx(
  xmlContent: string,
  options?: ParseGpxOptions,
): ParsedGpxResult {
  if (typeof xmlContent !== "string" || xmlContent.trim().length === 0) {
    throw new GpxParseError("Plik GPX jest pusty.");
  }

  const trimmedXml = xmlContent.trim();
  const validationResult = XMLValidator.validate(trimmedXml, {
    allowBooleanAttributes: true,
  });

  if (validationResult !== true) {
    throw new GpxParseError(
      `Niepoprawna składnia pliku XML/GPX (linia ${validationResult.err.line}).`,
    );
  }

  let parsedDoc: unknown;
  try {
    parsedDoc = gpxXmlParser.parse(trimmedXml);
  } catch {
    throw new GpxParseError("Nie udało się sparsować pliku XML/GPX.");
  }

  if (!parsedDoc || typeof parsedDoc !== "object") {
    throw new GpxParseError("Plik nie zawiera poprawnego dokumentu GPX.");
  }

  const rootGpx = (parsedDoc as Record<string, unknown>).gpx;
  if (!rootGpx || typeof rootGpx !== "object") {
    throw new GpxParseError("Brak głównego elementu <gpx> w przesłanym pliku.");
  }

  const gpxNode = rootGpx as Record<string, unknown>;
  const trackResult = extractTrackPoints(gpxNode);
  const routeResult =
    trackResult.points.length >= 2
      ? { points: [] as RoutePoint[], name: undefined }
      : extractRoutePoints(gpxNode);

  const rawPoints =
    trackResult.points.length >= 2 ? trackResult.points : routeResult.points;

  if (rawPoints.length < 2) {
    throw new GpxParseError(
      "Plik GPX musi zawierać co najmniej 2 poprawne punkty trasy (<trkpt> lub <rtept>).",
    );
  }

  const metadataRecord =
    gpxNode.metadata && typeof gpxNode.metadata === "object"
      ? (gpxNode.metadata as Record<string, unknown>)
      : undefined;
  const metadataName = metadataRecord
    ? extractText(metadataRecord.name)
    : undefined;
  const name = trackResult.name ?? metadataName ?? routeResult.name;

  let cumulativeKm = 0;
  let elevationGainRaw = 0;
  let pointsWithElevation = rawPoints[0].ele !== undefined ? 1 : 0;

  let north = rawPoints[0].lat;
  let south = rawPoints[0].lat;
  let east = rawPoints[0].lng;
  let west = rawPoints[0].lng;

  const fullPoints: RoutePoint[] = [{ ...rawPoints[0], distKm: 0 }];

  for (let i = 1; i < rawPoints.length; i += 1) {
    const prev = rawPoints[i - 1];
    const curr = rawPoints[i];

    cumulativeKm += haversineDistanceKm(prev, curr);

    if (curr.lat > north) north = curr.lat;
    if (curr.lat < south) south = curr.lat;
    if (curr.lng > east) east = curr.lng;
    if (curr.lng < west) west = curr.lng;

    if (curr.ele !== undefined) {
      pointsWithElevation += 1;
    }

    if (prev.ele !== undefined && curr.ele !== undefined) {
      const elevationDelta = curr.ele - prev.ele;
      if (elevationDelta > 0) {
        elevationGainRaw += elevationDelta;
      }
    }

    fullPoints.push({
      ...curr,
      distKm: Math.round(cumulativeKm * 100) / 100,
    });
  }

  const hasElevation = pointsWithElevation >= 2;
  const elevationGainM = hasElevation ? Math.round(elevationGainRaw) : 0;
  const distanceKm = Math.round(cumulativeKm * 100) / 100;

  const firstPoint = fullPoints[0];
  const lastPoint = fullPoints[fullPoints.length - 1];
  const startEndDistanceKm = haversineDistanceKm(firstPoint, lastPoint);
  const isLoop =
    fullPoints.length >= 3 && startEndDistanceKm < LOOP_THRESHOLD_KM;

  const maxPoints = options?.maxPoints ?? DEFAULT_MAX_ROUTE_POINTS;
  const routePoints = simplifyRoutePoints(fullPoints, maxPoints);

  const result: ParsedGpxResult = {
    distanceKm,
    elevationGainM,
    hasElevation,
    bounds: { north, south, east, west },
    startLat: firstPoint.lat,
    startLng: firstPoint.lng,
    endLat: lastPoint.lat,
    endLng: lastPoint.lng,
    isLoop,
    routePoints,
    originalPointCount: fullPoints.length,
  };

  if (name) {
    result.name = name;
  }

  return result;
}

function escapeXml(value: string): string {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&apos;");
}

/**
 * Generuje poprawny plik GPX 1.1 XML na podstawie zapisanych punktów trasy.
 */
export function generateGpxXml(trail: {
  title: string;
  shortDescription?: string | null;
  routePoints: readonly RoutePoint[];
}): string {
  const safeTitle = escapeXml(trail.title.trim() || "Szlak rowerowy");
  const descLine =
    trail.shortDescription && trail.shortDescription.trim().length > 0
      ? `\n    <desc>${escapeXml(trail.shortDescription.trim())}</desc>`
      : "";

  const trackPointsXml = trail.routePoints
    .map((pt) => {
      const lat = pt.lat.toFixed(6);
      const lon = pt.lng.toFixed(6);
      if (pt.ele !== undefined && Number.isFinite(pt.ele)) {
        return `      <trkpt lat="${lat}" lon="${lon}">\n        <ele>${Math.round(pt.ele * 10) / 10}</ele>\n      </trkpt>`;
      }
      return `      <trkpt lat="${lat}" lon="${lon}" />`;
    })
    .join("\n");

  const trksegContent =
    trackPointsXml.length > 0 ? `\n${trackPointsXml}\n    ` : "";

  return `<?xml version="1.0" encoding="UTF-8"?>
<gpx version="1.1" creator="Szlaki Rowerowe — Velo Pulse" xmlns="http://www.topografix.com/GPX/1/1">
  <metadata>
    <name>${safeTitle}</name>${descLine}
  </metadata>
  <trk>
    <name>${safeTitle}</name>
    <trkseg>${trksegContent}</trkseg>
  </trk>
</gpx>
`;
}
