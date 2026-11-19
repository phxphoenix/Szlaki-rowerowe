import { describe, expect, it } from "vitest";
import {
  formatDatePl,
  formatDistance,
  formatDuration,
  formatElevation,
} from "@/lib/utils/format";

describe("FMT-01: Polish telemetry and date formatting", () => {
  it("formats distance in km with Polish decimal comma", () => {
    expect(formatDistance(45.83)).toBe("45,8 km");
    expect(formatDistance(23)).toBe("23 km");
    expect(formatDistance(0)).toBe("0 km");
    expect(formatDistance(-5)).toBe("0 km");
  });

  it("formats elevation gain with upward arrow", () => {
    expect(formatElevation(320)).toBe("↑ 320 m");
    expect(formatElevation(0)).toBe("↑ 0 m");
    expect(formatElevation(1140.4)).toBe("↑ 1140 m");
  });

  it("formats duration into hours and minutes", () => {
    expect(formatDuration(135)).toBe("2h 15m");
    expect(formatDuration(45)).toBe("45 min");
    expect(formatDuration(120)).toBe("2h");
    expect(formatDuration(null)).toBe("—");
    expect(formatDuration(undefined)).toBe("—");
  });

  it("formats dates in Polish locale", () => {
    const formatted = formatDatePl("2026-11-19T12:00:00.000Z");
    expect(formatted).toContain("2026");
    expect(formatted).toContain("19");
    expect(formatted.toLowerCase()).toContain("listopada");
    expect(formatDatePl("invalid-date")).toBe("");
  });
});
