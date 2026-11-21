"use client";

import { useEffect, useRef, useState } from "react";
import Image from "next/image";
import { CameraOff, ChevronLeft, ChevronRight, X } from "lucide-react";
import { shouldUseUnoptimizedImage } from "@/lib/utils/image";
import type { TrailImage } from "@/types/trail";

export interface PhotoLightboxProps {
  images: readonly TrailImage[];
  currentIndex: number;
  trailTitle: string;
  isOpen: boolean;
  onClose: () => void;
  onChangeIndex: (nextIndex: number) => void;
}

const SWIPE_THRESHOLD_PX = 40;

export function PhotoLightbox({
  images,
  currentIndex,
  trailTitle,
  isOpen,
  onClose,
  onChangeIndex,
}: PhotoLightboxProps) {
  const touchStartRef = useRef<{ x: number; y: number } | null>(null);
  const [failedUrls, setFailedUrls] = useState<Record<string, boolean>>({});

  const total = images.length;
  const safeIndex =
    total > 0 ? ((currentIndex % total) + total) % total : 0;
  const activeImage = images[safeIndex];

  const handlePrev = () => {
    if (total <= 1) return;
    onChangeIndex((safeIndex - 1 + total) % total);
  };

  const handleNext = () => {
    if (total <= 1) return;
    onChangeIndex((safeIndex + 1) % total);
  };

  useEffect(() => {
    if (!isOpen) return;

    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        onClose();
      } else if (event.key === "ArrowLeft" && total > 1) {
        onChangeIndex((safeIndex - 1 + total) % total);
      } else if (event.key === "ArrowRight" && total > 1) {
        onChangeIndex((safeIndex + 1) % total);
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => {
      document.body.style.overflow = previousOverflow;
      window.removeEventListener("keydown", handleKeyDown);
    };
  }, [isOpen, onClose, onChangeIndex, safeIndex, total]);

  if (!isOpen || !activeImage) {
    return null;
  }

  const handleTouchStart = (event: React.TouchEvent<HTMLDivElement>) => {
    const touch = event.touches[0];
    if (!touch) return;
    touchStartRef.current = { x: touch.clientX, y: touch.clientY };
  };

  const handleTouchEnd = (event: React.TouchEvent<HTMLDivElement>) => {
    const start = touchStartRef.current;
    const touch = event.changedTouches[0];
    touchStartRef.current = null;
    if (!start || !touch || total <= 1) return;

    const deltaX = touch.clientX - start.x;
    const deltaY = touch.clientY - start.y;

    if (
      Math.abs(deltaX) >= SWIPE_THRESHOLD_PX &&
      Math.abs(deltaX) > Math.abs(deltaY)
    ) {
      if (deltaX < 0) {
        handleNext();
      } else {
        handlePrev();
      }
    }
  };

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label={`Galeria zdjęć: ${trailTitle}`}
      className="fixed inset-0 z-50 flex flex-col bg-[#0B0F13]/95 text-white backdrop-blur-md safe-top safe-bottom"
      onClick={(e) => {
        if (e.target === e.currentTarget) {
          onClose();
        }
      }}
    >
      {/* Top Bar: Counter & Close */}
      <div className="flex items-center justify-between gap-4 border-b border-white/10 px-4 py-3 sm:px-6">
        <div className="flex items-center gap-3 min-w-0">
          <span
            data-testid="lightbox-counter"
            className="shrink-0 rounded-full bg-white/10 px-3 py-1 font-mono text-xs font-bold tracking-wider text-white tabular-nums"
          >
            {safeIndex + 1} / {total}
          </span>
          <span className="truncate text-sm font-semibold text-white/80">
            {trailTitle}
          </span>
        </div>

        <button
          type="button"
          onClick={onClose}
          aria-label="Zamknij galerię"
          className="inline-flex min-h-[44px] min-w-[44px] cursor-pointer items-center justify-center rounded-xl border border-white/15 bg-white/10 text-white transition-colors hover:bg-white/20"
        >
          <X className="h-5 w-5" aria-hidden="true" />
        </button>
      </div>

      {/* Main Viewer */}
      <div
        data-testid="lightbox-stage"
        className="relative flex flex-1 items-center justify-center overflow-hidden px-3 py-4 sm:px-14"
        onTouchStart={handleTouchStart}
        onTouchEnd={handleTouchEnd}
        onClick={(e) => {
          if (e.target === e.currentTarget) {
            onClose();
          }
        }}
      >
        {total > 1 && (
          <button
            type="button"
            onClick={handlePrev}
            aria-label="Poprzednie zdjęcie"
            className="absolute left-2 z-10 inline-flex min-h-[44px] min-w-[44px] cursor-pointer items-center justify-center rounded-full border border-white/20 bg-[#11161A]/80 text-white shadow-lg backdrop-blur-sm transition-colors hover:bg-[#FF4D1C] sm:left-4"
          >
            <ChevronLeft className="h-6 w-6" aria-hidden="true" />
          </button>
        )}

        <div className="relative h-full max-h-[72dvh] w-full max-w-5xl">
          {failedUrls[activeImage.url] ? (
            <div
              data-testid="lightbox-image-fallback"
              className="flex h-full min-h-[240px] w-full flex-col items-center justify-center gap-3 rounded-2xl border border-white/10 bg-white/5 px-6 text-center text-white/80"
            >
              <CameraOff className="h-10 w-10 text-white/60" aria-hidden="true" />
              <p className="text-sm font-semibold sm:text-base">
                Nie udało się załadować zdjęcia
              </p>
              <p className="max-w-md text-xs text-white/55">
                Sprawdź połączenie z internetem lub przejdź do kolejnego zdjęcia w galerii.
              </p>
            </div>
          ) : (
            <Image
              src={activeImage.url}
              alt={activeImage.caption || `${trailTitle} — zdjęcie ${safeIndex + 1}`}
              fill
              sizes="100vw"
              unoptimized={shouldUseUnoptimizedImage(activeImage.url)}
              onError={() =>
                setFailedUrls((prev) =>
                  prev[activeImage.url]
                    ? prev
                    : { ...prev, [activeImage.url]: true },
                )
              }
              className="object-contain select-none"
              priority
            />
          )}
        </div>

        {total > 1 && (
          <button
            type="button"
            onClick={handleNext}
            aria-label="Następne zdjęcie"
            className="absolute right-2 z-10 inline-flex min-h-[44px] min-w-[44px] cursor-pointer items-center justify-center rounded-full border border-white/20 bg-[#11161A]/80 text-white shadow-lg backdrop-blur-sm transition-colors hover:bg-[#FF4D1C] sm:right-4"
          >
            <ChevronRight className="h-6 w-6" aria-hidden="true" />
          </button>
        )}
      </div>

      {/* Bottom Caption & Dots */}
      <div className="border-t border-white/10 px-4 py-3 text-center sm:px-6">
        {activeImage.caption && (
          <p className="mx-auto max-w-2xl text-sm text-white/90">
            {activeImage.caption}
          </p>
        )}

        {total > 1 && (
          <div className="mt-2.5 flex items-center justify-center gap-1.5">
            {images.map((img, idx) => (
              <button
                key={img.id}
                type="button"
                onClick={() => onChangeIndex(idx)}
                aria-label={`Pokaż zdjęcie ${idx + 1}`}
                aria-current={idx === safeIndex ? "true" : undefined}
                className={
                  idx === safeIndex
                    ? "h-2.5 w-7 cursor-pointer rounded-full bg-[#FF4D1C] transition-all"
                    : "h-2.5 w-2.5 cursor-pointer rounded-full bg-white/30 transition-all hover:bg-white/60"
                }
              />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
