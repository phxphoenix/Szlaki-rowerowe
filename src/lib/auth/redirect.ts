/**
 * Waliduje ścieżkę docelową przekierowania (`next`) po logowaniu,
 * chroniąc aplikację przed podatnością Open Redirect.
 * Akceptuje wyłącznie względne ścieżki rozpoczynające się od pojedynczego `/`.
 */
export function sanitizeNextPath(
  rawNext: string | string[] | undefined | null,
  fallback = "/dodaj",
): string {
  const candidate = Array.isArray(rawNext) ? rawNext[0] : rawNext;
  if (typeof candidate !== "string") {
    return fallback;
  }

  const trimmed = candidate.trim();
  if (trimmed.length === 0) {
    return fallback;
  }

  if (!trimmed.startsWith("/") || trimmed.startsWith("//")) {
    return fallback;
  }

  if (trimmed.includes("\\") || /[\r\n\0]/.test(trimmed)) {
    return fallback;
  }

  if (trimmed === "/logowanie" || trimmed.startsWith("/logowanie?")) {
    return fallback;
  }

  return trimmed;
}
