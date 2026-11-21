import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { TrailCard } from "@/components/trails/TrailCard";
import { simplifyRoutePoints } from "@/lib/gpx/simplify";
import { SEED_TRAILS } from "@/lib/trails/seed-data";
import type { RoutePreviewPoint, TrailSummary } from "@/types/trail";

function toPreviewPoints(points: typeof SEED_TRAILS[number]["routePoints"]): RoutePreviewPoint[] {
  return simplifyRoutePoints(points, 48).map(({ lat, lng }) => ({ lat, lng }));
}

const POGORIA_PREVIEW = toPreviewPoints(SEED_TRAILS[0].routePoints);
const VELO_DUNAJEC_PREVIEW = toPreviewPoints(SEED_TRAILS[2].routePoints);

const SAMPLE_TRAIL: TrailSummary = {
  id: "11111111-1111-4111-8111-111111111111",
  slug: "szlak-rowerowy-slaskie-1019753",
  title: "Szlak Rowerowy Beskidu Śląskiego — Pętla Widokowa",
  shortDescription:
    "Malownicza trasa widokowa przez dolinę Wisły i przełęcze Beskidu Śląskiego.",
  region: "slaskie",
  subregion: "Beskid Śląski",
  difficulty: "moderate",
  surface: "mixed",
  trailColor: "red",
  distanceKm: 45.8,
  elevationGainM: 410,
  estimatedTimeMin: 165,
  isLoop: true,
  coverImageUrl: "/images/trails/slaskie-1019753-cover.jpg",
  routePreviewPoints: POGORIA_PREVIEW,
  sourceUrl: "https://slaskie.travel/route/1019753",
  sourceName: "SLASKIE.travel",
  published: true,
  createdAt: "2026-06-01T10:00:00.000Z",
  updatedAt: "2026-06-01T10:00:00.000Z",
};

