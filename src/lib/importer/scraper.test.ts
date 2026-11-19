import { describe, expect, it } from "vitest";
import {
  extractTrailMetadataFromHtml,
  importTrailFromUrl,
  SsrfBlockedError,
  UrlImportError,
  validateSafeExternalUrl,
} from "@/lib/importer/scraper";

describe("IMP-01 & IMP-02: URL Importer & SSRF protection", () => {
  it("IMP-01: extracts metadata, GPX link, and slaskie region from slaskie.travel-like HTML", () => {
    const html = `<!doctype html>
<html lang="pl">
  <head>
    <meta charset="utf-8" />
    <title>Pogoria III i IV — Pętla Rodzinna | SLASKIE.travel</title>
    <meta property="og:title" content="Trasa rowerowa z dzieckiem: Pogoria i Park Zielona" />
    <meta property="og:description" content="Spokojna trasa rowerowa wokół jezior Pogoria III i IV w Dąbrowie Górniczej." />
    <meta property="og:image" content="/media/cache/pogoria-cover.jpg" />
  </head>
  <body>
    <main>
      <h1>Trasa rowerowa z dzieckiem: Pogoria i Park Zielona</h1>
      <div class="params">
        <span>Długość: 19,8 km</span>
        <span>Przewyższenie: 44 m</span>
        <span>Poziom trudności: Łatwa</span>
        <span>Nawierzchnia: Asfalt</span>
      </div>
      <p>Pętla prowadzi wydzielonymi drogami rowerowymi wokół zbiorników wodnych oraz przez Park Zielona.</p>
      <a href="/downloads/trasa-1019753.gpx">Pobierz ślad GPX</a>
    </main>
  </body>
</html>`;

    const metadata = extractTrailMetadataFromHtml(
      html,
      "https://slaskie.travel/route/1019753",
    );

    expect(metadata.sourceUrl).toBe("https://slaskie.travel/route/1019753");
    expect(metadata.sourceName).toBe("SLASKIE.travel");
    expect(metadata.region).toBe("slaskie");
    expect(metadata.title).toBe(
      "Trasa rowerowa z dzieckiem: Pogoria i Park Zielona",
    );
    expect(metadata.shortDescription).toContain("Pogoria III i IV");
    expect(metadata.coverImageUrl).toBe(
      "https://slaskie.travel/media/cache/pogoria-cover.jpg",
    );
    expect(metadata.gpxUrl).toBe(
      "https://slaskie.travel/downloads/trasa-1019753.gpx",
    );
    expect(metadata.gpxUrls).toEqual([
      "https://slaskie.travel/downloads/trasa-1019753.gpx",
    ]);
    expect(metadata.distanceKm).toBe(19.8);
    expect(metadata.elevationGainM).toBe(44);
    expect(metadata.difficulty).toBe("easy");
    expect(metadata.surface).toBe("asphalt");
  });

  it("IMP-01: parses generic OpenGraph, JSON-LD, and relative GPX/image URLs", () => {
    const html = `<!doctype html>
<html>
  <head>
    <title>Velo Dunajec — Szlaki Polski</title>
    <meta name="description" content="Jedna z najpiękniejszych tras rowerowych w Polsce." />
    <meta property="og:site_name" content="Rowerowe Szlaki" />
    <script type="application/ld+json">
      {
        "@context": "https://schema.org",
        "@type": "Article",
        "headline": "Velo Dunajec: Czorsztyn - Stary Sącz",
        "image": ["https://cdn.example.org/dunajec.webp"]
      }
    </script>
  </head>
  <body>
    <img src="/assets/fallback-photo.png" alt="Dunajec" />
    <a data-gpx="tracks/velo-dunajec.gpx?v=2">GPX</a>
  </body>
</html>`;

    const metadata = extractTrailMetadataFromHtml(
      html,
      "https://example.org/trasy/velo-dunajec",
    );

    expect(metadata.region).toBeNull();
    expect(metadata.sourceName).toBe("Rowerowe Szlaki");
    expect(metadata.title).toBe("Velo Dunajec: Czorsztyn - Stary Sącz");
    expect(metadata.shortDescription).toBe(
      "Jedna z najpiękniejszych tras rowerowych w Polsce.",
    );
    expect(metadata.coverImageUrl).toBe("https://cdn.example.org/dunajec.webp");
    expect(metadata.imageUrls).toContain(
      "https://example.org/assets/fallback-photo.png",
    );
    expect(metadata.gpxUrl).toBe(
      "https://example.org/trasy/tracks/velo-dunajec.gpx?v=2",
    );
  });

  it("IMP-02: blocks localhost, loopback, link-local metadata, private IPv4/IPv6 ranges, and non-HTTP protocols", () => {
    const blockedUrls = [
      "http://localhost",
      "http://localhost:3000/api/trails",
      "http://api.localhost/secret",
      "http://printer.local",
      "http://metadata.google.internal/computeMetadata/v1/",
      "http://127.0.0.1",
      "http://127.0.1.1:8080",
      "http://169.254.169.254/latest/meta-data/",
      "http://10.0.0.1/admin",
      "http://172.16.0.5/",
      "http://172.31.255.254/",
      "http://192.168.1.1/",
      "http://0.0.0.0/",
      "http://[::1]/",
      "http://[fe80::1]/",
      "http://[fc00::1]/",
      "http://[fd12:3456::1]/",
      "http://[::ffff:127.0.0.1]/",
      "file:///etc/passwd",
      "ftp://example.org/file.gpx",
      "javascript:alert(1)",
    ];

    for (const url of blockedUrls) {
      expect(() => validateSafeExternalUrl(url)).toThrow(SsrfBlockedError);
    }

    expect(
      validateSafeExternalUrl("https://slaskie.travel/route/1019753").hostname,
    ).toBe("slaskie.travel");
    expect(validateSafeExternalUrl("http://172.32.0.1/public").hostname).toBe(
      "172.32.0.1",
    );
  });

  it("IMP-02: blocks DNS rebinding to private IP and SSRF redirects in importTrailFromUrl", async () => {
    await expect(
      importTrailFromUrl("https://evil-rebind.example.com/route", {
        resolveDns: async () => [{ address: "127.0.0.1", family: 4 }],
      }),
    ).rejects.toThrow(SsrfBlockedError);

    await expect(
      importTrailFromUrl("https://public.example.com/start", {
        resolveDns: async () => [{ address: "93.184.216.34", family: 4 }],
        fetchFn: async () =>
          new Response(null, {
            status: 302,
            headers: { location: "http://169.254.169.254/latest/meta-data/" },
          }),
      }),
    ).rejects.toThrow(SsrfBlockedError);

    await expect(
      importTrailFromUrl("https://public.example.com/pdf", {
        resolveDns: async () => [{ address: "93.184.216.34", family: 4 }],
        fetchFn: async () =>
          new Response("PDF", {
            status: 200,
            headers: { "content-type": "application/pdf" },
          }),
      }),
    ).rejects.toThrow(UrlImportError);

    const okResult = await importTrailFromUrl(
      "https://slaskie.travel/route/1019753",
      {
        resolveDns: async () => [{ address: "93.184.216.34", family: 4 }],
        fetchFn: async () =>
          new Response(
            `<html><head><meta property="og:title" content="Pogoria Test" /></head></html>`,
            {
              status: 200,
              headers: { "content-type": "text/html; charset=utf-8" },
            },
          ),
      },
    );

    expect(okResult.title).toBe("Pogoria Test");
    expect(okResult.region).toBe("slaskie");
  });
});
