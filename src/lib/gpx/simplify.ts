import type { RoutePoint } from "@/types/trail";

export const DEFAULT_MAX_ROUTE_POINTS = 500;

const EARTH_RADIUS_METERS = 6_371_000;
const DEG_TO_RAD = Math.PI / 180;

interface ProjectedPoints {
  xs: Float64Array;
  ys: Float64Array;
}

function projectToLocalMeters(points: readonly RoutePoint[]): ProjectedPoints {
  const count = points.length;
  let latSum = 0;
  for (let i = 0; i < count; i += 1) {
    latSum += points[i].lat;
  }
  const cosRefLat = Math.cos((latSum / count) * DEG_TO_RAD);
  const xs = new Float64Array(count);
  const ys = new Float64Array(count);

  for (let i = 0; i < count; i += 1) {
    xs[i] = points[i].lng * DEG_TO_RAD * EARTH_RADIUS_METERS * cosRefLat;
    ys[i] = points[i].lat * DEG_TO_RAD * EARTH_RADIUS_METERS;
  }

  return { xs, ys };
}

function perpendicularDistanceMeters(
  xs: Float64Array,
  ys: Float64Array,
  pointIndex: number,
  startIndex: number,
  endIndex: number,
): number {
  const ax = xs[startIndex];
  const ay = ys[startIndex];
  const bx = xs[endIndex];
  const by = ys[endIndex];
  const px = xs[pointIndex];
  const py = ys[pointIndex];

  const dx = bx - ax;
  const dy = by - ay;

  if (dx === 0 && dy === 0) {
    return Math.hypot(px - ax, py - ay);
  }

  const areaTwice = Math.abs(dy * px - dx * py + bx * ay - by * ax);
  return areaTwice / Math.hypot(dx, dy);
}

function runDouglasPeuckerMask(
  xs: Float64Array,
  ys: Float64Array,
  toleranceMeters: number,
): { keep: Uint8Array; keptCount: number } {
  const count = xs.length;
  const keep = new Uint8Array(count);
  keep[0] = 1;
  keep[count - 1] = 1;

  const stack: Array<[number, number]> = [[0, count - 1]];

  while (stack.length > 0) {
    const range = stack.pop();
    if (!range) break;

    const [start, end] = range;
    if (end - start <= 1) continue;

    let maxDistance = -1;
    let farthestIndex = -1;

    for (let i = start + 1; i < end; i += 1) {
      const dist = perpendicularDistanceMeters(xs, ys, i, start, end);
      if (dist > maxDistance) {
        maxDistance = dist;
        farthestIndex = i;
      }
    }

    if (farthestIndex !== -1 && maxDistance > toleranceMeters) {
      keep[farthestIndex] = 1;
      stack.push([start, farthestIndex], [farthestIndex, end]);
    }
  }

  let keptCount = 0;
  for (let i = 0; i < count; i += 1) {
    keptCount += keep[i];
  }

  return { keep, keptCount };
}

function extractKeptPoints(
  points: readonly RoutePoint[],
  keep: Uint8Array,
): RoutePoint[] {
  const result: RoutePoint[] = [];
  for (let i = 0; i < points.length; i += 1) {
    if (keep[i] === 1) {
      result.push({ ...points[i] });
    }
  }
  return result;
}

/**
 * Upraszcza ślad trasy algorytmem Douglas-Peucker dla zadanej tolerancji w metrach,
 * zawsze zachowując pierwszy i ostatni punkt.
 */
export function douglasPeucker(
  points: readonly RoutePoint[],
  toleranceMeters: number,
): RoutePoint[] {
  if (points.length === 0) return [];
  if (points.length <= 2) return points.map((point) => ({ ...point }));

  const safeTolerance =
    Number.isFinite(toleranceMeters) && toleranceMeters > 0
      ? toleranceMeters
      : 0;
  const { xs, ys } = projectToLocalMeters(points);
  const { keep } = runDouglasPeuckerMask(xs, ys, safeTolerance);
  return extractKeptPoints(points, keep);
}

/**
 * Adaptacyjnie redukuje liczbę punktów śladu algorytmem Douglas-Peucker,
 * aby zwrócić maksymalnie `maxPoints` punktów (domyślnie 500) przy zachowaniu startu i mety.
 */
export function simplifyRoutePoints(
  points: readonly RoutePoint[],
  maxPoints: number = DEFAULT_MAX_ROUTE_POINTS,
): RoutePoint[] {
  if (points.length === 0) return [];
  if (points.length === 1) return [{ ...points[0] }];

  const targetMax = Number.isFinite(maxPoints)
    ? Math.max(2, Math.floor(maxPoints))
    : DEFAULT_MAX_ROUTE_POINTS;

  if (points.length <= targetMax) {
    return points.map((point) => ({ ...point }));
  }

  const { xs, ys } = projectToLocalMeters(points);

  const zeroTolerance = runDouglasPeuckerMask(xs, ys, 0);
  if (zeroTolerance.keptCount <= targetMax) {
    return extractKeptPoints(points, zeroTolerance.keep);
  }

  let low = 0;
  let high = 1;
  let bestResult = zeroTolerance;

  for (let i = 0; i < 64; i += 1) {
    const attempt = runDouglasPeuckerMask(xs, ys, high);
    if (attempt.keptCount <= targetMax) {
      bestResult = attempt;
      break;
    }
    low = high;
    high *= 2;
  }

  if (bestResult.keptCount > targetMax) {
    const fallback = new Uint8Array(points.length);
    fallback[0] = 1;
    fallback[points.length - 1] = 1;
    return extractKeptPoints(points, fallback);
  }

  for (let iter = 0; iter < 28; iter += 1) {
    const mid = (low + high) / 2;
    const attempt = runDouglasPeuckerMask(xs, ys, mid);

    if (attempt.keptCount <= targetMax) {
      bestResult = attempt;
      high = mid;
      if (attempt.keptCount === targetMax) {
        break;
      }
    } else {
      low = mid;
    }
  }

  return extractKeptPoints(points, bestResult.keep);
}
