import dns from "node:dns/promises";
import net from "node:net";
import type { Difficulty, RegionSlug, Surface } from "@/lib/constants/regions";

const DEFAULT_TIMEOUT_MS = 8_000;
const MAX_RESPONSE_BYTES = 2 * 1024 * 1024; // 2 MB
const MAX_REDIRECTS = 3;
const MAX_SHORT_DESCRIPTION_LENGTH = 360;

export class SsrfBlockedError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "SsrfBlockedError";
  }
}

export class UrlImportError extends Error {
  readonly statusCode: 400 | 422 | 502;

  constructor(message: string, statusCode: 400 | 422 | 502 = 502) {
    super(message);
    this.name = "UrlImportError";
    this.statusCode = statusCode;
  }
}

export interface DnsAddressRecord {
  address: string;
  family?: number;
}

export type DnsResolver = (hostname: string) => Promise<DnsAddressRecord[]>;

export interface ImportUrlOptions {
  resolveDns?: DnsResolver;
  fetchFn?: typeof fetch;
  timeoutMs?: number;
}

export interface ImportedTrailMetadata {
  sourceUrl: string;
  sourceName: string | null;
  title: string | null;
  shortDescription: string | null;
  content: string | null;
  coverImageUrl: string | null;
  imageUrls: string[];
  gpxUrl: string | null;
  gpxUrls: string[];
  region: RegionSlug | null;
  distanceKm: number | null;
  elevationGainM: number | null;
  difficulty: Difficulty | null;
  surface: Surface | null;
}

function stripIpv6BracketsAndZone(ip: string): string {
  const withoutBrackets =
    ip.startsWith("[") && ip.endsWith("]") ? ip.slice(1, -1) : ip;
  const zoneIndex = withoutBrackets.indexOf("%");
  return zoneIndex === -1
    ? withoutBrackets
    : withoutBrackets.slice(0, zoneIndex);
}

function parseIpv4Octets(ip: string): [number, number, number, number] | null {
  const parts = ip.split(".");
  if (parts.length !== 4) return null;
  const octets: number[] = [];
  for (const part of parts) {
    if (!/^\d+$/.test(part)) return null;
    const value = Number(part);
    if (!Number.isInteger(value) || value < 0 || value > 255) return null;
    octets.push(value);
  }
  return [octets[0], octets[1], octets[2], octets[3]];
}

function isBlockedIpv4Octets(
  octets: readonly [number, number, number, number],
): boolean {
  const [a, b, c] = octets;
  if (a === 0) return true; // 0.0.0.0/8
  if (a === 10) return true; // 10.0.0.0/8
  if (a === 100 && b >= 64 && b <= 127) return true; // 100.64.0.0/10 (CGNAT)
  if (a === 127) return true; // 127.0.0.0/8 (loopback)
  if (a === 169 && b === 254) return true; // 169.254.0.0/16 (link-local / metadata)
  if (a === 172 && b >= 16 && b <= 31) return true; // 172.16.0.0/12
  if (a === 192 && b === 0 && c === 0) return true; // 192.0.0.0/24
  if (a === 192 && b === 168) return true; // 192.168.0.0/16
  if (a >= 224) return true; // multicast & reserved (224.0.0.0/4+)
  return false;
}

function expandIpv6Groups(ip: string): number[] | null {
  let working = ip.toLowerCase();
  const lastColon = working.lastIndexOf(":");
  if (lastColon !== -1 && working.slice(lastColon + 1).includes(".")) {
    const ipv4Part = working.slice(lastColon + 1);
    const octets = parseIpv4Octets(ipv4Part);
    if (!octets) return null;
    const high = ((octets[0] << 8) | octets[1]).toString(16);
    const low = ((octets[2] << 8) | octets[3]).toString(16);
    working = `${working.slice(0, lastColon)}:${high}:${low}`;
  }

  const doubleColonParts = working.split("::");
  if (doubleColonParts.length > 2) return null;

  const left =
    doubleColonParts[0] !== "" ? doubleColonParts[0].split(":") : [];
  const right =
    doubleColonParts.length === 2 && doubleColonParts[1] !== ""
      ? doubleColonParts[1].split(":")
      : [];

  if (doubleColonParts.length === 1 && left.length !== 8) return null;
  if (doubleColonParts.length === 2 && left.length + right.length >= 8) {
    return null;
  }

  const missing =
    doubleColonParts.length === 2 ? 8 - (left.length + right.length) : 0;
  const rawGroups = [...left, ...Array<string>(missing).fill("0"), ...right];

  if (rawGroups.length !== 8) return null;

  const groups: number[] = [];
  for (const hex of rawGroups) {
    if (!/^[0-9a-f]{1,4}$/.test(hex)) return null;
    groups.push(Number.parseInt(hex, 16));
  }
  return groups;
}

