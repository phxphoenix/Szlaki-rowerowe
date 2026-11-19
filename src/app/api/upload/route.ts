import { handleUpload, type HandleUploadBody } from "@vercel/blob/client";
import { NextRequest, NextResponse } from "next/server";
import { isAuthenticatedRequest } from "@/lib/auth/session";
import {
  inferAllowedMimeFromPathname,
  isBlobTokenConfigured,
  validateUploadMetadata,
} from "@/lib/upload/validation";

class UploadValidationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "UploadValidationError";
  }
}

interface ParsedClientPayload {
  contentType?: string;
  size?: number;
}

function parseClientPayload(clientPayload: string | null | undefined): ParsedClientPayload {
  if (!clientPayload || typeof clientPayload !== "string") {
    return {};
  }
  try {
    const parsed = JSON.parse(clientPayload) as unknown;
    if (!parsed || typeof parsed !== "object") {
      return {};
    }
    const record = parsed as Record<string, unknown>;
    return {
      contentType:
        typeof record.contentType === "string" ? record.contentType : undefined,
      size: typeof record.size === "number" ? record.size : undefined,
    };
  } catch {
    return {};
  }
}

function isHandleUploadBody(body: unknown): body is HandleUploadBody {
  if (!body || typeof body !== "object") return false;
  const record = body as Record<string, unknown>;
  return (
    record.type === "blob.generate-client-token" ||
    record.type === "blob.upload-completed"
  );
}

export async function POST(request: NextRequest) {
  const authenticated = await isAuthenticatedRequest(request);
  if (!authenticated) {
    return NextResponse.json(
      { error: "Brak autoryzacji. Zaloguj się, aby przesyłać pliki." },
      { status: 401 },
    );
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json(
      { error: "Niepoprawny format JSON w treści żądania." },
      { status: 400 },
    );
  }

  if (!body || typeof body !== "object") {
    return NextResponse.json(
      { error: "Niepoprawne dane żądania uploadu." },
      { status: 400 },
    );
  }

  const record = body as Record<string, unknown>;

  if (record.type === "blob.upload-completed") {
    if (!isBlobTokenConfigured()) {
      return NextResponse.json(
        {
          error:
            "Magazyn plików Vercel Blob nie jest skonfigurowany (brak BLOB_READ_WRITE_TOKEN).",
        },
        { status: 503 },
      );
    }
  } else {
    const isClientTokenEvent = record.type === "blob.generate-client-token";
    const payload =
      isClientTokenEvent &&
      record.payload &&
      typeof record.payload === "object"
        ? (record.payload as Record<string, unknown>)
        : record;

    const pathname =
      typeof payload.pathname === "string"
        ? payload.pathname
        : typeof payload.filename === "string"
          ? payload.filename
          : "";

    const clientMeta = isClientTokenEvent
      ? parseClientPayload(
          typeof payload.clientPayload === "string"
            ? payload.clientPayload
            : null,
        )
      : {};

    const explicitContentType =
      clientMeta.contentType ??
      (typeof payload.contentType === "string"
        ? payload.contentType
        : typeof payload.mimeType === "string"
          ? payload.mimeType
          : undefined);

    const resolvedContentType =
      explicitContentType !== undefined
        ? explicitContentType
        : (inferAllowedMimeFromPathname(pathname) ?? "");

    const resolvedSize =
      clientMeta.size ??
      (typeof payload.size === "number" ? payload.size : undefined);

    const validation = validateUploadMetadata(
      resolvedContentType,
      pathname,
      resolvedSize,
    );

    if (!validation.valid) {
      return NextResponse.json({ error: validation.error }, { status: 400 });
    }
  }

  if (!isBlobTokenConfigured()) {
    return NextResponse.json(
      {
        error:
          "Magazyn plików Vercel Blob nie jest skonfigurowany (brak BLOB_READ_WRITE_TOKEN).",
      },
      { status: 503 },
    );
  }

  if (!isHandleUploadBody(body)) {
    return NextResponse.json(
      {
        error:
          "Niepoprawny format zdarzenia Vercel Blob (oczekiwano blob.generate-client-token).",
      },
      { status: 400 },
    );
  }

  try {
    const jsonResponse = await handleUpload({
      body,
      request,
      onBeforeGenerateToken: async (pathname, clientPayload) => {
        const meta = parseClientPayload(clientPayload);
        const contentType =
          meta.contentType ?? inferAllowedMimeFromPathname(pathname) ?? "";

        const check = validateUploadMetadata(contentType, pathname, meta.size);
        if (!check.valid) {
          throw new UploadValidationError(check.error);
        }

        return {
          allowedContentTypes: [...check.allowedContentTypes],
          maximumSizeInBytes: check.maxSizeBytes,
          addRandomSuffix: true,
          tokenPayload: clientPayload ?? undefined,
        };
      },
    });

    return NextResponse.json(jsonResponse, { status: 200 });
  } catch (error) {
    if (error instanceof UploadValidationError) {
      return NextResponse.json({ error: error.message }, { status: 400 });
    }
    const message =
      error instanceof Error ? error.message : "Błąd podczas generowania tokenu uploadu.";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
