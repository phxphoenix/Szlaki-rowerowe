"use client";

import { useState } from "react";
import Image from "next/image";
import { CameraOff } from "lucide-react";
import { shouldUseUnoptimizedImage } from "@/lib/utils/image";

export interface TrailHeroImageProps {
  src: string;
  alt: string;
}

export function TrailHeroImage({ src, alt }: TrailHeroImageProps) {
  const [failedSrc, setFailedSrc] = useState<string | null>(null);
  const hasError = failedSrc === src || !src.trim();

  if (hasError) {
    return (
      <div
        data-testid="hero-image-fallback"
        className="absolute inset-0 flex flex-col items-end justify-start bg-[radial-gradient(circle_at_top_right,_rgba(255,77,28,0.2),_transparent_55%),linear-gradient(135deg,#11161A_0%,#1D252C_55%,#11161A_100%)] p-5 sm:p-8"
      >
        <div className="inline-flex items-center gap-2 rounded-xl border border-white/15 bg-black/35 px-3 py-1.5 text-xs font-medium text-white/75 backdrop-blur-sm">
          <CameraOff className="h-4 w-4 text-white/70" aria-hidden="true" />
          <span>Nie udało się załadować zdjęcia</span>
        </div>
      </div>
    );
  }

  return (
    <Image
      src={src}
      alt={alt}
      fill
      priority
      sizes="(max-width: 1280px) 100vw, 1280px"
      unoptimized={shouldUseUnoptimizedImage(src)}
      onError={() => setFailedSrc(src)}
      className="object-cover"
    />
  );
}
