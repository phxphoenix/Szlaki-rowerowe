// @vitest-environment node
import { NextRequest } from "next/server";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { POST as loginPost } from "@/app/api/auth/login/route";
import { POST as logoutPost } from "@/app/api/auth/logout/route";
import { GET as sessionGet } from "@/app/api/auth/session/route";
import { POST as uploadPost } from "@/app/api/upload/route";
import {
  createSessionToken,
  SESSION_COOKIE_NAME,
} from "@/lib/auth/session";
import {
  MAX_GPX_SIZE_BYTES,
  MAX_IMAGE_SIZE_BYTES,
  validateUploadMetadata,
} from "@/lib/upload/validation";

const ORIGINAL_ADMIN_PASSWORD = process.env.ADMIN_PASSWORD;
const ORIGINAL_SESSION_SECRET = process.env.SESSION_SECRET;
const ORIGINAL_BLOB_TOKEN = process.env.BLOB_READ_WRITE_TOKEN;

describe("Auth & Upload API endpoints", () => {
  beforeEach(() => {
    process.env.ADMIN_PASSWORD = "super-tajne-haslo-rowerowe";
    process.env.SESSION_SECRET = "test-jwt-secret-key-at-least-32-chars";
    delete process.env.BLOB_READ_WRITE_TOKEN;
  });

  afterEach(() => {
    if (ORIGINAL_ADMIN_PASSWORD === undefined) {
      delete process.env.ADMIN_PASSWORD;
    } else {
      process.env.ADMIN_PASSWORD = ORIGINAL_ADMIN_PASSWORD;
    }
    if (ORIGINAL_SESSION_SECRET === undefined) {
      delete process.env.SESSION_SECRET;
    } else {
      process.env.SESSION_SECRET = ORIGINAL_SESSION_SECRET;
    }
    if (ORIGINAL_BLOB_TOKEN === undefined) {
      delete process.env.BLOB_READ_WRITE_TOKEN;
    } else {
      process.env.BLOB_READ_WRITE_TOKEN = ORIGINAL_BLOB_TOKEN;
    }
  });

  it("API-06: login returns 503 when ADMIN_PASSWORD is not configured and never accepts empty password", async () => {
    delete process.env.ADMIN_PASSWORD;

    const noEnvReq = new NextRequest("http://localhost:3000/api/auth/login", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ password: "" }),
    });
    expect((await loginPost(noEnvReq)).status).toBe(503);

    process.env.ADMIN_PASSWORD = "";
    const emptyEnvReq = new NextRequest("http://localhost:3000/api/auth/login", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ password: "" }),
    });
    expect((await loginPost(emptyEnvReq)).status).toBe(503);
  });

  it("API-06: login validates password (401 vs 200 + HttpOnly cookie), session & logout", async () => {
    const badReq = new NextRequest("http://localhost:3000/api/auth/login", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ password: "zle-haslo" }),
    });
    const badRes = await loginPost(badReq);
    expect(badRes.status).toBe(401);
    expect(badRes.headers.get("set-cookie")).toBeNull();

    const okReq = new NextRequest("http://localhost:3000/api/auth/login", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ password: "super-tajne-haslo-rowerowe" }),
    });
    const okRes = await loginPost(okReq);
    expect(okRes.status).toBe(200);

    const setCookieHeader = okRes.headers.get("set-cookie") ?? "";
    expect(setCookieHeader).toContain(`${SESSION_COOKIE_NAME}=`);
    expect(setCookieHeader.toLowerCase()).toContain("httponly");
    expect(setCookieHeader.toLowerCase()).toContain("samesite=lax");

    const sessionCookie = okRes.cookies.get(SESSION_COOKIE_NAME);
    expect(sessionCookie?.value).toBeTruthy();

    // Unauthenticated session check
    const unauthSessionRes = await sessionGet(
      new NextRequest("http://localhost:3000/api/auth/session"),
    );
    expect(await unauthSessionRes.json()).toEqual({
      authenticated: false,
      authConfigured: true,
    });

    // Authenticated session check
    const authSessionRes = await sessionGet(
      new NextRequest("http://localhost:3000/api/auth/session", {
        headers: {
          cookie: `${SESSION_COOKIE_NAME}=${sessionCookie?.value}`,
        },
      }),
    );
    expect(await authSessionRes.json()).toEqual({
      authenticated: true,
      authConfigured: true,
    });

    // Logout clears cookie
    const logoutRes = await logoutPost();
    expect(logoutRes.status).toBe(200);
    const logoutCookie = logoutRes.cookies.get(SESSION_COOKIE_NAME);
    expect(logoutCookie?.value).toBe("");
    expect(logoutCookie?.maxAge).toBe(0);
  });

  it("API-07: validateUploadMetadata enforces MIME allowlists, extensions, and size limits", () => {
    expect(
      validateUploadMetadata("image/jpeg", "trails/pogoria.jpg", 500_000).valid,
    ).toBe(true);
    expect(
      validateUploadMetadata("image/png", "trails/mapa.png", 1024).valid,
    ).toBe(true);
    expect(
      validateUploadMetadata("image/webp", "trails/widok.webp").valid,
    ).toBe(true);
    expect(
      validateUploadMetadata("image/svg+xml", "trails/ikona.svg").valid,
    ).toBe(true);
    expect(
      validateUploadMetadata("application/gpx+xml", "gpx/pogoria.gpx", 10_000)
        .valid,
    ).toBe(true);
    expect(
      validateUploadMetadata("text/xml", "gpx/dunajec.gpx", MAX_GPX_SIZE_BYTES)
        .valid,
    ).toBe(true);

    // Odrzucone rozmiary i typy
    expect(
      validateUploadMetadata(
        "image/jpeg",
        "trails/huge.jpg",
        MAX_IMAGE_SIZE_BYTES + 1,
      ).valid,
    ).toBe(false);
    expect(
      validateUploadMetadata(
        "application/gpx+xml",
        "gpx/huge.gpx",
        MAX_GPX_SIZE_BYTES + 1,
      ).valid,
    ).toBe(false);
    expect(
      validateUploadMetadata("application/x-msdownload", "evil.exe").valid,
    ).toBe(false);
    expect(validateUploadMetadata("text/html", "xss.html").valid).toBe(false);
    expect(validateUploadMetadata("application/javascript", "app.js").valid).toBe(
      false,
    );
    expect(validateUploadMetadata("image/jpeg", "fake.html").valid).toBe(false);
    expect(
      validateUploadMetadata("image/jpeg", "../escape/photo.jpg").valid,
    ).toBe(false);
  });

  it("API-07: POST /api/upload requires auth (401), rejects disallowed MIME/extensions (400) before 503 missing token", async () => {
    const unauthReq = new NextRequest("http://localhost:3000/api/upload", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        type: "blob.generate-client-token",
        payload: {
          pathname: "trails/photo.jpg",
          multipart: false,
          clientPayload: null,
        },
      }),
    });
    expect((await uploadPost(unauthReq)).status).toBe(401);

    const token = await createSessionToken();
    const cookie = `${SESSION_COOKIE_NAME}=${token}`;

    const disallowedCases = [
      {
        type: "blob.generate-client-token",
        payload: {
          pathname: "malware.exe",
          multipart: false,
          clientPayload: JSON.stringify({
            contentType: "application/x-msdownload",
          }),
        },
      },
      {
        type: "blob.generate-client-token",
        payload: {
          pathname: "payload.html",
          multipart: false,
          clientPayload: JSON.stringify({ contentType: "text/html" }),
        },
      },
      {
        pathname: "script.js",
        contentType: "application/javascript",
      },
    ];

    for (const payload of disallowedCases) {
      const badReq = new NextRequest("http://localhost:3000/api/upload", {
        method: "POST",
        headers: {
          "content-type": "application/json",
          cookie,
        },
        body: JSON.stringify(payload),
      });
      const res = await uploadPost(badReq);
      expect(res.status).toBe(400);
    }

    // Poprawny typ pliku bez skonfigurowanego BLOB_READ_WRITE_TOKEN -> 503
    const validWithoutBlobTokenReq = new NextRequest(
      "http://localhost:3000/api/upload",
      {
        method: "POST",
        headers: {
          "content-type": "application/json",
          cookie,
        },
        body: JSON.stringify({
          type: "blob.generate-client-token",
          payload: {
            pathname: "trails/pogoria.gpx",
            multipart: false,
            clientPayload: JSON.stringify({
              contentType: "application/gpx+xml",
              size: 12000,
            }),
          },
        }),
      },
    );

    const missingTokenRes = await uploadPost(validWithoutBlobTokenReq);
    expect(missingTokenRes.status).toBe(503);

    // Z poprawnym formatem BLOB_READ_WRITE_TOKEN generuje token klienta Vercel Blob
    process.env.BLOB_READ_WRITE_TOKEN = "vercel_blob_rw_teststore123_secretvalue";
    const validWithTokenReq = new NextRequest(
      "http://localhost:3000/api/upload",
      {
        method: "POST",
        headers: {
          "content-type": "application/json",
          cookie,
        },
        body: JSON.stringify({
          type: "blob.generate-client-token",
          payload: {
            pathname: "trails/pogoria.jpg",
            multipart: false,
            clientPayload: JSON.stringify({
              contentType: "image/jpeg",
              size: 120_000,
            }),
          },
        }),
      },
    );
    const tokenRes = await uploadPost(validWithTokenReq);
    expect(tokenRes.status).toBe(200);
    const tokenBody = (await tokenRes.json()) as {
      type: string;
      clientToken: string;
    };
    expect(tokenBody.type).toBe("blob.generate-client-token");
    expect(tokenBody.clientToken).toContain("vercel_blob_client_");
  });
});
