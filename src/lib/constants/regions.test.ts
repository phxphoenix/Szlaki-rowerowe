import { describe, expect, it } from "vitest";
import {
  DIFFICULTIES,
  DIFFICULTY_LABELS,
  getRegionInfo,
  isValidRegionSlug,
  REGION_MAP,
  REGION_SLUGS,
  REGIONS,
  SORT_OPTION_LABELS,
  SORT_OPTIONS,
  SURFACE_LABELS,
  SURFACES,
  TRAIL_COLOR_META,
  TRAIL_COLORS,
} from "@/lib/constants/regions";

describe("REG-01: Polish regions and domain constants", () => {
  it("defines exactly 16 unique Polish voivodeships with valid Polish names and coordinates", () => {
    expect(REGIONS).toHaveLength(16);
    expect(REGION_SLUGS).toHaveLength(16);

    const uniqueSlugs = new Set(REGIONS.map((region) => region.slug));
    const uniqueNames = new Set(REGIONS.map((region) => region.name));
    const uniqueShortCodes = new Set(REGIONS.map((region) => region.shortCode));

    expect(uniqueSlugs.size).toBe(16);
    expect(uniqueNames.size).toBe(16);
    expect(uniqueShortCodes.size).toBe(16);

    for (const region of REGIONS) {
      expect(REGION_SLUGS).toContain(region.slug);
      expect(REGION_MAP[region.slug]).toEqual(region);
      expect(getRegionInfo(region.slug)).toEqual(region);
      expect(isValidRegionSlug(region.slug)).toBe(true);
      expect(region.fullName.toLowerCase()).toContain("województwo");
      expect(region.center.lat).toBeGreaterThan(49);
      expect(region.center.lat).toBeLessThan(55);
      expect(region.center.lng).toBeGreaterThan(14);
      expect(region.center.lng).toBeLessThan(24.5);
      expect(region.defaultZoom).toBeGreaterThanOrEqual(7);
      expect(region.defaultZoom).toBeLessThanOrEqual(11);
    }

    expect(REGION_MAP.slaskie.name).toBe("Śląskie");
    expect(REGION_MAP.slaskie.fullName).toBe("Województwo śląskie");
    expect(REGION_MAP.lodzkie.name).toBe("Łódzkie");
    expect(REGION_MAP["warminsko-mazurskie"].name).toBe("Warmińsko-Mazurskie");
    expect(isValidRegionSlug("atlantis")).toBe(false);
  });

  it("provides Polish labels for difficulty, surface, trailColor, and sortOptions", () => {
    for (const difficulty of DIFFICULTIES) {
      expect(DIFFICULTY_LABELS[difficulty]).toBeTruthy();
    }
    for (const surface of SURFACES) {
      expect(SURFACE_LABELS[surface]).toBeTruthy();
    }
    for (const color of TRAIL_COLORS) {
      expect(TRAIL_COLOR_META[color].hex).toMatch(/^#[0-9A-F]{6}$/i);
      expect(TRAIL_COLOR_META[color].label).toBeTruthy();
    }
    for (const sort of SORT_OPTIONS) {
      expect(SORT_OPTION_LABELS[sort]).toBeTruthy();
    }
  });
});
