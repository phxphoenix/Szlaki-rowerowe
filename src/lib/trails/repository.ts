import crypto from "node:crypto";
import {
  and,
  asc,
  desc,
  eq,
  gte,
  ilike,
  lte,
  or,
  sql,
  type SQL,
} from "drizzle-orm";
import { getDb, isDatabaseConfigured } from "@/db";
import {
  trailImages,
  trailPois,
  trails,
  type TrailImageRow,
  type TrailPoiRow,
  type TrailRow,
} from "@/db/schema";
import { REGION_SLUGS, type RegionSlug } from "@/lib/constants/regions";
import {
  cloneTrail,
  createInitialSeedTrails,
} from "@/lib/trails/seed-data";
import { generateUniqueSlug } from "@/lib/utils/slug";
import {
  createTrailSchema,
  trailQuerySchema,
  updateTrailSchema,
} from "@/lib/validation/trail";
import type {
  CreateTrailInput,
  RouteBounds,
  RoutePoint,
  SortOption,
  Trail,
  TrailImage,
  TrailListResponse,
  TrailPoi,
  TrailQueryParams,
  TrailSummary,
  UpdateTrailInput,
} from "@/types/trail";

const UUID_REGEX =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

const DIFFICULTY_RANK: Record<Trail["difficulty"], number> = {
  easy: 1,
  moderate: 2,
  hard: 3,
};

declare global {
  var __szlakiMemoryStore: Trail[] | undefined;
}

function getMemoryStore(): Trail[] {
  if (!globalThis.__szlakiMemoryStore) {
    globalThis.__szlakiMemoryStore = createInitialSeedTrails();
  }
  return globalThis.__szlakiMemoryStore;
}

export function resetMemoryStore(): void {
  globalThis.__szlakiMemoryStore = createInitialSeedTrails();
}

function isUuid(value: string): boolean {
  return UUID_REGEX.test(value);
}

function createEmptyRegionCounts(): Record<RegionSlug, number> {
  return Object.fromEntries(
    REGION_SLUGS.map((slug) => [slug, 0]),
  ) as Record<RegionSlug, number>;
}

function computeBoundsFromPoints(points: RoutePoint[]): RouteBounds | null {
  if (points.length === 0) return null;
  let north = -90;
  let south = 90;
  let east = -180;
  let west = 180;

  for (const point of points) {
    if (point.lat > north) north = point.lat;
    if (point.lat < south) south = point.lat;
    if (point.lng > east) east = point.lng;
    if (point.lng < west) west = point.lng;
  }

  return { north, south, east, west };
}

function toSummary(trail: Trail | TrailRow): TrailSummary {
  const createdAt =
    trail.createdAt instanceof Date
      ? trail.createdAt.toISOString()
      : trail.createdAt;
  const updatedAt =
    trail.updatedAt instanceof Date
      ? trail.updatedAt.toISOString()
      : trail.updatedAt;

  return {
    id: trail.id,
    slug: trail.slug,
    title: trail.title,
    shortDescription: trail.shortDescription,
    region: trail.region,
    subregion: trail.subregion ?? null,
    difficulty: trail.difficulty,
    surface: trail.surface,
    trailColor: trail.trailColor,
    distanceKm: Number(trail.distanceKm),
    elevationGainM: trail.elevationGainM,
    estimatedTimeMin: trail.estimatedTimeMin ?? null,
    isLoop: trail.isLoop,
    coverImageUrl: trail.coverImageUrl,
    sourceUrl: trail.sourceUrl ?? null,
    sourceName: trail.sourceName ?? null,
    published: trail.published,
    createdAt,
    updatedAt,
  };
}

function mapImageRow(row: TrailImageRow): TrailImage {
  return {
    id: row.id,
    trailId: row.trailId,
    url: row.url,
    caption: row.caption ?? null,
    sortOrder: row.sortOrder,
  };
}

function mapPoiRow(row: TrailPoiRow): TrailPoi {
  return {
    id: row.id,
    trailId: row.trailId,
    name: row.name,
    category: row.category ?? null,
    description: row.description ?? null,
    lat: row.lat,
    lng: row.lng,
  };
}