function isBlockedIpv6(ip: string): boolean {
  const groups = expandIpv6Groups(ip);
  if (!groups) return true;

  const isAllZero = groups.every((group) => group === 0);
  if (isAllZero) return true; // ::

  const isLoopback =
    groups.slice(0, 7).every((group) => group === 0) && groups[7] === 1;
  if (isLoopback) return true; // ::1

  const isIpv4Mapped =
    groups.slice(0, 5).every((group) => group === 0) && groups[5] === 0xffff;
  const isIpv4Compatible =
    groups.slice(0, 6).every((group) => group === 0) &&
    (groups[6] !== 0 || groups[7] > 1);

  if (isIpv4Mapped || isIpv4Compatible) {
    const octets: [number, number, number, number] = [
      (groups[6] >> 8) & 0xff,
      groups[6] & 0xff,
      (groups[7] >> 8) & 0xff,
      groups[7] & 0xff,
    ];
    return isBlockedIpv4Octets(octets);
  }

  const first = groups[0];
  if ((first & 0xfe00) === 0xfc00) return true; // fc00::/7 (unique local)
  if ((first & 0xffc0) === 0xfe80) return true; // fe80::/10 (link-local)
  if ((first & 0xffc0) === 0xfec0) return true; // fec0::/10 (site-local)
  if ((first & 0xff00) === 0xff00) return true; // ff00::/8 (multicast)

  return false;
}

export function isBlockedIpAddress(rawIp: string): boolean {
  const cleanIp = stripIpv6BracketsAndZone(rawIp.trim());
  const version = net.isIP(cleanIp);
  if (version === 4) {
    const octets = parseIpv4Octets(cleanIp);
    return octets ? isBlockedIpv4Octets(octets) : true;
  }
  if (version === 6) {
    return isBlockedIpv6(cleanIp);
  }
  return false;
}

function isBlockedHostname(hostname: string): boolean {
  const clean = stripIpv6BracketsAndZone(hostname.toLowerCase()).replace(
    /\.+$/,
    "",
  );
  if (!clean) return true;

  if (
    clean === "localhost" ||
    clean.endsWith(".localhost") ||
    clean.endsWith(".local") ||
    clean.endsWith(".internal") ||
    clean.endsWith(".arpa") ||
    clean === "ip6-localhost" ||
    clean === "ip6-loopback" ||
    clean === "metadata.google.internal"
  ) {
    return true;
  }

  if (net.isIP(clean) !== 0) {
    return isBlockedIpAddress(clean);
  }

  return false;
}

/**
 * Waliduje zewnętrzny URL przed pobraniem (ochrona przed SSRF).
 * Akceptuje wyłącznie `http:` i `https:`, blokuje localhost, domeny lokalne oraz prywatne IPv4/IPv6.
 */
export function validateSafeExternalUrl(rawUrl: string): URL {
  if (typeof rawUrl !== "string" || rawUrl.trim().length === 0) {
    throw new UrlImportError("Podaj adres URL do zaimportowania.", 400);
  }

  let parsed: URL;
  try {
    parsed = new URL(rawUrl.trim());
  } catch {
    throw new UrlImportError("Nieprawidłowy format adresu URL.", 400);
  }

  if (parsed.protocol !== "http:" && parsed.protocol !== "https:") {
    throw new SsrfBlockedError(
      `Niedozwolony protokół (${parsed.protocol}). Akceptowane są wyłącznie http:// i https://.`,
    );
  }

  if (parsed.username || parsed.password) {
    throw new SsrfBlockedError(
      "Adres URL nie może zawierać wbudowanych danych uwierzytelniających.",
    );
  }

  if (isBlockedHostname(parsed.hostname)) {
    throw new SsrfBlockedError(
      "Dostęp do adresów lokalnych, localhost oraz sieci prywatnych jest zablokowany (ochrona SSRF).",
    );
  }

  return parsed;
}

