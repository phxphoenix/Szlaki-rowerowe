"use client";

import { useMemo, useRef, useState, type ChangeEvent, type DragEvent } from "react";
import { upload } from "@vercel/blob/client";
import {
  AlertCircle,
  CheckCircle2,
  FileUp,
  Info,
  Loader2,
  MapPin,
  Repeat,
  Route,
  Trash2,
  TrendingUp,
} from "lucide-react";
import { TrailGoogleMap } from "@/components/map/TrailGoogleMap";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import type { RegionSlug, TrailColor } from "@/lib/constants/regions";
import { GpxParseError, parseGpx, type ParsedGpxResult } from "@/lib/gpx/parser";
import { ALLOWED_GPX_MIME_TYPES, MAX_GPX_SIZE_BYTES } from "@/lib/upload/validation";
import { formatDistance, formatElevation } from "@/lib/utils/format";
import type { RouteBounds, RoutePoint, Trail } from "@/types/trail";

export interface GpxParsedPayload {
  parsed: ParsedGpxResult;
  fileName: string;
}

export interface GpxDropzoneProps {
  title: string;
  region: RegionSlug;
  trailColor: TrailColor;
  distanceKm: number;
  elevationGainM: number;
  isLoop: boolean;
  gpxUrl: string;
  routePoints: RoutePoint[];
  bounds: RouteBounds | null;
  startLat: number | null;
  startLng: number | null;
  endLat: number | null;
  endLng: number | null;
  blobConfigured?: boolean;
  gpxUrlError?: string;
  onGpxParsed: (payload: GpxParsedPayload) => void;
  onGpxUrlChange: (url: string) => void;
  onClearGpx: () => void;
}

async function readFileAsText(file: File): Promise<string> {
  if (typeof file.text === "function") {
    return file.text();
  }
  return new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () =>
      resolve(typeof reader.result === "string" ? reader.result : "");
    reader.onerror = () => reject(new Error("Nie udało się odczytać pliku GPX."));
    reader.readAsText(file);
  });
}

function sanitizeUploadFilename(name: string): string {
  const cleaned = name
    .trim()
    .replace(/[^a-zA-Z0-9._-]/g, "-")
    .replace(/-+/g, "-");
  if (!cleaned) return "trasa.gpx";
  if (!cleaned.toLowerCase().endsWith(".gpx") && !cleaned.toLowerCase().endsWith(".xml")) {
    return `${cleaned}.gpx`;
  }
  return cleaned;
}

function resolveGpxContentType(file: File): string {
  const normalized = file.type.split(";")[0].trim().toLowerCase();
  if ((ALLOWED_GPX_MIME_TYPES as readonly string[]).includes(normalized)) {
    return normalized;
  }
  return "application/gpx+xml";
}

