import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import { notFound } from "next/navigation";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import {
  ArrowLeft,
  Calendar,
  Car,
  ChevronRight,
  Clock,
  Edit3,
  ExternalLink,
  Eye,
  Gauge,
  Landmark,
  Layers,
  MapPin,
  Navigation,
  Repeat,
  Route,
  TrendingUp,
  Utensils,
  Wrench,
} from "lucide-react";
import { TrailGallery } from "@/components/gallery/TrailGallery";
import { TrailMapSection } from "@/components/map/TrailMapSection";
import { formatCoordinate } from "@/components/map/utils";
import { Badge } from "@/components/ui/badge";
import { getSessionFromCookies } from "@/lib/auth/session";
import {
  DIFFICULTY_LABELS,
  DIFFICULTY_META,
  POI_CATEGORY_LABELS,
  SURFACE_LABELS,
  TRAIL_COLOR_META,
  getRegionInfo,
  type PoiCategory,
} from "@/lib/constants/regions";
import { getTrailByIdOrSlug } from "@/lib/trails/repository";
import {
  formatDatePl,
  formatDistance,
  formatDuration,
  formatElevation,
} from "@/lib/utils/format";
import { shouldUseUnoptimizedImage } from "@/lib/utils/image";

export const dynamic = "force-dynamic";

interface PageProps {
  params: Promise<{ slug: string }>;
}

function getSourceDisplayName(sourceUrl: string, sourceName: string | null): string {
  if (sourceName && sourceName.trim().length > 0) {
    return sourceName.trim();
  }
  try {
    return new URL(sourceUrl).hostname.replace(/^www\./, "");
  } catch {
    return "Źródło zewnętrzne";
  }
}

function getPoiCategoryMeta(category: string | null) {
  switch (category) {
    case "viewpoint":
      return { label: POI_CATEGORY_LABELS.viewpoint, Icon: Eye };
    case "parking":
      return { label: POI_CATEGORY_LABELS.parking, Icon: Car };
    case "food":
      return { label: POI_CATEGORY_LABELS.food, Icon: Utensils };
    case "monument":
      return { label: POI_CATEGORY_LABELS.monument, Icon: Landmark };
    case "bike_service":
      return { label: POI_CATEGORY_LABELS.bike_service, Icon: Wrench };
    default: {
      const label =
        category && Object.prototype.hasOwnProperty.call(POI_CATEGORY_LABELS, category)
          ? POI_CATEGORY_LABELS[category as PoiCategory]
          : "Punkt na trasie";
      return { label, Icon: MapPin };
    }
  }
}

export async function generateMetadata({
  params,
}: PageProps): Promise<Metadata> {
  const { slug } = await params;
  const trail = await getTrailByIdOrSlug(slug);

  if (!trail) {
    return {
      title: "Nie znaleziono szlaku",
    };
  }

  const regionInfo = getRegionInfo(trail.region);
  const title = `${trail.title} — ${regionInfo.name}`;

  return {
    title,
    description: trail.shortDescription,
    alternates: {
      canonical: `/szlaki/${trail.slug}`,
    },
    openGraph: {
      type: "article",
      locale: "pl_PL",
      title,
      description: trail.shortDescription,
      url: `/szlaki/${trail.slug}`,
      images: [
        {
          url: trail.coverImageUrl,
          alt: trail.title,
        },
      ],
    },
  };
}

