import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import * as dbModule from "@/db";
import { trailImages, trailPois, trails } from "@/db/schema";
import { REGION_SLUGS } from "@/lib/constants/regions";
import { SEED_TRAILS } from "@/lib/trails/seed-data";
import {
  createTrail,
  deleteTrail,
  getRegionCounts,
  getTrailByIdOrSlug,
  listTrails,
  resetMemoryStore,
  ROUTE_PREVIEW_MAX_POINTS,
  updateTrail,
} from "@/lib/trails/repository";
import {
  buildLegacySvgToJpgImageMap,
  migrateLegacySvgTrailImages,
  seedDatabase,
} from "../../../scripts/seed";

vi.mock("@/db", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/db")>();
  return {
    ...actual,
    isDatabaseConfigured: vi.fn(() => actual.isDatabaseConfigured()),
    getDb: vi.fn(() => actual.getDb()),
  };
});

describe("Trail repository (in-memory fallback mode)", () => {
  beforeEach(() => {
    delete process.env.DATABASE_URL;
    resetMemoryStore();
  });

  it("lists all 7 seeded trails with regionCounts for all 16 voivodeships", async () => {
    const result = await listTrails();
    expect(result.total).toBe(7);
    expect(result.items).toHaveLength(7);
    expect(result.page).toBe(1);
    expect(result.totalPages).toBe(1);
    expect(Object.keys(result.regionCounts)).toHaveLength(REGION_SLUGS.length);
    expect(result.regionCounts.slaskie).toBe(3);
    expect(result.regionCounts.malopolskie).toBe(1);
    expect(result.regionCounts.podlaskie).toBe(1);
    expect(result.regionCounts.dolnoslaskie).toBe(1);
    expect(result.regionCounts.pomorskie).toBe(1);
    expect(result.regionCounts.mazowieckie).toBe(0);

    const pogoria = result.items.find(
      (item) => item.sourceUrl === "https://slaskie.travel/route/1019753",
    );
    expect(pogoria).toBeDefined();
    expect(pogoria?.region).toBe("slaskie");
    expect(pogoria?.sourceName).toBe("SLASKIE.travel");
  });

  it("filters by region, difficulty, surface, distance range, and text query q", async () => {
    const slaskie = await listTrails({ region: "slaskie" });
    expect(slaskie.total).toBe(3);
    expect(slaskie.items.every((item) => item.region === "slaskie")).toBe(true);
    expect(slaskie.regionCounts.malopolskie).toBe(1);

    const easySlaskie = await listTrails({
      region: "slaskie",
      difficulty: "easy",
    });
    expect(easySlaskie.total).toBe(2);

    const offroad = await listTrails({ surface: "offroad" });
    expect(offroad.total).toBe(1);
    expect(offroad.items[0]?.slug).toContain("orlich-gniazd");

    const range = await listTrails({ minDistance: 29, maxDistance: 40 });
    expect(
      range.items.every(
        (item) => item.distanceKm >= 29 && item.distanceKm <= 40,
      ),
    ).toBe(true);
    expect(range.total).toBe(3);

    const searchResult = await listTrails({ q: "pogoria" });
    expect(searchResult.total).toBe(1);
    expect(searchResult.items[0]?.sourceUrl).toBe(
      "https://slaskie.travel/route/1019753",
    );

    const emptySearch = await listTrails({ q: "nieistniejacy-szlak-xyz" });
    expect(emptySearch.total).toBe(0);
    expect(emptySearch.items).toHaveLength(0);
    expect(emptySearch.totalPages).toBe(0);
  });

  it("supports all sort options and pagination", async () => {
    const asc = await listTrails({ sort: "distance_asc" });
    for (let i = 1; i < asc.items.length; i += 1) {
      expect(asc.items[i].distanceKm).toBeGreaterThanOrEqual(
        asc.items[i - 1].distanceKm,
      );
    }

    const desc = await listTrails({ sort: "distance_desc" });
    for (let i = 1; i < desc.items.length; i += 1) {
      expect(desc.items[i].distanceKm).toBeLessThanOrEqual(
        desc.items[i - 1].distanceKm,
      );
    }

    const elev = await listTrails({ sort: "elevation_desc" });
    for (let i = 1; i < elev.items.length; i += 1) {
      expect(elev.items[i].elevationGainM).toBeLessThanOrEqual(
        elev.items[i - 1].elevationGainM,
      );
    }

    const diff = await listTrails({ sort: "difficulty_asc" });
    const rank = { easy: 1, moderate: 2, hard: 3 } as const;
    for (let i = 1; i < diff.items.length; i += 1) {
      expect(rank[diff.items[i].difficulty]).toBeGreaterThanOrEqual(
        rank[diff.items[i - 1].difficulty],
      );
    }

    const page1 = await listTrails({ page: 1, limit: 3 });
    const page2 = await listTrails({ page: 2, limit: 3 });
    const page3 = await listTrails({ page: 3, limit: 3 });
    expect(page1.items).toHaveLength(3);
    expect(page2.items).toHaveLength(3);
    expect(page3.items).toHaveLength(1);
    expect(page1.totalPages).toBe(3);
  });

  it("supports getTrailByIdOrSlug, createTrail, updateTrail, deleteTrail, and updates regionCounts", async () => {
    const bySlug = await getTrailByIdOrSlug(
      "pogoria-iii-pogoria-iv-i-park-zielona-petla-slaskie",
    );
    expect(bySlug).not.toBeNull();
    expect(bySlug?.images.length).toBeGreaterThanOrEqual(3);
    expect(bySlug?.pois.length).toBeGreaterThanOrEqual(3);
    expect(bySlug?.routePoints.length).toBeGreaterThan(20);
    expect(bySlug?.bounds).not.toBeNull();

    const byId = await getTrailByIdOrSlug(bySlug!.id);
    expect(byId?.slug).toBe(bySlug?.slug);

    const created = await createTrail({
      title: "Szlak Nadwiślański Mazowsze",
      shortDescription: "Malownicza trasa wzdłuż Wisły pod Warszawą.",
      content: "## Opis\nTrasa rekreacyjna przez Kampinos i wały wiślane.",
      region: "mazowieckie",
      difficulty: "easy",
      surface: "mixed",
      trailColor: "green",
      distanceKm: 34.5,
      elevationGainM: 120,
      coverImageUrl: "/images/trails/green-velo-podlasie-cover.jpg",
      routePoints: [
        { lat: 52.2297, lng: 21.0122, ele: 95, distKm: 0 },
        { lat: 52.31, lng: 20.92, ele: 112, distKm: 18 },
      ],
      images: [
        {
          url: "/images/trails/green-velo-podlasie-1.jpg",
          caption: "Widok na Wisłę",
          sortOrder: 0,
        },
      ],
      pois: [
        {
          name: "Punkt widokowy nad Wisłą",
          category: "viewpoint",
          lat: 52.26,
          lng: 20.97,
        },
      ],
    });

    expect(created.slug).toBe("szlak-nadwislanski-mazowsze");
    expect(created.startLat).toBe(52.2297);
    expect(created.bounds?.north).toBe(52.31);
    expect(created.images).toHaveLength(1);
    expect(created.pois).toHaveLength(1);

    let counts = await getRegionCounts();
    expect(counts.mazowieckie).toBe(1);

    const updated = await updateTrail(created.id, {
      title: "Szlak Nadwiślański Mazowsze — Edycja II",
      distanceKm: 39.2,
    });
    expect(updated?.title).toBe("Szlak Nadwiślański Mazowsze — Edycja II");
    expect(updated?.distanceKm).toBe(39.2);
    expect(updated?.slug).toBe(created.slug);
    expect(updated?.images).toHaveLength(1);

    const deleted = await deleteTrail(created.id);
    expect(deleted).toBe(true);
    expect(await getTrailByIdOrSlug(created.id)).toBeNull();
    expect(await deleteTrail(created.id)).toBe(false);

    counts = await getRegionCounts();
    expect(counts.mazowieckie).toBe(0);
  });

  it("populates lightweight routePreviewPoints (<= 48 pts, lat/lng only) in in-memory listTrails", async () => {
    const result = await listTrails();
    expect(result.items.length).toBeGreaterThan(0);

    for (const item of result.items) {
      expect(Array.isArray(item.routePreviewPoints)).toBe(true);
      expect(item.routePreviewPoints.length).toBeGreaterThanOrEqual(2);
      expect(item.routePreviewPoints.length).toBeLessThanOrEqual(
        ROUTE_PREVIEW_MAX_POINTS,
      );
      for (const pt of item.routePreviewPoints) {
        expect(Object.keys(pt).sort()).toEqual(["lat", "lng"]);
        expect(typeof pt.lat).toBe("number");
        expect(typeof pt.lng).toBe("number");
      }
    }

    const emptyRouteTrail = await createTrail({
      title: "Szlak Bez Śladu GPX",
      shortDescription: "Krótka trasa bez zapisanych punktów GPX.",
      content: "## Opis\nTrasa testowa bez punktów.",
      region: "mazowieckie",
      difficulty: "easy",
      surface: "asphalt",
      distanceKm: 12,
      coverImageUrl: "/images/trails/slaskie-1019753-cover.jpg",
    });

    const filtered = await listTrails({ q: "Bez Śladu GPX" });
    expect(filtered.items).toHaveLength(1);
    expect(filtered.items[0]?.routePreviewPoints).toEqual([]);

    await deleteTrail(emptyRouteTrail.id);
  });
});

