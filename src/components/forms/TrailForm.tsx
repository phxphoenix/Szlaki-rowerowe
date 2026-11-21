"use client";

import { useEffect, useId, useState, type FormEvent } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  AlertCircle,
  AlertTriangle,
  Compass,
  FileText,
  Image as ImageIcon,
  Loader2,
  MapPin,
  Plus,
  Route,
  Save,
  Trash2,
  X,
} from "lucide-react";
import { GpxDropzone, type GpxParsedPayload } from "@/components/forms/GpxDropzone";
import {
  ImageUploader,
  PRESET_TRAIL_IMAGES,
  type FormImageItem,
} from "@/components/forms/ImageUploader";
import { UrlImporterCard } from "@/components/forms/UrlImporterCard";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import {
  DIFFICULTIES,
  DIFFICULTY_META,
  POI_CATEGORIES,
  POI_CATEGORY_LABELS,
  REGIONS,
  SURFACES,
  SURFACE_LABELS,
  TRAIL_COLORS,
  TRAIL_COLOR_META,
  getRegionInfo,
  type Difficulty,
  type RegionSlug,
  type Surface,
  type TrailColor,
} from "@/lib/constants/regions";
import type { ImportedTrailMetadata } from "@/lib/importer/scraper";
import { createTrailSchema } from "@/lib/validation/trail";
import type { RouteBounds, RoutePoint, Trail } from "@/types/trail";

export interface TrailFormProps {
  mode: "create" | "edit";
  initialTrail?: Trail;
  blobConfigured?: boolean;
}

interface FormPoiItem {
  localId: string;
  name: string;
  category: string;
  description: string;
  lat: string;
  lng: string;
}

const DEFAULT_COVER_IMAGE = PRESET_TRAIL_IMAGES[0].url;
const MAX_SHORT_DESC_LENGTH = 360;

function parseDecimalInput(raw: string): number {
  const normalized = raw.trim().replace(",", ".");
  if (normalized === "") return Number.NaN;
  return Number(normalized);
}

function buildInitialPois(trail?: Trail): FormPoiItem[] {
  if (!trail) return [];
  return trail.pois.map((poi, index) => ({
    localId: poi.id || `poi-init-${index}`,
    name: poi.name,
    category: poi.category ?? "viewpoint",
    description: poi.description ?? "",
    lat: String(poi.lat),
    lng: String(poi.lng),
  }));
}

function buildInitialImages(trail?: Trail): FormImageItem[] {
  if (!trail) return [];
  return trail.images.map((img) => ({
    url: img.url,
    caption: img.caption ?? "",
  }));
}

