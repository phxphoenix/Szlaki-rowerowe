import { expect, type Page } from "@playwright/test";

export const TEST_ADMIN_PASSWORD =
  process.env.ADMIN_PASSWORD || "TestVeloAdmin2026!";

export interface RuntimeMonitor {
  consoleErrors: string[];
  pageErrors: string[];
  serverErrors: Array<{ url: string; status: number }>;
  notFoundErrors: Array<{ url: string; status: number }>;
  allowNextUnauthorizedConsoleError: () => void;
  assertClean: (options?: { checkNotFound?: boolean }) => void;
}

export function attachRuntimeMonitor(page: Page): RuntimeMonitor {
  const consoleErrors: string[] = [];
  const pageErrors: string[] = [];
  const serverErrors: Array<{ url: string; status: number }> = [];
  const notFoundErrors: Array<{ url: string; status: number }> = [];
  let ignored401ConsoleErrors = 0;

  page.on("console", (msg) => {
    if (msg.type() === "error") {
      const text = msg.text();
      if (
        ignored401ConsoleErrors > 0 &&
        text.includes("401")
      ) {
        ignored401ConsoleErrors -= 1;
        return;
      }
      consoleErrors.push(text);
    }
  });

  page.on("pageerror", (error) => {
    pageErrors.push(error.message);
  });

  page.on("response", (response) => {
    const status = response.status();
    const url = response.url();
    if (status >= 500) {
      serverErrors.push({ url, status });
    } else if (status === 404) {
      notFoundErrors.push({ url, status });
    }
  });

  return {
    consoleErrors,
    pageErrors,
    serverErrors,
    notFoundErrors,
    allowNextUnauthorizedConsoleError() {
      ignored401ConsoleErrors += 1;
    },
    assertClean(options) {
      expect(
        pageErrors,
        `Uncaught page errors: ${pageErrors.join(" | ")}`,
      ).toEqual([]);
      expect(
        serverErrors,
        `HTTP >= 500 responses: ${JSON.stringify(serverErrors)}`,
      ).toEqual([]);
      expect(
        consoleErrors,
        `Console errors: ${consoleErrors.join(" | ")}`,
      ).toEqual([]);
      if (options?.checkNotFound) {
        expect(
          notFoundErrors,
          `HTTP 404 responses: ${JSON.stringify(notFoundErrors)}`,
        ).toEqual([]);
      }
    },
  };
}

export async function loginAsAdmin(
  page: Page,
  nextPath = "/dodaj",
): Promise<void> {
  await page.goto(`/logowanie?next=${encodeURIComponent(nextPath)}`);
  await page.locator("#admin-password").fill(TEST_ADMIN_PASSWORD);
  await page.getByRole("button", { name: /Zaloguj do panelu/i }).click();
  await page.waitForURL((url) => url.pathname === nextPath);
}

export async function assertAllImagesLoaded(page: Page): Promise<void> {
  const images = page.locator("img");
  const count = await images.count();
  expect(count).toBeGreaterThan(0);

  for (let i = 0; i < count; i += 1) {
    const img = images.nth(i);
    await img.scrollIntoViewIfNeeded();
    await expect
      .poll(
        async () =>
          img.evaluate((el: HTMLImageElement) => ({
            src: el.getAttribute("src") ?? el.currentSrc,
            complete: el.complete,
            naturalWidth: el.naturalWidth,
          })),
        { timeout: 5000 },
      )
      .toEqual(
        expect.objectContaining({
          complete: true,
        }),
      );

    const metrics = await img.evaluate((el: HTMLImageElement) => ({
      src: el.getAttribute("src") ?? el.currentSrc,
      alt: el.alt,
      complete: el.complete,
      naturalWidth: el.naturalWidth,
    }));

    expect(
      metrics.naturalWidth,
      `Image failed to load: ${JSON.stringify(metrics)}`,
    ).toBeGreaterThan(0);
  }
}
