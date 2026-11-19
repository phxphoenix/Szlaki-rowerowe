// @vitest-environment node
import { NextRequest } from "next/server";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { POST as importUrlPost } from "@/app/api/import-url/route";
import { GET as trailDetailGet, PATCH as trailPatch, DELETE as trailDelete } from "@/app/api/trails/[id]/route";
import { GET as trailsGet, POST as trailsPost } from "@/app/api/trails/route";
import {
  createSessionToken,
  SESSION_COOKIE_NAME,
} from "@/lib/auth/session";
import * as scraperModule from "@/lib/importer/scraper";
import { resetMemoryStore } from "@/lib/trails/repository";
import type { Trail, TrailListResponse } from "@/types/trail";

async function buildAuthCookieHeader(): Promise<string> {
  const token = await createSessionToken();
  return `${SESSION_COOKIE_NAME}=${token}`;
}

const validCreatePayload = {
  title: "Szlak Beskidzkich Przełęczy",
  shortDescription: "Wymagająca pętla górska przez Przełęcz Salmopolską i Kubalonkę.",
  content: "## Opis\nMalownicza górska trasa szosowa w Beskidzie Śląskim.",
  region: "slaskie",
  subregion: "Beskid Śląski",
  difficulty: "hard",
  surface: "asphalt",
  trailColor: "red",
  distanceKm: 68.4,
  elevationGainM: 1420,
  estimatedTimeMin: 240,
  isLoop: true,
  coverImageUrl: "/images/trails/slaskie-1019753-cover.svg",
  sourceUrl: "https://slaskie.travel/route/999001",
  sourceName: "SLASKIE.travel",
};