export function TrailForm({
  mode,
  initialTrail,
  blobConfigured = true,
}: TrailFormProps) {
  const router = useRouter();
  const deleteDialogTitleId = useId();

  // Podstawowe informacje
  const [title, setTitle] = useState(initialTrail?.title ?? "");
  const [region, setRegion] = useState<RegionSlug>(
    initialTrail?.region ?? "slaskie",
  );
  const [subregion, setSubregion] = useState(initialTrail?.subregion ?? "");
  const [difficulty, setDifficulty] = useState<Difficulty>(
    initialTrail?.difficulty ?? "moderate",
  );
  const [surface, setSurface] = useState<Surface>(
    initialTrail?.surface ?? "mixed",
  );
  const [trailColor, setTrailColor] = useState<TrailColor>(
    initialTrail?.trailColor ?? "none",
  );
  const [shortDescription, setShortDescription] = useState(
    initialTrail?.shortDescription ?? "",
  );
  const [content, setContent] = useState(initialTrail?.content ?? "");

  // Parametry i źródło
  const [distanceKmInput, setDistanceKmInput] = useState(
    initialTrail ? String(initialTrail.distanceKm) : "",
  );
  const [elevationGainInput, setElevationGainInput] = useState(
    initialTrail ? String(initialTrail.elevationGainM) : "0",
  );
  const [estimatedTimeInput, setEstimatedTimeInput] = useState(
    initialTrail?.estimatedTimeMin != null
      ? String(initialTrail.estimatedTimeMin)
      : "",
  );
  const [isLoop, setIsLoop] = useState(initialTrail?.isLoop ?? false);
  const [published, setPublished] = useState(initialTrail?.published ?? true);
  const [sourceUrl, setSourceUrl] = useState(initialTrail?.sourceUrl ?? "");
  const [sourceName, setSourceName] = useState(initialTrail?.sourceName ?? "");
  const [googleMapsEmbedUrl, setGoogleMapsEmbedUrl] = useState(
    initialTrail?.googleMapsEmbedUrl ?? "",
  );

  // GPX & Geometria
  const [gpxUrl, setGpxUrl] = useState(initialTrail?.gpxUrl ?? "");
  const [routePoints, setRoutePoints] = useState<RoutePoint[]>(
    initialTrail?.routePoints ?? [],
  );
  const [bounds, setBounds] = useState<RouteBounds | null>(
    initialTrail?.bounds ?? null,
  );
  const [startLat, setStartLat] = useState<number | null>(
    initialTrail?.startLat ?? null,
  );
  const [startLng, setStartLng] = useState<number | null>(
    initialTrail?.startLng ?? null,
  );
  const [endLat, setEndLat] = useState<number | null>(
    initialTrail?.endLat ?? null,
  );
  const [endLng, setEndLng] = useState<number | null>(
    initialTrail?.endLng ?? null,
  );

  // Okładka i galeria zdjęć
  const [coverImageUrl, setCoverImageUrl] = useState(
    initialTrail?.coverImageUrl ?? DEFAULT_COVER_IMAGE,
  );
  const [images, setImages] = useState<FormImageItem[]>(() =>
    buildInitialImages(initialTrail),
  );

  // Punkty POI
  const [pois, setPois] = useState<FormPoiItem[]>(() =>
    buildInitialPois(initialTrail),
  );

  // Stany walidacji i zapisu
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const [validationSummary, setValidationSummary] = useState<string[]>([]);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Modal usuwania (tryb edit)
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [deleteError, setDeleteError] = useState<string | null>(null);

  useEffect(() => {
    if (!showDeleteModal) return;
    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape" && !isDeleting) {
        setShowDeleteModal(false);
      }
    }
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [showDeleteModal, isDeleting]);

  function clearFieldError(fieldKey: string) {
    setFieldErrors((prev) => {
      if (!prev[fieldKey]) return prev;
      const next = { ...prev };
      delete next[fieldKey];
      return next;
    });
  }

  function handleUrlImport(data: ImportedTrailMetadata) {
    if (data.title) {
      setTitle(data.title);
      clearFieldError("title");
    }
    if (data.shortDescription) {
      setShortDescription(data.shortDescription.slice(0, MAX_SHORT_DESC_LENGTH));
      clearFieldError("shortDescription");
    }
    if (data.content) {
      setContent(data.content);
      clearFieldError("content");
    }
    if (data.region) {
      setRegion(data.region);
    }
    if (data.difficulty) {
      setDifficulty(data.difficulty);
    }
    if (data.surface) {
      setSurface(data.surface);
    }
    if (data.sourceUrl) {
      setSourceUrl(data.sourceUrl);
      clearFieldError("sourceUrl");
    }
    if (data.sourceName) {
      setSourceName(data.sourceName);
    }
    if (data.distanceKm != null && data.distanceKm > 0) {
      setDistanceKmInput(String(data.distanceKm));
      clearFieldError("distanceKm");
    }
    if (data.elevationGainM != null && data.elevationGainM >= 0) {
      setElevationGainInput(String(data.elevationGainM));
      clearFieldError("elevationGainM");
    }
    if (data.gpxUrl) {
      setGpxUrl(data.gpxUrl);
      clearFieldError("gpxUrl");
    }
    if (data.coverImageUrl) {
      setCoverImageUrl(data.coverImageUrl);
      clearFieldError("coverImageUrl");
    }

    if (data.parsedGpx) {
      const parsedGpx = data.parsedGpx;
      setRoutePoints(parsedGpx.routePoints);
      setBounds(parsedGpx.bounds);
      setStartLat(parsedGpx.startLat);
      setStartLng(parsedGpx.startLng);
      setEndLat(parsedGpx.endLat);
      setEndLng(parsedGpx.endLng);
      setIsLoop(parsedGpx.isLoop);

      if (parsedGpx.distanceKm > 0) {
        setDistanceKmInput(String(parsedGpx.distanceKm));
        clearFieldError("distanceKm");

        setEstimatedTimeInput((prev) => {
          if (prev.trim().length > 0) return prev;
          return String(Math.max(1, Math.round((parsedGpx.distanceKm / 15) * 60)));
        });
      }

      if (parsedGpx.hasElevation) {
        setElevationGainInput(String(parsedGpx.elevationGainM));
        clearFieldError("elevationGainM");
      } else if (data.elevationGainM != null && data.elevationGainM >= 0) {
        setElevationGainInput(String(data.elevationGainM));
        clearFieldError("elevationGainM");
      } else {
        setElevationGainInput("0");
        clearFieldError("elevationGainM");
      }
    }

    const importedUrls = Array.isArray(data.imageUrls) ? data.imageUrls : [];
    if (importedUrls.length > 0) {
      setImages((prev) => {
        const existing = new Set(prev.map((item) => item.url));
        const next = [...prev];
        for (const imgUrl of importedUrls.slice(0, 12)) {
          if (!existing.has(imgUrl)) {
            next.push({ url: imgUrl, caption: "" });
            existing.add(imgUrl);
          }
        }
        return next;
      });
    }
  }

  function handleGpxParsed({ parsed }: GpxParsedPayload) {
    setRoutePoints(parsed.routePoints);
    setBounds(parsed.bounds);
    setStartLat(parsed.startLat);
    setStartLng(parsed.startLng);
    setEndLat(parsed.endLat);
    setEndLng(parsed.endLng);
    setIsLoop(parsed.isLoop);

    if (parsed.distanceKm > 0) {
      setDistanceKmInput(String(parsed.distanceKm));
      clearFieldError("distanceKm");

      setEstimatedTimeInput((prev) => {
        if (prev.trim().length > 0) return prev;
        return String(Math.max(1, Math.round((parsed.distanceKm / 15) * 60)));
      });
    }

    setElevationGainInput(String(parsed.elevationGainM));
    clearFieldError("elevationGainM");
  }

  function handleClearGpx() {
    setRoutePoints([]);
    setBounds(null);
    setStartLat(null);
    setStartLng(null);
    setEndLat(null);
    setEndLng(null);
    setGpxUrl("");
  }

  function handleAddPoi() {
    const regionCenter = getRegionInfo(region).center;
    const defaultLat = startLat ?? regionCenter.lat;
    const defaultLng = startLng ?? regionCenter.lng;

    setPois((prev) => [
      ...prev,
      {
        localId: `poi-${Date.now()}-${prev.length}`,
        name: "",
        category: "viewpoint",
        description: "",
        lat: defaultLat.toFixed(5),
        lng: defaultLng.toFixed(5),
      },
    ]);
  }

  function handleUpdatePoi(
    index: number,
    patch: Partial<Omit<FormPoiItem, "localId">>,
  ) {
    setPois((prev) =>
      prev.map((item, idx) => (idx === index ? { ...item, ...patch } : item)),
    );
  }

  function handleRemovePoi(index: number) {
    setPois((prev) => prev.filter((_, idx) => idx !== index));
  }

  function buildPayloadForValidation() {
    const parsedDistance =
      distanceKmInput.trim() === "" ? 0 : parseDecimalInput(distanceKmInput);
    const parsedElevation =
      elevationGainInput.trim() === ""
        ? 0
        : parseDecimalInput(elevationGainInput);
    const parsedTime =
      estimatedTimeInput.trim() === ""
        ? null
        : parseDecimalInput(estimatedTimeInput);

    return {
      title: title.trim(),
      shortDescription: shortDescription.trim(),
      content: content.trim(),
      region,
      subregion: subregion.trim() || null,
      difficulty,
      surface,
      trailColor,
      distanceKm: parsedDistance,
      elevationGainM: parsedElevation,
      estimatedTimeMin: parsedTime,
      isLoop,
      coverImageUrl: coverImageUrl.trim(),
      sourceUrl: sourceUrl.trim() || null,
      sourceName: sourceName.trim() || null,
      gpxUrl: gpxUrl.trim() || null,
      googleMapsEmbedUrl: googleMapsEmbedUrl.trim() || null,
      routePoints,
      startLat,
      startLng,
      endLat,
      endLng,
      bounds,
      published,
      images: images.map((img, idx) => ({
        url: img.url.trim(),
        caption: img.caption.trim() || null,
        sortOrder: idx,
      })),
      pois: pois.map((poi) => ({
        name: poi.name.trim(),
        category: poi.category.trim() || null,
        description: poi.description.trim() || null,
        lat: parseDecimalInput(poi.lat),
        lng: parseDecimalInput(poi.lng),
      })),
    };
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSubmitError(null);

    const rawPayload = buildPayloadForValidation();
    const validation = createTrailSchema.safeParse(rawPayload);

    if (!validation.success) {
      const nextFieldErrors: Record<string, string> = {};
      const messages: string[] = [];

      for (const issue of validation.error.issues) {
        const key = issue.path.map(String).join(".") || "_form";
        if (!nextFieldErrors[key]) {
          nextFieldErrors[key] = issue.message;
        }
        if (!messages.includes(issue.message)) {
          messages.push(issue.message);
        }
      }

      setFieldErrors(nextFieldErrors);
      setValidationSummary(messages);
      return;
    }

    setFieldErrors({});
    setValidationSummary([]);
    setIsSubmitting(true);

    try {
      const endpoint =
        mode === "edit" && initialTrail
          ? `/api/trails/${encodeURIComponent(initialTrail.id)}`
          : "/api/trails";
      const method = mode === "edit" ? "PATCH" : "POST";

      const response = await fetch(endpoint, {
        method,
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(validation.data),
      });

      const data = (await response.json().catch(() => null)) as
        | (Trail & { error?: string })
        | { error?: string; issues?: Array<{ path?: unknown[]; message?: string }> }
        | null;

      if (!response.ok) {
        if (response.status === 401) {
          setSubmitError(
            "Twoja sesja wygasła. Zaloguj się ponownie, aby zapisać szlak.",
          );
          return;
        }

        if (data && "issues" in data && Array.isArray(data.issues)) {
          const apiFieldErrors: Record<string, string> = {};
          const apiMessages: string[] = [];
          for (const issue of data.issues) {
            if (typeof issue.message === "string") {
              const key = Array.isArray(issue.path)
                ? issue.path.map(String).join(".")
                : "_form";
              if (!apiFieldErrors[key]) {
                apiFieldErrors[key] = issue.message;
              }
              if (!apiMessages.includes(issue.message)) {
                apiMessages.push(issue.message);
              }
            }
          }
          setFieldErrors(apiFieldErrors);
          setValidationSummary(apiMessages);
        }

        setSubmitError(
          data?.error ?? "Nie udało się zapisać szlaku. Sprawdź poprawność danych.",
        );
        return;
      }

      const savedSlug =
        data && "slug" in data && typeof data.slug === "string"
          ? data.slug
          : initialTrail?.slug ?? "";

      router.push(savedSlug ? `/szlaki/${savedSlug}` : "/");
      router.refresh();
    } catch {
      setSubmitError(
        "Wystąpił błąd sieci podczas zapisywania szlaku. Spróbuj ponownie.",
      );
    } finally {
      setIsSubmitting(false);
    }
  }

  async function handleConfirmDelete() {
    if (!initialTrail) return;
    setDeleteError(null);
    setIsDeleting(true);

    try {
      const response = await fetch(
        `/api/trails/${encodeURIComponent(initialTrail.id)}`,
        {
          method: "DELETE",
        },
      );

      if (!response.ok) {
        const data = (await response.json().catch(() => null)) as {
          error?: string;
        } | null;
        setDeleteError(
          data?.error ?? "Nie udało się usunąć szlaku. Spróbuj ponownie.",
        );
        return;
      }

      setShowDeleteModal(false);
      router.push("/");
      router.refresh();
    } catch {
      setDeleteError("Wystąpił błąd połączenia podczas usuwania szlaku.");
    } finally {
      setIsDeleting(false);
    }
  }

  const parsedPreviewDistance = parseDecimalInput(distanceKmInput);
  const parsedPreviewElevation = parseDecimalInput(elevationGainInput);

  return (
    <div className="space-y-6">
      {/* Sekcja 1: Importer z linku (w trybie dodawania) */}
      {mode === "create" && <UrlImporterCard onImport={handleUrlImport} />}

      <form
        onSubmit={handleSubmit}
        noValidate
        className="space-y-6"
        data-testid="trail-form"
      >
        {/* Podsumowanie błędów walidacji lub błędu API */}
        {(validationSummary.length > 0 || submitError) && (
          <div
            role="alert"
            data-testid="form-error-summary"
            className="rounded-2xl border border-[var(--accent-danger)]/40 bg-[var(--accent-danger)]/10 p-4 text-sm text-[var(--accent-danger)]"
          >
            <div className="flex items-start gap-3">
              <AlertCircle className="mt-0.5 h-5 w-5 shrink-0" aria-hidden="true" />
              <div className="space-y-1.5">
                <p className="font-bold">
                  {submitError ?? "Popraw poniższe błędy przed zapisaniem szlaku:"}
                </p>
                {validationSummary.length > 0 && (
                  <ul className="list-disc space-y-1 pl-5 text-[var(--text-primary)]">
                    {validationSummary.map((msg) => (
                      <li key={msg}>{msg}</li>
                    ))}
                  </ul>
                )}
              </div>
            </div>
          </div>
        )}

        {/* Sekcja 2: Podstawowe informacje */}
        <section className="rounded-3xl border border-[var(--border-subtle)] bg-[var(--bg-surface)] p-5 shadow-sm sm:p-6">
          <div className="mb-5 flex items-center gap-2.5 border-b border-[var(--border-subtle)] pb-4">
            <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-[var(--accent-primary)]/15 text-[var(--accent-primary)]">
              <FileText className="h-4 w-4" aria-hidden="true" />
            </span>
            <div>
              <h2 className="font-display text-2xl font-bold uppercase tracking-wide text-[var(--text-primary)]">
                Podstawowe informacje
              </h2>
              <p className="text-xs text-[var(--text-secondary)]">
                Nazwa, lokalizacja, charakterystyka i opis szlaku rowerowego.
              </p>
            </div>
          </div>

          <div className="space-y-5">
            {/* Tytuł */}
            <div className="space-y-1.5">
              <label
                htmlFor="trail-title"
                className="block text-sm font-semibold text-[var(--text-primary)]"
              >
                Tytuł szlaku <span className="text-[var(--accent-danger)]">*</span>
              </label>
              <Input
                id="trail-title"
                name="title"
                type="text"
                value={title}
                onChange={(event) => {
                  setTitle(event.target.value);
                  clearFieldError("title");
                }}
                placeholder="np. Szlak Rowerowy Orlich Gniazd"
                maxLength={200}
                aria-invalid={Boolean(fieldErrors.title)}
                aria-describedby={fieldErrors.title ? "trail-title-error" : undefined}
                className="text-base"
              />
              {fieldErrors.title && (
                <p
                  id="trail-title-error"
                  className="text-xs font-medium text-[var(--accent-danger)]"
                >
                  {fieldErrors.title}
                </p>
              )}
            </div>

            {/* Województwo + Subregion */}
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <div className="space-y-1.5">
                <label
                  htmlFor="trail-region"
                  className="block text-sm font-semibold text-[var(--text-primary)]"
                >
                  Województwo <span className="text-[var(--accent-danger)]">*</span>
                </label>
                <Select
                  id="trail-region"
                  name="region"
                  value={region}
                  onChange={(event) => {
                    setRegion(event.target.value as RegionSlug);
                    clearFieldError("region");
                  }}
                  className="text-base"
                >
                  {REGIONS.map((item) => (
                    <option key={item.slug} value={item.slug}>
                      {item.name}
                    </option>
                  ))}
                </Select>
              </div>

              <div className="space-y-1.5">
                <label
                  htmlFor="trail-subregion"
                  className="block text-sm font-semibold text-[var(--text-primary)]"
                >
                  Subregion / Kraina{" "}
                  <span className="font-normal text-[var(--text-secondary)]">
                    (opcjonalnie)
                  </span>
                </label>
                <Input
                  id="trail-subregion"
                  name="subregion"
                  type="text"
                  value={subregion}
                  onChange={(event) => setSubregion(event.target.value)}
                  placeholder="np. Jura Krakowsko-Częstochowska, Beskid Śląski"
                  maxLength={120}
                  className="text-base"
                />
              </div>
            </div>

            {/* Trudność + Nawierzchnia + Kolor oznakowania PTTK */}
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
              <div className="space-y-1.5">
                <label
                  htmlFor="trail-difficulty"
                  className="block text-sm font-semibold text-[var(--text-primary)]"
                >
                  Poziom trudności <span className="text-[var(--accent-danger)]">*</span>
                </label>
                <Select
                  id="trail-difficulty"
                  name="difficulty"
                  value={difficulty}
                  onChange={(event) =>
                    setDifficulty(event.target.value as Difficulty)
                  }
                  className="text-base"
                >
                  {DIFFICULTIES.map((diff) => (
                    <option key={diff} value={diff}>
                      {DIFFICULTY_META[diff].label}
                    </option>
                  ))}
                </Select>
              </div>

              <div className="space-y-1.5">
                <label
                  htmlFor="trail-surface"
                  className="block text-sm font-semibold text-[var(--text-primary)]"
                >
                  Nawierzchnia <span className="text-[var(--accent-danger)]">*</span>
                </label>
                <Select
                  id="trail-surface"
                  name="surface"
                  value={surface}
                  onChange={(event) => setSurface(event.target.value as Surface)}
                  className="text-base"
                >
                  {SURFACES.map((item) => (
                    <option key={item} value={item}>
                      {SURFACE_LABELS[item]}
                    </option>
                  ))}
                </Select>
              </div>

              <div className="space-y-1.5">
                <label
                  htmlFor="trail-color"
                  className="block text-sm font-semibold text-[var(--text-primary)]"
                >
                  Kolor oznakowania PTTK
                </label>
                <div className="flex items-center gap-2.5">
                  <span
                    className="h-5 w-5 shrink-0 rounded-full border border-black/15 shadow-sm"
                    style={{ backgroundColor: TRAIL_COLOR_META[trailColor].hex }}
                    aria-hidden="true"
                  />
                  <Select
                    id="trail-color"
                    name="trailColor"
                    value={trailColor}
                    onChange={(event) =>
                      setTrailColor(event.target.value as TrailColor)
                    }
                    className="text-base"
                  >
                    {TRAIL_COLORS.map((color) => (
                      <option key={color} value={color}>
                        {TRAIL_COLOR_META[color].label}
                      </option>
                    ))}
                  </Select>
                </div>
              </div>
            </div>

            {/* Krótki opis */}
            <div className="space-y-1.5">
              <div className="flex items-center justify-between gap-2">
                <label
                  htmlFor="trail-short-description"
                  className="block text-sm font-semibold text-[var(--text-primary)]"
                >
                  Krótki opis (na kafelek){" "}
                  <span className="text-[var(--accent-danger)]">*</span>
                </label>
                <span
                  className={`font-mono text-xs tabular-nums ${
                    shortDescription.length > MAX_SHORT_DESC_LENGTH
                      ? "font-bold text-[var(--accent-danger)]"
                      : "text-[var(--text-secondary)]"
                  }`}
                >
                  {shortDescription.length} / {MAX_SHORT_DESC_LENGTH}
                </span>
              </div>
              <textarea
                id="trail-short-description"
                name="shortDescription"
                rows={3}
                maxLength={MAX_SHORT_DESC_LENGTH}
                value={shortDescription}
                onChange={(event) => {
                  setShortDescription(event.target.value);
                  clearFieldError("shortDescription");
                }}
                placeholder="Zwięzły opis w 1–2 zdaniach zachęcający do przejechania trasy..."
                aria-invalid={Boolean(fieldErrors.shortDescription)}
                aria-describedby={
                  fieldErrors.shortDescription
                    ? "trail-short-description-error"
                    : undefined
                }
                className="w-full rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-surface-muted)] px-3.5 py-2.5 text-base text-[var(--text-primary)] placeholder:text-[var(--text-secondary)] transition-colors focus:border-[var(--accent-primary)] focus:bg-[var(--bg-surface)] focus:outline-none"
              />
              {fieldErrors.shortDescription && (
                <p
                  id="trail-short-description-error"
                  className="text-xs font-medium text-[var(--accent-danger)]"
                >
                  {fieldErrors.shortDescription}
                </p>
              )}
            </div>

            {/* Pełny opis artykułu (Markdown) */}
            <div className="space-y-1.5">
              <label
                htmlFor="trail-content"
                className="block text-sm font-semibold text-[var(--text-primary)]"
              >
                Pełny opis artykułu (Markdown){" "}
                <span className="text-[var(--accent-danger)]">*</span>
              </label>
              <textarea
                id="trail-content"
                name="content"
                rows={8}
                value={content}
                onChange={(event) => {
                  setContent(event.target.value);
                  clearFieldError("content");
                }}
                placeholder="## Przebieg trasy&#10;&#10;Opisz szczegółowo wrażenia z jazdy, jakość nawierzchni, najciekawsze odcinki i praktyczne wskazówki (obsługiwany jest Markdown)..."
                aria-invalid={Boolean(fieldErrors.content)}
                aria-describedby={
                  fieldErrors.content ? "trail-content-error" : undefined
                }
                className="w-full rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-surface-muted)] px-3.5 py-2.5 text-base leading-relaxed text-[var(--text-primary)] placeholder:text-[var(--text-secondary)] transition-colors focus:border-[var(--accent-primary)] focus:bg-[var(--bg-surface)] focus:outline-none"
              />
              {fieldErrors.content ? (
                <p
                  id="trail-content-error"
                  className="text-xs font-medium text-[var(--accent-danger)]"
                >
                  {fieldErrors.content}
                </p>
              ) : (
                <p className="text-xs text-[var(--text-secondary)]">
                  Możesz używać nagłówków (<code className="font-mono">##</code>), list wypunktowanych i pogrubień (<code className="font-mono">**tekst**</code>).
                </p>
              )}
            </div>
          </div>
        </section>

        {/* Sekcja 3: Parametry i źródło */}
        <section className="rounded-3xl border border-[var(--border-subtle)] bg-[var(--bg-surface)] p-5 shadow-sm sm:p-6">
          <div className="mb-5 flex items-center gap-2.5 border-b border-[var(--border-subtle)] pb-4">
            <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-[var(--accent-telemetry)]/15 text-[var(--accent-telemetry)]">
              <Route className="h-4 w-4" aria-hidden="true" />
            </span>
            <div>
              <h2 className="font-display text-2xl font-bold uppercase tracking-wide text-[var(--text-primary)]">
                Parametry telemetrii i źródło
              </h2>
              <p className="text-xs text-[var(--text-secondary)]">
                Wartości dystansu i przewyższenia uzupełnią się automatycznie po wgraniu pliku GPX.
              </p>
            </div>
          </div>

          <div className="space-y-5">
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
              <div className="space-y-1.5">
                <label
                  htmlFor="trail-distance"
                  className="block text-sm font-semibold text-[var(--text-primary)]"
                >
                  Dystans (km) <span className="text-[var(--accent-danger)]">*</span>
                </label>
                <Input
                  id="trail-distance"
                  name="distanceKm"
                  type="number"
                  inputMode="decimal"
                  step="0.1"
                  min="0"
                  max="2500"
                  value={distanceKmInput}
                  onChange={(event) => {
                    setDistanceKmInput(event.target.value);
                    clearFieldError("distanceKm");
                  }}
                  placeholder="np. 42.5"
                  aria-invalid={Boolean(fieldErrors.distanceKm)}
                  aria-describedby={
                    fieldErrors.distanceKm ? "trail-distance-error" : undefined
                  }
                  className="font-mono text-base tabular-nums"
                />
                {fieldErrors.distanceKm && (
                  <p
                    id="trail-distance-error"
                    className="text-xs font-medium text-[var(--accent-danger)]"
                  >
                    {fieldErrors.distanceKm}
                  </p>
                )}
              </div>

              <div className="space-y-1.5">
                <label
                  htmlFor="trail-elevation"
                  className="block text-sm font-semibold text-[var(--text-primary)]"
                >
                  Przewyższenie (m)
                </label>
                <Input
                  id="trail-elevation"
                  name="elevationGainM"
                  type="number"
                  inputMode="numeric"
                  step="1"
                  min="0"
                  max="50000"
                  value={elevationGainInput}
                  onChange={(event) => {
                    setElevationGainInput(event.target.value);
                    clearFieldError("elevationGainM");
                  }}
                  placeholder="np. 380"
                  aria-invalid={Boolean(fieldErrors.elevationGainM)}
                  aria-describedby={
                    fieldErrors.elevationGainM
                      ? "trail-elevation-error"
                      : undefined
                  }
                  className="font-mono text-base tabular-nums"
                />
                {fieldErrors.elevationGainM && (
                  <p
                    id="trail-elevation-error"
                    className="text-xs font-medium text-[var(--accent-danger)]"
                  >
                    {fieldErrors.elevationGainM}
                  </p>
                )}
              </div>

              <div className="space-y-1.5">
                <label
                  htmlFor="trail-estimated-time"
                  className="block text-sm font-semibold text-[var(--text-primary)]"
                >
                  Szacowany czas (min)
                </label>
                <Input
                  id="trail-estimated-time"
                  name="estimatedTimeMin"
                  type="number"
                  inputMode="numeric"
                  step="1"
                  min="1"
                  max="30000"
                  value={estimatedTimeInput}
                  onChange={(event) => {
                    setEstimatedTimeInput(event.target.value);
                    clearFieldError("estimatedTimeMin");
                  }}
                  placeholder="np. 165"
                  aria-invalid={Boolean(fieldErrors.estimatedTimeMin)}
                  aria-describedby={
                    fieldErrors.estimatedTimeMin
                      ? "trail-estimated-time-error"
                      : undefined
                  }
                  className="font-mono text-base tabular-nums"
                />
                {fieldErrors.estimatedTimeMin && (
                  <p
                    id="trail-estimated-time-error"
                    className="text-xs font-medium text-[var(--accent-danger)]"
                  >
                    {fieldErrors.estimatedTimeMin}
                  </p>
                )}
              </div>
            </div>

            {/* Checkboxy: Pętla i Opublikowany */}
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <label className="flex min-h-[44px] cursor-pointer items-center gap-3 rounded-2xl border border-[var(--border-subtle)] bg-[var(--bg-canvas)]/70 px-4 py-3 transition-colors hover:border-[var(--accent-primary)]/50">
                <input
                  id="trail-is-loop"
                  name="isLoop"
                  type="checkbox"
                  checked={isLoop}
                  onChange={(event) => setIsLoop(event.target.checked)}
                  className="h-5 w-5 rounded border-[var(--border-subtle)] accent-[var(--accent-primary)]"
                />
                <div>
                  <span className="block text-sm font-semibold text-[var(--text-primary)]">
                    Trasa w formie pętli
                  </span>
                  <span className="block text-xs text-[var(--text-secondary)]">
                    Start i meta znajdują się w tym samym miejscu.
                  </span>
                </div>
              </label>

              <label className="flex min-h-[44px] cursor-pointer items-center gap-3 rounded-2xl border border-[var(--border-subtle)] bg-[var(--bg-canvas)]/70 px-4 py-3 transition-colors hover:border-[var(--accent-primary)]/50">
                <input
                  id="trail-published"
                  name="published"
                  type="checkbox"
                  checked={published}
                  onChange={(event) => setPublished(event.target.checked)}
                  className="h-5 w-5 rounded border-[var(--border-subtle)] accent-[var(--accent-primary)]"
                />
                <div>
                  <span className="block text-sm font-semibold text-[var(--text-primary)]">
                    Opublikowany w katalogu
                  </span>
                  <span className="block text-xs text-[var(--text-secondary)]">
                    Odznacz, aby zapisać szlak jako roboczy szkic.
                  </span>
                </div>
              </label>
            </div>

            {/* Link źródłowy + Nazwa źródła */}
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <div className="space-y-1.5">
                <label
                  htmlFor="trail-source-url"
                  className="block text-sm font-semibold text-[var(--text-primary)]"
                >
                  Link źródłowy{" "}
                  <span className="font-normal text-[var(--text-secondary)]">
                    (opcjonalnie)
                  </span>
                </label>
                <Input
                  id="trail-source-url"
                  name="sourceUrl"
                  type="url"
                  inputMode="url"
                  value={sourceUrl}
                  onChange={(event) => {
                    setSourceUrl(event.target.value);
                    clearFieldError("sourceUrl");
                  }}
                  placeholder="https://slaskie.travel/route/1019753"
                  aria-invalid={Boolean(fieldErrors.sourceUrl)}
                  className="text-base"
                />
                {fieldErrors.sourceUrl && (
                  <p className="text-xs font-medium text-[var(--accent-danger)]">
                    {fieldErrors.sourceUrl}
                  </p>
                )}
              </div>

              <div className="space-y-1.5">
                <label
                  htmlFor="trail-source-name"
                  className="block text-sm font-semibold text-[var(--text-primary)]"
                >
                  Nazwa źródła{" "}
                  <span className="font-normal text-[var(--text-secondary)]">
                    (opcjonalnie)
                  </span>
                </label>
                <Input
                  id="trail-source-name"
                  name="sourceName"
                  type="text"
                  value={sourceName}
                  onChange={(event) => setSourceName(event.target.value)}
                  placeholder="np. SLASKIE.travel"
                  maxLength={120}
                  className="text-base"
                />
              </div>
            </div>

            {/* Link do Google My Maps (opcjonalnie) */}
            <div className="space-y-1.5">
              <label
                htmlFor="trail-google-maps-embed-url"
                className="block text-sm font-semibold text-[var(--text-primary)]"
              >
                Link do Google My Maps{" "}
                <span className="font-normal text-[var(--text-secondary)]">
                  (opcjonalnie)
                </span>
              </label>
              <Input
                id="trail-google-maps-embed-url"
                name="googleMapsEmbedUrl"
                type="url"
                inputMode="url"
                value={googleMapsEmbedUrl}
                onChange={(event) => {
                  setGoogleMapsEmbedUrl(event.target.value);
                  clearFieldError("googleMapsEmbedUrl");
                }}
                placeholder="https://www.google.com/maps/d/viewer?mid=..."
                aria-invalid={Boolean(fieldErrors.googleMapsEmbedUrl)}
                aria-describedby={
                  fieldErrors.googleMapsEmbedUrl
                    ? "trail-google-maps-embed-url-error"
                    : "trail-google-maps-embed-url-help"
                }
                className="min-h-[44px] text-base"
              />
              {fieldErrors.googleMapsEmbedUrl ? (
                <p
                  id="trail-google-maps-embed-url-error"
                  className="text-xs font-medium text-[var(--accent-danger)]"
                >
                  {fieldErrors.googleMapsEmbedUrl}
                </p>
              ) : (
                <p
                  id="trail-google-maps-embed-url-help"
                  className="text-xs text-[var(--text-secondary)]"
                >
                  Opcjonalnie podepnij własną mapę 1:1 z{" "}
                  <code className="font-mono">mymaps.google.com</code> lub{" "}
                  <code className="font-mono">google.com/maps/d/...</code>, aby dodać na stronie szlaku bezpośredni przycisk „Mapa 1:1 (My Maps)”.
                </p>
              )}
            </div>
          </div>
        </section>

        {/* Sekcja 4: Ślad GPX i podgląd mapy na żywo */}
        <section className="rounded-3xl border border-[var(--border-subtle)] bg-[var(--bg-surface)] p-5 shadow-sm sm:p-6">
          <div className="mb-5 flex items-center gap-2.5 border-b border-[var(--border-subtle)] pb-4">
            <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-[var(--accent-secondary)]/15 text-[var(--accent-secondary)]">
              <Compass className="h-4 w-4" aria-hidden="true" />
            </span>
            <div>
              <h2 className="font-display text-2xl font-bold uppercase tracking-wide text-[var(--text-primary)]">
                Ślad GPX i podgląd mapy
              </h2>
              <p className="text-xs text-[var(--text-secondary)]">
                Wgraj plik .gpx, aby wyświetlić trasę na Google Maps i wyliczyć profil wysokościowy.
              </p>
            </div>
          </div>

          <GpxDropzone
            title={title}
            region={region}
            trailColor={trailColor}
            distanceKm={
              Number.isFinite(parsedPreviewDistance) ? parsedPreviewDistance : 0
            }
            elevationGainM={
              Number.isFinite(parsedPreviewElevation)
                ? Math.round(parsedPreviewElevation)
                : 0
            }
            isLoop={isLoop}
            gpxUrl={gpxUrl}
            routePoints={routePoints}
            bounds={bounds}
            startLat={startLat}
            startLng={startLng}
            endLat={endLat}
            endLng={endLng}
            blobConfigured={blobConfigured}
            gpxUrlError={fieldErrors.gpxUrl}
            onGpxParsed={handleGpxParsed}
            onGpxUrlChange={(val) => {
              setGpxUrl(val);
              clearFieldError("gpxUrl");
            }}
            onClearGpx={handleClearGpx}
          />
        </section>

        {/* Sekcja 5: Okładka i galeria zdjęć */}
        <section className="rounded-3xl border border-[var(--border-subtle)] bg-[var(--bg-surface)] p-5 shadow-sm sm:p-6">
          <div className="mb-5 flex items-center gap-2.5 border-b border-[var(--border-subtle)] pb-4">
            <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-[var(--accent-warning)]/15 text-[var(--accent-warning)]">
              <ImageIcon className="h-4 w-4" aria-hidden="true" />
            </span>
            <div>
              <h2 className="font-display text-2xl font-bold uppercase tracking-wide text-[var(--text-primary)]">
                Okładka i galeria zdjęć
              </h2>
              <p className="text-xs text-[var(--text-secondary)]">
                Prześlij zdjęcia przez Vercel Blob, wklej adresy URL lub skorzystaj z gotowych grafik.
              </p>
            </div>
          </div>

          <ImageUploader
            coverImageUrl={coverImageUrl}
            images={images}
            blobConfigured={blobConfigured}
            coverError={fieldErrors.coverImageUrl}
            onCoverImageChange={(url) => {
              setCoverImageUrl(url);
              clearFieldError("coverImageUrl");
            }}
            onImagesChange={setImages}
          />
        </section>

        {/* Sekcja 6: Punkty POI na trasie */}
        <section className="rounded-3xl border border-[var(--border-subtle)] bg-[var(--bg-surface)] p-5 shadow-sm sm:p-6">
          <div className="mb-5 flex flex-wrap items-center justify-between gap-3 border-b border-[var(--border-subtle)] pb-4">
            <div className="flex items-center gap-2.5">
              <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-[var(--accent-telemetry)]/15 text-[var(--accent-telemetry)]">
                <MapPin className="h-4 w-4" aria-hidden="true" />
              </span>
              <div>
                <h2 className="font-display text-2xl font-bold uppercase tracking-wide text-[var(--text-primary)]">
                  Ciekawe miejsca na trasie (POI)
                </h2>
                <p className="text-xs text-[var(--text-secondary)]">
                  Opcjonalne pinezki na mapie: punkty widokowe, parkingi, gastronomia, zabytki, serwisy MOR.
                </p>
              </div>
            </div>

            <Button
              type="button"
              variant="outline"
              onClick={handleAddPoi}
              className="min-h-[44px]"
            >
              <Plus className="h-4 w-4 text-[var(--accent-primary)]" aria-hidden="true" />
              <span>Dodaj punkt POI</span>
            </Button>
          </div>

          {pois.length === 0 ? (
            <p className="rounded-2xl border border-dashed border-[var(--border-subtle)] bg-[var(--bg-canvas)]/60 px-4 py-6 text-center text-sm text-[var(--text-secondary)]">
              Nie dodano jeszcze żadnych punktów POI. Kliknij „Dodaj punkt POI”, aby oznaczyć atrakcje lub parking przy trasie.
            </p>
          ) : (
            <div className="space-y-4">
              {pois.map((poi, index) => {
                const nameErr = fieldErrors[`pois.${index}.name`];
                const latErr = fieldErrors[`pois.${index}.lat`];
                const lngErr = fieldErrors[`pois.${index}.lng`];

                return (
                  <div
                    key={poi.localId}
                    className="rounded-2xl border border-[var(--border-subtle)] bg-[var(--bg-canvas)]/70 p-4 space-y-3"
                  >
                    <div className="flex items-center justify-between gap-2">
                      <span className="font-mono text-xs font-bold uppercase tracking-wider text-[var(--accent-telemetry)]">
                        Punkt POI #{index + 1}
                      </span>
                      <Button
                        type="button"
                        variant="ghost"
                        onClick={() => handleRemovePoi(index)}
                        aria-label={`Usuń punkt POI ${index + 1}`}
                        className="min-h-[44px] text-xs text-[var(--accent-danger)] hover:bg-[var(--accent-danger)]/10 hover:text-[var(--accent-danger)]"
                      >
                        <Trash2 className="h-3.5 w-3.5" aria-hidden="true" />
                        <span>Usuń</span>
                      </Button>
                    </div>

                    <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                      <div className="space-y-1">
                        <label
                          htmlFor={`poi-name-${index}`}
                          className="block text-xs font-semibold text-[var(--text-primary)]"
                        >
                          Nazwa miejsca *
                        </label>
                        <Input
                          id={`poi-name-${index}`}
                          type="text"
                          value={poi.name}
                          onChange={(event) => {
                            handleUpdatePoi(index, { name: event.target.value });
                            clearFieldError(`pois.${index}.name`);
                          }}
                          placeholder="np. Zamek Ogrodzieniec / Parking PKP"
                          maxLength={140}
                          aria-invalid={Boolean(nameErr)}
                          className="text-base"
                        />
                        {nameErr && (
                          <p className="text-xs font-medium text-[var(--accent-danger)]">
                            {nameErr}
                          </p>
                        )}
                      </div>

                      <div className="space-y-1">
                        <label
                          htmlFor={`poi-category-${index}`}
                          className="block text-xs font-semibold text-[var(--text-primary)]"
                        >
                          Kategoria
                        </label>
                        <Select
                          id={`poi-category-${index}`}
                          value={poi.category}
                          onChange={(event) =>
                            handleUpdatePoi(index, { category: event.target.value })
                          }
                          className="text-base"
                        >
                          {POI_CATEGORIES.map((cat) => (
                            <option key={cat} value={cat}>
                              {POI_CATEGORY_LABELS[cat]}
                            </option>
                          ))}
                        </Select>
                      </div>
                    </div>

                    <div className="space-y-1">
                      <label
                        htmlFor={`poi-desc-${index}`}
                        className="block text-xs font-semibold text-[var(--text-primary)]"
                      >
                        Krótki opis (opcjonalnie)
                      </label>
                      <Input
                        id={`poi-desc-${index}`}
                        type="text"
                        value={poi.description}
                        onChange={(event) =>
                          handleUpdatePoi(index, { description: event.target.value })
                        }
                        placeholder="np. Bezpłatny parking i stojaki rowerowe przy starcie"
                        maxLength={300}
                        className="text-base"
                      />
                    </div>

                    <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                      <div className="space-y-1">
                        <label
                          htmlFor={`poi-lat-${index}`}
                          className="block text-xs font-semibold text-[var(--text-primary)]"
                        >
                          Szerokość geograficzna (lat) *
                        </label>
                        <Input
                          id={`poi-lat-${index}`}
                          type="number"
                          inputMode="decimal"
                          step="any"
                          value={poi.lat}
                          onChange={(event) => {
                            handleUpdatePoi(index, { lat: event.target.value });
                            clearFieldError(`pois.${index}.lat`);
                          }}
                          placeholder="50.4532"
                          aria-invalid={Boolean(latErr)}
                          className="font-mono text-base tabular-nums"
                        />
                        {latErr && (
                          <p className="text-xs font-medium text-[var(--accent-danger)]">
                            Podaj poprawną szerokość geograficzną (-90 do 90).
                          </p>
                        )}
                      </div>

                      <div className="space-y-1">
                        <label
                          htmlFor={`poi-lng-${index}`}
                          className="block text-xs font-semibold text-[var(--text-primary)]"
                        >
                          Długość geograficzna (lng) *
                        </label>
                        <Input
                          id={`poi-lng-${index}`}
                          type="number"
                          inputMode="decimal"
                          step="any"
                          value={poi.lng}
                          onChange={(event) => {
                            handleUpdatePoi(index, { lng: event.target.value });
                            clearFieldError(`pois.${index}.lng`);
                          }}
                          placeholder="19.5529"
                          aria-invalid={Boolean(lngErr)}
                          className="font-mono text-base tabular-nums"
                        />
                        {lngErr && (
                          <p className="text-xs font-medium text-[var(--accent-danger)]">
                            Podaj poprawną długość geograficzną (-180 do 180).
                          </p>
                        )}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </section>

        {/* Pasek akcji formularza */}
        <div className="flex flex-col-reverse gap-3 rounded-3xl border border-[var(--border-subtle)] bg-[var(--bg-surface)] p-5 shadow-sm sm:flex-row sm:items-center sm:justify-between sm:p-6">
          <div className="flex flex-wrap items-center gap-3">
            {mode === "edit" && initialTrail && (
              <Button
                type="button"
                variant="destructive"
                onClick={() => {
                  setDeleteError(null);
                  setShowDeleteModal(true);
                }}
                disabled={isSubmitting || isDeleting}
                className="min-h-[44px]"
              >
                <Trash2 className="h-4 w-4" aria-hidden="true" />
                <span>Usuń szlak</span>
              </Button>
            )}

            <Link
              href={mode === "edit" && initialTrail ? `/szlaki/${initialTrail.slug}` : "/"}
              className="inline-flex min-h-[44px] items-center justify-center rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-surface)] px-4 py-2 text-sm font-semibold text-[var(--text-primary)] transition-colors hover:bg-[var(--bg-surface-muted)]"
            >
              Anuluj
            </Link>
          </div>

          <Button
            type="submit"
            size="lg"
            disabled={isSubmitting || isDeleting}
            className="min-h-[48px] w-full text-base font-bold sm:w-auto sm:min-w-[220px]"
          >
            {isSubmitting ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
                <span>Zapisywanie...</span>
              </>
            ) : (
              <>
                <Save className="h-4 w-4" aria-hidden="true" />
                <span>
                  {mode === "edit" ? "Zapisz zmiany" : "Opublikuj szlak"}
                </span>
              </>
            )}
          </Button>
        </div>
      </form>

      {/* Modal potwierdzenia usunięcia (tylko tryb edit) */}
      {mode === "edit" && initialTrail && showDeleteModal && (
        <div
          role="dialog"
          aria-modal="true"
          aria-labelledby={deleteDialogTitleId}
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/65 p-4 backdrop-blur-sm"
          onClick={() => {
            if (!isDeleting) setShowDeleteModal(false);
          }}
        >
          <div
            className="w-full max-w-md rounded-3xl border border-[var(--border-subtle)] bg-[var(--bg-surface)] p-6 shadow-2xl"
            onClick={(event) => event.stopPropagation()}
          >
            <div className="flex items-start justify-between gap-3">
              <div className="flex items-center gap-3">
                <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-[var(--accent-danger)]/15 text-[var(--accent-danger)]">
                  <AlertTriangle className="h-5 w-5" aria-hidden="true" />
                </span>
                <div>
                  <h3
                    id={deleteDialogTitleId}
                    className="font-display text-2xl font-bold uppercase tracking-wide text-[var(--text-primary)]"
                  >
                    Usuń szlak
                  </h3>
                  <p className="text-xs text-[var(--text-secondary)]">
                    Tej operacji nie można cofnąć.
                  </p>
                </div>
              </div>

              <button
                type="button"
                onClick={() => setShowDeleteModal(false)}
                disabled={isDeleting}
                aria-label="Zamknij okno potwierdzenia"
                className="inline-flex min-h-[44px] min-w-[44px] items-center justify-center rounded-xl text-[var(--text-secondary)] hover:bg-[var(--bg-surface-muted)] hover:text-[var(--text-primary)] cursor-pointer"
              >
                <X className="h-5 w-5" aria-hidden="true" />
              </button>
            </div>

            <p className="mt-4 text-sm leading-relaxed text-[var(--text-secondary)]">
              Czy na pewno chcesz trwale usunąć szlak{" "}
              <strong className="font-semibold text-[var(--text-primary)]">
                „{initialTrail.title}”
              </strong>{" "}
              wraz ze wszystkimi przypisanymi zdjęciami i punktami POI?
            </p>

            {deleteError && (
              <div
                role="alert"
                className="mt-4 rounded-xl border border-[var(--accent-danger)]/40 bg-[var(--accent-danger)]/10 px-3.5 py-2.5 text-sm font-medium text-[var(--accent-danger)]"
              >
                {deleteError}
              </div>
            )}

            <div className="mt-6 flex flex-col-reverse gap-2.5 sm:flex-row sm:justify-end">
              <Button
                type="button"
                variant="outline"
                onClick={() => setShowDeleteModal(false)}
                disabled={isDeleting}
                className="min-h-[44px]"
              >
                Anuluj
              </Button>
              <Button
                type="button"
                variant="destructive"
                onClick={handleConfirmDelete}
                disabled={isDeleting}
                className="min-h-[44px]"
              >
                {isDeleting ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
                    <span>Usuwanie...</span>
                  </>
                ) : (
                  <>
                    <Trash2 className="h-4 w-4" aria-hidden="true" />
                    <span>Tak, usuń szlak</span>
                  </>
                )}
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
