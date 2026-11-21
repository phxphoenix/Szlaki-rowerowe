import { expect, test, type Locator, type Page } from "@playwright/test";
import {
  assertAllImagesLoaded,
  attachRuntimeMonitor,
  loginAsAdmin,
} from "./helpers";

const SAMPLE_DETAIL_PATH =
  "/szlaki/pogoria-iii-pogoria-iv-i-park-zielona-petla-slaskie";

async function assertNoHorizontalOverflow(page: Page, routeLabel: string) {
  const metrics = await page.evaluate(() => ({
    docScrollWidth: document.documentElement.scrollWidth,
    bodyScrollWidth: document.body.scrollWidth,
    innerWidth: window.innerWidth,
  }));

  expect(
    metrics.docScrollWidth,
    `Horizontal overflow on ${routeLabel}: documentElement.scrollWidth=${metrics.docScrollWidth} > innerWidth=${metrics.innerWidth}`,
  ).toBeLessThanOrEqual(metrics.innerWidth);
  expect(
    metrics.bodyScrollWidth,
    `Horizontal overflow on ${routeLabel}: body.scrollWidth=${metrics.bodyScrollWidth} > innerWidth=${metrics.innerWidth}`,
  ).toBeLessThanOrEqual(metrics.innerWidth);
}

async function assertMinTouchHeight(
  locator: Locator,
  label: string,
  minHeight = 44,
) {
  await expect(locator, `Missing touch target: ${label}`).toBeVisible();
  const box = await locator.boundingBox();
  expect(box, `No bounding box for touch target: ${label}`).not.toBeNull();
  expect(
    box!.height,
    `Touch target "${label}" height ${box!.height}px is below ${minHeight}px`,
  ).toBeGreaterThanOrEqual(minHeight);
}

