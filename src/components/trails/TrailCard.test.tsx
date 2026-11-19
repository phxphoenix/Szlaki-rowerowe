import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { TrailCard } from "@/components/trails/TrailCard";
import type { TrailSummary } from "@/types/trail";

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
  coverImageUrl: "/images/trails/slaskie-1019753-cover.svg",
  sourceUrl: "https://slaskie.travel/route/1019753",
  sourceName: "SLASKIE.travel",
  published: true,
  createdAt: "2026-06-01T10:00:00.000Z",
  updatedAt: "2026-06-01T10:00:00.000Z",
};

describe("TrailCard (UI-01)", () => {
  it("renders cover image, region badge, difficulty, title, short description, telemetry and link to /szlaki/[slug]", () => {
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
    expect(image.getAttribute("src")).toContain("slaskie-1019753-cover.svg");

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
});
