import { NextRequest, NextResponse } from "next/server";
import { isAuthenticatedRequest } from "@/lib/auth/session";
import { createTrail, listTrails } from "@/lib/trails/repository";
import { createTrailSchema, trailQuerySchema } from "@/lib/validation/trail";

export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams;
  const wantsUnpublished = searchParams.get("includeUnpublished") === "true";
  const includeUnpublished = wantsUnpublished
    ? await isAuthenticatedRequest(request)
    : false;

  const query = trailQuerySchema.parse({
    region: searchParams.get("region") ?? undefined,
    difficulty: searchParams.get("difficulty") ?? undefined,
    surface: searchParams.get("surface") ?? undefined,
    minDistance: searchParams.get("minDistance") ?? undefined,
    maxDistance: searchParams.get("maxDistance") ?? undefined,
    q: searchParams.get("q") ?? undefined,
    sort: searchParams.get("sort") ?? undefined,
    page: searchParams.get("page") ?? undefined,
    limit: searchParams.get("limit") ?? undefined,
    includeUnpublished,
  });

  const result = await listTrails(query);
  return NextResponse.json(result, { status: 200 });
}

export async function POST(request: NextRequest) {
  const authenticated = await isAuthenticatedRequest(request);
  if (!authenticated) {
    return NextResponse.json(
      { error: "Brak autoryzacji. Zaloguj się, aby dodać szlak." },
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

  const parsed = createTrailSchema.safeParse(rawBody);
  if (!parsed.success) {
    return NextResponse.json(
      {
        error: "Walidacja danych szlaku nie powiodła się.",
        details: parsed.error.flatten(),
        issues: parsed.error.issues,
      },
      { status: 400 },
    );
  }

  const created = await createTrail(parsed.data);
  return NextResponse.json(created, { status: 201 });
}