export function GpxDropzone({
  title,
  region,
  trailColor,
  distanceKm,
  elevationGainM,
  isLoop,
  gpxUrl,
  routePoints,
  bounds,
  startLat,
  startLng,
  endLat,
  endLng,
  blobConfigured = true,
  gpxUrlError,
  onGpxParsed,
  onGpxUrlChange,
  onClearGpx,
}: GpxDropzoneProps) {
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [isUploadingBlob, setIsUploadingBlob] = useState(false);
  const [loadedFileName, setLoadedFileName] = useState<string | null>(null);
  const [parseError, setParseError] = useState<string | null>(null);
  const [statusInfo, setStatusInfo] = useState<string | null>(null);
  const [blobSaved, setBlobSaved] = useState(false);

  const previewTrail = useMemo<Trail>(
    () => ({
      id: "preview-gpx-trail",
      slug: "podglad-gpx",
      title: title.trim() || "Podgląd wczytanej trasy GPX",
      shortDescription: "Podgląd śladu GPX przed zapisaniem szlaku.",
      content: "",
      region,
      subregion: null,
      difficulty: "moderate",
      surface: "mixed",
      trailColor,
      distanceKm: Number.isFinite(distanceKm) && distanceKm > 0 ? distanceKm : 0,
      elevationGainM: Number.isFinite(elevationGainM) ? elevationGainM : 0,
      estimatedTimeMin: null,
      isLoop,
      coverImageUrl: "/images/trails/slaskie-1019753-cover.svg",
      sourceUrl: null,
      sourceName: null,
      gpxUrl: gpxUrl || null,
      routePoints,
      startLat,
      startLng,
      endLat,
      endLng,
      bounds,
      googleMapsEmbedUrl: null,
      published: true,
      createdAt: "",
      updatedAt: "",
      images: [],
      pois: [],
    }),
    [
      title,
      region,
      trailColor,
      distanceKm,
      elevationGainM,
      isLoop,
      gpxUrl,
      routePoints,
      bounds,
      startLat,
      startLng,
      endLat,
      endLng,
    ],
  );

  async function processFile(file: File) {
    setParseError(null);
    setStatusInfo(null);
    setBlobSaved(false);

    if (file.size > MAX_GPX_SIZE_BYTES) {
      setParseError("Plik GPX jest zbyt duży (maksymalny rozmiar to 15 MB).");
      return;
    }

    let xmlText: string;
    try {
      xmlText = await readFileAsText(file);
    } catch {
      setParseError("Nie udało się odczytać wybranego pliku GPX.");
      return;
    }

    let parsed: ParsedGpxResult;
    try {
      parsed = parseGpx(xmlText);
    } catch (error) {
      if (error instanceof GpxParseError) {
        setParseError(error.message);
      } else {
        setParseError(
          "Nie udało się sparsować pliku GPX. Upewnij się, że plik zawiera poprawny ślad <trkpt> lub trasę <rtept>.",
        );
      }
      return;
    }

    setLoadedFileName(file.name);
    onGpxParsed({ parsed, fileName: file.name });

    if (!blobConfigured) {
      setBlobSaved(false);
      setStatusInfo(
        "Ślad GPX wczytany (zapis oryginalnego pliku wymaga Vercel Blob).",
      );
      return;
    }

    // Opcjonalny zapis oryginalnego pliku GPX w Vercel Blob (nie blokuje formularza przy 503)
    setIsUploadingBlob(true);
    try {
      const safeName = sanitizeUploadFilename(file.name);
      const contentType = resolveGpxContentType(file);
      const result = await upload(`gpx/${safeName}`, file, {
        access: "public",
        handleUploadUrl: "/api/upload",
        contentType,
        clientPayload: JSON.stringify({
          contentType,
          size: file.size,
        }),
      });
      onGpxUrlChange(result.url);
      setBlobSaved(true);
      setStatusInfo(
        `Ślad GPX wczytany (${parsed.routePoints.length} pkt) i zapisany w Vercel Blob.`,
      );
    } catch {
      setBlobSaved(false);
      setStatusInfo(
        "Ślad GPX wczytany (zapis oryginalnego pliku wymaga Vercel Blob).",
      );
    } finally {
      setIsUploadingBlob(false);
    }
  }

  function handleFileChange(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    if (file) {
      void processFile(file);
    }
    event.target.value = "";
  }

  function handleDragOver(event: DragEvent<HTMLDivElement>) {
    event.preventDefault();
    setIsDragging(true);
  }

  function handleDragLeave(event: DragEvent<HTMLDivElement>) {
    event.preventDefault();
    setIsDragging(false);
  }

  function handleDrop(event: DragEvent<HTMLDivElement>) {
    event.preventDefault();
    setIsDragging(false);
    const file = event.dataTransfer.files?.[0];
    if (file) {
      void processFile(file);
    }
  }

  function handleClear() {
    setLoadedFileName(null);
    setParseError(null);
    setStatusInfo(null);
    setBlobSaved(false);
    onClearGpx();
  }

  return (
    <div className="space-y-4">
      <div
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
        className={`relative rounded-2xl border-2 border-dashed p-5 text-center transition-colors sm:p-6 ${
          isDragging
            ? "border-[var(--accent-primary)] bg-[var(--accent-primary)]/10"
            : "border-[var(--border-subtle)] bg-[var(--bg-canvas)]/70 hover:border-[var(--accent-primary)]/60"
        }`}
      >
        <input
          ref={fileInputRef}
          id="gpx-file-input"
          type="file"
          accept=".gpx,application/gpx+xml,application/xml,text/xml"
          data-testid="gpx-file-input"
          onChange={handleFileChange}
          className="sr-only"
        />

        <div className="mx-auto flex max-w-lg flex-col items-center gap-3">
          <span className="flex h-12 w-12 items-center justify-center rounded-2xl bg-[var(--accent-primary)]/15 text-[var(--accent-primary)]">
            {isUploadingBlob ? (
              <Loader2 className="h-6 w-6 animate-spin" aria-hidden="true" />
            ) : (
              <FileUp className="h-6 w-6" aria-hidden="true" />
            )}
          </span>

          <div className="space-y-1">
            <p className="text-base font-bold text-[var(--text-primary)]">
              Upuść plik <span className="font-mono text-[var(--accent-primary)]">.gpx</span> tutaj lub wybierz z urządzenia
            </p>
            <p className="text-xs leading-relaxed text-[var(--text-secondary)]">
              Plik zostanie natychmiast sparsowany lokalnie — dystans, przewyższenie, pętla oraz podgląd mapy uzupełnią się automatycznie.
            </p>
          </div>

          <div className="flex flex-wrap items-center justify-center gap-2 pt-1">
            <Button
              type="button"
              variant="outline"
              onClick={() => fileInputRef.current?.click()}
              disabled={isUploadingBlob}
              className="min-h-[44px]"
            >
              <FileUp className="h-4 w-4 text-[var(--accent-primary)]" aria-hidden="true" />
              <span>Wybierz plik .gpx</span>
            </Button>

            {routePoints.length > 0 && (
              <Button
                type="button"
                variant="ghost"
                onClick={handleClear}
                className="min-h-[44px] text-[var(--accent-danger)] hover:bg-[var(--accent-danger)]/10 hover:text-[var(--accent-danger)]"
              >
                <Trash2 className="h-4 w-4" aria-hidden="true" />
                <span>Usuń ślad GPX</span>
              </Button>
            )}
          </div>

          {loadedFileName && (
            <p className="font-mono text-xs text-[var(--text-secondary)]">
              Plik: <span className="font-semibold text-[var(--text-primary)]">{loadedFileName}</span>
            </p>
          )}
        </div>
      </div>

      {parseError && (
        <div
          role="alert"
          className="flex items-start gap-2.5 rounded-2xl border border-[var(--accent-danger)]/40 bg-[var(--accent-danger)]/10 px-4 py-3 text-sm font-medium text-[var(--accent-danger)]"
        >
          <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />
          <span>{parseError}</span>
        </div>
      )}

      {statusInfo && (
        <div
          role="status"
          data-testid="gpx-status-message"
          className={`flex items-start gap-2.5 rounded-2xl border px-4 py-3 text-sm ${
            blobSaved
              ? "border-[var(--accent-secondary)]/40 bg-[var(--accent-secondary)]/10 text-[var(--text-primary)]"
              : "border-[var(--accent-telemetry)]/40 bg-[var(--accent-telemetry)]/10 text-[var(--text-primary)]"
          }`}
        >
          {blobSaved ? (
            <CheckCircle2
              className="mt-0.5 h-4 w-4 shrink-0 text-[var(--accent-secondary)]"
              aria-hidden="true"
            />
          ) : (
            <Info
              className="mt-0.5 h-4 w-4 shrink-0 text-[var(--accent-telemetry)]"
              aria-hidden="true"
            />
          )}
          <span>{statusInfo}</span>
        </div>
      )}

      {routePoints.length >= 2 && (
        <div
          data-testid="gpx-live-preview"
          className="overflow-hidden rounded-2xl border border-[var(--border-subtle)] bg-[var(--bg-surface)] shadow-sm"
        >
          <div className="flex flex-wrap items-center justify-between gap-2 border-b border-[var(--border-subtle)] bg-[var(--bg-canvas)] px-4 py-3">
            <span className="font-display text-sm font-bold uppercase tracking-wider text-[var(--text-primary)]">
              Podgląd trasy na żywo
            </span>
            <div className="flex flex-wrap items-center gap-3 font-mono text-xs font-semibold tabular-nums text-[var(--text-secondary)]">
              <span className="inline-flex items-center gap-1 text-[var(--text-primary)]">
                <Route className="h-3.5 w-3.5 text-[var(--accent-primary)]" aria-hidden="true" />
                {formatDistance(distanceKm)}
              </span>
              <span className="inline-flex items-center gap-1 text-[var(--text-primary)]">
                <TrendingUp className="h-3.5 w-3.5 text-[var(--accent-telemetry)]" aria-hidden="true" />
                {formatElevation(elevationGainM)}
              </span>
              <span className="inline-flex items-center gap-1">
                <MapPin className="h-3.5 w-3.5 text-[var(--accent-secondary)]" aria-hidden="true" />
                {routePoints.length} pkt
              </span>
              <span className="inline-flex items-center gap-1">
                <Repeat className="h-3.5 w-3.5 text-[var(--accent-warning)]" aria-hidden="true" />
                {isLoop ? "Pętla" : "Punkt–Punkt"}
              </span>
            </div>
          </div>

          <div className="h-[280px] w-full sm:h-[340px]">
            <TrailGoogleMap trail={previewTrail} className="h-full w-full" />
          </div>
        </div>
      )}

      <div className="space-y-1.5">
        <label
          htmlFor="trail-gpx-url"
          className="block text-sm font-semibold text-[var(--text-primary)]"
        >
          Link do pliku GPX <span className="font-normal text-[var(--text-secondary)]">(opcjonalny)</span>
        </label>
        <Input
          id="trail-gpx-url"
          name="gpxUrl"
          type="text"
          value={gpxUrl}
          onChange={(event) => onGpxUrlChange(event.target.value)}
          placeholder="https://... lub /sample-gpx/slaskie-1019753.gpx"
          aria-invalid={Boolean(gpxUrlError)}
          className="text-base"
        />
        {gpxUrlError && (
          <p className="text-xs font-medium text-[var(--accent-danger)]">{gpxUrlError}</p>
        )}
      </div>
    </div>
  );
}