function mapTrailRow(
  row: TrailRow,
  images: TrailImageRow[],
  pois: TrailPoiRow[],
): Trail {
  return {
    ...toSummary(row),
    content: row.content,
    gpxUrl: row.gpxUrl ?? null,
    routePoints: Array.isArray(row.routePointsJson) ? row.routePointsJson : [],
    startLat: row.startLat ?? null,
    startLng: row.startLng ?? null,
    endLat: row.endLat ?? null,
    endLng: row.endLng ?? null,
    bounds: row.boundsJson ?? null,
    googleMapsEmbedUrl: row.googleMapsEmbedUrl ?? null,
    images: [...images]
      .sort((a, b) => a.sortOrder - b.sortOrder)
      .map(mapImageRow),
    pois: pois.map(mapPoiRow),
  };
}

function escapeLikePattern(term: string): string {
  return term.replace(/[\\%_]/g, (char) => `\\${char}`);
}

function compareTrails(a: Trail, b: Trail, sort: SortOption): number {
  switch (sort) {
    case "distance_asc":
      if (a.distanceKm !== b.distanceKm) {
        return a.distanceKm - b.distanceKm;
      }
      return b.createdAt.localeCompare(a.createdAt);
    case "distance_desc":
      if (a.distanceKm !== b.distanceKm) {
        return b.distanceKm - a.distanceKm;
      }
      return b.createdAt.localeCompare(a.createdAt);
    case "elevation_desc":
      if (a.elevationGainM !== b.elevationGainM) {
        return b.elevationGainM - a.elevationGainM;
      }
      return b.createdAt.localeCompare(a.createdAt);
    case "difficulty_asc": {
      const rankDiff =
        DIFFICULTY_RANK[a.difficulty] - DIFFICULTY_RANK[b.difficulty];
      if (rankDiff !== 0) {
        return rankDiff;
      }
      return a.distanceKm - b.distanceKm;
    }
    case "newest":
    default: {
      const dateDiff = b.createdAt.localeCompare(a.createdAt);
      if (dateDiff !== 0) {
        return dateDiff;
      }
      return a.title.localeCompare(b.title, "pl");
    }
  }
}

function buildDbOrderBy(sort: SortOption) {
  switch (sort) {
    case "distance_asc":
      return [asc(trails.distanceKm), desc(trails.createdAt)];
    case "distance_desc":
      return [desc(trails.distanceKm), desc(trails.createdAt)];
    case "elevation_desc":
      return [desc(trails.elevationGainM), desc(trails.createdAt)];
    case "difficulty_asc":
      return [
        sql<number>`CASE ${trails.difficulty} WHEN 'easy' THEN 1 WHEN 'moderate' THEN 2 ELSE 3 END ASC`,
        asc(trails.distanceKm),
      ];
    case "newest":
    default:
      return [desc(trails.createdAt), asc(trails.title)];
  }
}

export async function getRegionCounts(options?: {
  includeUnpublished?: boolean;
}): Promise<Record<RegionSlug, number>> {
  const counts = createEmptyRegionCounts();
  const includeUnpublished = Boolean(options?.includeUnpublished);

  if (!isDatabaseConfigured()) {
    const store = getMemoryStore();
    for (const trail of store) {
      if (!includeUnpublished && !trail.published) continue;
      counts[trail.region] = (counts[trail.region] ?? 0) + 1;
    }
    return counts;
  }

  const db = getDb();
  const baseQuery = db
    .select({
      region: trails.region,
      count: sql<number>`count(*)::int`,
    })
    .from(trails);

  const rows = includeUnpublished
    ? await baseQuery.groupBy(trails.region)
    : await baseQuery.where(eq(trails.published, true)).groupBy(trails.region);

  for (const row of rows) {
    counts[row.region] = Number(row.count);
  }
  return counts;
}

