import { pathToFileURL } from "node:url";
import { eq, inArray } from "drizzle-orm";
import type { BatchItem } from "drizzle-orm/batch";
import { getDb, isDatabaseConfigured } from "@/db";
import { trailImages, trailPois, trails } from "@/db/schema";
import { SEED_TRAILS } from "@/lib/trails/seed-data";

export interface SeedDatabaseOptions {
  force?: boolean;
}

export interface LegacySvgMigrationResult {
  updatedCovers: number;
  updatedGalleryImages: number;
  skipped: boolean;
}

export function buildLegacySvgToJpgImageMap(): ReadonlyMap<string, string> {
  const map = new Map<string, string>();
  const register = (url: string) => {
    if (url.startsWith("/images/trails/") && /\.jpg$/i.test(url)) {
      map.set(url.replace(/\.jpg$/i, ".svg"), url);
    }
  };

  for (const trail of SEED_TRAILS) {
    register(trail.coverImageUrl);
    for (const image of trail.images) {
      register(image.url);
    }
  }

  return map;
}

export async function migrateLegacySvgTrailImages(): Promise<LegacySvgMigrationResult> {
  if (!isDatabaseConfigured()) {
    return { updatedCovers: 0, updatedGalleryImages: 0, skipped: true };
  }

  const replacements = buildLegacySvgToJpgImageMap();
  const legacyUrls = Array.from(replacements.keys());
  if (legacyUrls.length === 0) {
    return { updatedCovers: 0, updatedGalleryImages: 0, skipped: false };
  }

  const db = getDb();
  const [matchingCovers, matchingImages] = await Promise.all([
    db
      .select({ id: trails.id, url: trails.coverImageUrl })
      .from(trails)
      .where(inArray(trails.coverImageUrl, legacyUrls)),
    db
      .select({ id: trailImages.id, url: trailImages.url })
      .from(trailImages)
      .where(inArray(trailImages.url, legacyUrls)),
  ]);

  if (matchingCovers.length === 0 && matchingImages.length === 0) {
    return { updatedCovers: 0, updatedGalleryImages: 0, skipped: false };
  }

  const queries: BatchItem<"pg">[] = [];
  let updatedCovers = 0;
  let updatedGalleryImages = 0;

  for (const row of matchingCovers) {
    const nextUrl = replacements.get(row.url);
    if (nextUrl) {
      queries.push(
        db
          .update(trails)
          .set({ coverImageUrl: nextUrl })
          .where(eq(trails.id, row.id)),
      );
      updatedCovers += 1;
    }
  }

  for (const row of matchingImages) {
    const nextUrl = replacements.get(row.url);
    if (nextUrl) {
      queries.push(
        db
          .update(trailImages)
          .set({ url: nextUrl })
          .where(eq(trailImages.id, row.id)),
      );
      updatedGalleryImages += 1;
    }
  }

  if (queries.length > 0) {
    await db.batch(queries as [BatchItem<"pg">, ...BatchItem<"pg">[]]);
    console.info(
      `[seed] Migrated legacy SVG paths to JPEG in Neon Postgres (covers: ${updatedCovers}, gallery images: ${updatedGalleryImages}).`,
    );
  }

  return { updatedCovers, updatedGalleryImages, skipped: false };
}