export default async function TrailDetailPage({ params }: PageProps) {
  const { slug } = await params;
  const session = await getSessionFromCookies();
  const trail = await getTrailByIdOrSlug(slug, {
    includeUnpublished: Boolean(session),
  });

  if (!trail) {
    notFound();
  }

  const regionInfo = getRegionInfo(trail.region);
  const trailColorMeta = TRAIL_COLOR_META[trail.trailColor];
  const difficultyMeta = DIFFICULTY_META[trail.difficulty];
  const difficultyShortLabel = DIFFICULTY_LABELS[trail.difficulty];
  const surfaceLabel = SURFACE_LABELS[trail.surface];
  const formattedUpdatedDate = formatDatePl(trail.updatedAt || trail.createdAt);

  const telemetryMetrics = [
    {
      label: "Dystans",
      value: formatDistance(trail.distanceKm),
      icon: Route,
      accentClass: "text-[var(--accent-primary)]",
    },
    {
      label: "Przewyższenie",
      value: formatElevation(trail.elevationGainM),
      icon: TrendingUp,
      accentClass: "text-[var(--accent-telemetry)]",
    },
    {
      label: "Szacowany czas",
      value: formatDuration(trail.estimatedTimeMin),
      icon: Clock,
      accentClass: "text-[var(--accent-secondary)]",
    },
    {
      label: "Trudność",
      value: difficultyMeta.label,
      icon: Gauge,
      accentClass: "text-[var(--accent-warning)]",
    },
    {
      label: "Nawierzchnia",
      value: surfaceLabel,
      icon: Layers,
      accentClass: "text-[var(--accent-telemetry)]",
    },
    {
      label: "Typ trasy",
      value: trail.isLoop ? "Pętla" : "Punkt–Punkt",
      icon: Repeat,
      accentClass: "text-[var(--accent-primary)]",
    },
  ] as const;

  return (
    <main className="mx-auto w-full max-w-7xl px-4 pt-5 pb-24 sm:px-6 sm:pt-7 md:pb-8 lg:px-8">
      {/* Breadcrumb Navigation + Owner Edit Action */}
      <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
        <nav
          aria-label="Ścieżka nawigacji"
          className="flex min-w-0 flex-wrap items-center gap-1.5 text-sm text-[var(--text-secondary)]"
        >
          <Link
            href="/"
            className="inline-flex min-h-[44px] items-center gap-1.5 rounded-xl px-2.5 font-semibold text-[var(--text-primary)] transition-colors hover:bg-[var(--bg-surface-muted)]"
          >
            <ArrowLeft className="h-4 w-4 text-[var(--accent-primary)]" aria-hidden="true" />
            <span>Katalog tras</span>
          </Link>

          <ChevronRight className="h-4 w-4 shrink-0 opacity-50" aria-hidden="true" />

          <Link
            href={`/?region=${trail.region}`}
            className="inline-flex min-h-[44px] items-center rounded-xl px-2.5 font-medium transition-colors hover:bg-[var(--bg-surface-muted)] hover:text-[var(--text-primary)]"
          >
            {regionInfo.name}
          </Link>

          <ChevronRight className="h-4 w-4 shrink-0 opacity-50" aria-hidden="true" />

          <span className="max-w-[220px] truncate px-1 font-medium text-[var(--text-primary)] sm:max-w-sm">
            {trail.title}
          </span>
        </nav>

        {session && (
          <Link
            href={`/szlaki/${trail.slug}/edytuj`}
            className="inline-flex min-h-[44px] items-center gap-2 rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-surface)] px-4 py-2 text-sm font-semibold text-[var(--text-primary)] shadow-sm transition-colors hover:bg-[var(--bg-surface-muted)]"
          >
            <Edit3 className="h-4 w-4 text-[var(--accent-primary)]" aria-hidden="true" />
            <span>Edytuj szlak</span>
          </Link>
        )}
      </div>

      {/* Sporty Hero Section */}
      <section className="relative overflow-hidden rounded-3xl border border-[var(--border-subtle)] bg-[var(--bg-carbon)] text-[var(--text-on-dark)] shadow-lg">
        <div className="relative min-h-[300px] sm:min-h-[360px] lg:min-h-[420px]">
          <Image
            src={trail.coverImageUrl}
            alt={trail.title}
            fill
            priority
            sizes="(max-width: 1280px) 100vw, 1280px"
            unoptimized={shouldUseUnoptimizedImage(trail.coverImageUrl)}
            className="object-cover"
          />

          <div
            aria-hidden="true"
            className="absolute inset-0 bg-gradient-to-t from-[#0D1114] via-[#11161A]/70 to-[#11161A]/35"
          />

          <div className="relative flex min-h-[300px] flex-col justify-between p-5 sm:min-h-[360px] sm:p-8 lg:min-h-[420px] lg:p-10">
            {/* Top Badges */}
            <div className="flex flex-wrap items-center gap-2">
              <Badge variant="carbon" className="py-1.5 pr-3 pl-2.5">
                <span
                  className="h-2.5 w-2.5 shrink-0 rounded-full ring-1 ring-white/60"
                  style={{ backgroundColor: trailColorMeta.hex }}
                  aria-hidden="true"
                />
                <span>{regionInfo.fullName}</span>
              </Badge>

              <Badge variant={trail.difficulty} className="py-1.5 px-3">
                {difficultyShortLabel}
              </Badge>

              <Badge variant="carbon" className="py-1.5 px-3">
                {trailColorMeta.label}
              </Badge>

              {!trail.published && (
                <Badge className="bg-amber-500 text-[#11161A]">
                  Szkic (nieopublikowany)
                </Badge>
              )}
            </div>

            {/* Title, Lead & Source */}
            <div className="mt-8 max-w-4xl space-y-3">
              {trail.subregion && (
                <p className="inline-flex items-center gap-1.5 font-mono text-xs font-semibold uppercase tracking-[0.16em] text-[#FF7A59]">
                  <MapPin className="h-3.5 w-3.5" aria-hidden="true" />
                  <span>{trail.subregion}</span>
                </p>
              )}

              <h1 className="font-display text-[clamp(1.85rem,3.8vw,3.25rem)] font-bold uppercase leading-[1.02] tracking-tight text-white">
                {trail.title}
              </h1>

              <p className="max-w-3xl text-sm leading-relaxed text-white/85 sm:text-base">
                {trail.shortDescription}
              </p>

              <div className="flex flex-wrap items-center gap-3 pt-2">
                {trail.sourceUrl && (
                  <a
                    href={trail.sourceUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex min-h-[44px] items-center gap-2 rounded-xl border border-white/20 bg-white/10 px-4 py-2 text-xs font-semibold text-white backdrop-blur-md transition-colors hover:bg-white/20 sm:text-sm"
                  >
                    <span>
                      Źródło: {getSourceDisplayName(trail.sourceUrl, trail.sourceName)}
                    </span>
                    <ExternalLink className="h-3.5 w-3.5 text-[#FF7A59]" aria-hidden="true" />
                  </a>
                )}

                {formattedUpdatedDate && (
                  <span className="inline-flex items-center gap-1.5 font-mono text-xs text-white/65">
                    <Calendar className="h-3.5 w-3.5" aria-hidden="true" />
                    <span>Aktualizacja: {formattedUpdatedDate}</span>
                  </span>
                )}
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* 6 Telemetry Metric Tiles */}
      <section aria-label="Parametry techniczne szlaku" className="mt-6">
        <dl className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
          {telemetryMetrics.map((metric) => {
            const Icon = metric.icon;
            return (
              <div
                key={metric.label}
                className="rounded-2xl border border-[var(--border-subtle)] bg-[var(--bg-surface)] p-4 shadow-sm"
              >
                <dt className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wider text-[var(--text-secondary)]">
                  <Icon
                    className={`h-4 w-4 shrink-0 ${metric.accentClass}`}
                    aria-hidden="true"
                  />
                  <span className="truncate">{metric.label}</span>
                </dt>
                <dd className="mt-1.5 font-mono text-base font-bold text-[var(--text-primary)] tabular-nums sm:text-lg">
                  {metric.value}
                </dd>
              </div>
            );
          })}
        </dl>
      </section>

      {/* Central Map Section + Elevation Profile + Field Actions Bar */}
      <div className="mt-8">
        <TrailMapSection trail={trail} />
      </div>

      {/* Article Prose + Points of Interest (POI) */}
      <section className="mt-10 grid grid-cols-1 gap-8 lg:grid-cols-12">
        <article
          className={
            trail.pois.length > 0
              ? "rounded-3xl border border-[var(--border-subtle)] bg-[var(--bg-surface)] p-6 shadow-sm sm:p-8 lg:col-span-8"
              : "rounded-3xl border border-[var(--border-subtle)] bg-[var(--bg-surface)] p-6 shadow-sm sm:p-8 lg:col-span-12"
          }
        >
          <div className="mb-4 flex items-center justify-between border-b border-[var(--border-subtle)] pb-4">
            <h2 className="font-display text-2xl font-bold uppercase tracking-wide text-[var(--text-primary)] sm:text-3xl">
              Opis trasy i wrażenia z jazdy
            </h2>
          </div>

          <div className="trail-prose">
            <ReactMarkdown
              remarkPlugins={[remarkGfm]}
              components={{
                a: ({ href, children, ...props }) => {
                  const isExternal =
                    typeof href === "string" && /^https?:\/\//i.test(href);
                  if (isExternal) {
                    return (
                      <a
                        href={href}
                        target="_blank"
                        rel="noopener noreferrer"
                        {...props}
                      >
                        {children}
                      </a>
                    );
                  }
                  return (
                    <a href={href} {...props}>
                      {children}
                    </a>
                  );
                },
              }}
            >
              {trail.content}
            </ReactMarkdown>
          </div>
        </article>

        {trail.pois.length > 0 && (
          <aside
            aria-labelledby="trail-pois-heading"
            className="space-y-4 lg:col-span-4"
          >
            <div className="rounded-3xl border border-[var(--border-subtle)] bg-[var(--bg-surface)] p-5 shadow-sm sm:p-6">
              <div className="mb-4 flex items-center justify-between gap-2">
                <div>
                  <p className="font-mono text-[11px] font-semibold uppercase tracking-[0.18em] text-[var(--accent-telemetry)]">
                    Punkty po drodze
                  </p>
                  <h2
                    id="trail-pois-heading"
                    className="font-display text-2xl font-bold uppercase tracking-wide text-[var(--text-primary)]"
                  >
                    Ciekawe miejsca (POI)
                  </h2>
                </div>
                <span className="rounded-full bg-[var(--bg-surface-muted)] px-2.5 py-1 font-mono text-xs font-bold text-[var(--text-secondary)] tabular-nums">
                  {trail.pois.length}
                </span>
              </div>

              <ul className="space-y-3">
                {trail.pois.map((poi) => {
                  const { label, Icon } = getPoiCategoryMeta(poi.category);
                  const poiGoogleMapsUrl = `https://www.google.com/maps/search/?api=1&query=${poi.lat},${poi.lng}`;

                  return (
                    <li
                      key={poi.id}
                      className="rounded-2xl border border-[var(--border-subtle)] bg-[var(--bg-canvas)] p-4 transition-colors hover:border-[var(--accent-telemetry)]/50"
                    >
                      <div className="flex items-start gap-3">
                        <span className="mt-0.5 inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-[var(--accent-telemetry)]/15 text-[var(--accent-telemetry)]">
                          <Icon className="h-4 w-4" aria-hidden="true" />
                        </span>
                        <div className="min-w-0 flex-1">
                          <p className="font-mono text-[11px] font-semibold uppercase tracking-wider text-[var(--accent-telemetry)]">
                            {label}
                          </p>
                          <h3 className="mt-0.5 text-base font-bold leading-snug text-[var(--text-primary)]">
                            {poi.name}
                          </h3>
                          {poi.description && (
                            <p className="mt-1 text-sm leading-relaxed text-[var(--text-secondary)]">
                              {poi.description}
                            </p>
                          )}

                          <div className="mt-3 flex flex-wrap items-center justify-between gap-2">
                            <span className="font-mono text-[11px] text-[var(--text-secondary)] tabular-nums">
                              {formatCoordinate(poi.lat, "lat")},{" "}
                              {formatCoordinate(poi.lng, "lng")}
                            </span>

                            <a
                              href={poiGoogleMapsUrl}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="inline-flex min-h-[44px] sm:min-h-[36px] items-center gap-1.5 rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-surface)] px-3 py-1.5 text-xs font-semibold text-[var(--text-primary)] transition-colors hover:border-[var(--accent-primary)] hover:text-[var(--accent-primary)]"
                            >
                              <Navigation className="h-3.5 w-3.5" aria-hidden="true" />
                              <span>Lokalizuj</span>
                            </a>
                          </div>
                        </div>
                      </div>
                    </li>
                  );
                })}
              </ul>
            </div>
          </aside>
        )}
      </section>

      {/* Photo Gallery with Swipe Lightbox */}
      <div className="mt-10">
        <TrailGallery
          images={trail.images}
          coverImageUrl={trail.coverImageUrl}
          trailTitle={trail.title}
        />
      </div>
    </main>
  );
}