export async function listTrails(
  query: Partial<TrailQueryParams> = {},
): Promise<TrailListResponse> {
  const params = trailQuerySchema.parse(query);

  if (!isDatabaseConfigured()) {
    const store = getMemoryStore();
    const needle = params.q?.toLowerCase();

    const filtered = store.filter((trail) => {
      if (!params.includeUnpublished && !trail.published) {
        return false;
      }
      if (params.region !== "all" && trail.region !== params.region) {
        return false;
      }
      if (params.difficulty && trail.difficulty !== params.difficulty) {
        return false;
      }
      if (params.surface && trail.surface !== params.surface) {
        return false;
      }
      if (
        params.minDistance !== undefined &&
        trail.distanceKm < params.minDistance
      ) {
        return false;
      }
      if (
        params.maxDistance !== undefined &&
        trail.distanceKm > params.maxDistance
      ) {
        return false;
      }
      if (needle) {
        const haystacks = [
          trail.title,
          trail.shortDescription,
          trail.subregion ?? "",
        ];
        const matches = haystacks.some((value) =>
          value.toLowerCase().includes(needle),
        );
        if (!matches) {
          return false;
        }
      }
      return true;
    });

    const sorted = [...filtered].sort((a, b) =>
      compareTrails(a, b, params.sort),
    );
    const total = sorted.length;
    const totalPages = total === 0 ? 0 : Math.ceil(total / params.limit);
    const offset = (params.page - 1) * params.limit;
    const items = sorted.slice(offset, offset + params.limit).map(toSummary);
    const regionCounts = await getRegionCounts({
      includeUnpublished: params.includeUnpublished,
    });

    return {
      items,
      total,
      page: params.page,
      limit: params.limit,
      totalPages,
      regionCounts,
    };
  }

  const db = getDb();
  const conditions: SQL[] = [];

  if (!params.includeUnpublished) {
    conditions.push(eq(trails.published, true));
  }
  if (params.region !== "all") {
    conditions.push(eq(trails.region, params.region));
  }
  if (params.difficulty) {
    conditions.push(eq(trails.difficulty, params.difficulty));
  }
  if (params.surface) {
    conditions.push(eq(trails.surface, params.surface));
  }
  if (params.minDistance !== undefined) {
    conditions.push(gte(trails.distanceKm, params.minDistance));
  }
  if (params.maxDistance !== undefined) {
    conditions.push(lte(trails.distanceKm, params.maxDistance));
  }
  if (params.q) {
    const pattern = `%${escapeLikePattern(params.q)}%`;
    const searchExpr = or(
      ilike(trails.title, pattern),
      ilike(trails.shortDescription, pattern),
      ilike(trails.subregion, pattern),
    );
    if (searchExpr) {
      conditions.push(searchExpr);
    }
  }

  const whereClause = conditions.length > 0 ? and(...conditions) : undefined;
  const offset = (params.page - 1) * params.limit;

  const [countResult, rows, regionCounts] = await Promise.all([
    db
      .select({ count: sql<number>`count(*)::int` })
      .from(trails)
      .where(whereClause),
    db
      .select()
      .from(trails)
      .where(whereClause)
      .orderBy(...buildDbOrderBy(params.sort))
      .limit(params.limit)
      .offset(offset),
    getRegionCounts({ includeUnpublished: params.includeUnpublished }),
  ]);

  const total = Number(countResult[0]?.count ?? 0);
  const totalPages = total === 0 ? 0 : Math.ceil(total / params.limit);

  return {
    items: rows.map(toSummary),
    total,
    page: params.page,
    limit: params.limit,
    totalPages,
    regionCounts,
  };
}

export async function getTrailByIdOrSlug(
  idOrSlug: string,
  options?: { includeUnpublished?: boolean },
): Promise<Trail | null> {
  const trimmed = idOrSlug.trim();
  if (!trimmed) return null;

  const includeUnpublished = Boolean(options?.includeUnpublished);

  if (!isDatabaseConfigured()) {
    const store = getMemoryStore();
    const match = store.find(
      (trail) => trail.id === trimmed || trail.slug === trimmed,
    );
    if (!match) return null;
    if (!includeUnpublished && !match.published) return null;
    return cloneTrail(match);
  }

  const db = getDb();
  const lookupCondition = isUuid(trimmed)
    ? eq(trails.id, trimmed)
    : eq(trails.slug, trimmed);

  const whereClause = includeUnpublished
    ? lookupCondition
    : and(lookupCondition, eq(trails.published, true));

  const [row] = await db.select().from(trails).where(whereClause).limit(1);
  if (!row) return null;

  const [images, pois] = await Promise.all([
    db
      .select()
      .from(trailImages)
      .where(eq(trailImages.trailId, row.id))
      .orderBy(asc(trailImages.sortOrder)),
    db.select().from(trailPois).where(eq(trailPois.trailId, row.id)),
  ]);

  return mapTrailRow(row, images, pois);
}

