"use client";

import { useRef, useState, type ChangeEvent } from "react";
import Image from "next/image";
import { upload } from "@vercel/blob/client";
import {
  AlertCircle,
  Check,
  ImagePlus,
  Info,
  Link2,
  Loader2,
  Star,
  Trash2,
  Upload,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ALLOWED_IMAGE_MIME_TYPES, MAX_IMAGE_SIZE_BYTES } from "@/lib/upload/validation";
import { isValidAssetUrl } from "@/lib/validation/trail";

export interface FormImageItem {
  url: string;
  caption: string;
}

export interface ImageUploaderProps {
  coverImageUrl: string;
  images: FormImageItem[];
  blobConfigured?: boolean;
  coverError?: string;
  onCoverImageChange: (url: string) => void;
  onImagesChange: (images: FormImageItem[]) => void;
}

export const PRESET_TRAIL_IMAGES = [
  {
    url: "/images/trails/slaskie-1019753-cover.jpg",
    label: "Śląskie · Jura",
  },
  {
    url: "/images/trails/orle-gniazda-cover.jpg",
    label: "Orle Gniazda",
  },
  {
    url: "/images/trails/velo-dunajec-cover.jpg",
    label: "Velo Dunajec",
  },
  {
    url: "/images/trails/green-velo-podlasie-cover.jpg",
    label: "Green Velo",
  },
  {
    url: "/images/trails/dolina-baryczy-cover.jpg",
    label: "Dolina Baryczy",
  },
  {
    url: "/images/trails/velo-baltica-cover.jpg",
    label: "Velo Baltica",
  },
  {
    url: "/images/trails/zelazny-szlak-cover.jpg",
    label: "Żelazny Szlak",
  },
] as const;

function sanitizeImageFilename(name: string): string {
  const cleaned = name
    .trim()
    .replace(/[^a-zA-Z0-9._-]/g, "-")
    .replace(/-+/g, "-");
  return cleaned || "zdjecie-szlaku.jpg";
}