const defaultDnsResolver: DnsResolver = async (hostname: string) => {
  const results = await dns.lookup(hostname, { all: true });
  return results.map((entry) => ({
    address: entry.address,
    family: entry.family,
  }));
};

export async function assertSafeResolvedHost(
  url: URL,
  resolveDns: DnsResolver = defaultDnsResolver,
): Promise<void> {
  const cleanHost = stripIpv6BracketsAndZone(url.hostname.toLowerCase());
  if (net.isIP(cleanHost) !== 0) {
    if (isBlockedIpAddress(cleanHost)) {
      throw new SsrfBlockedError(
        "Docelowy adres IP należy do sieci prywatnej lub lokalnej.",
      );
    }
    return;
  }

  let records: DnsAddressRecord[];
  try {
    records = await resolveDns(cleanHost);
  } catch {
    throw new UrlImportError(
      "Nie udało się rozwiązać nazwy domeny (błąd DNS).",
      502,
    );
  }

  if (!records || records.length === 0) {
    throw new UrlImportError(
      "Nie znaleziono publicznego adresu IP dla podanej domeny.",
      502,
    );
  }

  for (const record of records) {
    if (isBlockedIpAddress(record.address)) {
      throw new SsrfBlockedError(
        "Domena wskazuje na prywatny lub lokalny adres IP (ochrona SSRF).",
      );
    }
  }
}

const NAMED_HTML_ENTITIES: Record<string, string> = {
  amp: "&",
  lt: "<",
  gt: ">",
  quot: '"',
  apos: "'",
  nbsp: " ",
  ndash: "–",
  mdash: "—",
  hellip: "…",
  oacute: "ó",
  Oacute: "Ó",
};

function decodeHtmlEntities(input: string): string {
  return input
    .replace(/&#x([0-9a-f]+);/gi, (_, hex: string) => {
      const code = Number.parseInt(hex, 16);
      return Number.isFinite(code) && code > 0 ? String.fromCodePoint(code) : "";
    })
    .replace(/&#(\d+);/g, (_, dec: string) => {
      const code = Number.parseInt(dec, 10);
      return Number.isFinite(code) && code > 0 ? String.fromCodePoint(code) : "";
    })
    .replace(/&([a-zA-Z]+);/g, (full, name: string) => {
      return NAMED_HTML_ENTITIES[name] ?? full;
    })
    .replace(/\s+/g, " ")
    .trim();
}

function parseAttributes(tagContent: string): Record<string, string> {
  const attrs: Record<string, string> = {};
  const attrRegex =
    /([a-zA-Z0-9_:-]+)\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s"'=<>`]+))/g;

  for (const match of tagContent.matchAll(attrRegex)) {
    const key = match[1].toLowerCase();
    const rawValue = match[2] ?? match[3] ?? match[4] ?? "";
    attrs[key] = decodeHtmlEntities(rawValue);
  }

  return attrs;
}

function stripTags(html: string): string {
  return decodeHtmlEntities(
    html
      .replace(/<script\b[^>]*>[\s\S]*?<\/script>/gi, " ")
      .replace(/<style\b[^>]*>[\s\S]*?<\/style>/gi, " ")
      .replace(/<noscript\b[^>]*>[\s\S]*?<\/noscript>/gi, " ")
      .replace(/<[^>]+>/g, " "),
  );
}

function resolveHttpUrl(candidate: string, baseUrl: string): string | null {
  const trimmed = candidate.trim();
  if (!trimmed || trimmed.startsWith("data:") || trimmed.startsWith("javascript:")) {
    return null;
  }
  try {
    const resolved = new URL(trimmed, baseUrl);
    if (resolved.protocol !== "http:" && resolved.protocol !== "https:") {
      return null;
    }
    return resolved.toString();
  } catch {
    return null;
  }
}