export async function createTrail(input: CreateTrailInput): Promise<Trail> {
  const parsed = createTrailSchema.parse(input);
  const routePoints = parsed.routePoints ?? [];
  const firstPoint = routePoints[0];
  const lastPoint = routePoints[routePoints.length - 1];

  const startLat = parsed.startLat ?? firstPoint?.lat ?? null;
  const startLng = parsed.startLng ?? firstPoint?.lng ?? null;
  const endLat = parsed.endLat ?? lastPoint?.lat ?? null;
  const endLng = parsed.endLng ?? lastPoint?.lng ?? null;
  const bounds = parsed.bounds ?? computeBoundsFromPoints(routePoints);

  if (!isDatabaseConfigured()) {
    const store = getMemoryStore();
    const slug = generateUniqueSlug(
      parsed.slug ?? parsed.title,
      store.map((item) => item.slug),
    );
    const id = crypto.randomUUID();
    const now = new Date().toISOString();

    const images: TrailImage[] = parsed.images.map((image, idx) => ({
      id: crypto.randomUUID(),
      trailId: id,
      url: image.url,
      caption: image.caption ?? null,
      sortOrder: image.sortOrder ?? idx,
    }));

    const pois: TrailPoi[] = parsed.pois.map((poi) => ({
      id: crypto.randomUUID(),
      trailId: id,
      name: poi.name,
      category: poi.category ?? null,
      description: poi.description ?? null,
      lat: poi.lat,
      lng: poi.lng,
    }));

    const created: Trail = {
      id,
      slug,
      title: parsed.title,
      shortDescription: parsed.shortDescription,
      content: parsed.content,
      region: parsed.region,
      subregion: parsed.subregion ?? null,
      difficulty: parsed.difficulty,
      surface: parsed.surface,
      trailColor: parsed.trailColor,
      distanceKm: parsed.distanceKm,
      elevationGainM: parsed.elevationGainM,
      estimatedTimeMin: parsed.estimatedTimeMin ?? null,
      isLoop: parsed.isLoop,
      coverImageUrl: parsed.coverImageUrl,
      sourceUrl: parsed.sourceUrl ?? null,
      sourceName: parsed.sourceName ?? null,
      gpxUrl: parsed.gpxUrl ?? null,
      routePoints: routePoints.map((point) => ({ ...point })),
      startLat,
      startLng,
      endLat,
      endLng,
      bounds: bounds ? { ...bounds } : null,
      googleMapsEmbedUrl: parsed.googleMapsEmbedUrl ?? null,
      published: parsed.published,
      createdAt: now,
      updatedAt: now,
      images,
      pois,
    };

    store.push(created);
    return cloneTrail(created);
  }

  const db = getDb();
  const existingSlugs = await db.select({ slug: trails.slug }).from(trails);
  const slug = generateUniqueSlug(
    parsed.slug ?? parsed.title,
    existingSlugs.map((row) => row.slug),
  );

  const [inserted] = await db
    .insert(trails)
    .values({
      slug,
      title: parsed.title,
      shortDescription: parsed.shortDescription,
      content: parsed.content,
      region: parsed.region,
      subregion: parsed.subregion ?? null,
      difficulty: parsed.difficulty,
      surface: parsed.surface,
      trailColor: parsed.trailColor,
      distanceKm: parsed.distanceKm,
      elevationGainM: parsed.elevationGainM,
      estimatedTimeMin: parsed.estimatedTimeMin ?? null,
      isLoop: parsed.isLoop,
      coverImageUrl: parsed.coverImageUrl,
      sourceUrl: parsed.sourceUrl ?? null,
      sourceName: parsed.sourceName ?? null,
      gpxUrl: parsed.gpxUrl ?? null,
      routePointsJson: routePoints,
      startLat,
      startLng,
      endLat,
      endLng,
      boundsJson: bounds,
      googleMapsEmbedUrl: parsed.googleMapsEmbedUrl ?? null,
      published: parsed.published,
    })
    .returning();

  const insertedImages =
    parsed.images.length > 0
      ? await db
          .insert(trailImages)
          .values(
            parsed.images.map((image, idx) => ({
              trailId: inserted.id,
              url: image.url,
              caption: image.caption ?? null,
              sortOrder: image.sortOrder ?? idx,
            })),
          )
          .returning()
      : [];

  const insertedPois =
    parsed.pois.length > 0
      ? await db
          .insert(trailPois)
          .values(
            parsed.pois.map((poi) => ({
              trailId: inserted.id,
              name: poi.name,
              category: poi.category ?? null,
              description: poi.description ?? null,
              lat: poi.lat,
              lng: poi.lng,
            })),
          )
          .returning()
      : [];

  return mapTrailRow(inserted, insertedImages, insertedPois);
}