export async function seedDatabase(
  options: SeedDatabaseOptions = {},
): Promise<{
  seeded: number;
  skipped: boolean;
}> {
  if (!isDatabaseConfigured()) {
    console.warn(
      "[seed] DATABASE_URL is not configured. Skipping Postgres seed.",
    );
    return { seeded: 0, skipped: true };
  }

  const force = Boolean(options.force);
  const db = getDb();
  let seeded = 0;

  for (const trail of SEED_TRAILS) {
    const trailValues = {
      id: trail.id,
      slug: trail.slug,
      title: trail.title,
      shortDescription: trail.shortDescription,
      content: trail.content,
      region: trail.region,
      subregion: trail.subregion,
      difficulty: trail.difficulty,
      surface: trail.surface,
      trailColor: trail.trailColor,
      distanceKm: trail.distanceKm,
      elevationGainM: trail.elevationGainM,
      estimatedTimeMin: trail.estimatedTimeMin,
      isLoop: trail.isLoop,
      coverImageUrl: trail.coverImageUrl,
      sourceUrl: trail.sourceUrl,
      sourceName: trail.sourceName,
      gpxUrl: trail.gpxUrl,
      routePointsJson: trail.routePoints,
      startLat: trail.startLat,
      startLng: trail.startLng,
      endLat: trail.endLat,
      endLng: trail.endLng,
      boundsJson: trail.bounds,
      googleMapsEmbedUrl: trail.googleMapsEmbedUrl,
      published: trail.published,
      createdAt: new Date(trail.createdAt),
      updatedAt: new Date(trail.updatedAt),
    };

    if (force) {
      const [upserted] = await db
        .insert(trails)
        .values(trailValues)
        .onConflictDoUpdate({
          target: trails.slug,
          set: {
            title: trail.title,
            shortDescription: trail.shortDescription,
            content: trail.content,
            region: trail.region,
            subregion: trail.subregion,
            difficulty: trail.difficulty,
            surface: trail.surface,
            trailColor: trail.trailColor,
            distanceKm: trail.distanceKm,
            elevationGainM: trail.elevationGainM,
            estimatedTimeMin: trail.estimatedTimeMin,
            isLoop: trail.isLoop,
            coverImageUrl: trail.coverImageUrl,
            sourceUrl: trail.sourceUrl,
            sourceName: trail.sourceName,
            gpxUrl: trail.gpxUrl,
            routePointsJson: trail.routePoints,
            startLat: trail.startLat,
            startLng: trail.startLng,
            endLat: trail.endLat,
            endLng: trail.endLng,
            boundsJson: trail.bounds,
            googleMapsEmbedUrl: trail.googleMapsEmbedUrl,
            published: trail.published,
            updatedAt: new Date(),
          },
        })
        .returning({ id: trails.id });

      if (!upserted) {
        continue;
      }

      await db.delete(trailImages).where(eq(trailImages.trailId, upserted.id));
      if (trail.images.length > 0) {
        await db.insert(trailImages).values(
          trail.images.map((image, idx) => ({
            trailId: upserted.id,
            url: image.url,
            caption: image.caption,
            sortOrder: image.sortOrder ?? idx,
          })),
        );
      }

      await db.delete(trailPois).where(eq(trailPois.trailId, upserted.id));
      if (trail.pois.length > 0) {
        await db.insert(trailPois).values(
          trail.pois.map((poi) => ({
            trailId: upserted.id,
            name: poi.name,
            category: poi.category,
            description: poi.description,
            lat: poi.lat,
            lng: poi.lng,
          })),
        );
      }

      seeded += 1;
      continue;
    }

    const [inserted] = await db
      .insert(trails)
      .values(trailValues)
      .onConflictDoNothing({ target: trails.slug })
      .returning({ id: trails.id });

    if (!inserted) {
      continue;
    }

    if (trail.images.length > 0) {
      await db.insert(trailImages).values(
        trail.images.map((image, idx) => ({
          trailId: inserted.id,
          url: image.url,
          caption: image.caption,
          sortOrder: image.sortOrder ?? idx,
        })),
      );
    }

    if (trail.pois.length > 0) {
      await db.insert(trailPois).values(
        trail.pois.map((poi) => ({
          trailId: inserted.id,
          name: poi.name,
          category: poi.category,
          description: poi.description,
          lat: poi.lat,
          lng: poi.lng,
        })),
      );
    }

    seeded += 1;
  }

  console.info(
    `[seed] ${force ? "Force-updated" : "Inserted missing"} ${seeded} cycling trails in Neon Postgres (total reference: ${SEED_TRAILS.length}).`,
  );
  return { seeded, skipped: false };
}

const isDirectExecution =
  typeof process !== "undefined" &&
  process.argv[1] !== undefined &&
  import.meta.url === pathToFileURL(process.argv[1]).href;

if (isDirectExecution) {
  const force = process.argv.includes("--force");
  seedDatabase({ force }).catch((error) => {
    console.error("[seed] Failed to seed database:", error);
    process.exitCode = 1;
  });
}
