import { NextRequest, NextResponse } from "next/server";
import { isAuthenticatedRequest } from "@/lib/auth/session";
import {
  deleteTrail,
  getTrailByIdOrSlug,
  updateTrail,
} from "@/lib/trails/repository";
import { updateTrailSchema } from "@/lib/validation/trail";

type TrailRouteContext = {
  params: Promise<{ id: string }>;
};

export async function GET(request: NextRequest, context: TrailRouteContext) {
  const { id } = await context.params;
  const authenticated = await isAuthenticatedRequest(request);
  const trail = await getTrailByIdOrSlug(id, {
    includeUnpublished: authenticated,
  });

  if (!trail) {
    return NextResponse.json(
      { error: "Nie znaleziono szlaku." },
      { status: 404 },
    );
  }

  return NextResponse.json(trail, { status: 200 });
}

export async function PATCH(request: NextRequest, context: TrailRouteContext) {
  const authenticated = await isAuthenticatedRequest(request);
  if (!authenticated) {
    return NextResponse.json(
      { error: "Brak autoryzacji. Zaloguj się, aby edytować szlak." },
      { status: 401 },
    );
  }

  const { id } = await context.params;

  let rawBody: unknown;
  try {
    rawBody = await request.json();
  } catch {
    return NextResponse.json(
      { error: "Niepoprawny format JSON w treści żądania." },
      { status: 400 },
    );
  }

  const parsed = updateTrailSchema.safeParse(rawBody);
  if (!parsed.success) {
    return NextResponse.json(
      {
        error: "Walidacja danych aktualizacji szlaku nie powiodła się.",
        details: parsed.error.flatten(),
        issues: parsed.error.issues,
      },
      { status: 400 },
    );
  }

  const updated = await updateTrail(id, parsed.data);
  if (!updated) {
    return NextResponse.json(
      { error: "Nie znaleziono szlaku." },
      { status: 404 },
    );
  }

  return NextResponse.json(updated, { status: 200 });
}

export async function DELETE(
  request: NextRequest,
  context: TrailRouteContext,
) {
  const authenticated = await isAuthenticatedRequest(request);
  if (!authenticated) {
    return NextResponse.json(
      { error: "Brak autoryzacji. Zaloguj się, aby usunąć szlak." },
      { status: 401 },
    );
  }

  const { id } = await context.params;
  const deleted = await deleteTrail(id);

  if (!deleted) {
    return NextResponse.json(
      { error: "Nie znaleziono szlaku." },
      { status: 404 },
    );
  }

  return NextResponse.json({ deleted: true, id }, { status: 200 });
}
