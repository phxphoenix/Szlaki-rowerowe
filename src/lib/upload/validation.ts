export const MAX_IMAGE_SIZE_BYTES = 10 * 1024 * 1024; // 10 MB
export const MAX_GPX_SIZE_BYTES = 15 * 1024 * 1024; // 15 MB

export function isBlobTokenConfigured(): boolean {
  const token = process.env.BLOB_READ_WRITE_TOKEN?.trim();
  return Boolean(token && token.length > 0 && token !== "vercel_blob_rw_...");
}

export const ALLOWED_IMAGE_MIME_TYPES = [
  "image/jpeg",
  "image/png",
  "image/webp",
] as const;

export const ALLOWED_GPX_MIME_TYPES = [
  "application/gpx+xml",
  "application/xml",
  "text/xml",
] as const;

export type AllowedImageMimeType = (typeof ALLOWED_IMAGE_MIME_TYPES)[number];
export type AllowedGpxMimeType = (typeof ALLOWED_GPX_MIME_TYPES)[number];
export type UploadCategory = "image" | "gpx";

const IMAGE_MIME_EXTENSIONS: Record<AllowedImageMimeType, readonly string[]> = {
  "image/jpeg": [".jpg", ".jpeg"],
  "image/png": [".png"],
  "image/webp": [".webp"],
};

const GPX_EXTENSIONS = [".gpx", ".xml"] as const;

const EXTENSION_TO_MIME: Record<string, string> = {
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".png": "image/png",
  ".webp": "image/webp",
  ".gpx": "application/gpx+xml",
  ".xml": "application/xml",
};

export type UploadValidationResult =
  | {
      valid: true;
      category: UploadCategory;
      contentType: string;
      pathname: string;
      maxSizeBytes: number;
      allowedContentTypes: readonly string[];
    }
  | {
      valid: false;
      error: string;
    };

function extractExtension(pathname: string): string {
  const normalized = pathname.replaceAll("\\", "/").split("?")[0].split("#")[0];
  const fileName = normalized.split("/").pop() ?? "";
  const dotIndex = fileName.lastIndexOf(".");
  if (dotIndex <= 0 || dotIndex === fileName.length - 1) {
    return "";
  }
  return fileName.slice(dotIndex).toLowerCase();
}

export function inferAllowedMimeFromPathname(pathname: string): string | null {
  if (typeof pathname !== "string" || pathname.trim().length === 0) {
    return null;
  }
  const ext = extractExtension(pathname);
  return EXTENSION_TO_MIME[ext] ?? null;
}

function isAllowedImageMime(value: string): value is AllowedImageMimeType {
  return (ALLOWED_IMAGE_MIME_TYPES as readonly string[]).includes(value);
}

function isAllowedGpxMime(value: string): value is AllowedGpxMimeType {
  return (ALLOWED_GPX_MIME_TYPES as readonly string[]).includes(value);
}

/**
 * Waliduje metadane przesyłanego pliku (MIME, rozszerzenie, ścieżkę i opcjonalny rozmiar).
 */
export function validateUploadMetadata(
  contentType: string,
  pathname: string,
  size?: number,
): UploadValidationResult {
  if (typeof pathname !== "string" || pathname.trim().length === 0) {
    return { valid: false, error: "Ścieżka pliku jest wymagana." };
  }

  const trimmedPath = pathname.trim().replaceAll("\\", "/");
  if (
    trimmedPath.includes("..") ||
    trimmedPath.includes("\0") ||
    trimmedPath.startsWith("/")
  ) {
    return {
      valid: false,
      error: "Nieprawidłowa nazwa lub ścieżka przesyłanego pliku.",
    };
  }

  const extension = extractExtension(trimmedPath);
  if (!extension) {
    return {
      valid: false,
      error: "Plik musi posiadać poprawne rozszerzenie (.jpg, .png, .webp lub .gpx).",
    };
  }

  const normalizedMime =
    typeof contentType === "string"
      ? contentType.split(";")[0].trim().toLowerCase()
      : "";

  if (!normalizedMime) {
    return {
      valid: false,
      error: "Brak lub niepoprawny typ MIME przesyłanego pliku.",
    };
  }

  if (isAllowedImageMime(normalizedMime)) {
    const validExtensions = IMAGE_MIME_EXTENSIONS[normalizedMime];
    if (!validExtensions.includes(extension)) {
      return {
        valid: false,
        error: `Rozszerzenie ${extension} nie pasuje do typu MIME ${normalizedMime}.`,
      };
    }

    if (size !== undefined) {
      if (!Number.isFinite(size) || size <= 0) {
        return { valid: false, error: "Rozmiar pliku musi być większy od 0." };
      }
      if (size > MAX_IMAGE_SIZE_BYTES) {
        return {
          valid: false,
          error: "Zdjęcie nie może przekraczać 10 MB.",
        };
      }
    }

    return {
      valid: true,
      category: "image",
      contentType: normalizedMime,
      pathname: trimmedPath,
      maxSizeBytes: MAX_IMAGE_SIZE_BYTES,
      allowedContentTypes: ALLOWED_IMAGE_MIME_TYPES,
    };
  }

  if (isAllowedGpxMime(normalizedMime)) {
    if (!(GPX_EXTENSIONS as readonly string[]).includes(extension)) {
      return {
        valid: false,
        error: `Niedozwolone rozszerzenie pliku ${extension} dla pliku GPX/XML.`,
      };
    }

    if (size !== undefined) {
      if (!Number.isFinite(size) || size <= 0) {
        return { valid: false, error: "Rozmiar pliku musi być większy od 0." };
      }
      if (size > MAX_GPX_SIZE_BYTES) {
        return {
          valid: false,
          error: "Plik GPX nie może przekraczać 15 MB.",
        };
      }
    }

    return {
      valid: true,
      category: "gpx",
      contentType: normalizedMime,
      pathname: trimmedPath,
      maxSizeBytes: MAX_GPX_SIZE_BYTES,
      allowedContentTypes: ALLOWED_GPX_MIME_TYPES,
    };
  }

  return {
    valid: false,
    error: `Niedozwolony typ pliku (${normalizedMime}, ${extension}). Akceptujemy wyłącznie obrazy (JPG, PNG, WebP) oraz pliki GPX.`,
  };
}