describe("TrailCard (UI-01)", () => {
  it("renders cover image, route minimap overlay, region badge, difficulty, title, telemetry and link to /szlaki/[slug]", () => {
    render(<TrailCard trail={SAMPLE_TRAIL} />);

    const link = screen.getByRole("link", {
      name: /Szlak Rowerowy Beskidu Śląskiego/i,
    });
    expect(link).toHaveAttribute(
      "href",
      "/szlaki/szlak-rowerowy-slaskie-1019753",
    );

    const image = screen.getByRole("img", {
      name: SAMPLE_TRAIL.title,
    });
    expect(image).toBeInTheDocument();
    expect(image.getAttribute("src")).toContain("slaskie-1019753-cover.jpg");

    const minimap = screen.getByTestId("trail-card-route-minimap");
    expect(minimap).toHaveAttribute("data-variant", "overlay");
    expect(screen.getByTestId("trail-card-route-path")).toHaveAttribute("d");

    expect(screen.getByText("Śląskie")).toBeInTheDocument();
    expect(screen.getByText("Średni")).toBeInTheDocument();
    expect(screen.getByText("Pętla")).toBeInTheDocument();
    expect(screen.getByText("Beskid Śląski")).toBeInTheDocument();
    expect(screen.getByText("SLASKIE.travel")).toBeInTheDocument();

    expect(screen.getByText(SAMPLE_TRAIL.title)).toBeInTheDocument();
    expect(
      screen.getByText(SAMPLE_TRAIL.shortDescription),
    ).toBeInTheDocument();

    expect(screen.getByText("45,8 km")).toBeInTheDocument();
    expect(screen.getByText("↑ 410 m")).toBeInTheDocument();
    expect(screen.getByText("Mieszana")).toBeInTheDocument();
  });

  it("renders easy and hard difficulty variants properly without optional fields", () => {
    const easyTrail: TrailSummary = {
      ...SAMPLE_TRAIL,
      id: "22222222-2222-4222-8222-222222222222",
      slug: "velo-dunajec",
      title: "Velo Dunajec",
      region: "malopolskie",
      subregion: null,
      sourceName: null,
      difficulty: "easy",
      surface: "asphalt",
      distanceKm: 32,
      elevationGainM: 120,
      isLoop: false,
      coverImageUrl: "/images/trails/velo-dunajec-cover.jpg",
      routePreviewPoints: VELO_DUNAJEC_PREVIEW,
    };

    render(<TrailCard trail={easyTrail} />);

    expect(screen.getByText("Małopolskie")).toBeInTheDocument();
    expect(screen.getByText("Łatwy")).toBeInTheDocument();
    expect(screen.getByText("32 km")).toBeInTheDocument();
    expect(screen.getByText("↑ 120 m")).toBeInTheDocument();
    expect(screen.getByText("Asfalt")).toBeInTheDocument();
    expect(screen.queryByText("Pętla")).not.toBeInTheDocument();
    expect(screen.getByRole("link")).toHaveAttribute(
      "href",
      "/szlaki/velo-dunajec",
    );
  });

  it("produces distinct SVG route path strings for different trails (Pogoria vs Velo Dunajec)", () => {
    const pogoriaTrail: TrailSummary = {
      ...SAMPLE_TRAIL,
      slug: SEED_TRAILS[0].slug,
      title: SEED_TRAILS[0].title,
      trailColor: SEED_TRAILS[0].trailColor,
      isLoop: SEED_TRAILS[0].isLoop,
      routePreviewPoints: POGORIA_PREVIEW,
    };

    const dunajecTrail: TrailSummary = {
      ...SAMPLE_TRAIL,
      id: "33333333-3333-4333-8333-333333333333",
      slug: SEED_TRAILS[2].slug,
      title: SEED_TRAILS[2].title,
      region: SEED_TRAILS[2].region,
      trailColor: SEED_TRAILS[2].trailColor,
      isLoop: SEED_TRAILS[2].isLoop,
      coverImageUrl: "/images/trails/velo-dunajec-cover.jpg",
      routePreviewPoints: VELO_DUNAJEC_PREVIEW,
    };

    const { unmount } = render(<TrailCard trail={pogoriaTrail} />);
    const pogoriaPathD = screen
      .getByTestId("trail-card-route-path")
      .getAttribute("d");
    // Loop trail has START (#16A34A) but no META (#E11D48) marker
    const pogoriaMinimap = screen.getByTestId("trail-card-route-minimap");
    expect(pogoriaMinimap.querySelector('circle[fill="#16A34A"]')).not.toBeNull();
    expect(pogoriaMinimap.querySelector('circle[fill="#E11D48"]')).toBeNull();
    unmount();

    render(<TrailCard trail={dunajecTrail} />);
    const dunajecPathD = screen
      .getByTestId("trail-card-route-path")
      .getAttribute("d");
    // Point-to-point trail has both START (#16A34A) and META (#E11D48) markers
    const dunajecMinimap = screen.getByTestId("trail-card-route-minimap");
    expect(dunajecMinimap.querySelector('circle[fill="#16A34A"]')).not.toBeNull();
    expect(dunajecMinimap.querySelector('circle[fill="#E11D48"]')).not.toBeNull();

    expect(pogoriaPathD).toBeTruthy();
    expect(dunajecPathD).toBeTruthy();
    expect(pogoriaPathD).not.toBe(dunajecPathD);
  });

  it("switches cover to full RouteMiniMap when cover image triggers onError", () => {
    render(<TrailCard trail={SAMPLE_TRAIL} />);

    const image = screen.getByRole("img", { name: SAMPLE_TRAIL.title });
    expect(screen.getByTestId("trail-card-route-minimap")).toHaveAttribute(
      "data-variant",
      "overlay",
    );

    fireEvent.error(image);

    expect(
      screen.queryByAltText(SAMPLE_TRAIL.title),
    ).not.toBeInTheDocument();
    const fullMinimap = screen.getByTestId("trail-card-route-minimap");
    expect(fullMinimap).toHaveAttribute("data-variant", "full");
    expect(screen.getByTestId("trail-card-route-path")).toHaveAttribute("d");
  });

  it("renders full RouteMiniMap fallback with empty GPX notice when coverImageUrl and routePreviewPoints are missing", () => {
    const emptyTrail: TrailSummary = {
      ...SAMPLE_TRAIL,
      coverImageUrl: "",
      routePreviewPoints: [],
    };

    render(<TrailCard trail={emptyTrail} />);

    const fullMinimap = screen.getByTestId("trail-card-route-minimap");
    expect(fullMinimap).toHaveAttribute("data-variant", "full");
    expect(screen.getByText("Brak śladu GPX")).toBeInTheDocument();
    expect(screen.queryByTestId("trail-card-route-path")).not.toBeInTheDocument();
  });
});
