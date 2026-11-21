import path from "node:path";
import { expect, test } from "@playwright/test";
import { TEST_ADMIN_PASSWORD, attachRuntimeMonitor } from "./helpers";

test.describe("Owner Auth, Trail Creation & Cleanup Flow (E2E-05)", () => {
  test("E2E-05: protects /dodaj, validates login, creates trail with real GPX, verifies on /, and deletes it cleanly", async ({
    page,
  }, testInfo) => {
    const monitor = attachRuntimeMonitor(page);
    const uniqueTitle = `E2E Szlak Dunajca ${testInfo.project.name} ${Date.now()}`;

    // 1. Visiting /dodaj without session redirects to /logowanie
    await page.goto("/dodaj");
    await expect(page).toHaveURL(/\/logowanie\?next=(%2F|\/)dodaj/);
    await expect(
      page.getByRole("heading", { level: 1, name: /Logowanie/i }),
    ).toBeVisible();

    // 2. Wrong password shows error
    monitor.allowNextUnauthorizedConsoleError();
    await page.locator("#admin-password").fill("ZleHasloTestowe999!");
    await page.getByRole("button", { name: /Zaloguj do panelu/i }).click();

    await expect(page.getByTestId("login-error")).toBeVisible();
    await expect(page).toHaveURL(/\/logowanie/);

    // 3. Valid password logs in and opens /dodaj
    await page.locator("#admin-password").fill(TEST_ADMIN_PASSWORD);
    await page.getByRole("button", { name: /Zaloguj do panelu/i }).click();

    await expect(page).toHaveURL(/\/dodaj$/);
    await expect(
      page.getByRole("heading", {
        level: 1,
        name: /Dodaj nowy szlak rowerowy/i,
      }),
    ).toBeVisible();

    // 4. Fill form + upload real GPX file
    await page.locator("#trail-title").fill(uniqueTitle);
    await page.locator("#trail-region").selectOption("malopolskie");
    await page.locator("#trail-subregion").fill("Pieniny E2E");
    await page
      .locator("#trail-short-description")
      .fill(
        "Automatyczny testowy szlak rowerowy w Małopolsce utworzony w teście E2E Playwright.",
      );
    await page
      .locator("#trail-content")
      .fill(
        "## Opis testowy E2E\n\nTrasa wgrana bezpośrednio z pliku `velo-dunajec.gpx` w ramach testu integracyjnego.",
      );

    const gpxPath = path.join(
      process.cwd(),
      "public",
      "sample-gpx",
      "velo-dunajec.gpx",
    );
    await page.getByTestId("gpx-file-input").setInputFiles(gpxPath);

    // Verify automatic distance calculation & live GPX preview
    await expect(page.getByTestId("gpx-live-preview")).toBeVisible();
    await expect
      .poll(async () => Number(await page.locator("#trail-distance").inputValue()))
      .toBeGreaterThan(20);

    // Choose cover preset
    await page.getByRole("button", { name: /Velo Dunajec/i }).click();
    await expect(page.locator("#trail-cover-image")).toHaveValue(
      "/images/trails/velo-dunajec-cover.jpg",
    );

    // Submit form
    await page.getByRole("button", { name: /Opublikuj szlak/i }).click();

    await expect(page).toHaveURL(/\/szlaki\/e2e-szlak-dunajca-/);
    const createdUrl = page.url();
    const createdSlug = new URL(createdUrl).pathname.split("/").pop() ?? "";
    expect(createdSlug).toContain("e2e-szlak-dunajca-");

    await expect(
      page.getByRole("heading", { level: 1, name: uniqueTitle }),
    ).toBeVisible();

    // 5. Verify new trail appears on home catalog / with GPX route minimap
    await page.goto("/");
    const createdCardLink = page.locator(
      `main#katalog a[href="/szlaki/${createdSlug}"]`,
    );
    await expect(createdCardLink).toBeVisible();
    await expect(createdCardLink).toContainText(uniqueTitle);
    const createdRoutePath = createdCardLink.getByTestId(
      "trail-card-route-path",
    );
    await expect(createdRoutePath).toBeVisible();
    const createdPathD = await createdRoutePath.getAttribute("d");
    expect(createdPathD).toBeTruthy();
    expect(createdPathD?.startsWith("M ")).toBe(true);

    // 6. Navigate to edit page and delete via confirmation modal
    await createdCardLink.click();
    await expect(page).toHaveURL(new RegExp(`/szlaki/${createdSlug}$`));

    await page.getByRole("link", { name: /Edytuj szlak/i }).click();
    await expect(page).toHaveURL(new RegExp(`/szlaki/${createdSlug}/edytuj$`));

    await page.getByRole("button", { name: /Usuń szlak/i }).click();
    const confirmDialog = page.getByRole("dialog");
    await expect(confirmDialog).toBeVisible();

    await confirmDialog
      .getByRole("button", { name: /Tak, usuń szlak/i })
      .click();

    await expect(page).toHaveURL(/\/$/);
    await expect(
      page.locator(`main#katalog a[href="/szlaki/${createdSlug}"]`),
    ).toHaveCount(0);

    monitor.assertClean({ checkNotFound: true });
  });
});
