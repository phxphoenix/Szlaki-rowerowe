// @vitest-environment node
import { NextRequest } from "next/server";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { POST as loginPost } from "@/app/api/auth/login/route";
import { POST as logoutPost } from "@/app/api/auth/logout/route";
import { GET as sessionGet } from "@/app/api/auth/session/route";
import { POST as uploadPost } from "@/app/api/upload/route";
import {
  checkLoginRateLimit,
  getTrackedLoginIpCount,
  LOGIN_RATE_LIMIT_MAX_ATTEMPTS,
  LOGIN_RATE_LIMIT_WINDOW_MS,
  MAX_TRACKED_IPS,
  recordFailedLoginAttempt,
  resetLoginRateLimit,
} from "@/lib/auth/rate-limit";
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
    resetLoginRateLimit();
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
    ).toBe(false);
    expect(
      validateUploadMetadata("image/svg+xml", "trails/ikona.png").valid,
    ).toBe(false);
    expect(
      validateUploadMetadata("image/png", "trails/ikona.svg").valid,
    ).toBe(false);
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
      {
        type: "blob.generate-client-token",
        payload: {
          pathname: "trails/vector.svg",
          multipart: false,
          clientPayload: JSON.stringify({ contentType: "image/svg+xml" }),
        },
      },
      {
        pathname: "trails/inferred-vector.svg",
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

  it("API-06b: rate-limits repeated failed login attempts by IP (HTTP 429 + Retry-After), isolates IPs, and resets cleanly", async () => {
    const attackerHeaders = {
      "content-type": "application/json",
      "x-forwarded-for": "203.0.113.10, 10.0.0.1",
    };

    for (let i = 0; i < LOGIN_RATE_LIMIT_MAX_ATTEMPTS; i += 1) {
      const res = await loginPost(
        new NextRequest("http://localhost:3000/api/auth/login", {
          method: "POST",
          headers: attackerHeaders,
          body: JSON.stringify({ password: `zle-haslo-${i}` }),
        }),
      );
      expect(res.status).toBe(401);
    }

    // 11th attempt from the same IP is blocked with 429 + Retry-After even with valid password
    const blockedRes = await loginPost(
      new NextRequest("http://localhost:3000/api/auth/login", {
        method: "POST",
        headers: attackerHeaders,
        body: JSON.stringify({ password: "super-tajne-haslo-rowerowe" }),
      }),
    );
    expect(blockedRes.status).toBe(429);
    const retryAfter = Number(blockedRes.headers.get("retry-after"));
    expect(Number.isFinite(retryAfter)).toBe(true);
    expect(retryAfter).toBeGreaterThan(0);

    // Different IP is unaffected
    const otherIpRes = await loginPost(
      new NextRequest("http://localhost:3000/api/auth/login", {
        method: "POST",
        headers: {
          "content-type": "application/json",
          "x-forwarded-for": "198.51.100.25",
        },
        body: JSON.stringify({ password: "super-tajne-haslo-rowerowe" }),
      }),
    );
    expect(otherIpRes.status).toBe(200);

    // resetLoginRateLimit clears state for tests
    resetLoginRateLimit();
    const afterResetRes = await loginPost(
      new NextRequest("http://localhost:3000/api/auth/login", {
        method: "POST",
        headers: attackerHeaders,
        body: JSON.stringify({ password: "super-tajne-haslo-rowerowe" }),
      }),
    );
    expect(afterResetRes.status).toBe(200);

    // Successful login resets prior failed attempts for that IP
    for (let i = 0; i < 6; i += 1) {
      const failRes = await loginPost(
        new NextRequest("http://localhost:3000/api/auth/login", {
          method: "POST",
          headers: attackerHeaders,
          body: JSON.stringify({ password: "wrong" }),
        }),
      );
      expect(failRes.status).toBe(401);
    }

    const okAfterFails = await loginPost(
      new NextRequest("http://localhost:3000/api/auth/login", {
        method: "POST",
        headers: attackerHeaders,
        body: JSON.stringify({ password: "super-tajne-haslo-rowerowe" }),
      }),
    );
    expect(okAfterFails.status).toBe(200);

    for (let i = 0; i < 6; i += 1) {
      const failRes = await loginPost(
        new NextRequest("http://localhost:3000/api/auth/login", {
          method: "POST",
          headers: attackerHeaders,
          body: JSON.stringify({ password: "wrong" }),
        }),
      );
      expect(failRes.status).toBe(401);
    }
  });

  it("API-06c: bounds tracked IPs to MAX_TRACKED_IPS under rotating IPs, prunes expired entries first, and preserves active lockouts", () => {
    const baseTime = 1_700_000_000_000;

    // Populate half the store with older entries and half with newer entries
    const halfCap = Math.floor(MAX_TRACKED_IPS / 2);
    for (let i = 0; i < halfCap; i += 1) {
      recordFailedLoginAttempt(`198.51.0.${i}`, baseTime);
    }
    for (let i = halfCap; i < MAX_TRACKED_IPS; i += 1) {
      recordFailedLoginAttempt(`198.51.1.${i}`, baseTime + 5 * 60 * 1000);
    }
    expect(getTrackedLoginIpCount()).toBe(MAX_TRACKED_IPS);

    // Advance past window for the first half only; inserting 1 new IP should prune expired entries first
    const afterFirstHalfExpires = baseTime + LOGIN_RATE_LIMIT_WINDOW_MS + 1;
    recordFailedLoginAttempt("203.0.113.200", afterFirstHalfExpires);
    expect(getTrackedLoginIpCount()).toBe(MAX_TRACKED_IPS - halfCap + 1);

    // Now fill up beyond MAX_TRACKED_IPS with active rotating IPs within the window
    resetLoginRateLimit();
    const activeTargetIp = "203.0.113.99";
    for (let i = 0; i < LOGIN_RATE_LIMIT_MAX_ATTEMPTS - 1; i += 1) {
      recordFailedLoginAttempt(activeTargetIp, baseTime + i);
    }

    // Rotate 1,000 IPs, then refresh activeTargetIp so it stays active at the tail, then rotate MAX_TRACKED_IPS - 500 more
    for (let i = 0; i < 1_000; i += 1) {
      recordFailedLoginAttempt(`192.0.2.${i}`, baseTime + 1_000 + i);
    }

    // 10th attempt refreshes activeTargetIp and triggers lockout
    const lockedStatus = recordFailedLoginAttempt(
      activeTargetIp,
      baseTime + 3_000,
    );
    expect(lockedStatus.allowed).toBe(false);
    expect(lockedStatus.retryAfterSeconds).toBeGreaterThan(0);

    // Push past MAX_TRACKED_IPS total distinct IPs within the 15-minute window
    for (let i = 1_000; i < MAX_TRACKED_IPS + 500; i += 1) {
      recordFailedLoginAttempt(`192.0.2.${i}`, baseTime + 4_000 + i);
      expect(getTrackedLoginIpCount()).toBeLessThanOrEqual(MAX_TRACKED_IPS);
    }

    expect(getTrackedLoginIpCount()).toBe(MAX_TRACKED_IPS);
    // activeTargetIp refreshed its position on the 10th attempt and fewer than MAX_TRACKED_IPS newer IPs followed
    expect(checkLoginRateLimit(activeTargetIp, baseTime + 10_000).allowed).toBe(
      false,
    );
    // Oldest IPs from the start of the rotation were evicted FIFO
    expect(
      checkLoginRateLimit("192.0.2.0", baseTime + 10_000).remaining,
    ).toBe(LOGIN_RATE_LIMIT_MAX_ATTEMPTS);
    // Still-recent rotating IP remains tracked
    expect(
      checkLoginRateLimit(
        `192.0.2.${MAX_TRACKED_IPS + 499}`,
        baseTime + 10_000,
      ).remaining,
    ).toBe(LOGIN_RATE_LIMIT_MAX_ATTEMPTS - 1);
  });

  it("API-06d: POST /api/auth/login keeps store bounded under rotating x-forwarded-for headers and still returns 429 on active tracked IP", async () => {
    const activeIp = "198.51.100.77";

    // Exceed MAX_TRACKED_IPS using rotating spoofed x-forwarded-for headers
    const totalRotatingIps = MAX_TRACKED_IPS + 200;
    for (let i = 0; i < totalRotatingIps; i += 1) {
      const octet3 = Math.floor(i / 256);
      const octet4 = i % 256;
      const res = await loginPost(
        new NextRequest("http://localhost:3000/api/auth/login", {
          method: "POST",
          headers: {
            "content-type": "application/json",
            "x-forwarded-for": `10.10.${octet3}.${octet4}`,
          },
          body: JSON.stringify({ password: "wrong-password" }),
        }),
      );
      expect(res.status).toBe(401);
    }

    expect(getTrackedLoginIpCount()).toBe(MAX_TRACKED_IPS);

    // Active tracked IP accumulates failures and is blocked with HTTP 429 + Retry-After
    for (let i = 0; i < LOGIN_RATE_LIMIT_MAX_ATTEMPTS; i += 1) {
      const res = await loginPost(
        new NextRequest("http://localhost:3000/api/auth/login", {
          method: "POST",
          headers: {
            "content-type": "application/json",
            "x-forwarded-for": activeIp,
          },
          body: JSON.stringify({ password: "wrong-password" }),
        }),
      );
      expect(res.status).toBe(401);
    }

    expect(getTrackedLoginIpCount()).toBe(MAX_TRACKED_IPS);

    const blockedRes = await loginPost(
      new NextRequest("http://localhost:3000/api/auth/login", {
        method: "POST",
        headers: {
          "content-type": "application/json",
          "x-forwarded-for": activeIp,
        },
        body: JSON.stringify({ password: "super-tajne-haslo-rowerowe" }),
      }),
    );
    expect(blockedRes.status).toBe(429);
    const retryAfter = Number(blockedRes.headers.get("retry-after"));
    expect(Number.isFinite(retryAfter)).toBe(true);
    expect(retryAfter).toBeGreaterThan(0);
  });

  it("API-06e: protects actively locked IPs from 20k rotating-IP eviction and demotes/expires them accurately", () => {
    const lockedIp = "203.0.113.42";
    for (let i = 0; i < LOGIN_RATE_LIMIT_MAX_ATTEMPTS; i += 1) {
      recordFailedLoginAttempt(lockedIp, 1_000 + i);
    }

    const lockBefore = checkLoginRateLimit(lockedIp, 1_010);
    expect(lockBefore.allowed).toBe(false);
    expect(lockBefore.remaining).toBe(0);

    // 20,000 rotating distinct IPs within the 15-minute window
    for (let i = 0; i < 20_000; i += 1) {
      const octet2 = Math.floor(i / 65_536);
      const octet3 = Math.floor(i / 256) % 256;
      const octet4 = i % 256;
      recordFailedLoginAttempt(`172.${16 + octet2}.${octet3}.${octet4}`, 2_000 + i);
      if (i % 500 === 0) {
        expect(checkLoginRateLimit(lockedIp, 2_000 + i).allowed).toBe(false);
      }
    }

    expect(getTrackedLoginIpCount()).toBe(MAX_TRACKED_IPS);
    const lockAfter = checkLoginRateLimit(lockedIp, 25_000);
    expect(lockAfter.allowed).toBe(false);
    expect(lockAfter.remaining).toBe(0);
    expect(lockAfter.retryAfterSeconds).toBeGreaterThan(0);

    // After full window passes, locked IP expires cleanly
    const afterWindow = checkLoginRateLimit(
      lockedIp,
      1_000 + LOGIN_RATE_LIMIT_WINDOW_MS + 100,
    );
    expect(afterWindow).toEqual({
      allowed: true,
      remaining: LOGIN_RATE_LIMIT_MAX_ATTEMPTS,
      retryAfterSeconds: 0,
    });

    // Partial expiry demotes a locked IP to unlocked so rotating noise can then evict it
    resetLoginRateLimit();
    const partialIp = "203.0.113.77";
    const stillLockedIp = "203.0.113.88";
    for (let i = 0; i < LOGIN_RATE_LIMIT_MAX_ATTEMPTS - 1; i += 1) {
      recordFailedLoginAttempt(partialIp, 1_000 + i);
    }
    recordFailedLoginAttempt(partialIp, 50_000);
    expect(checkLoginRateLimit(partialIp, 50_001).allowed).toBe(false);

    for (let i = 0; i < LOGIN_RATE_LIMIT_MAX_ATTEMPTS; i += 1) {
      recordFailedLoginAttempt(stillLockedIp, 60_000 + i);
    }

    const partialExpiryNow = 1_000 + LOGIN_RATE_LIMIT_WINDOW_MS + 50;
    const demotedStatus = checkLoginRateLimit(partialIp, partialExpiryNow);
    expect(demotedStatus).toEqual({
      allowed: true,
      remaining: LOGIN_RATE_LIMIT_MAX_ATTEMPTS - 1,
      retryAfterSeconds: 0,
    });

    for (let i = 0; i < MAX_TRACKED_IPS + 200; i += 1) {
      const octet3 = Math.floor(i / 256);
      const octet4 = i % 256;
      recordFailedLoginAttempt(
        `198.18.${octet3}.${octet4}`,
        partialExpiryNow + 100 + i,
      );
    }
    expect(getTrackedLoginIpCount()).toBe(MAX_TRACKED_IPS);
    expect(
      checkLoginRateLimit(stillLockedIp, partialExpiryNow + 10_000).allowed,
    ).toBe(false);
    expect(
      checkLoginRateLimit(partialIp, partialExpiryNow + 10_000).remaining,
    ).toBe(LOGIN_RATE_LIMIT_MAX_ATTEMPTS);

    // Even if MAX_TRACKED_IPS distinct IPs are all actively locked, store remains bounded <= MAX_TRACKED_IPS
    resetLoginRateLimit();
    for (let i = 0; i < MAX_TRACKED_IPS + 50; i += 1) {
      const octet3 = Math.floor(i / 256);
      const octet4 = i % 256;
      const ip = `198.19.${octet3}.${octet4}`;
      for (let j = 0; j < LOGIN_RATE_LIMIT_MAX_ATTEMPTS; j += 1) {
        recordFailedLoginAttempt(ip, 100_000 + i * 10 + j);
      }
      expect(getTrackedLoginIpCount()).toBeLessThanOrEqual(MAX_TRACKED_IPS);
    }
    expect(getTrackedLoginIpCount()).toBe(MAX_TRACKED_IPS);
    expect(checkLoginRateLimit("198.19.0.0", 200_000).allowed).toBe(true);
    expect(
      checkLoginRateLimit(
        `198.19.${Math.floor((MAX_TRACKED_IPS + 49) / 256)}.${(MAX_TRACKED_IPS + 49) % 256}`,
        200_000,
      ).allowed,
    ).toBe(false);
  });

  it("API-06f: keeps out-of-order sweep tracking active until remaining entries are monotonically ordered (probe 1C2)", () => {
    for (let i = 0; i < MAX_TRACKED_IPS - 1; i += 1) {
      const octet3 = Math.floor(i / 256);
      const octet4 = i % 256;
      recordFailedLoginAttempt(`100.64.${octet3}.${octet4}`, 2_000);
    }
    // Out-of-order older entry placed at the tail
    recordFailedLoginAttempt("9.9.9.9", 500);
    expect(getTrackedLoginIpCount()).toBe(MAX_TRACKED_IPS);

    // Triggers sweep before 9.9.9.9 expires; must NOT clear needsFullExpiredSweep because 9.9.9.9 (500) remains behind t=2000 entries
    recordFailedLoginAttempt("8.8.8.8", 2_002);
    expect(getTrackedLoginIpCount()).toBe(MAX_TRACKED_IPS);

    // At t=900600, 9.9.9.9 (500 <= 600) has expired while t=2000 entries remain active (> 600)
    recordFailedLoginAttempt("8.8.9.0", 2_000 + LOGIN_RATE_LIMIT_WINDOW_MS - 1_400);
    expect(getTrackedLoginIpCount()).toBe(MAX_TRACKED_IPS);
    // Expired 9.9.9.9 was pruned, so 100.64.0.1..5 were NOT evicted
    for (let i = 1; i <= 5; i += 1) {
      expect(
        checkLoginRateLimit(
          `100.64.0.${i}`,
          2_000 + LOGIN_RATE_LIMIT_WINDOW_MS - 1_400,
        ).remaining,
      ).toBe(LOGIN_RATE_LIMIT_MAX_ATTEMPTS - 1);
    }

    // Continuing with 4 more entries (total 5 entries at 900600..900604) keeps 100.64.0.5 active (only 4 active evicted, not 5)
    for (let i = 1; i <= 4; i += 1) {
      recordFailedLoginAttempt("8.8.9." + String(i), 900_600 + i);
    }
    expect(getTrackedLoginIpCount()).toBe(MAX_TRACKED_IPS);
    expect(checkLoginRateLimit("9.9.9.9", 900_604).remaining).toBe(
      LOGIN_RATE_LIMIT_MAX_ATTEMPTS,
    );
    expect(checkLoginRateLimit("100.64.0.5", 900_604).remaining).toBe(
      LOGIN_RATE_LIMIT_MAX_ATTEMPTS - 1,
    );
  });
});