test.describe("Responsive Layout & PWA Audit (E2E-06, E2E-07)", () => {
  test("E2E-06: audits horizontal overflow, >=44px mobile touch targets and sticky action bar across key routes", async ({
    page,
  }, testInfo) => {
    const monitor = attachRuntimeMonitor(page);
    const isMobileProject = testInfo.project.name === "iphone-15";

    // 1. Home page (/)
    await page.goto("/");
    await assertNoHorizontalOverflow(page, "/");
    await assertAllImagesLoaded(page);

    if (isMobileProject) {
      await assertMinTouchHeight(
        page.locator("header").getByRole("link", { name: /Dodaj szlak/i }),
        "Navbar Dodaj szlak",
      );
      await assertMinTouchHeight(
        page.getByRole("button", { name: /Przełącz motyw/i }),
        "Navbar ThemeToggle",
      );
      await assertMinTouchHeight(
        page
          .getByRole("group", { name: "Filtruj według województwa" })
          .getByRole("button", { name: /^Śląskie/i }),
        "Region pill Śląskie",
      );
      await assertMinTouchHeight(
        page.getByRole("button", { name: /^Filtry/i }),
        "Mobile Filtry toggle",
      );
      await assertMinTouchHeight(page.locator("#trail-sort-select"), "SortSelect");
      await assertMinTouchHeight(
        page.locator("#trail-search-input"),
        "Search input",
      );

      // Verify filtered catalog view keeps >= 44px reset CTA and zero overflow
      await page.goto("/?region=slaskie");
      await assertNoHorizontalOverflow(page, "/?region=slaskie");
      await assertMinTouchHeight(
        page.getByRole("button", { name: /Wyczyść filtry/i }),
        "FilterBar Wyczyść filtry",
      );
    }

    // 2. Trail detail page (/szlaki/[slug])
    await page.goto(SAMPLE_DETAIL_PATH);
    await assertNoHorizontalOverflow(page, SAMPLE_DETAIL_PATH);
    await assertAllImagesLoaded(page);

    if (isMobileProject) {
      const actionsBar = page.getByTestId("map-actions-bar");
      await expect(actionsBar).toBeVisible();

      const barPosition = await actionsBar.evaluate(
        (el) => window.getComputedStyle(el).position,
      );
      expect(barPosition).toBe("fixed");

      const barBox = await actionsBar.boundingBox();
      expect(barBox).not.toBeNull();
      const viewport = page.viewportSize()!;
      expect(barBox!.y).toBeGreaterThanOrEqual(0);
      expect(barBox!.y + barBox!.height).toBeLessThanOrEqual(
        viewport.height + 1,
      );

      await assertMinTouchHeight(
        actionsBar.getByRole("link", { name: /Otwórz trasę w Google Maps/i }),
        "Sticky Google Maps CTA",
      );
      await assertMinTouchHeight(
        actionsBar.getByRole("link", { name: /Dojazd do startu/i }),
        "Sticky Dojazd do startu",
      );
      await assertMinTouchHeight(
        actionsBar.getByRole("link", { name: /Pobierz GPX/i }),
        "Sticky Pobierz GPX",
      );
      await assertMinTouchHeight(
        actionsBar.getByRole("button", { name: /Udostępnij/i }),
        "Sticky Udostępnij",
      );
      await assertMinTouchHeight(
        page.getByRole("button", { name: /Moja pozycja/i }),
        "Map Moja pozycja GPS button",
      );
      await assertMinTouchHeight(
        page.getByRole("button", { name: /Wyśrodkuj trasę/i }),
        "Map recenter button",
      );
      await assertMinTouchHeight(
        page.getByRole("button", { name: /Pełny ekran mapy/i }),
        "Map fullscreen button",
      );
      if ((await page.getByTestId("trail-google-map").count()) > 0) {
        await assertMinTouchHeight(
          page.getByRole("button", { name: /^Teren$/i }),
          "Map type Teren button",
        );
      } else {
        await expect(
          page.getByRole("button", { name: /^Teren$/i }),
        ).toHaveCount(0);
      }
      await assertMinTouchHeight(
        page.getByRole("link", { name: /Źródło: SLASKIE\.travel/i }),
        "Hero source link",
      );
    }

    // 3. Login page (/logowanie)
    await page.goto("/logowanie");
    await assertNoHorizontalOverflow(page, "/logowanie");

    if (isMobileProject) {
      await assertMinTouchHeight(
        page.locator("#admin-password"),
        "Login password input",
      );
      await assertMinTouchHeight(
        page.getByRole("button", { name: /Zaloguj do panelu/i }),
        "Login submit CTA",
      );
      await assertMinTouchHeight(
        page.getByRole("button", { name: /Pokaż hasło/i }),
        "Toggle password visibility",
      );
    }

    // 4. Authenticated /dodaj page
    await loginAsAdmin(page, "/dodaj");
    await assertNoHorizontalOverflow(page, "/dodaj");

    if (isMobileProject) {
      await assertMinTouchHeight(
        page.getByRole("button", { name: /Pobierz dane ze strony/i }),
        "URL Importer button",
      );
      await assertMinTouchHeight(
        page.getByRole("button", { name: /Wybierz plik \.gpx/i }),
        "GPX file picker button",
      );
      await assertMinTouchHeight(
        page.getByRole("button", { name: /Wgraj zdjęcia/i }),
        "Image upload button",
      );
      await assertMinTouchHeight(
        page.getByRole("button", { name: /Dodaj punkt POI/i }),
        "Add POI button",
      );
      await assertMinTouchHeight(
        page.getByRole("button", { name: /Opublikuj szlak/i }),
        "Submit trail CTA",
      );
      await assertMinTouchHeight(
        page.getByRole("button", { name: /Wyloguj się/i }),
        "Logout button",
      );
    }

    monitor.assertClean({ checkNotFound: true });
  });

  test("E2E-07: verifies PWA manifest, viewport-fit=cover, icon responses (200) and zero 404 assets", async ({
    page,
    request,
  }) => {
    const monitor = attachRuntimeMonitor(page);

    await page.goto("/");

    // Viewport meta tag contains viewport-fit=cover
    const viewportContent = await page
      .locator('meta[name="viewport"]')
      .getAttribute("content");
    expect(viewportContent).toBeTruthy();
    expect(viewportContent).toContain("viewport-fit=cover");

    // Manifest link in DOM
    const manifestHref = await page
      .locator('link[rel="manifest"]')
      .getAttribute("href");
    expect(manifestHref).toBe("/manifest.webmanifest");

    // Apple touch icon link in DOM
    const appleIconHref = await page
      .locator('link[rel="apple-touch-icon"]')
      .first()
      .getAttribute("href");
    expect(appleIconHref).toBeTruthy();
    const appleIconRes = await request.get(appleIconHref!);
    expect(appleIconRes.status()).toBe(200);

    // Fetch /manifest.webmanifest and validate schema + icon URLs
    const manifestRes = await request.get("/manifest.webmanifest");
    expect(manifestRes.status()).toBe(200);

    const manifestJson = (await manifestRes.json()) as {
      name?: string;
      short_name?: string;
      display?: string;
      icons?: Array<{ src: string; sizes?: string; type?: string }>;
    };

    expect(manifestJson.name).toBe("Szlaki Rowerowe — Polska Kolekcja Tras");
    expect(manifestJson.display).toBe("standalone");
    expect(Array.isArray(manifestJson.icons)).toBe(true);
    expect(manifestJson.icons!.length).toBeGreaterThanOrEqual(3);

    const uniqueIconSrcs = Array.from(
      new Set(manifestJson.icons!.map((icon) => icon.src)),
    );
    for (const iconSrc of uniqueIconSrcs) {
      const iconRes = await request.get(iconSrc);
      expect(
        iconRes.status(),
        `Manifest icon ${iconSrc} returned status ${iconRes.status()}`,
      ).toBe(200);
    }

    // Visit detail page too so static images/assets are checked across both main views
    await page.goto(SAMPLE_DETAIL_PATH);
    await assertAllImagesLoaded(page);

    monitor.assertClean({ checkNotFound: true });
  });
});
