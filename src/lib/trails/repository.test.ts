import { beforeEach, describe, expect, it } from "vitest";
import { REGION_SLUGS } from "@/lib/constants/regions";
import {
  createTrail,
  deleteTrail,
  getRegionCounts,
  getTrailByIdOrSlug,
  listTrails,
  resetMemoryStore,
  updateTrail,
} from "@/lib/trails/repository";

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
      coverImageUrl: "/images/trails/green-velo-podlasie-cover.svg",
      routePoints: [
        { lat: 52.2297, lng: 21.0122, ele: 95, distKm: 0 },
        { lat: 52.31, lng: 20.92, ele: 112, distKm: 18 },
      ],
      images: [
        {
          url: "/images/trails/green-velo-podlasie-1.svg",
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
});
