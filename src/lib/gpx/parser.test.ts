import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import {
  GpxParseError,
  generateGpxXml,
  haversineDistanceKm,
  parseGpx,
} from "@/lib/gpx/parser";
import { douglasPeucker, simplifyRoutePoints } from "@/lib/gpx/simplify";
import type { RoutePoint } from "@/types/trail";

describe("GPX parser & Douglas-Peucker simplification", () => {
  it("GPX-01: parses real public/sample-gpx/slaskie-1019753.gpx with accurate distance, elevation, start/end, and bounds", () => {
    const filePath = path.resolve(
      process.cwd(),
      "public/sample-gpx/slaskie-1019753.gpx",
    );
    const xml = fs.readFileSync(filePath, "utf8");

    const parsed = parseGpx(xml);

    expect(parsed.name?.replace(/\s+/g, " ").trim()).toBe(
      "Trasa rowerowa z dzieckiem: Pogoria i Park Zielona",
    );
    // Oficjalny ślad GPX z slaskie.travel/download/route/gpx/1019753 ma ~23.02 km i 97 m przewyższenia
    expect(parsed.distanceKm).toBeGreaterThan(22.5);
    expect(parsed.distanceKm).toBeLessThan(23.5);
    expect(parsed.hasElevation).toBe(true);
    expect(parsed.elevationGainM).toBeGreaterThan(80);
    expect(parsed.elevationGainM).toBeLessThan(115);
    expect(parsed.startLat).toBeCloseTo(50.34398, 4);
    expect(parsed.startLng).toBeCloseTo(19.19803, 4);
    expect(parsed.endLat).toBeCloseTo(50.34398, 4);
    expect(parsed.endLng).toBeCloseTo(19.19801, 4);
    expect(parsed.isLoop).toBe(true);
    expect(parsed.bounds.north).toBeGreaterThan(parsed.bounds.south);
    expect(parsed.bounds.east).toBeGreaterThan(parsed.bounds.west);
    expect(parsed.routePoints[0]?.distKm).toBe(0);
    expect(
      parsed.routePoints[parsed.routePoints.length - 1]?.distKm,
    ).toBeCloseTo(parsed.distanceKm, 1);
  });

  it("GPX-02: reduces 5000-point track to <= 500 points via Douglas-Peucker keeping start, end, and shape", () => {
    const trkpts: string[] = [];
    const totalPoints = 5000;

    for (let i = 0; i < totalPoints; i += 1) {
      const progress = i / (totalPoints - 1);
      const lat = 50.0 + progress * 0.4 + Math.sin(progress * Math.PI * 10) * 0.02;
      const lng = 19.0 + progress * 0.6;
      const ele = 250 + Math.round(Math.sin(progress * Math.PI * 6) * 40);
      trkpts.push(
        `<trkpt lat="${lat.toFixed(6)}" lon="${lng.toFixed(6)}"><ele>${ele}</ele></trkpt>`,
      );
    }

    const hugeGpx = `<?xml version="1.0" encoding="UTF-8"?>
<gpx version="1.1">
  <trk>
    <name>Długi ślad testowy 5000 pkt</name>
    <trkseg>
      ${trkpts.join("\n      ")}
    </trkseg>
  </trk>
</gpx>`;

    const parsed = parseGpx(hugeGpx);

    expect(parsed.originalPointCount).toBe(5000);
    expect(parsed.routePoints.length).toBeLessThanOrEqual(500);
    expect(parsed.routePoints.length).toBeGreaterThan(50);
    expect(parsed.routePoints[0]?.lat).toBeCloseTo(50.0, 5);
    expect(parsed.routePoints[0]?.lng).toBeCloseTo(19.0, 5);
    expect(parsed.routePoints[parsed.routePoints.length - 1]?.lat).toBeCloseTo(
      50.4,
      4,
    );
    expect(parsed.routePoints[parsed.routePoints.length - 1]?.lng).toBeCloseTo(
      19.6,
      5,
    );
    expect(parsed.isLoop).toBe(false);

    // Bezpośredni test funkcji simplifyRoutePoints z mniejszym limitem
    const synthetic: RoutePoint[] = Array.from({ length: 200 }, (_, i) => ({
      lat: 50 + i * 0.001,
      lng: 19 + Math.sin(i / 10) * 0.01,
    }));
    const simplified50 = simplifyRoutePoints(synthetic, 50);
    expect(simplified50.length).toBeLessThanOrEqual(50);
    expect(simplified50[0]).toEqual(synthetic[0]);
    expect(simplified50[simplified50.length - 1]).toEqual(
      synthetic[synthetic.length - 1],
    );

    const fixedDp = douglasPeucker(synthetic, 100);
    expect(fixedDp.length).toBeLessThan(synthetic.length);
    expect(fixedDp[0]).toEqual(synthetic[0]);
    expect(fixedDp[fixedDp.length - 1]).toEqual(
      synthetic[synthetic.length - 1],
    );
  });

  it("GPX-03: handles GPX files without <ele> tags gracefully", () => {
    const gpxWithoutEle = `<?xml version="1.0" encoding="UTF-8"?>
<gpx version="1.1">
  <trk>
    <name>Płaski ślad bez wysokości</name>
    <trkseg>
      <trkpt lat="52.2297" lon="21.0122" />
      <trkpt lat="52.2397" lon="21.0222" />
      <trkpt lat="52.2497" lon="21.0322" />
    </trkseg>
  </trk>
</gpx>`;

    const parsed = parseGpx(gpxWithoutEle);

    expect(parsed.hasElevation).toBe(false);
    expect(parsed.elevationGainM).toBe(0);
    expect(parsed.distanceKm).toBeGreaterThan(2);
    expect(parsed.routePoints).toHaveLength(3);
    expect(parsed.routePoints[0]?.ele).toBeUndefined();
  });

  it("GPX-04: parses <rte>/<rtept> routes and multi-segment <trkseg> tracks", () => {
    const rteGpx = `<?xml version="1.0" encoding="UTF-8"?>
<gpx version="1.1">
  <rte>
    <name>Trasa z punktów rtept</name>
    <rtept lat="50.0614" lon="19.9366"><ele>219</ele></rtept>
    <rtept lat="50.0714" lon="19.9466"><ele>245</ele></rtept>
    <rtept lat="50.0814" lon="19.9566"><ele>230</ele></rtept>
  </rte>
</gpx>`;

    const parsed = parseGpx(rteGpx);

    expect(parsed.name).toBe("Trasa z punktów rtept");
    expect(parsed.routePoints).toHaveLength(3);
    expect(parsed.hasElevation).toBe(true);
    expect(parsed.elevationGainM).toBe(26);
    expect(parsed.isLoop).toBe(false);

    const multiSegGpx = `<?xml version="1.0" encoding="UTF-8"?>
<gpx version="1.1">
  <trk>
    <trkseg><trkpt lat="50.1" lon="19.1" /></trkseg>
    <trkseg><trkpt lat="50.2" lon="19.2" /></trkseg>
  </trk>
</gpx>`;
    const multiSegParsed = parseGpx(multiSegGpx);
    expect(multiSegParsed.routePoints).toHaveLength(2);
    expect(multiSegParsed.distanceKm).toBeGreaterThan(10);
  });

  it("GPX-05: throws GpxParseError on malformed XML or missing valid coordinates", () => {
    expect(() => parseGpx("")).toThrow(GpxParseError);
    expect(() => parseGpx("<gpx><trk><trkseg><trkpt>")).toThrow(GpxParseError);
    expect(() => parseGpx("to nie jest xml")).toThrow(GpxParseError);
    expect(() =>
      parseGpx("<gpx><trk><trkseg><trkpt lat='50.1' lon='19.1'/></trkseg></trk></gpx>"),
    ).toThrow(GpxParseError);
    expect(() =>
      parseGpx(
        "<gpx><trk><trkseg><trkpt lat='999' lon='19.1'/><trkpt lat='50.2' lon='abc'/></trkseg></trk></gpx>",
      ),
    ).toThrow(GpxParseError);
  });

  it("GPX-06: detects loops when start-to-end distance < 0.3 km and track has >= 3 points", () => {
    const loopGpx = `<?xml version="1.0" encoding="UTF-8"?>
<gpx version="1.1">
  <trk><trkseg>
    <trkpt lat="50.3514" lon="19.1995" />
    <trkpt lat="50.3614" lon="19.2095" />
    <trkpt lat="50.3519" lon="19.2001" />
  </trkseg></trk>
</gpx>`;
    const loopResult = parseGpx(loopGpx);
    expect(
      haversineDistanceKm(
        { lat: loopResult.startLat, lng: loopResult.startLng },
        { lat: loopResult.endLat, lng: loopResult.endLng },
      ),
    ).toBeLessThan(0.3);
    expect(loopResult.isLoop).toBe(true);

    const openGpx = `<?xml version="1.0" encoding="UTF-8"?>
<gpx version="1.1">
  <trk><trkseg>
    <trkpt lat="50.3514" lon="19.1995" />
    <trkpt lat="50.3614" lon="19.2095" />
    <trkpt lat="50.3714" lon="19.2195" />
  </trkseg></trk>
</gpx>`;
    expect(parseGpx(openGpx).isLoop).toBe(false);
  });

  it("generates valid GPX 1.1 XML that round-trips cleanly through parseGpx", () => {
    const xml = generateGpxXml({
      title: "Szlak Orlich Gniazd & Jura <Test>",
      shortDescription: "Piękny szlak przez Jurę",
      routePoints: [
        { lat: 50.453, lng: 19.551, ele: 340 },
        { lat: 50.461, lng: 19.562, ele: 375 },
        { lat: 50.47, lng: 19.57, ele: 360 },
      ],
    });

    expect(xml).toContain('version="1.1"');
    expect(xml).toContain("Szlak Orlich Gniazd &amp; Jura &lt;Test&gt;");

    const reparsed = parseGpx(xml);
    expect(reparsed.name).toBe("Szlak Orlich Gniazd & Jura <Test>");
    expect(reparsed.elevationGainM).toBe(35);
    expect(reparsed.routePoints).toHaveLength(3);
  });
});