interface JsonLdExtracted {
  title?: string;
  description?: string;
  images: string[];
}

function collectJsonLdNodes(input: unknown, out: Record<string, unknown>[]): void {
  if (!input) return;
  if (Array.isArray(input)) {
    for (const item of input) {
      collectJsonLdNodes(item, out);
    }
    return;
  }
  if (typeof input === "object") {
    const record = input as Record<string, unknown>;
    out.push(record);
    if (Array.isArray(record["@graph"])) {
      collectJsonLdNodes(record["@graph"], out);
    }
  }
}

function extractImageFromJsonLdValue(value: unknown, baseUrl: string): string[] {
  if (typeof value === "string") {
    const resolved = resolveHttpUrl(value, baseUrl);
    return resolved ? [resolved] : [];
  }
  if (Array.isArray(value)) {
    return value.flatMap((item) => extractImageFromJsonLdValue(item, baseUrl));
  }
  if (value && typeof value === "object") {
    const record = value as Record<string, unknown>;
    const candidate = record.url ?? record.contentUrl;
    if (typeof candidate === "string") {
      const resolved = resolveHttpUrl(candidate, baseUrl);
      return resolved ? [resolved] : [];
    }
  }
  return [];
}

function extractJsonLd(html: string, baseUrl: string): JsonLdExtracted {
  const images: string[] = [];
  let title: string | undefined;
  let description: string | undefined;

  const scriptRegex =
    /<script\b[^>]*type\s*=\s*["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi;

  for (const match of html.matchAll(scriptRegex)) {
    const rawJson = match[1]?.trim();
    if (!rawJson) continue;

    try {
      const parsed = JSON.parse(rawJson) as unknown;
      const nodes: Record<string, unknown>[] = [];
      collectJsonLdNodes(parsed, nodes);

      for (const node of nodes) {
        if (!title) {
          const rawTitle = node.name ?? node.headline;
          if (typeof rawTitle === "string" && rawTitle.trim().length > 0) {
            title = decodeHtmlEntities(rawTitle);
          }
        }
        if (!description && typeof node.description === "string") {
          const cleaned = decodeHtmlEntities(node.description);
          if (cleaned.length > 0) {
            description = cleaned;
          }
        }
        if (node.image !== undefined) {
          images.push(...extractImageFromJsonLdValue(node.image, baseUrl));
        }
      }
    } catch {
      // Ignoruj uszkodzony JSON-LD na zewnętrznej stronie
    }
  }

  return { title, description, images };
}

function truncateText(text: string, maxLength: number): string {
  const normalized = text.replace(/\s+/g, " ").trim();
  if (normalized.length <= maxLength) {
    return normalized;
  }
  const sliced = normalized.slice(0, maxLength - 1);
  const lastSpace = sliced.lastIndexOf(" ");
  if (lastSpace > maxLength * 0.6) {
    return `${sliced.slice(0, lastSpace)}…`;
  }
  return `${sliced}…`;
}

function cleanSiteSuffix(title: string, hostname: string): string {
  if (hostname === "slaskie.travel" || hostname.endsWith(".slaskie.travel")) {
    return title
      .replace(/\s*[|\-–—]\s*(?:SLASKIE\.travel|Śląskie[^|\-–—]*)$/i, "")
      .trim();
  }
  return title.trim();
}

function parsePolishNumber(raw: string): number | null {
  const normalized = raw.replace(/\s+/g, "").replace(",", ".");
  const parsed = Number(normalized);
  return Number.isFinite(parsed) ? parsed : null;
}

function inferTelemetryFromText(text: string): {
  distanceKm: number | null;
  elevationGainM: number | null;
  difficulty: Difficulty | null;
  surface: Surface | null;
} {
  let distanceKm: number | null = null;
  const labeledDistanceMatch =
    /(?:długość|dlugosc|dystans|trasa(?:\s+ma)?)\s*:?\s*(\d{1,4}(?:[.,]\d{1,2})?)\s*km\b/i.exec(
      text,
    ) ?? /\b(\d{1,4}(?:[.,]\d{1,2})?)\s*km\b/i.exec(text);

  if (labeledDistanceMatch?.[1]) {
    const candidate = parsePolishNumber(labeledDistanceMatch[1]);
    if (candidate !== null && candidate > 0 && candidate <= 2500) {
      distanceKm = Math.round(candidate * 100) / 100;
    }
  }

  let elevationGainM: number | null = null;
  const elevationMatch =
    /(?:przewyższeni[ae]|suma\s+podejść|podjazdy)\s*:?\s*(\d{1,5})\s*m\b/i.exec(
      text,
    );
  if (elevationMatch?.[1]) {
    const candidate = Number.parseInt(elevationMatch[1], 10);
    if (Number.isFinite(candidate) && candidate >= 0 && candidate <= 50000) {
      elevationGainM = candidate;
    }
  }

  let difficulty: Difficulty | null = null;
  if (/(?:poziom\s+trudności|trudność)\s*:?\s*(?:łatw|rodzin)/i.test(text)) {
    difficulty = "easy";
  } else if (
    /(?:poziom\s+trudności|trudność)\s*:?\s*(?:średni|umiarkowan)/i.test(text)
  ) {
    difficulty = "moderate";
  } else if (
    /(?:poziom\s+trudności|trudność)\s*:?\s*(?:trudn|wymagając|górsk)/i.test(
      text,
    )
  ) {
    difficulty = "hard";
  }

  let surface: Surface | null = null;
  if (/nawierzchni[ae]\s*:?\s*asfalt/i.test(text)) {
    surface = "asphalt";
  } else if (/nawierzchni[ae]\s*:?\s*(?:szuter|szutrow|leśn)/i.test(text)) {
    surface = "gravel";
  } else if (/nawierzchni[ae]\s*:?\s*mieszan/i.test(text)) {
    surface = "mixed";
  } else if (/nawierzchni[ae]\s*:?\s*(?:teren|mtb|gruntow)/i.test(text)) {
    surface = "offroad";
  }

  return { distanceKm, elevationGainM, difficulty, surface };
}

/**
 * Czysta funkcja wyciągająca metadane szlaku rowerowego z kodu HTML strony zewnętrznej.
 */
export function extractTrailMetadataFromHtml(
  html: string,
  sourceUrl: string,
): ImportedTrailMetadata {
  let hostname = "";
  try {
    hostname = new URL(sourceUrl).hostname.toLowerCase();
  } catch {
    hostname = "";
  }

  const isSlaskieTravel =
    hostname === "slaskie.travel" || hostname.endsWith(".slaskie.travel");

  const metaByProperty = new Map<string, string>();
  const metaByName = new Map<string, string>();

  for (const match of html.matchAll(/<meta\b([^>]+)>/gi)) {
    const attrs = parseAttributes(match[1]);
    const content = attrs.content?.trim();
    if (!content) continue;

    if (attrs.property) {
      const key = attrs.property.toLowerCase();
      if (!metaByProperty.has(key)) {
        metaByProperty.set(key, content);
      }
    }
    if (attrs.name) {
      const key = attrs.name.toLowerCase();
      if (!metaByName.has(key)) {
        metaByName.set(key, content);
      }
    }
  }

  const jsonLd = extractJsonLd(html, sourceUrl);

  const titleMatch = /<title\b[^>]*>([\s\S]*?)<\/title>/i.exec(html);
  const rawTitleTag = titleMatch?.[1] ? stripTags(titleMatch[1]) : undefined;

  const h1Match = /<h1\b[^>]*>([\s\S]*?)<\/h1>/i.exec(html);
  const rawH1 = h1Match?.[1] ? stripTags(h1Match[1]) : undefined;

  const rawTitle =
    metaByProperty.get("og:title") ??
    metaByName.get("twitter:title") ??
    jsonLd.title ??
    rawH1 ??
    rawTitleTag ??
    null;

  const title = rawTitle ? cleanSiteSuffix(rawTitle, hostname) || null : null;

  const paragraphs: string[] = [];
  for (const match of html.matchAll(/<p\b[^>]*>([\s\S]*?)<\/p>/gi)) {
    const text = stripTags(match[1]);
    if (text.length >= 25) {
      paragraphs.push(text);
    }
    if (paragraphs.length >= 5) break;
  }

  const rawDescription =
    metaByProperty.get("og:description") ??
    metaByName.get("description") ??
    metaByName.get("twitter:description") ??
    jsonLd.description ??
    paragraphs[0] ??
    null;

  const shortDescription = rawDescription
    ? truncateText(rawDescription, MAX_SHORT_DESCRIPTION_LENGTH)
    : null;

  const contentParts: string[] = [];
  if (rawDescription) {
    contentParts.push(rawDescription);
  }
  for (const paragraph of paragraphs) {
    if (!contentParts.some((existing) => existing.includes(paragraph))) {
      contentParts.push(paragraph);
    }
  }
  const content =
    contentParts.length > 0 ? contentParts.join("\n\n").slice(0, 4000) : null;

  // Zbieranie linków .gpx
  const gpxSet = new Set<string>();
  const attrUrlRegex =
    /(?:href|data-gpx|data-url|content)\s*=\s*(?:"([^"]*\.gpx(?:\?[^"]*)?)"|'([^']*\.gpx(?:\?[^']*)?)')/gi;
  for (const match of html.matchAll(attrUrlRegex)) {
    const candidate = match[1] ?? match[2] ?? "";
    const resolved = resolveHttpUrl(candidate, sourceUrl);
    if (resolved) {
      gpxSet.add(resolved);
    }
  }
  const inlineGpxRegex = /https?:\/\/[^\s"'<>()]+?\.gpx(?:\?[^\s"'<>()]*)?/gi;
  for (const match of html.matchAll(inlineGpxRegex)) {
    const resolved = resolveHttpUrl(match[0], sourceUrl);
    if (resolved) {
      gpxSet.add(resolved);
    }
  }
  const gpxUrls = Array.from(gpxSet);

  // Zbieranie obrazów
  const imageSet = new Set<string>();
  const addImageCandidate = (rawCandidate: string | undefined) => {
    if (!rawCandidate) return;
    const resolved = resolveHttpUrl(rawCandidate, sourceUrl);
    if (resolved) {
      imageSet.add(resolved);
    }
  };

  addImageCandidate(metaByProperty.get("og:image"));
  addImageCandidate(metaByProperty.get("og:image:secure_url"));
  addImageCandidate(metaByName.get("twitter:image"));
  for (const img of jsonLd.images) {
    addImageCandidate(img);
  }
  for (const match of html.matchAll(/<img\b([^>]+)>/gi)) {
    const attrs = parseAttributes(match[1]);
    const src = attrs.src ?? attrs["data-src"];
    if (!src) continue;
    if (/favicon|sprite|logo|pixel|spacer/i.test(src)) continue;
    addImageCandidate(src);
  }

  const imageUrls = Array.from(imageSet);
  const coverImageUrl = imageUrls[0] ?? null;

  const plainText = stripTags(html);
  const telemetry = isSlaskieTravel
    ? inferTelemetryFromText(plainText)
    : inferTelemetryFromText(
        [rawDescription ?? "", ...paragraphs].join(" "),
      );

  const sourceName = isSlaskieTravel
    ? "SLASKIE.travel"
    : metaByProperty.get("og:site_name") ??
      (hostname ? hostname.replace(/^www\./, "") : null);

  const region: RegionSlug | null = isSlaskieTravel ? "slaskie" : null;

  return {
    sourceUrl,
    sourceName,
    title,
    shortDescription,
    content,
    coverImageUrl,
    imageUrls,
    gpxUrl: gpxUrls[0] ?? null,
    gpxUrls,
    region,
    distanceKm: telemetry.distanceKm,
    elevationGainM: telemetry.elevationGainM,
    difficulty: telemetry.difficulty,
    surface: telemetry.surface,
  };
}

async function readResponseTextWithLimit(
  response: Response,
  maxBytes: number,
): Promise<string> {
  const contentLengthHeader = response.headers.get("content-length");
  if (contentLengthHeader) {
    const declaredLength = Number(contentLengthHeader);
    if (Number.isFinite(declaredLength) && declaredLength > maxBytes) {
      throw new UrlImportError(
        "Docelowa strona przekracza maksymalny limit rozmiaru (2 MB).",
        422,
      );
    }
  }

  if (!response.body) {
    const text = await response.text();
    if (Buffer.byteLength(text, "utf8") > maxBytes) {
      throw new UrlImportError(
        "Docelowa strona przekracza maksymalny limit rozmiaru (2 MB).",
        422,
      );
    }
    return text;
  }

  const reader = response.body.getReader();
  const chunks: Uint8Array[] = [];
  let totalBytes = 0;

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    if (!value) continue;

    totalBytes += value.byteLength;
    if (totalBytes > maxBytes) {
      await reader.cancel().catch(() => undefined);
      throw new UrlImportError(
        "Docelowa strona przekracza maksymalny limit rozmiaru (2 MB).",
        422,
      );
    }
    chunks.push(value);
  }

  return Buffer.concat(chunks).toString("utf8");
}

function isRedirectStatus(status: number): boolean {
  return (
    status === 301 ||
    status === 302 ||
    status === 303 ||
    status === 307 ||
    status === 308
  );
}

/**
 * Bezpiecznie pobiera zewnętrzną stronę (ochrona SSRF, walidacja DNS,
 * kontrola przekierowań, timeout 8s, limit 2 MB) i zwraca ustrukturyzowane metadane szlaku.
 */
export async function importTrailFromUrl(
  rawUrl: string,
  options?: ImportUrlOptions,
): Promise<ImportedTrailMetadata> {
  const fetchFn = options?.fetchFn ?? fetch;
  const resolveDns = options?.resolveDns ?? defaultDnsResolver;
  const timeoutMs = options?.timeoutMs ?? DEFAULT_TIMEOUT_MS;

  let currentUrl = validateSafeExternalUrl(rawUrl);
  let response: Response | null = null;

  for (let redirectCount = 0; redirectCount <= MAX_REDIRECTS; redirectCount += 1) {
    await assertSafeResolvedHost(currentUrl, resolveDns);

    try {
      response = await fetchFn(currentUrl.toString(), {
        method: "GET",
        redirect: "manual",
        signal: AbortSignal.timeout(timeoutMs),
        headers: {
          Accept: "text/html,application/xhtml+xml;q=0.9,*/*;q=0.8",
          "Accept-Language": "pl-PL,pl;q=0.9,en;q=0.8",
          "User-Agent": "SzlakiRoweroweBot/1.0 (+https://szlaki-rowerowe.vercel.app)",
        },
      });
    } catch (error) {
      if (error instanceof SsrfBlockedError || error instanceof UrlImportError) {
        throw error;
      }
      if (error instanceof Error && error.name === "TimeoutError") {
        throw new UrlImportError(
          "Przekroczono czas oczekiwania (8s) na odpowiedź zewnętrznego serwera.",
          502,
        );
      }
      throw new UrlImportError(
        "Nie udało się pobrać strony z podanego adresu URL.",
        502,
      );
    }

    if (isRedirectStatus(response.status)) {
      const location = response.headers.get("location");
      if (!location) {
        throw new UrlImportError(
          "Serwer zwrócił przekierowanie bez nagłówka Location.",
          502,
        );
      }
      if (redirectCount === MAX_REDIRECTS) {
        throw new UrlImportError("Zbyt wiele przekierowań podanego adresu URL.", 502);
      }
      const nextRaw = new URL(location, currentUrl).toString();
      currentUrl = validateSafeExternalUrl(nextRaw);
      continue;
    }

    break;
  }

  if (!response) {
    throw new UrlImportError("Brak odpowiedzi z zewnętrznego serwera.", 502);
  }

  if (!response.ok) {
    throw new UrlImportError(
      `Zewnętrzny serwer zwrócił błąd HTTP ${response.status}.`,
      502,
    );
  }

  const contentType = response.headers.get("content-type")?.toLowerCase() ?? "";
  if (
    contentType &&
    !contentType.includes("text/html") &&
    !contentType.includes("application/xhtml+xml") &&
    !contentType.includes("text/plain")
  ) {
    throw new UrlImportError(
      `Podany adres nie zwraca strony HTML (${contentType}).`,
      422,
    );
  }

  const html = await readResponseTextWithLimit(response, MAX_RESPONSE_BYTES);
  return extractTrailMetadataFromHtml(html, currentUrl.toString());
}