export async function updateTrail(
  idOrSlug: string,
  input: UpdateTrailInput,
): Promise<Trail | null> {
  const trimmed = idOrSlug.trim();
  if (!trimmed) return null;

  const parsed = updateTrailSchema.parse(input);

  if (!isDatabaseConfigured()) {
    const store = getMemoryStore();
    const index = store.findIndex(
      (trail) => trail.id === trimmed || trail.slug === trimmed,
    );
    if (index === -1) return null;

    const existing = store[index];
    const nextRoutePoints =
      parsed.routePoints !== undefined
        ? parsed.routePoints.map((point) => ({ ...point }))
        : existing.routePoints;

    const firstPoint = nextRoutePoints[0];
    const lastPoint = nextRoutePoints[nextRoutePoints.length - 1];

    const nextSlug =
      parsed.slug !== undefined
        ? generateUniqueSlug(
            parsed.slug,
            store
              .filter((item) => item.id !== existing.id)
              .map((item) => item.slug),
          )
        : existing.slug;

    const nextImages: TrailImage[] =
      parsed.images !== undefined
        ? parsed.images.map((image, idx) => ({
            id: crypto.randomUUID(),
            trailId: existing.id,
            url: image.url,
            caption: image.caption ?? null,
            sortOrder: image.sortOrder ?? idx,
          }))
        : existing.images;

    const nextPois: TrailPoi[] =
      parsed.pois !== undefined
        ? parsed.pois.map((poi) => ({
            id: crypto.randomUUID(),
            trailId: existing.id,
            name: poi.name,
            category: poi.category ?? null,
            description: poi.description ?? null,
            lat: poi.lat,
            lng: poi.lng,
          }))
        : existing.pois;

    const hasNewPoints =
      parsed.routePoints !== undefined && nextRoutePoints.length > 0;

    const updated: Trail = {
      ...existing,
      slug: nextSlug,
      title: parsed.title ?? existing.title,
      shortDescription: parsed.shortDescription ?? existing.shortDescription,
      content: parsed.content ?? existing.content,
      region: parsed.region ?? existing.region,
      subregion:
        parsed.subregion !== undefined ? parsed.subregion : existing.subregion,
      difficulty: parsed.difficulty ?? existing.difficulty,
      surface: parsed.surface ?? existing.surface,
      trailColor: parsed.trailColor ?? existing.trailColor,
      distanceKm: parsed.distanceKm ?? existing.distanceKm,
      elevationGainM: parsed.elevationGainM ?? existing.elevationGainM,
      estimatedTimeMin:
        parsed.estimatedTimeMin !== undefined
          ? parsed.estimatedTimeMin
          : existing.estimatedTimeMin,
      isLoop: parsed.isLoop ?? existing.isLoop,
      coverImageUrl: parsed.coverImageUrl ?? existing.coverImageUrl,
      sourceUrl:
        parsed.sourceUrl !== undefined ? parsed.sourceUrl : existing.sourceUrl,
      sourceName:
        parsed.sourceName !== undefined
          ? parsed.sourceName
          : existing.sourceName,
      gpxUrl: parsed.gpxUrl !== undefined ? parsed.gpxUrl : existing.gpxUrl,
      routePoints: nextRoutePoints,
      startLat:
        parsed.startLat !== undefined
          ? parsed.startLat
          : hasNewPoints
            ? firstPoint.lat
            : existing.startLat,
      startLng:
        parsed.startLng !== undefined
          ? parsed.startLng
          : hasNewPoints
            ? firstPoint.lng
            : existing.startLng,
      endLat:
        parsed.endLat !== undefined
          ? parsed.endLat
          : hasNewPoints
            ? lastPoint.lat
            : existing.endLat,
      endLng:
        parsed.endLng !== undefined
          ? parsed.endLng
          : hasNewPoints
            ? lastPoint.lng
            : existing.endLng,
      bounds:
        parsed.bounds !== undefined
          ? parsed.bounds
          : hasNewPoints
            ? computeBoundsFromPoints(nextRoutePoints)
            : existing.bounds,
      googleMapsEmbedUrl:
        parsed.googleMapsEmbedUrl !== undefined
          ? parsed.googleMapsEmbedUrl
          : existing.googleMapsEmbedUrl,
      published: parsed.published ?? existing.published,
      updatedAt: new Date().toISOString(),
      images: nextImages,
      pois: nextPois,
    };

    store[index] = updated;
    return cloneTrail(updated);
  }

  const db = getDb();
  const lookupCondition = isUuid(trimmed)
    ? eq(trails.id, trimmed)
    : eq(trails.slug, trimmed);

  const [existing] = await db
    .select()
    .from(trails)
    .where(lookupCondition)
    .limit(1);
  if (!existing) return null;

  let nextSlug = existing.slug;
  if (parsed.slug !== undefined) {
    const allSlugs = await db
      .select({ id: trails.id, slug: trails.slug })
      .from(trails);
    nextSlug = generateUniqueSlug(
      parsed.slug,
      allSlugs.filter((item) => item.id !== existing.id).map((item) => item.slug),
    );
  }

  const hasNewPoints =
    parsed.routePoints !== undefined && parsed.routePoints.length > 0;
  const firstPoint = parsed.routePoints?.[0];
  const lastPoint = parsed.routePoints?.[parsed.routePoints.length - 1];

  const updatePayload: Partial<typeof trails.$inferInsert> = {
    updatedAt: new Date(),
  };

  if (parsed.slug !== undefined) updatePayload.slug = nextSlug;
  if (parsed.title !== undefined) updatePayload.title = parsed.title;
  if (parsed.shortDescription !== undefined) {
    updatePayload.shortDescription = parsed.shortDescription;
  }
  if (parsed.content !== undefined) updatePayload.content = parsed.content;
  if (parsed.region !== undefined) updatePayload.region = parsed.region;
  if (parsed.subregion !== undefined) {
    updatePayload.subregion = parsed.subregion;
  }
  if (parsed.difficulty !== undefined) {
    updatePayload.difficulty = parsed.difficulty;
  }
  if (parsed.surface !== undefined) updatePayload.surface = parsed.surface;
  if (parsed.trailColor !== undefined) {
    updatePayload.trailColor = parsed.trailColor;
  }
  if (parsed.distanceKm !== undefined) {
    updatePayload.distanceKm = parsed.distanceKm;
  }
  if (parsed.elevationGainM !== undefined) {
    updatePayload.elevationGainM = parsed.elevationGainM;
  }
  if (parsed.estimatedTimeMin !== undefined) {
    updatePayload.estimatedTimeMin = parsed.estimatedTimeMin;
  }
  if (parsed.isLoop !== undefined) updatePayload.isLoop = parsed.isLoop;
  if (parsed.coverImageUrl !== undefined) {
    updatePayload.coverImageUrl = parsed.coverImageUrl;
  }
  if (parsed.sourceUrl !== undefined) updatePayload.sourceUrl = parsed.sourceUrl;
  if (parsed.sourceName !== undefined) {
    updatePayload.sourceName = parsed.sourceName;
  }
  if (parsed.gpxUrl !== undefined) updatePayload.gpxUrl = parsed.gpxUrl;
  if (parsed.routePoints !== undefined) {
    updatePayload.routePointsJson = parsed.routePoints;
  }
  if (parsed.startLat !== undefined) {
    updatePayload.startLat = parsed.startLat;
  } else if (hasNewPoints && firstPoint) {
    updatePayload.startLat = firstPoint.lat;
  }
  if (parsed.startLng !== undefined) {
    updatePayload.startLng = parsed.startLng;
  } else if (hasNewPoints && firstPoint) {
    updatePayload.startLng = firstPoint.lng;
  }
  if (parsed.endLat !== undefined) {
    updatePayload.endLat = parsed.endLat;
  } else if (hasNewPoints && lastPoint) {
    updatePayload.endLat = lastPoint.lat;
  }
  if (parsed.endLng !== undefined) {
    updatePayload.endLng = parsed.endLng;
  } else if (hasNewPoints && lastPoint) {
    updatePayload.endLng = lastPoint.lng;
  }
  if (parsed.bounds !== undefined) {
    updatePayload.boundsJson = parsed.bounds;
  } else if (hasNewPoints && parsed.routePoints) {
    updatePayload.boundsJson = computeBoundsFromPoints(parsed.routePoints);
  }
  if (parsed.googleMapsEmbedUrl !== undefined) {
    updatePayload.googleMapsEmbedUrl = parsed.googleMapsEmbedUrl;
  }
  if (parsed.published !== undefined) {
    updatePayload.published = parsed.published;
  }

  await db.update(trails).set(updatePayload).where(eq(trails.id, existing.id));

  if (parsed.images !== undefined) {
    await db.delete(trailImages).where(eq(trailImages.trailId, existing.id));
    if (parsed.images.length > 0) {
      await db.insert(trailImages).values(
        parsed.images.map((image, idx) => ({
          trailId: existing.id,
          url: image.url,
          caption: image.caption ?? null,
          sortOrder: image.sortOrder ?? idx,
        })),
      );
    }
  }

  if (parsed.pois !== undefined) {
    await db.delete(trailPois).where(eq(trailPois.trailId, existing.id));
    if (parsed.pois.length > 0) {
      await db.insert(trailPois).values(
        parsed.pois.map((poi) => ({
          trailId: existing.id,
          name: poi.name,
          category: poi.category ?? null,
          description: poi.description ?? null,
          lat: poi.lat,
          lng: poi.lng,
        })),
      );
    }
  }

  return getTrailByIdOrSlug(existing.id, { includeUnpublished: true });
}

