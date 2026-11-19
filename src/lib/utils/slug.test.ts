import { describe, expect, it } from "vitest";
import { generateUniqueSlug, slugify } from "@/lib/utils/slug";

describe("SLG-01: Polish slug generation", () => {
  it("converts Polish diacritics and special characters into clean URL slugs", () => {
    expect(slugify("Żelazny Szlak Rowerowy — Śląsk!")).toBe(
      "zelazny-szlak-rowerowy-slask",
    );
    expect(slugify("ąćęłńóśźż ĄĆĘŁŃÓŚŹŻ")).toBe("acelnoszz-acelnoszz");
    expect(slugify("  Łódź — Dolina Baryczy (45,8 km)  ")).toBe(
      "lodz-dolina-baryczy-45-8-km",
    );
    expect(slugify("---!!!---")).toBe("");
  });

  it("generates unique slugs when collisions occur", () => {
    const existing = ["szlak-orlich-gniazd", "szlak-orlich-gniazd-2"];
    expect(generateUniqueSlug("Szlak Orlich Gniazd", existing)).toBe(
      "szlak-orlich-gniazd-3",
    );
    expect(generateUniqueSlug("Nowy Szlak Nad Wisłą", existing)).toBe(
      "nowy-szlak-nad-wisla",
    );
    expect(generateUniqueSlug("???", [])).toBe("szlak");
    expect(generateUniqueSlug("???", ["szlak"])).toBe("szlak-2");
  });
});
