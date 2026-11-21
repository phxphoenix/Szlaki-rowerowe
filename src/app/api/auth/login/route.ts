import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import {
  checkLoginRateLimit,
  clearLoginRateLimitForIp,
  extractClientIp,
  recordFailedLoginAttempt,
} from "@/lib/auth/rate-limit";
import {
  createSessionToken,
  isAuthConfigured,
  setSessionCookie,
  verifyAdminPassword,
} from "@/lib/auth/session";

const loginBodySchema = z.object({
  password: z
    .string({ message: "Hasło musi być tekstem." })
    .min(1, "Podaj hasło administratora."),
});

export async function POST(request: NextRequest) {
  if (!isAuthConfigured()) {
    return NextResponse.json(
      {
        error:
          "Autoryzacja nie jest skonfigurowana na serwerze (brak zmiennej ADMIN_PASSWORD).",
      },
      { status: 503 },
    );
  }

  const clientIp = extractClientIp(request);
  const rateLimit = checkLoginRateLimit(clientIp);
  if (!rateLimit.allowed) {
    return NextResponse.json(
      {
        error: `Zbyt wiele nieudanych prób logowania. Spróbuj ponownie za ${rateLimit.retryAfterSeconds} s.`,
      },
      {
        status: 429,
        headers: {
          "Retry-After": String(rateLimit.retryAfterSeconds),
        },
      },
    );
  }

  let rawBody: unknown;
  try {
    rawBody = await request.json();
  } catch {
    return NextResponse.json(
      { error: "Niepoprawny format JSON w treści żądania." },
      { status: 400 },
    );
  }

  const parsed = loginBodySchema.safeParse(rawBody);
  if (!parsed.success) {
    return NextResponse.json(
      {
        error: parsed.error.issues[0]?.message ?? "Podaj hasło administratora.",
      },
      { status: 400 },
    );
  }

  if (!verifyAdminPassword(parsed.data.password)) {
    recordFailedLoginAttempt(clientIp);
    return NextResponse.json(
      { error: "Nieprawidłowe hasło administratora." },
      { status: 401 },
    );
  }

  clearLoginRateLimitForIp(clientIp);
  const token = await createSessionToken();
  const response = NextResponse.json({ authenticated: true }, { status: 200 });
  return setSessionCookie(response, token, request);
}