export function ImageUploader({
  coverImageUrl,
  images,
  blobConfigured = true,
  coverError,
  onCoverImageChange,
  onImagesChange,
}: ImageUploaderProps) {
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const [newImageUrl, setNewImageUrl] = useState("");
  const [newImageCaption, setNewImageCaption] = useState("");
  const [isUploading, setIsUploading] = useState(false);
  const [uploadNotice, setUploadNotice] = useState<string | null>(null);
  const [urlError, setUrlError] = useState<string | null>(null);

  function addImagesToGallery(added: FormImageItem[]) {
    if (added.length === 0) return;

    const existingUrls = new Set(images.map((item) => item.url));
    const merged = [...images];

    for (const item of added) {
      if (!existingUrls.has(item.url)) {
        merged.push(item);
        existingUrls.add(item.url);
      }
    }

    onImagesChange(merged);

    if (!coverImageUrl.trim() && added[0]?.url) {
      onCoverImageChange(added[0].url);
    }
  }

  async function handleFileSelect(event: ChangeEvent<HTMLInputElement>) {
    const fileList = event.target.files;
    if (!fileList || fileList.length === 0) return;

    const files = Array.from(fileList);
    event.target.value = "";

    setUploadNotice(null);
    setUrlError(null);

    const invalidFile = files.find((file) => {
      const mime = file.type.split(";")[0].trim().toLowerCase();
      return (
        !(ALLOWED_IMAGE_MIME_TYPES as readonly string[]).includes(mime) ||
        file.size > MAX_IMAGE_SIZE_BYTES
      );
    });

    if (invalidFile) {
      setUrlError(
        `Plik „${invalidFile.name}” ma niedozwolony format lub przekracza 10 MB (akceptujemy JPG, PNG, WebP).`,
      );
      return;
    }

    if (!blobConfigured) {
      setUploadNotice(
        "Bezpośredni upload plików wymaga konfiguracji Vercel Blob. Możesz dodać zdjęcie przez adres URL lub wybrać gotową grafikę poniżej.",
      );
      return;
    }

    setIsUploading(true);
    const uploadedItems: FormImageItem[] = [];
    let blobUnavailable = false;

    try {
      for (const file of files) {
        const mime = file.type.split(";")[0].trim().toLowerCase();
        const safeName = sanitizeImageFilename(file.name);
        try {
          const blob = await upload(`trails/${safeName}`, file, {
            access: "public",
            handleUploadUrl: "/api/upload",
            contentType: mime,
            clientPayload: JSON.stringify({
              contentType: mime,
              size: file.size,
            }),
          });
          uploadedItems.push({ url: blob.url, caption: "" });
        } catch {
          blobUnavailable = true;
          break;
        }
      }

      if (uploadedItems.length > 0) {
        addImagesToGallery(uploadedItems);
        setUploadNotice(
          `Przesłano ${uploadedItems.length} ${
            uploadedItems.length === 1 ? "zdjęcie" : "zdjęcia"
          } do Vercel Blob.`,
        );
      } else if (blobUnavailable) {
        setUploadNotice(
          "Bezpośredni upload plików wymaga konfiguracji Vercel Blob. Możesz dodać zdjęcie przez adres URL lub wybrać gotową grafikę poniżej.",
        );
      }
    } finally {
      setIsUploading(false);
    }
  }

  function handleAddByUrl() {
    setUrlError(null);
    const trimmedUrl = newImageUrl.trim();
    if (!trimmedUrl) {
      setUrlError("Podaj adres URL zdjęcia (https://... lub /images/...).");
      return;
    }

    if (!isValidAssetUrl(trimmedUrl)) {
      setUrlError(
        "Niepoprawny adres URL zdjęcia. Użyj pełnego linku http(s):// lub ścieżki /images/...",
      );
      return;
    }

    addImagesToGallery([
      {
        url: trimmedUrl,
        caption: newImageCaption.trim(),
      },
    ]);
    setNewImageUrl("");
    setNewImageCaption("");
  }

  function handleSelectPreset(presetUrl: string, presetLabel: string) {
    setUrlError(null);
    onCoverImageChange(presetUrl);
    if (!images.some((item) => item.url === presetUrl)) {
      onImagesChange([...images, { url: presetUrl, caption: presetLabel }]);
    }
  }

  function handleCaptionChange(index: number, caption: string) {
    const next = images.map((item, idx) =>
      idx === index ? { ...item, caption } : item,
    );
    onImagesChange(next);
  }

  function handleRemoveImage(index: number) {
    const removed = images[index];
    const next = images.filter((_, idx) => idx !== index);
    onImagesChange(next);

    if (removed && removed.url === coverImageUrl && next.length > 0) {
      onCoverImageChange(next[0].url);
    }
  }

  const trimmedCover = coverImageUrl.trim();
  const hasValidCoverPreview = trimmedCover.length > 0 && isValidAssetUrl(trimmedCover);

  return (
    <div className="space-y-5">
      {/* Cover Image Input + Live Preview */}
      <div className="grid grid-cols-1 gap-4 md:grid-cols-12">
        <div className="space-y-2 md:col-span-7">
          <label
            htmlFor="trail-cover-image"
            className="block text-sm font-semibold text-[var(--text-primary)]"
          >
            Zdjęcie okładkowe (URL) <span className="text-[var(--accent-danger)]">*</span>
          </label>
          <Input
            id="trail-cover-image"
            name="coverImageUrl"
            type="text"
            value={coverImageUrl}
            onChange={(event) => onCoverImageChange(event.target.value)}
            placeholder="/images/trails/slaskie-1019753-cover.jpg lub https://..."
            aria-invalid={Boolean(coverError)}
            aria-describedby={coverError ? "trail-cover-image-error" : undefined}
            className="text-base"
          />
          {coverError ? (
            <p
              id="trail-cover-image-error"
              className="text-xs font-medium text-[var(--accent-danger)]"
            >
              {coverError}
            </p>
          ) : (
            <p className="text-xs text-[var(--text-secondary)]">
              Wyświetlane na kafelku w katalogu i w nagłówku artykułu szlaku.
            </p>
          )}

          {/* Direct Upload to Vercel Blob */}
          <div className="pt-2">
            <input
              ref={fileInputRef}
              type="file"
              accept="image/jpeg,image/png,image/webp"
              multiple
              onChange={handleFileSelect}
              className="sr-only"
              data-testid="image-file-input"
            />
            <Button
              type="button"
              variant="outline"
              onClick={() => fileInputRef.current?.click()}
              disabled={isUploading}
              className="min-h-[44px]"
            >
              {isUploading ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
                  <span>Przesyłanie zdjęć...</span>
                </>
              ) : (
                <>
                  <Upload className="h-4 w-4 text-[var(--accent-primary)]" aria-hidden="true" />
                  <span>Wgraj zdjęcia (Vercel Blob)</span>
                </>
              )}
            </Button>
          </div>
        </div>

        <div className="md:col-span-5">
          <p className="mb-2 text-xs font-semibold uppercase tracking-wider text-[var(--text-secondary)]">
            Podgląd okładki (16:10)
          </p>
          <div className="relative aspect-[16/10] w-full overflow-hidden rounded-2xl border border-[var(--border-subtle)] bg-[var(--bg-surface-muted)]">
            {hasValidCoverPreview ? (
              <Image
                src={trimmedCover}
                alt="Podgląd zdjęcia okładkowego"
                fill
                unoptimized
                sizes="(max-width: 768px) 100vw, 400px"
                className="object-cover"
              />
            ) : (
              <div className="flex h-full flex-col items-center justify-center gap-2 p-4 text-center text-xs text-[var(--text-secondary)]">
                <ImagePlus className="h-6 w-6 opacity-60" aria-hidden="true" />
                <span>Wpisz URL lub wybierz grafikę poniżej</span>
              </div>
            )}
          </div>
        </div>
      </div>

      {uploadNotice && (
        <div
          role="status"
          className="flex items-start gap-2.5 rounded-2xl border border-[var(--accent-telemetry)]/40 bg-[var(--accent-telemetry)]/10 px-4 py-3 text-sm text-[var(--text-primary)]"
        >
          <Info
            className="mt-0.5 h-4 w-4 shrink-0 text-[var(--accent-telemetry)]"
            aria-hidden="true"
          />
          <span>{uploadNotice}</span>
        </div>
      )}

      {/* Default Velo Pulse Presets */}
      <div className="space-y-2.5">
        <p className="text-xs font-semibold uppercase tracking-wider text-[var(--text-secondary)]">
          Lub wybierz gotową grafikę Velo Pulse
        </p>
        <div className="grid grid-cols-2 gap-2.5 sm:grid-cols-4 lg:grid-cols-7">
          {PRESET_TRAIL_IMAGES.map((preset) => {
            const isSelected = trimmedCover === preset.url;
            return (
              <button
                key={preset.url}
                type="button"
                onClick={() => handleSelectPreset(preset.url, preset.label)}
                className={`group relative flex min-h-[44px] flex-col overflow-hidden rounded-xl border text-left transition-all cursor-pointer focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--accent-primary)] ${
                  isSelected
                    ? "border-[var(--accent-primary)] ring-2 ring-[var(--accent-primary)]/30"
                    : "border-[var(--border-subtle)] hover:border-[var(--accent-primary)]/60"
                }`}
              >
                <div className="relative aspect-[16/10] w-full bg-[var(--bg-surface-muted)]">
                  <Image
                    src={preset.url}
                    alt={preset.label}
                    fill
                    unoptimized
                    sizes="160px"
                    className="object-cover transition-transform duration-300 group-hover:scale-105"
                  />
                  {isSelected && (
                    <span className="absolute top-1.5 right-1.5 flex h-5 w-5 items-center justify-center rounded-full bg-[var(--accent-primary)] text-white shadow">
                      <Check className="h-3 w-3" aria-hidden="true" />
                    </span>
                  )}
                </div>
                <span className="truncate bg-[var(--bg-surface)] px-2 py-1.5 text-[11px] font-semibold text-[var(--text-primary)]">
                  {preset.label}
                </span>
              </button>
            );
          })}
        </div>
      </div>

      {/* Add Additional Gallery Image by URL */}
      <div className="rounded-2xl border border-[var(--border-subtle)] bg-[var(--bg-canvas)]/70 p-4 space-y-3">
        <p className="flex items-center gap-1.5 text-sm font-semibold text-[var(--text-primary)]">
          <Link2 className="h-4 w-4 text-[var(--accent-primary)]" aria-hidden="true" />
          <span>Dodaj zdjęcie do galerii po adresie URL</span>
        </p>

        <div className="grid grid-cols-1 gap-3 sm:grid-cols-12">
          <div className="sm:col-span-6">
            <label htmlFor="gallery-new-url" className="sr-only">
              Adres URL zdjęcia do galerii
            </label>
            <Input
              id="gallery-new-url"
              type="text"
              value={newImageUrl}
              onChange={(event) => {
                setNewImageUrl(event.target.value);
                if (urlError) setUrlError(null);
              }}
              placeholder="https://... lub /images/trails/..."
              className="text-base"
            />
          </div>
          <div className="sm:col-span-4">
            <label htmlFor="gallery-new-caption" className="sr-only">
              Podpis zdjęcia
            </label>
            <Input
              id="gallery-new-caption"
              type="text"
              value={newImageCaption}
              onChange={(event) => setNewImageCaption(event.target.value)}
              placeholder="Podpis zdjęcia (opcjonalnie)"
              maxLength={240}
              className="text-base"
            />
          </div>
          <div className="sm:col-span-2">
            <Button
              type="button"
              variant="secondary"
              onClick={handleAddByUrl}
              className="min-h-[44px] w-full"
            >
              Dodaj
            </Button>
          </div>
        </div>

        {urlError && (
          <p
            role="alert"
            className="flex items-center gap-1.5 text-xs font-medium text-[var(--accent-danger)]"
          >
            <AlertCircle className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
            <span>{urlError}</span>
          </p>
        )}
      </div>

      {/* Gallery Items List */}
      {images.length > 0 && (
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <p className="text-xs font-semibold uppercase tracking-wider text-[var(--text-secondary)]">
              Zdjęcia w galerii ({images.length})
            </p>
          </div>

          <ul className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            {images.map((img, index) => {
              const isCover = img.url === trimmedCover;
              const validPreview = isValidAssetUrl(img.url);

              return (
                <li
                  key={`${img.url}-${index}`}
                  className="flex flex-col gap-3 rounded-2xl border border-[var(--border-subtle)] bg-[var(--bg-surface)] p-3 shadow-sm"
                >
                  <div className="relative aspect-[16/10] w-full overflow-hidden rounded-xl bg-[var(--bg-surface-muted)]">
                    {validPreview ? (
                      <Image
                        src={img.url}
                        alt={img.caption || `Zdjęcie galerii ${index + 1}`}
                        fill
                        unoptimized
                        sizes="(max-width: 640px) 100vw, 360px"
                        className="object-cover"
                      />
                    ) : (
                      <div className="flex h-full items-center justify-center text-xs text-[var(--text-secondary)]">
                        Niepoprawny podgląd
                      </div>
                    )}

                    {isCover && (
                      <span className="absolute top-2 left-2 inline-flex items-center gap-1 rounded-full bg-[var(--accent-primary)] px-2.5 py-1 text-[11px] font-bold text-white shadow">
                        <Star className="h-3 w-3 fill-current" aria-hidden="true" />
                        Okładka
                      </span>
                    )}
                  </div>

                  <div className="space-y-2">
                    <Input
                      type="text"
                      value={img.caption}
                      onChange={(event) => handleCaptionChange(index, event.target.value)}
                      placeholder="Dodaj podpis zdjęcia..."
                      aria-label={`Podpis zdjęcia ${index + 1}`}
                      maxLength={240}
                      className="text-base"
                    />

                    <div className="flex flex-wrap items-center justify-between gap-2">
                      {!isCover ? (
                        <Button
                          type="button"
                          variant="outline"
                          onClick={() => onCoverImageChange(img.url)}
                          className="min-h-[44px] text-xs"
                        >
                          <Star className="h-3.5 w-3.5 text-[var(--accent-warning)]" aria-hidden="true" />
                          <span>Ustaw jako okładkę</span>
                        </Button>
                      ) : (
                        <span className="inline-flex min-h-[44px] items-center text-xs font-semibold text-[var(--accent-primary)]">
                          Aktualne zdjęcie główne
                        </span>
                      )}

                      <Button
                        type="button"
                        variant="ghost"
                        onClick={() => handleRemoveImage(index)}
                        aria-label={`Usuń zdjęcie ${index + 1}`}
                        className="min-h-[44px] text-xs text-[var(--accent-danger)] hover:bg-[var(--accent-danger)]/10 hover:text-[var(--accent-danger)]"
                      >
                        <Trash2 className="h-3.5 w-3.5" aria-hidden="true" />
                        <span>Usuń</span>
                      </Button>
                    </div>
                  </div>
                </li>
              );
            })}
          </ul>
        </div>
      )}
    </div>
  );
}