describe("REST API: /api/trails, /api/trails/[id] & /api/import-url", () => {
  beforeEach(() => {
    delete process.env.DATABASE_URL;
    process.env.SESSION_SECRET = "test-session-secret-minimum-32-chars-ok";
    resetMemoryStore();
    vi.restoreAllMocks();
  });

  it("API-01: GET /api/trails returns 200 with published trails, regionCounts, and pagination", async () => {
    const request = new NextRequest("http://localhost:3000/api/trails");
    const response = await trailsGet(request);
    expect(response.status).toBe(200);

    const data = (await response.json()) as TrailListResponse;
    expect(data.total).toBe(7);
    expect(data.items).toHaveLength(7);
    expect(data.page).toBe(1);
    expect(data.totalPages).toBe(1);
    expect(data.regionCounts.slaskie).toBe(3);
    expect(Object.keys(data.regionCounts)).toHaveLength(16);
  });

  it("API-02: GET /api/trails?region=slaskie&sort=distance_desc returns filtered & sorted trails", async () => {
    const request = new NextRequest(
      "http://localhost:3000/api/trails?region=slaskie&sort=distance_desc",
    );
    const response = await trailsGet(request);
    expect(response.status).toBe(200);

    const data = (await response.json()) as TrailListResponse;
    expect(data.total).toBe(3);
    expect(data.items.every((item) => item.region === "slaskie")).toBe(true);

    for (let i = 1; i < data.items.length; i += 1) {
      expect(data.items[i].distanceKm).toBeLessThanOrEqual(
        data.items[i - 1].distanceKm,
      );
    }
  });

  it("API-03: rejects unauthenticated mutations (POST, PATCH, DELETE) with 401", async () => {
    const postReq = new NextRequest("http://localhost:3000/api/trails", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(validCreatePayload),
    });
    expect((await trailsPost(postReq)).status).toBe(401);

    const patchReq = new NextRequest(
      "http://localhost:3000/api/trails/pogoria-iii-pogoria-iv-i-park-zielona-petla-slaskie",
      {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ title: "Zmiana" }),
      },
    );
    expect(
      (
        await trailPatch(patchReq, {
          params: Promise.resolve({
            id: "pogoria-iii-pogoria-iv-i-park-zielona-petla-slaskie",
          }),
        })
      ).status,
    ).toBe(401);

    const deleteReq = new NextRequest(
      "http://localhost:3000/api/trails/pogoria-iii-pogoria-iv-i-park-zielona-petla-slaskie",
      { method: "DELETE" },
    );
    expect(
      (
        await trailDelete(deleteReq, {
          params: Promise.resolve({
            id: "pogoria-iii-pogoria-iv-i-park-zielona-petla-slaskie",
          }),
        })
      ).status,
    ).toBe(401);
  });

  it("API-04 & CRUD: POST /api/trails creates trail (201), GET/PATCH/DELETE by slug or UUID work", async () => {
    const cookie = await buildAuthCookieHeader();

    const createReq = new NextRequest("http://localhost:3000/api/trails", {
      method: "POST",
      headers: {
        "content-type": "application/json",
        cookie,
      },
      body: JSON.stringify(validCreatePayload),
    });

    const createRes = await trailsPost(createReq);
    expect(createRes.status).toBe(201);
    const created = (await createRes.json()) as Trail;
    expect(created.slug).toBe("szlak-beskidzkich-przeleczy");
    expect(created.id).toBeTruthy();

    // GET by slug
    const getBySlugRes = await trailDetailGet(
      new NextRequest(`http://localhost:3000/api/trails/${created.slug}`),
      { params: Promise.resolve({ id: created.slug }) },
    );
    expect(getBySlugRes.status).toBe(200);
    expect(((await getBySlugRes.json()) as Trail).id).toBe(created.id);

    // PATCH by UUID
    const patchRes = await trailPatch(
      new NextRequest(`http://localhost:3000/api/trails/${created.id}`, {
        method: "PATCH",
        headers: {
          "content-type": "application/json",
          cookie,
        },
        body: JSON.stringify({ distanceKm: 71.2 }),
      }),
      { params: Promise.resolve({ id: created.id }) },
    );
    expect(patchRes.status).toBe(200);
    expect(((await patchRes.json()) as Trail).distanceKm).toBe(71.2);

    // DELETE by slug
    const deleteRes = await trailDelete(
      new NextRequest(`http://localhost:3000/api/trails/${created.slug}`, {
        method: "DELETE",
        headers: { cookie },
      }),
      { params: Promise.resolve({ id: created.slug }) },
    );
    expect(deleteRes.status).toBe(200);
    expect(await deleteRes.json()).toEqual({
      deleted: true,
      id: created.slug,
    });

    // GET after delete -> 404
    const afterDeleteRes = await trailDetailGet(
      new NextRequest(`http://localhost:3000/api/trails/${created.id}`),
      { params: Promise.resolve({ id: created.id }) },
    );
    expect(afterDeleteRes.status).toBe(404);
  });

  it("API-05: POST /api/trails returns 400 with Zod details on invalid payload", async () => {
    const cookie = await buildAuthCookieHeader();

    const invalidReq = new NextRequest("http://localhost:3000/api/trails", {
      method: "POST",
      headers: {
        "content-type": "application/json",
        cookie,
      },
      body: JSON.stringify({
        ...validCreatePayload,
        title: "",
        region: "nieistniejace-wojewodztwo",
        distanceKm: -10,
      }),
    });

    const response = await trailsPost(invalidReq);
    expect(response.status).toBe(400);

    const body = (await response.json()) as {
      error: string;
      details: { fieldErrors: Record<string, string[]> };
      issues: unknown[];
    };
    expect(body.error).toBeTruthy();
    expect(body.details.fieldErrors.title).toBeDefined();
    expect(body.details.fieldErrors.region).toBeDefined();
    expect(body.details.fieldErrors.distanceKm).toBeDefined();
    expect(body.issues.length).toBeGreaterThanOrEqual(3);
  });

  it("POST /api/import-url enforces auth (401), SSRF block (400), and returns extracted metadata (200)", async () => {
    const unauthReq = new NextRequest("http://localhost:3000/api/import-url", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ url: "https://slaskie.travel/route/1019753" }),
    });
    expect((await importUrlPost(unauthReq)).status).toBe(401);

    const cookie = await buildAuthCookieHeader();
    const ssrfReq = new NextRequest("http://localhost:3000/api/import-url", {
      method: "POST",
      headers: { "content-type": "application/json", cookie },
      body: JSON.stringify({ url: "http://169.254.169.254/latest/meta-data/" }),
    });
    expect((await importUrlPost(ssrfReq)).status).toBe(400);

    vi.spyOn(scraperModule, "importTrailFromUrl").mockResolvedValueOnce({
      sourceUrl: "https://slaskie.travel/route/1019753",
      sourceName: "SLASKIE.travel",
      title: "Pogoria i Park Zielona",
      shortDescription: "Pętla rodzinna",
      content: "Pętla rodzinna wokół Pogorii.",
      coverImageUrl: "https://slaskie.travel/cover.jpg",
      imageUrls: ["https://slaskie.travel/cover.jpg"],
      gpxUrl: "https://slaskie.travel/route.gpx",
      gpxUrls: ["https://slaskie.travel/route.gpx"],
      region: "slaskie",
      distanceKm: 19.8,
      elevationGainM: 44,
      difficulty: "easy",
      surface: "asphalt",
    });

    const okReq = new NextRequest("http://localhost:3000/api/import-url", {
      method: "POST",
      headers: { "content-type": "application/json", cookie },
      body: JSON.stringify({ url: "https://slaskie.travel/route/1019753" }),
    });
    const okRes = await importUrlPost(okReq);
    expect(okRes.status).toBe(200);
    const data = (await okRes.json()) as scraperModule.ImportedTrailMetadata;
    expect(data.region).toBe("slaskie");
    expect(data.sourceName).toBe("SLASKIE.travel");
  });
});
