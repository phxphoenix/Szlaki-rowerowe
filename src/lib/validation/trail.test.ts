import { describe, expect, it } from "vitest";
import {
  createTrailSchema,
  trailQuerySchema,
  updateTrailSchema,
} from "@/lib/validation/trail";

const validPayload = {
  title: "Pogoria III i IV — Pętla Dąbrowska",
  shortDescription: "Rodzinna trasa asfaltowa wokół jezior Pogoria.",
  content: "Szczegółowy opis trasy rowerowej w Dąbrowie Górniczej.",
  region: "slaskie" as const,
  subregion: "Pojezierze Dąbrowskie",
  difficulty: "easy" as const,
  surface: "asphalt" as const,
  trailColor: "blue" as const,
  distanceKm: 22.8,
  elevationGainM: 85,
  estimatedTimeMin: 80,
  isLoop: true,
  coverImageUrl: "/images/trails/slaskie-1019753-cover.svg",
  sourceUrl: "https://slaskie.travel/route/1019753",
  sourceName: "SLASKIE.travel",
  gpxUrl: "/sample-gpx/slaskie-1019753.gpx",
};

describe("VAL-01: createTrailSchema and updateTrailSchema", () => {
  it("accepts a valid trail payload with relative asset paths and HTTPS sourceUrl", () => {
    const result = createTrailSchema.safeParse(validPayload);
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.region).toBe("slaskie");
      expect(result.data.sourceUrl).toBe("https://slaskie.travel/route/1019753");
      expect(result.data.published).toBe(true);
    }
  });

  it("normalizes empty optional sourceUrl and gpxUrl to null", () => {
    const result = createTrailSchema.safeParse({
      ...validPayload,
      sourceUrl: "",
      gpxUrl: "   ",
    });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.sourceUrl).toBeNull();
      expect(result.data.gpxUrl).toBeNull();
    }
  });

  it("rejects negative/zero distance, excessive distance, negative elevation, empty title, invalid region, and invalid URLs", () => {
    expect(
      createTrailSchema.safeParse({ ...validPayload, title: "   " }).success,
    ).toBe(false);
    expect(
      createTrailSchema.safeParse({ ...validPayload, shortDescription: "" })
        .success,
    ).toBe(false);
    expect(
      createTrailSchema.safeParse({ ...validPayload, content: "" }).success,
    ).toBe(false);
    expect(
      createTrailSchema.safeParse({ ...validPayload, region: "nieistniejace" })
        .success,
    ).toBe(false);
    expect(
      createTrailSchema.safeParse({ ...validPayload, distanceKm: -5 }).success,
    ).toBe(false);
    expect(
      createTrailSchema.safeParse({ ...validPayload, distanceKm: 0 }).success,
    ).toBe(false);
    expect(
      createTrailSchema.safeParse({ ...validPayload, distanceKm: 2501 })
        .success,
    ).toBe(false);
    expect(
      createTrailSchema.safeParse({ ...validPayload, elevationGainM: -10 })
        .success,
    ).toBe(false);
    expect(
      createTrailSchema.safeParse({
        ...validPayload,
        sourceUrl: "ftp://slaskie.travel/route/1019753",
      }).success,
    ).toBe(false);
    expect(
      createTrailSchema.safeParse({
        ...validPayload,
        sourceUrl: "not-a-valid-url",
      }).success,
    ).toBe(false);
    expect(
      createTrailSchema.safeParse({
        ...validPayload,
        coverImageUrl: "javascript:alert(1)",
      }).success,
    ).toBe(false);
  });

  it("does not inject default values for omitted fields in updateTrailSchema", () => {
    const parsed = updateTrailSchema.parse({ title: "Nowy Tytuł Szlaku" });
    expect(parsed).toEqual({ title: "Nowy Tytuł Szlaku" });
    expect("isLoop" in parsed).toBe(false);
    expect("published" in parsed).toBe(false);
    expect("images" in parsed).toBe(false);
  });
});

describe("VAL-02: trailQuerySchema", () => {
  it("applies safe defaults for missing or malformed query parameters", () => {
    const empty = trailQuerySchema.parse({});
    expect(empty).toEqual({
      region: "all",
      difficulty: undefined,
      surface: undefined,
      minDistance: undefined,
      maxDistance: undefined,
      q: undefined,
      sort: "newest",
      page: 1,
      limit: 12,
      includeUnpublished: false,
    });

    const malformed = trailQuerySchema.parse({
      region: "narnia",
      difficulty: "extreme",
      surface: "lava",
      minDistance: "",
      maxDistance: "not-a-number",
      q: "   ",
      sort: "random_order",
      page: "-5",
      limit: "9999",
    });

    expect(malformed.region).toBe("all");
    expect(malformed.difficulty).toBeUndefined();
    expect(malformed.surface).toBeUndefined();
    expect(malformed.minDistance).toBeUndefined();
    expect(malformed.maxDistance).toBeUndefined();
    expect(malformed.q).toBeUndefined();
    expect(malformed.sort).toBe("newest");
    expect(malformed.page).toBe(1);
    expect(malformed.limit).toBe(12);
  });

  it("parses valid query parameters cleanly", () => {
    const parsed = trailQuerySchema.parse({
      region: "slaskie",
      difficulty: "easy",
      surface: "asphalt",
      minDistance: "10",
      maxDistance: "60",
      q: "  Pogoria ",
      sort: "distance_desc",
      page: "2",
      limit: "6",
    });

    expect(parsed.region).toBe("slaskie");
    expect(parsed.difficulty).toBe("easy");
    expect(parsed.surface).toBe("asphalt");
    expect(parsed.minDistance).toBe(10);
    expect(parsed.maxDistance).toBe(60);
    expect(parsed.q).toBe("Pogoria");
    expect(parsed.sort).toBe("distance_desc");
    expect(parsed.page).toBe(2);
    expect(parsed.limit).toBe(6);
  });
});
