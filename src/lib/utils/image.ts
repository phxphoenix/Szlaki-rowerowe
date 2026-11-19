const OPTIMIZED_REMOTE_HOSTS = new Set([
  "slaskie.travel",
  "images.unsplash.com",
]);

/**
 * Określa, czy obraz powinien ominąć optymalizator Next.js (`unoptimized`),
 * np. dla lokalnych grafik SVG lub dowolnych zewnętrznych domen spoza `remotePatterns`.
 */
export function shouldUseUnoptimizedImage(url: string): boolean {
  const lower = url.toLowerCase();
  if (lower.endsWith(".svg") || lower.includes(".svg?")) {
    return true;
  }
  if (url.startsWith("/")) {
    return false;
  }
  try {
    const parsed = new URL(url);
    if (
      OPTIMIZED_REMOTE_HOSTS.has(parsed.hostname) ||
      parsed.hostname.endsWith(".slaskie.travel") ||
      parsed.hostname.endsWith(".public.blob.vercel-storage.com")
    ) {
      return false;
    }
    return true;
  } catch {
    return true;
  }
}