describe("Trail repository & seedDatabase (mocked Postgres DB mode)", () => {
  afterEach(() => {
    vi.restoreAllMocks();
    vi.mocked(dbModule.isDatabaseConfigured).mockReset();
    vi.mocked(dbModule.getDb).mockReset();
  });

  it("listTrails omits trails.content in Drizzle select and simplifies routePreviewPoints <= 48", async () => {
    const denseRoute = Array.from({ length: 120 }, (_, i) => ({
      lat: 50.3 + i * 0.001,
      lng: 19.1 + Math.sin(i / 8) * 0.01,
      ele: 260 + i,
      distKm: i * 0.2,
    }));

    const summaryRow = {
      id: "11111111-1111-4111-8111-111111111111",
      slug: "mock-db-trail",
      title: "Mock DB Trail",
      shortDescription: "Opis testowy z mockowanej bazy danych.",
      region: "slaskie" as const,
      subregion: "Jura",
      difficulty: "easy" as const,
      surface: "asphalt" as const,
      trailColor: "red" as const,
      distanceKm: 24,
      elevationGainM: 120,
      estimatedTimeMin: 90,
      isLoop: true,
      coverImageUrl: "/images/trails/slaskie-1019753-cover.jpg",
      sourceUrl: null,
      sourceName: null,
      published: true,
      createdAt: new Date("2026-06-01T10:00:00.000Z"),
      updatedAt: new Date("2026-06-01T10:00:00.000Z"),
      routePointsJson: denseRoute,
    };

    const capturedSelections: Array<Record<string, unknown> | undefined> = [];

    const mockDb = {
      select: vi.fn((fields?: Record<string, unknown>) => {
        capturedSelections.push(fields);
        return {
          from: vi.fn(() => {
            if (fields && "region" in fields && "count" in fields) {
              return {
                where: vi.fn(() => ({
                  groupBy: vi
                    .fn()
                    .mockResolvedValue([{ region: "slaskie", count: 1 }]),
                })),
                groupBy: vi
                  .fn()
                  .mockResolvedValue([{ region: "slaskie", count: 1 }]),
              };
            }
            if (fields && "count" in fields) {
              return { where: vi.fn().mockResolvedValue([{ count: 1 }]) };
            }
            return {
              where: vi.fn(() => ({
                orderBy: vi.fn(() => ({
                  limit: vi.fn(() => ({
                    offset: vi.fn().mockResolvedValue([summaryRow]),
                  })),
                })),
              })),
            };
          }),
        };
      }),
    };

    vi.mocked(dbModule.isDatabaseConfigured).mockReturnValue(true);
    vi.mocked(dbModule.getDb).mockReturnValue(
      mockDb as unknown as ReturnType<typeof dbModule.getDb>,
    );

    const response = await listTrails();
    expect(response.items).toHaveLength(1);
    expect(response.items[0]?.routePreviewPoints.length).toBeLessThanOrEqual(
      ROUTE_PREVIEW_MAX_POINTS,
    );
    expect(response.items[0]?.routePreviewPoints.length).toBeGreaterThan(2);
    expect(
      Object.keys(response.items[0]?.routePreviewPoints[0] ?? {}).sort(),
    ).toEqual(["lat", "lng"]);

    const rowsSelect = capturedSelections.find(
      (sel) => sel && "slug" in sel && "routePointsJson" in sel,
    );
    expect(rowsSelect).toBeDefined();
    expect(rowsSelect).not.toHaveProperty("content");
  });

  it("createTrail and updateTrail execute atomic db.batch across trails, trail_images, and trail_pois", async () => {
    const trailId = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
    const now = new Date("2026-06-01T10:00:00.000Z");

    const dbTrailRow = {
      id: trailId,
      slug: "batch-test-trail",
      title: "Batch Test Trail",
      shortDescription: "Opis testowy operacji batch w bazie danych.",
      content: "## Opis\nSzczegóły szlaku.",
      region: "slaskie" as const,
      subregion: null,
      difficulty: "moderate" as const,
      surface: "mixed" as const,
      trailColor: "blue" as const,
      distanceKm: 31.5,
      elevationGainM: 210,
      estimatedTimeMin: 120,
      isLoop: false,
      coverImageUrl: "/images/trails/slaskie-1019753-cover.jpg",
      sourceUrl: null,
      sourceName: null,
      gpxUrl: null,
      routePointsJson: [
        { lat: 50.3, lng: 19.1 },
        { lat: 50.35, lng: 19.2 },
      ],
      startLat: 50.3,
      startLng: 19.1,
      endLat: 50.35,
      endLng: 19.2,
      boundsJson: { north: 50.35, south: 50.3, east: 19.2, west: 19.1 },
      googleMapsEmbedUrl: null,
      published: true,
      createdAt: now,
      updatedAt: now,
    };

    const dbImageRows = [
      {
        id: "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb",
        trailId,
        url: "/images/trails/slaskie-1019753-1.jpg",
        caption: "Zdjęcie",
        sortOrder: 0,
      },
    ];

    const dbPoiRows = [
      {
        id: "cccccccc-cccc-4ccc-8ccc-cccccccccccc",
        trailId,
        name: "Punkt widokowy",
        category: "viewpoint",
        description: null,
        lat: 50.32,
        lng: 19.15,
      },
    ];

    const batchMock = vi
      .fn()
      .mockResolvedValueOnce([
        [dbTrailRow],
        dbImageRows,
        dbPoiRows,
      ])
      .mockResolvedValueOnce([undefined, undefined, undefined, undefined, undefined]);

    const selectMock = vi.fn(() => ({
      from: vi.fn((table: unknown) => {
        if (table === trails) {
          return {
            then: (resolve: (val: unknown) => void) => resolve([]),
            where: vi.fn(() => ({
              limit: vi.fn().mockResolvedValue([dbTrailRow]),
            })),
          };
        }
        if (table === trailImages) {
          return {
            where: vi.fn(() => ({
              orderBy: vi.fn().mockResolvedValue(dbImageRows),
            })),
          };
        }
        if (table === trailPois) {
          return {
            where: vi.fn().mockResolvedValue(dbPoiRows),
          };
        }
        return { where: vi.fn().mockResolvedValue([]) };
      }),
    }));

    const mockDb = {
      select: selectMock,
      insert: vi.fn((table: unknown) => ({
        values: vi.fn((vals: unknown) => ({
          returning: vi.fn(() => ({ table, action: "insert-returning", vals })),
          table,
          action: "insert",
          vals,
        })),
      })),
      update: vi.fn((table: unknown) => ({
        set: vi.fn((vals: unknown) => ({
          where: vi.fn(() => ({ table, action: "update", vals })),
        })),
      })),
      delete: vi.fn((table: unknown) => ({
        where: vi.fn(() => ({ table, action: "delete" })),
      })),
      batch: batchMock,
    };

    vi.mocked(dbModule.isDatabaseConfigured).mockReturnValue(true);
    vi.mocked(dbModule.getDb).mockReturnValue(
      mockDb as unknown as ReturnType<typeof dbModule.getDb>,
    );

    const created = await createTrail({
      title: "Batch Test Trail",
      shortDescription: "Opis testowy operacji batch w bazie danych.",
      content: "## Opis\nSzczegóły szlaku.",
      region: "slaskie",
      difficulty: "moderate",
      surface: "mixed",
      trailColor: "blue",
      distanceKm: 31.5,
      elevationGainM: 210,
      coverImageUrl: "/images/trails/slaskie-1019753-cover.jpg",
      images: [{ url: "/images/trails/slaskie-1019753-1.jpg", caption: "Zdjęcie" }],
      pois: [{ name: "Punkt widokowy", category: "viewpoint", lat: 50.32, lng: 19.15 }],
    });

    expect(batchMock).toHaveBeenCalledTimes(1);
    expect(batchMock.mock.calls[0]?.[0]).toHaveLength(3);
    expect(created.id).toBe(trailId);
    expect(created.images).toHaveLength(1);
    expect(created.pois).toHaveLength(1);

    const updated = await updateTrail(trailId, {
      title: "Batch Test Trail Updated",
      images: [{ url: "/images/trails/slaskie-1019753-1.jpg", caption: "Nowe" }],
      pois: [{ name: "Nowy POI", category: "parking", lat: 50.31, lng: 19.12 }],
    });

    expect(batchMock).toHaveBeenCalledTimes(2);
    expect(batchMock.mock.calls[1]?.[0]).toHaveLength(5);
    expect(updated?.id).toBe(trailId);
  });

  it("seedDatabase defaults to force: false (onConflictDoNothing, preserves existing images/POIs) and supports force: true", async () => {
    const deleteWhereMock = vi.fn().mockResolvedValue(undefined);
    const onConflictDoNothingMock = vi.fn();
    const onConflictDoUpdateMock = vi.fn();
    const childInsertMock = vi.fn().mockResolvedValue(undefined);

    let insertIndex = 0;
    onConflictDoNothingMock.mockImplementation(() => ({
      returning: vi.fn(async () => {
        const current = insertIndex;
        insertIndex += 1;
        // Only the very first trail is treated as newly inserted; all others already exist
        return current === 0 ? [{ id: SEED_TRAILS[0]!.id }] : [];
      }),
    }));

    onConflictDoUpdateMock.mockImplementation(() => ({
      returning: vi.fn(async () => [{ id: "upserted-id" }]),
    }));

    const mockDb = {
      insert: vi.fn((table: unknown) => ({
        values: vi.fn(() => {
          if (table === trails) {
            return {
              onConflictDoNothing: onConflictDoNothingMock,
              onConflictDoUpdate: onConflictDoUpdateMock,
            };
          }
          return childInsertMock();
        }),
      })),
      delete: vi.fn(() => ({
        where: deleteWhereMock,
      })),
    };

    vi.mocked(dbModule.isDatabaseConfigured).mockReturnValue(true);
    vi.mocked(dbModule.getDb).mockReturnValue(
      mockDb as unknown as ReturnType<typeof dbModule.getDb>,
    );

    const safeResult = await seedDatabase();
    expect(safeResult).toEqual({ seeded: 1, skipped: false });
    expect(onConflictDoNothingMock).toHaveBeenCalledTimes(SEED_TRAILS.length);
    expect(onConflictDoUpdateMock).not.toHaveBeenCalled();
    expect(deleteWhereMock).not.toHaveBeenCalled();
    // Only 1 new trail -> 1 insert into trailImages + 1 insert into trailPois
    expect(childInsertMock).toHaveBeenCalledTimes(2);

    vi.clearAllMocks();
    const forceResult = await seedDatabase({ force: true });
    expect(forceResult).toEqual({ seeded: SEED_TRAILS.length, skipped: false });
    expect(onConflictDoUpdateMock).toHaveBeenCalledTimes(SEED_TRAILS.length);
    expect(onConflictDoNothingMock).not.toHaveBeenCalled();
    expect(deleteWhereMock).toHaveBeenCalledTimes(SEED_TRAILS.length * 2);
  });

  it("migrateLegacySvgTrailImages maps all 21 legacy SVG paths and performs idempotent batch migration", async () => {
    const legacyMap = buildLegacySvgToJpgImageMap();
    expect(legacyMap.size).toBe(21);
    expect(legacyMap.get("/images/trails/slaskie-1019753-cover.svg")).toBe(
      "/images/trails/slaskie-1019753-cover.jpg",
    );

    const coverMatches = [
      { id: "trail-1", url: "/images/trails/slaskie-1019753-cover.svg" },
    ];
    const imageMatches = [
      { id: "img-1", url: "/images/trails/slaskie-1019753-cover.svg" },
      { id: "img-2", url: "/images/trails/slaskie-1019753-1.svg" },
    ];

    const batchMock = vi.fn().mockResolvedValue([]);
    const updateSetWhereMocks: Array<{ setArg: unknown }> = [];

    let selectCall = 0;
    const mockDb = {
      select: vi.fn(() => ({
        from: vi.fn((table: unknown) => ({
          where: vi.fn(async () => {
            selectCall += 1;
            if (table === trails) return coverMatches;
            if (table === trailImages) return imageMatches;
            return [];
          }),
        })),
      })),
      update: vi.fn(() => ({
        set: vi.fn((setArg: unknown) => ({
          where: vi.fn(() => {
            updateSetWhereMocks.push({ setArg });
            return { kind: "update-query", setArg };
          }),
        })),
      })),
      batch: batchMock,
    };

    vi.mocked(dbModule.isDatabaseConfigured).mockReturnValue(true);
    vi.mocked(dbModule.getDb).mockReturnValue(
      mockDb as unknown as ReturnType<typeof dbModule.getDb>,
    );

    const firstRun = await migrateLegacySvgTrailImages();
    expect(selectCall).toBe(2);
    expect(firstRun).toEqual({
      updatedCovers: 1,
      updatedGalleryImages: 2,
      skipped: false,
    });
    expect(batchMock).toHaveBeenCalledTimes(1);
    expect(batchMock.mock.calls[0]?.[0]).toHaveLength(3);
    expect(updateSetWhereMocks.map((call) => call.setArg)).toEqual([
      { coverImageUrl: "/images/trails/slaskie-1019753-cover.jpg" },
      { url: "/images/trails/slaskie-1019753-cover.jpg" },
      { url: "/images/trails/slaskie-1019753-1.jpg" },
    ]);

    // Second run with no legacy .svg paths left in DB -> no batch write
    coverMatches.length = 0;
    imageMatches.length = 0;
    batchMock.mockClear();

    const secondRun = await migrateLegacySvgTrailImages();
    expect(secondRun).toEqual({
      updatedCovers: 0,
      updatedGalleryImages: 0,
      skipped: false,
    });
    expect(batchMock).not.toHaveBeenCalled();
  });
});
