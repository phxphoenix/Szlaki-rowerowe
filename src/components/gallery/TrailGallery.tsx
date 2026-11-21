"use client";

import { useMemo, useState } from "react";
import Image from "next/image";
import { Camera, CameraOff, Expand } from "lucide-react";
import { shouldUseUnoptimizedImage } from "@/lib/utils/image";
import type { TrailImage } from "@/types/trail";
import { PhotoLightbox } from "@/components/gallery/PhotoLightbox";

export interface TrailGalleryProps {
  images: readonly TrailImage[];
  coverImageUrl: string;
  trailTitle: string;
}

export function TrailGallery({
  images,
  coverImageUrl,
  trailTitle,
}: TrailGalleryProps) {
  const [lightboxOpen, setLightboxOpen] = useState(false);
  const [activeIndex, setActiveIndex] = useState(0);
  const [failedUrls, setFailedUrls] = useState<Record<string, boolean>>({});

  const galleryImages = useMemo<TrailImage[]>(() => {
    if (images.length > 0) {
      return [...images].sort((a, b) => a.sortOrder - b.sortOrder);
    }
    return [
      {
        id: "cover-fallback",
        trailId: "",
        url: coverImageUrl,
        caption: trailTitle,
        sortOrder: 0,
      },
    ];
  }, [images, coverImageUrl, trailTitle]);

  const handleOpenAt = (index: number) => {
    setActiveIndex(index);
    setLightboxOpen(true);
  };

  return (
    <section aria-labelledby="trail-gallery-heading" className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-2.5">
          <span className="inline-flex h-9 w-9 items-center justify-center rounded-xl bg-[var(--accent-primary)]/12 text-[var(--accent-primary)]">
            <Camera className="h-5 w-5" aria-hidden="true" />
          </span>
          <div>
            <h2
              id="trail-gallery-heading"
              className="font-display text-2xl font-bold uppercase tracking-wide text-[var(--text-primary)] leading-none sm:text-3xl"
            >
              Galeria trasy
            </h2>
            <p className="mt-1 text-xs text-[var(--text-secondary)] sm:text-sm">
              Kliknij zdjęcie, aby otworzyć podgląd pełnoekranowy
            </p>
          </div>
        </div>

        <span className="rounded-full border border-[var(--border-subtle)] bg-[var(--bg-surface-muted)] px-3 py-1 font-mono text-xs font-semibold text-[var(--text-secondary)] tabular-nums">
          {galleryImages.length}{" "}
          {galleryImages.length === 1
            ? "zdjęcie"
            : galleryImages.length >= 2 && galleryImages.length <= 4
              ? "zdjęcia"
              : "zdjęć"}
        </span>
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {galleryImages.map((img, index) => {
          const altText =
            img.caption?.trim() || `${trailTitle} — zdjęcie ${index + 1}`;

          return (
            <button
              key={img.id}
              type="button"
              onClick={() => handleOpenAt(index)}
              aria-label={`Otwórz zdjęcie ${index + 1} z ${galleryImages.length}: ${altText}`}
              className="group relative flex min-h-[44px] cursor-pointer flex-col overflow-hidden rounded-2xl border border-[var(--border-subtle)] bg-[var(--bg-surface)] text-left shadow-sm transition-all duration-200 hover:-translate-y-0.5 hover:shadow-md focus-visible:outline-2 focus-visible:outline-[var(--accent-primary)]"
            >
              <div className="relative aspect-[16/10] w-full overflow-hidden bg-[var(--bg-carbon)]">
                {failedUrls[img.url] ? (
                  <div
                    data-testid="gallery-image-fallback"
                    className="flex h-full w-full flex-col items-center justify-center gap-2 bg-[var(--bg-surface-muted)] px-4 text-center text-xs text-[var(--text-secondary)]"
                  >
                    <CameraOff className="h-7 w-7 opacity-65" aria-hidden="true" />
                    <span className="font-medium">
                      Nie udało się załadować zdjęcia
                    </span>
                  </div>
                ) : (
                  <>
                    <Image
                      src={img.url}
                      alt={altText}
                      fill
                      sizes="(max-width: 640px) 100vw, (max-width: 1024px) 50vw, 33vw"
                      unoptimized={shouldUseUnoptimizedImage(img.url)}
                      onError={() =>
                        setFailedUrls((prev) =>
                          prev[img.url] ? prev : { ...prev, [img.url]: true },
                        )
                      }
                      className="object-cover transition-transform duration-500 ease-out group-hover:scale-105"
                    />

                    <div
                      aria-hidden="true"
                      className="pointer-events-none absolute inset-0 bg-gradient-to-t from-[#11161A]/65 via-transparent to-transparent opacity-80 transition-opacity group-hover:opacity-95"
                    />
                  </>
                )}

                <span className="absolute top-3 right-3 inline-flex h-8 w-8 items-center justify-center rounded-full bg-[#11161A]/75 text-white backdrop-blur-sm transition-transform group-hover:scale-110">
                  <Expand className="h-4 w-4" aria-hidden="true" />
                </span>

                <span className="absolute bottom-2.5 left-3 rounded-md bg-[#11161A]/75 px-2 py-0.5 font-mono text-[11px] font-semibold text-white/90 tabular-nums backdrop-blur-sm">
                  {index + 1} / {galleryImages.length}
                </span>
              </div>

              {img.caption && (
                <div className="px-4 py-3">
                  <p className="text-sm font-medium leading-snug text-[var(--text-primary)] line-clamp-2">
                    {img.caption}
                  </p>
                </div>
              )}
            </button>
          );
        })}
      </div>

      <PhotoLightbox
        images={galleryImages}
        currentIndex={activeIndex}
        trailTitle={trailTitle}
        isOpen={lightboxOpen}
        onClose={() => setLightboxOpen(false)}
        onChangeIndex={setActiveIndex}
      />
    </section>
  );
}