export async function deleteTrail(idOrSlug: string): Promise<boolean> {
  const trimmed = idOrSlug.trim();
  if (!trimmed) return false;

  if (!isDatabaseConfigured()) {
    const store = getMemoryStore();
    const index = store.findIndex(
      (trail) => trail.id === trimmed || trail.slug === trimmed,
    );
    if (index === -1) return false;
    store.splice(index, 1);
    return true;
  }

  const db = getDb();
  const lookupCondition = isUuid(trimmed)
    ? eq(trails.id, trimmed)
    : eq(trails.slug, trimmed);

  const deleted = await db
    .delete(trails)
    .where(lookupCondition)
    .returning({ id: trails.id });

  return deleted.length > 0;
}

export interface CollectionStats {
  totalTrails: number;
  totalDistanceKm: number;
  activeRegionsCount: number;
}

export async function getCollectionStats(): Promise<CollectionStats> {
  if (!isDatabaseConfigured()) {
    const published = getMemoryStore().filter((trail) => trail.published);
    const regions = new Set(published.map((trail) => trail.region));
    const totalDistanceKm = published.reduce(
      (sum, trail) => sum + Number(trail.distanceKm),
      0,
    );
    return {
      totalTrails: published.length,
      totalDistanceKm: Math.round(totalDistanceKm * 10) / 10,
      activeRegionsCount: regions.size,
    };
  }

  const db = getDb();
  const [row] = await db
    .select({
      totalTrails: sql<number>`count(*)::int`,
      totalDistanceKm: sql<number>`coalesce(sum(${trails.distanceKm}), 0)::float8`,
      activeRegionsCount: sql<number>`count(distinct ${trails.region})::int`,
    })
    .from(trails)
    .where(eq(trails.published, true));

  return {
    totalTrails: Number(row?.totalTrails ?? 0),
    totalDistanceKm: Math.round(Number(row?.totalDistanceKm ?? 0) * 10) / 10,
    activeRegionsCount: Number(row?.activeRegionsCount ?? 0),
  };
}
