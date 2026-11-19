import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { isAuthenticatedRequest } from "@/lib/auth/session";
import {
  importTrailFromUrl,
  SsrfBlockedError,
  UrlImportError,
} from "@/lib/importer/scraper";

const importUrlBodySchema = z.object({
  url: z
    .string({ message: "Adres URL musi być tekstem." })
    .trim()
    .min(1, "Podaj adres URL strony ze szlakiem."),
});

export async function POST(request: NextRequest) {
  const authenticated = await isAuthenticatedRequest(request);
  if (!authenticated) {
    return NextResponse.json(
      { error: "Brak autoryzacji. Zaloguj się, aby importować szlaki z linku." },
      { status: 401 },
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

  const parsed = importUrlBodySchema.safeParse(rawBody);
  if (!parsed.success) {
    return NextResponse.json(
      {
        error:
          parsed.error.issues[0]?.message ?? "Podaj poprawny adres URL.",
      },
      { status: 400 },
    );
  }

  try {
    const metadata = await importTrailFromUrl(parsed.data.url);
    return NextResponse.json(metadata, { status: 200 });
  } catch (error) {
    if (error instanceof SsrfBlockedError) {
      return NextResponse.json({ error: error.message }, { status: 400 });
    }
    if (error instanceof UrlImportError) {
      return NextResponse.json(
        { error: error.message },
        { status: error.statusCode },
      );
    }
    return NextResponse.json(
      { error: "Nie udało się zaimportować metadanych z podanego adresu URL." },
      { status: 502 },
    );
  }
}
