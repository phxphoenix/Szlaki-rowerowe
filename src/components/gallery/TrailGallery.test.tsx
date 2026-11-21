import { fireEvent, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it } from "vitest";
import { TrailGallery } from "@/components/gallery/TrailGallery";
import { TrailHeroImage } from "@/components/gallery/TrailHeroImage";
import type { TrailImage } from "@/types/trail";

const SAMPLE_IMAGES: TrailImage[] = [
  {
    id: "img-1",
    trailId: "trail-1",
    url: "/images/trails/slaskie-1019753-cover.jpg",
    caption: "Panorama jezior Pogoria III i IV",
    sortOrder: 0,
  },
  {
    id: "img-2",
    trailId: "trail-1",
    url: "/images/trails/slaskie-1019753-1.jpg",
    caption: "Asfaltowa droga rowerowa wzdłuż brzegu",
    sortOrder: 1,
  },
  {
    id: "img-3",
    trailId: "trail-1",
    url: "/images/trails/slaskie-1019753-2.jpg",
    caption: "Zacieniona aleja przez Park Zielona",
    sortOrder: 2,
  },
];

describe("TrailGallery & PhotoLightbox", () => {
  it("renders gallery thumbnails, opens Lightbox on click, supports ArrowRight/Escape and close button", async () => {
    const user = userEvent.setup();

    render(
      <TrailGallery
        images={SAMPLE_IMAGES}
        coverImageUrl="/images/trails/slaskie-1019753-cover.jpg"
        trailTitle="Pogoria III i IV"
      />,
    );

    expect(screen.getByText("3 zdjęcia")).toBeInTheDocument();

    const thumbButtons = screen.getAllByRole("button", {
      name: /Otwórz zdjęcie/i,
    });
    expect(thumbButtons).toHaveLength(3);

    // Open on 1st image
    await user.click(thumbButtons[0]);

    const dialog = screen.getByRole("dialog");
    expect(dialog).toHaveAttribute("aria-modal", "true");
    expect(screen.getByTestId("lightbox-counter")).toHaveTextContent("1 / 3");
    expect(
      screen.getAllByText("Panorama jezior Pogoria III i IV").length,
    ).toBeGreaterThanOrEqual(1);

    // Keyboard navigation: ArrowRight -> 2 / 3
    fireEvent.keyDown(window, { key: "ArrowRight" });
    expect(screen.getByTestId("lightbox-counter")).toHaveTextContent("2 / 3");

    // Keyboard navigation: ArrowLeft -> 1 / 3
    fireEvent.keyDown(window, { key: "ArrowLeft" });
    expect(screen.getByTestId("lightbox-counter")).toHaveTextContent("1 / 3");

    // Swipe gesture left -> 2 / 3
    const stage = screen.getByTestId("lightbox-stage");
    fireEvent.touchStart(stage, { touches: [{ clientX: 280, clientY: 200 }] });
    fireEvent.touchEnd(stage, {
      changedTouches: [{ clientX: 160, clientY: 205 }],
    });
    expect(screen.getByTestId("lightbox-counter")).toHaveTextContent("2 / 3");

    // Escape closes Lightbox
    fireEvent.keyDown(window, { key: "Escape" });
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();

    // Open 2nd image and close via Close button
    await user.click(thumbButtons[1]);
    expect(screen.getByTestId("lightbox-counter")).toHaveTextContent("2 / 3");

    await user.click(screen.getByRole("button", { name: /Zamknij galerię/i }));
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  });

  it("falls back to coverImageUrl when images array is empty", async () => {
    const user = userEvent.setup();

    render(
      <TrailGallery
        images={[]}
        coverImageUrl="/images/trails/velo-dunajec-cover.jpg"
        trailTitle="Velo Dunajec"
      />,
    );

    expect(screen.getByText("1 zdjęcie")).toBeInTheDocument();
    const thumb = screen.getByRole("button", { name: /Otwórz zdjęcie 1 z 1/i });
    await user.click(thumb);

    expect(screen.getByTestId("lightbox-counter")).toHaveTextContent("1 / 1");
  });

  it("renders fallback card on gallery thumbnail onError without affecting sibling images", () => {
    render(
      <TrailGallery
        images={SAMPLE_IMAGES}
        coverImageUrl="/images/trails/slaskie-1019753-cover.jpg"
        trailTitle="Pogoria III i IV"
      />,
    );

    const brokenImg = screen.getByAltText("Panorama jezior Pogoria III i IV");
    fireEvent.error(brokenImg);

    expect(screen.getByTestId("gallery-image-fallback")).toBeInTheDocument();
    expect(
      screen.getByText("Nie udało się załadować zdjęcia"),
    ).toBeInTheDocument();
    expect(
      screen.getByAltText("Asfaltowa droga rowerowa wzdłuż brzegu"),
    ).toBeInTheDocument();
  });

  it("renders dark fallback on Lightbox image onError and recovers when switching to another valid photo", async () => {
    const user = userEvent.setup();

    render(
      <TrailGallery
        images={SAMPLE_IMAGES}
        coverImageUrl="/images/trails/slaskie-1019753-cover.jpg"
        trailTitle="Pogoria III i IV"
      />,
    );

    const thumbButtons = screen.getAllByRole("button", {
      name: /Otwórz zdjęcie/i,
    });
    await user.click(thumbButtons[0]);

    const dialog = screen.getByRole("dialog");
    const lightboxImg = dialog.querySelector("img");
    expect(lightboxImg).not.toBeNull();
    fireEvent.error(lightboxImg!);

    expect(screen.getByTestId("lightbox-image-fallback")).toBeInTheDocument();

    // Switching to next image should recover and render <img>
    await user.click(screen.getByRole("button", { name: /Następne zdjęcie/i }));
    expect(screen.getByTestId("lightbox-counter")).toHaveTextContent("2 / 3");
    expect(
      screen.queryByTestId("lightbox-image-fallback"),
    ).not.toBeInTheDocument();
    expect(dialog.querySelector("img")).not.toBeNull();
  });
});

describe("TrailHeroImage", () => {
  it("renders hero image and falls back cleanly on onError", () => {
    render(
      <TrailHeroImage
        src="/images/trails/velo-dunajec-cover.jpg"
        alt="Velo Dunajec"
      />,
    );

    const heroImg = screen.getByAltText("Velo Dunajec");
    fireEvent.error(heroImg);

    expect(screen.getByTestId("hero-image-fallback")).toBeInTheDocument();
    expect(
      screen.getByText("Nie udało się załadować zdjęcia"),
    ).toBeInTheDocument();
  });
});
