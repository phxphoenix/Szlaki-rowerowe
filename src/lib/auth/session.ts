import crypto from "node:crypto";
import { jwtVerify, SignJWT, type JWTPayload } from "jose";
import { cookies } from "next/headers";
import type { NextRequest, NextResponse } from "next/server";

export const SESSION_COOKIE_NAME = "szlaki_admin_session";
export const SESSION_MAX_AGE_SECONDS = 60 * 60 * 24 * 7; // 7 dni

const JWT_ALGORITHM = "HS256";
const JWT_ISSUER = "szlaki-rowerowe";
const JWT_AUDIENCE = "szlaki-admin";

export interface AdminSessionPayload extends JWTPayload {
  role: "admin";
}

export class AuthConfigError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "AuthConfigError";
  }
}

export function isAuthConfigured(): boolean {
  const password = process.env.ADMIN_PASSWORD;
  return typeof password === "string" && password.length > 0;
}

function sha256KeyBytes(input: string): Uint8Array {
  const digest = crypto.createHash("sha256").update(input, "utf8").digest();
  return new Uint8Array(digest.buffer, digest.byteOffset, digest.byteLength).slice();
}

function getSigningSecretKey(): Uint8Array | null {
  const sessionSecret = process.env.SESSION_SECRET;
  if (typeof sessionSecret === "string" && sessionSecret.length > 0) {
    return sha256KeyBytes(sessionSecret);
  }

  const adminPassword = process.env.ADMIN_PASSWORD;
  if (typeof adminPassword === "string" && adminPassword.length > 0) {
    return sha256KeyBytes(`szlaki-session:${adminPassword}`);
  }

  if (process.env.NODE_ENV !== "production") {
    return sha256KeyBytes("szlaki-non-prod-test-secret");
  }

  return null;
}

/**
 * Weryfikuje podane hasło z `process.env.ADMIN_PASSWORD` za pomocą porównania
 * stałoczasowego (`crypto.timingSafeEqual` na skrótach SHA-256).
 */
export function verifyAdminPassword(password: string): boolean {
  const configuredPassword = process.env.ADMIN_PASSWORD;
  if (typeof configuredPassword !== "string" || configuredPassword.length === 0) {
    return false;
  }
  if (typeof password !== "string" || password.length === 0) {
    return false;
  }

  const candidateDigest = crypto
    .createHash("sha256")
    .update(password, "utf8")
    .digest();
  const expectedDigest = crypto
    .createHash("sha256")
    .update(configuredPassword, "utf8")
    .digest();

  return crypto.timingSafeEqual(candidateDigest, expectedDigest);
}

/**
 * Generuje podpisany token JWT (HS256) ważny przez 7 dni.
 */
export async function createSessionToken(): Promise<string> {
  const secretKey = getSigningSecretKey();
  if (!secretKey) {
    throw new AuthConfigError(
      "Brak konfiguracji klucza sesji (SESSION_SECRET lub ADMIN_PASSWORD).",
    );
  }

  return new SignJWT({ role: "admin" })
    .setProtectedHeader({ alg: JWT_ALGORITHM })
    .setSubject("admin")
    .setIssuer(JWT_ISSUER)
    .setAudience(JWT_AUDIENCE)
    .setIssuedAt()
    .setExpirationTime(`${SESSION_MAX_AGE_SECONDS}s`)
    .sign(secretKey);
}

/**
 * Weryfikuje token JWT sesji i zwraca payload lub `null` dla niepoprawnego/wygasłego tokenu.
 */
export async function verifySessionToken(
  token: string,
): Promise<AdminSessionPayload | null> {
  if (typeof token !== "string" || token.trim().length === 0) {
    return null;
  }

  const secretKey = getSigningSecretKey();
  if (!secretKey) {
    return null;
  }

  try {
    const { payload } = await jwtVerify(token, secretKey, {
      algorithms: [JWT_ALGORITHM],
      issuer: JWT_ISSUER,
      audience: JWT_AUDIENCE,
    });

    if (payload.role !== "admin") {
      return null;
    }

    return payload as AdminSessionPayload;
  } catch {
    return null;
  }
}

/**
 * Odczytuje i weryfikuje sesję z ciasteczek Next.js (`cookies()`).
 */
export async function getSessionFromCookies(): Promise<AdminSessionPayload | null> {
  try {
    const cookieStore = await cookies();
    const token = cookieStore.get(SESSION_COOKIE_NAME)?.value;
    if (!token) {
      return null;
    }
    return verifySessionToken(token);
  } catch {
    return null;
  }
}

function extractTokenFromCookieHeader(cookieHeader: string | null): string | null {
  if (!cookieHeader) return null;

  const parts = cookieHeader.split(";");
  for (const part of parts) {
    const eqIndex = part.indexOf("=");
    if (eqIndex === -1) continue;
    const name = part.slice(0, eqIndex).trim();
    if (name !== SESSION_COOKIE_NAME) continue;
    const rawValue = part.slice(eqIndex + 1).trim();
    if (!rawValue) return null;
    try {
      return decodeURIComponent(rawValue);
    } catch {
      return rawValue;
    }
  }
  return null;
}

function extractTokenFromRequest(request: Request | NextRequest): string | null {
  if ("cookies" in request && typeof request.cookies?.get === "function") {
    const cookieValue = request.cookies.get(SESSION_COOKIE_NAME)?.value;
    if (cookieValue) {
      return cookieValue;
    }
  }
  return extractTokenFromCookieHeader(request.headers.get("cookie"));
}

/**
 * Sprawdza, czy żądanie (lub bieżący kontekst ciasteczek) posiada aktywną sesję administratora.
 */
export async function isAuthenticatedRequest(
  request?: Request | NextRequest,
): Promise<boolean> {
  if (request) {
    const token = extractTokenFromRequest(request);
    if (!token) return false;
    const session = await verifySessionToken(token);
    return session !== null;
  }

  const session = await getSessionFromCookies();
  return session !== null;
}

function shouldUseSecureCookie(request?: Request | NextRequest): boolean {
  if (request) {
    const forwardedProto = request.headers
      .get("x-forwarded-proto")
      ?.split(",")[0]
      ?.trim()
      .toLowerCase();
    if (forwardedProto) {
      return forwardedProto === "https";
    }
    try {
      const parsed = new URL(request.url);
      if (parsed.protocol === "https:") return true;
      if (parsed.protocol === "http:") return false;
    } catch {
      // Fallback to NODE_ENV check
    }
  }
  return process.env.NODE_ENV === "production";
}

/**
 * Ustawia bezpieczne ciasteczko sesji `HttpOnly` na odpowiedzi `NextResponse`.
 */
export function setSessionCookie(
  response: NextResponse,
  token: string,
  request?: Request | NextRequest,
): NextResponse {
  response.cookies.set(SESSION_COOKIE_NAME, token, {
    httpOnly: true,
    sameSite: "lax",
    path: "/",
    secure: shouldUseSecureCookie(request),
    maxAge: SESSION_MAX_AGE_SECONDS,
  });
  return response;
}

/**
 * Usuwa ciasteczko sesji z odpowiedzi `NextResponse`.
 */
export function clearSessionCookie(
  response: NextResponse,
  request?: Request | NextRequest,
): NextResponse {
  response.cookies.set(SESSION_COOKIE_NAME, "", {
    httpOnly: true,
    sameSite: "lax",
    path: "/",
    secure: shouldUseSecureCookie(request),
    maxAge: 0,
  });
  return response;
}
