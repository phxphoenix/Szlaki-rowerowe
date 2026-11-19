import { pathToFileURL } from "node:url";
import { eq } from "drizzle-orm";
import { getDb, isDatabaseConfigured } from "@/db";
import { trailImages, trailPois, trails } from "@/db/schema";
import { SEED_TRAILS } from "@/lib/trails/seed-data";

export async function seedDatabase(): Promise<{
  seeded: number;
  skipped: boolean;
}> {
  if (!isDatabaseConfigured()) {
    console.warn(
      "[seed] DATABASE_URL is not configured. Skipping Postgres seed.",
    );
    return { seeded: 0, skipped: true };
  }

  const db = getDb();

  for (const trail of SEED_TRAILS) {
    const [upserted] = await db
      .insert(trails)
      .values({
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
      })
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
  }

  console.info(
    `[seed] Successfully seeded ${SEED_TRAILS.length} cycling trails into Neon Postgres.`,
  );
  return { seeded: SEED_TRAILS.length, skipped: false };
}

const isDirectExecution =
  typeof process !== "undefined" &&
  process.argv[1] !== undefined &&
  import.meta.url === pathToFileURL(process.argv[1]).href;

if (isDirectExecution) {
  seedDatabase().catch((error) => {
    console.error("[seed] Failed to seed database:", error);
    process.exitCode = 1;
  });
}
