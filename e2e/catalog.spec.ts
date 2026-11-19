import { expect, test } from "@playwright/test";
import { assertAllImagesLoaded, attachRuntimeMonitor } from "./helpers";

test.describe("Catalog & Filtering (E2E-01, E2E-02, E2E-03)", () => {
  test("E2E-01: loads home catalog with trail cards, images, descriptions, telemetry and zero errors", async ({
    page,
  }) => {
    const monitor = attachRuntimeMonitor(page);

    await page.goto("/");

    await expect(
      page.getByRole("heading", { level: 1, name: /Szlaki rowerowe/i }),
    ).toBeVisible();

    const regionGroup = page.getByRole("group", {
      name: "Filtruj według województwa",
    });
    await expect(regionGroup).toBeVisible();
    await expect(
      regionGroup.getByRole("button", { name: /^Cała Polska/i }),
    ).toHaveAttribute("aria-pressed", "true");

    const cards = page.locator("main#katalog article");
    const cardCount = await cards.count();
    expect(cardCount).toBeGreaterThanOrEqual(6);

    for (let i = 0; i < cardCount; i += 1) {
      const card = cards.nth(i);
      const title = card.locator("h2");
      const description = card.locator("p");
      const img = card.locator("img");

      await expect(title).toBeVisible();
      expect((await title.innerText()).trim().length).toBeGreaterThan(2);

      await expect(description).toBeVisible();
      expect((await description.innerText()).trim().length).toBeGreaterThan(
        10,
      );

      await expect(img).toBeVisible();
      await expect(card).toContainText("km");
      await expect(card).toContainText("↑");
    }

    await assertAllImagesLoaded(page);
    monitor.assertClean({ checkNotFound: true });
  });

  test("E2E-02: filters by Śląskie voivodeship (region=slaskie) and reorders cards on sort change", async ({
    page,
  }) => {
    const monitor = attachRuntimeMonitor(page);

    await page.goto("/");

    const regionGroup = page.getByRole("group", {
      name: "Filtruj według województwa",
    });
    const slaskieButton = regionGroup.getByRole("button", {
      name: /^Śląskie/i,
    });
    await slaskieButton.click();

    await expect(page).toHaveURL(/region=slaskie/);
    await expect(slaskieButton).toHaveAttribute("aria-pressed", "true");
    await expect(
      page.getByRole("heading", { level: 2, name: /Województwo śląskie/i }),
    ).toBeVisible();

    const cards = page.locator("main#katalog article");
    await expect(cards).toHaveCount(3);

    for (let i = 0; i < 3; i += 1) {
      await expect(cards.nth(i)).toContainText("Śląskie");
    }

    const pogoriaLink = page.locator(
      'main#katalog a[href="/szlaki/pogoria-iii-pogoria-iv-i-park-zielona-petla-slaskie"]',
    );
    await expect(pogoriaLink).toBeVisible();
    await expect(pogoriaLink).toContainText("SLASKIE.travel");

    // Sort: Najkrótsze vs Najdłuższe
    const sortSelect = page.locator("#trail-sort-select");
    await sortSelect.selectOption("distance_asc");
    await expect(page).toHaveURL(/sort=distance_asc/);

    const shortestOrder = await cards.locator("h2").allInnerTexts();
    expect(shortestOrder[0]).toContain("Pogoria III");

    await sortSelect.selectOption("distance_desc");
    await expect(page).toHaveURL(/sort=distance_desc/);

    const longestOrder = await cards.locator("h2").allInnerTexts();
    expect(longestOrder[0]).toContain("Szlak Orlich Gniazd");
    expect(longestOrder).not.toEqual(shortestOrder);

    monitor.assertClean({ checkNotFound: true });
  });

  test("E2E-03: shows empty state for unmatched search and restores full list via Wyczyść filtry", async ({
    page,
  }) => {
    const monitor = attachRuntimeMonitor(page);

    await page.goto("/");

    const initialCount = await page.locator("main#katalog article").count();
    expect(initialCount).toBeGreaterThanOrEqual(6);

    const searchInput = page.locator("#trail-search-input");
    await searchInput.fill("NieistniejacySzlakXyz999");
    await searchInput.press("Enter");

    await expect(page).toHaveURL(/q=NieistniejacySzlakXyz999/);
    await expect(
      page.getByRole("heading", { level: 2, name: /Brak pasujących szlaków/i }),
    ).toBeVisible();
    await expect(page.locator("main#katalog article")).toHaveCount(0);

    const clearLink = page
      .locator("main#katalog")
      .getByRole("link", { name: /Wyczyść filtry/i });
    await expect(clearLink).toBeVisible();
    await clearLink.click();

    await expect(page).toHaveURL(/\/$/);
    await expect(page.locator("main#katalog article")).toHaveCount(
      initialCount,
    );

    monitor.assertClean({ checkNotFound: true });
  });
});
