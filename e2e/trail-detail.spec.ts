import { expect, test } from "@playwright/test";
import { assertAllImagesLoaded, attachRuntimeMonitor } from "./helpers";

test.describe("Trail Detail View (E2E-04)", () => {
  test("E2E-04: navigates to Śląskie sample trail and verifies telemetry, map, elevation chart, POIs and Lightbox gallery", async ({
    page,
  }) => {
    const monitor = attachRuntimeMonitor(page);

    await page.goto("/");

    await page
      .getByRole("group", { name: "Filtruj według województwa" })
      .getByRole("button", { name: /^Śląskie/i })
      .click();
    await expect(page).toHaveURL(/region=slaskie/);

    const sampleTrailCard = page.locator(
      'main#katalog a[href="/szlaki/pogoria-iii-pogoria-iv-i-park-zielona-petla-slaskie"]',
    );
    await expect(sampleTrailCard).toBeVisible();
    await sampleTrailCard.click();

    await expect(page).toHaveURL(
      /\/szlaki\/pogoria-iii-pogoria-iv-i-park-zielona-petla-slaskie$/,
    );

    // Hero title & source link
    await expect(
      page.getByRole("heading", {
        level: 1,
        name: /Pogoria III, Pogoria IV i Park Zielona/i,
      }),
    ).toBeVisible();

    const sourceLink = page.getByRole("link", {
      name: /Źródło: SLASKIE\.travel/i,
    });
    await expect(sourceLink).toBeVisible();
    await expect(sourceLink).toHaveAttribute(
      "href",
      "https://slaskie.travel/route/1019753",
    );

    // 6 telemetry metrics
    const telemetrySection = page.locator(
      'section[aria-label="Parametry techniczne szlaku"]',
    );
    await expect(telemetrySection).toBeVisible();
    for (const label of [
      "Dystans",
      "Przewyższenie",
      "Szacowany czas",
      "Trudność",
      "Nawierzchnia",
      "Typ trasy",
    ]) {
      await expect(telemetrySection).toContainText(label);
    }

    // Central map section (Google Maps or SVG vector fallback with route path)
    await expect(page.locator("#trail-map-heading")).toBeVisible();
    const googleMapCount = await page
      .getByTestId("trail-google-map")
      .count();
    if (googleMapCount > 0) {
      await expect(page.getByTestId("trail-google-map")).toBeVisible();
    } else {
      await expect(page.getByTestId("map-fallback")).toBeVisible();
      const routePath = page.getByTestId("fallback-route-path");
      await expect(routePath).toBeVisible();
      const pathD = await routePath.getAttribute("d");
      expect(pathD).toBeTruthy();
      expect(pathD?.startsWith("M ")).toBe(true);
    }

    // Elevation chart
    await expect(page.getByTestId("elevation-chart")).toBeVisible();
    await expect(page.getByTestId("elevation-chart-svg")).toBeVisible();

    // Google Maps navigation CTA link
    const actionsBar = page.getByTestId("map-actions-bar");
    await expect(actionsBar).toBeVisible();
    const gmapsLink = actionsBar.getByRole("link", {
      name: /Otwórz w Google Maps/i,
    });
    await expect(gmapsLink).toBeVisible();
    const gmapsHref = await gmapsLink.getAttribute("href");
    expect(gmapsHref).toMatch(/^https:\/\/www\.google\.com\/maps\/dir\//);
    expect(gmapsHref).toContain("travelmode=bicycling");

    // Article content & POIs
    const articleProse = page.locator("article .trail-prose");
    await expect(articleProse).toBeVisible();
    await expect(articleProse).toContainText("Charakterystyka trasy");

    const poiAside = page.locator('aside[aria-labelledby="trail-pois-heading"]');
    await expect(poiAside).toBeVisible();
    await expect(poiAside).toContainText("Molo i plaża Pogoria III");

    // Gallery & Lightbox interaction
    const gallerySection = page.locator(
      'section[aria-labelledby="trail-gallery-heading"]',
    );
    await expect(gallerySection).toBeVisible();

    const thumbButtons = gallerySection.getByRole("button", {
      name: /Otwórz zdjęcie/i,
    });
    expect(await thumbButtons.count()).toBe(3);

    await thumbButtons.first().click();

    const dialog = page.getByRole("dialog");
    await expect(dialog).toBeVisible();
    await expect(page.getByTestId("lightbox-counter")).toHaveText("1 / 3");

    await dialog.getByRole("button", { name: /Następne zdjęcie/i }).click();
    await expect(page.getByTestId("lightbox-counter")).toHaveText("2 / 3");

    await page.keyboard.press("Escape");
    await expect(dialog).toBeHidden();

    // Reopen and close via button
    await thumbButtons.nth(1).click();
    await expect(dialog).toBeVisible();
    await expect(page.getByTestId("lightbox-counter")).toHaveText("2 / 3");
    await dialog.getByRole("button", { name: /Zamknij galerię/i }).click();
    await expect(dialog).toBeHidden();

    await assertAllImagesLoaded(page);
    monitor.assertClean({ checkNotFound: true });
  });
});
