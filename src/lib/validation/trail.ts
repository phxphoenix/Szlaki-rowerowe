import { z } from "zod";
import {
  DIFFICULTIES,
  POI_CATEGORIES,
  REGION_SLUGS,
  SORT_OPTIONS,
  SURFACES,
  TRAIL_COLORS,
} from "@/lib/constants/regions";

export function isHttpUrl(value: string): boolean {
  try {
    const parsed = new URL(value);
    return parsed.protocol === "http:" || parsed.protocol === "https:";
  } catch {
    return false;
  }
}

export function isRelativeAssetPath(value: string): boolean {
  if (!value.startsWith("/") || value.startsWith("//")) {
    return false;
  }
  if (value.includes("..") || /\s/.test(value)) {
    return false;
  }
  return value.startsWith("/images/") || value.startsWith("/sample-gpx/");
}

export function isValidAssetUrl(value: string): boolean {
  return isHttpUrl(value) || isRelativeAssetPath(value);
}

const optionalTrimmedString = (max: number, fieldLabel: string) =>
  z
    .string()
    .trim()
    .max(max, `${fieldLabel} może mieć maksymalnie ${max} znaków`)
    .optional()
    .nullable()
    .transform((v) => {
      if (v === undefined) return undefined;
      if (v === null || v === "") return null;
      return v;
    });

const optionalHttpUrlField = (message: string) =>
  z
    .string()
    .trim()
    .refine((v) => v === "" || isHttpUrl(v), { message })
    .optional()
    .nullable()
    .transform((v) => {
      if (v === undefined) return undefined;
      if (v === null || v === "") return null;
      return v;
    });

const optionalAssetUrlField = (message: string) =>
  z
    .string()
    .trim()
    .refine((v) => v === "" || isValidAssetUrl(v), { message })
    .optional()
    .nullable()
    .transform((v) => {
      if (v === undefined) return undefined;
      if (v === null || v === "") return null;
      return v;
    });

export const routePointSchema = z.object({
  lat: z.number().finite().min(-90).max(90),
  lng: z.number().finite().min(-180).max(180),
  ele: z.number().finite().optional(),
  distKm: z.number().finite().min(0).optional(),
});

export const routeBoundsSchema = z
  .object({
    north: z.number().finite().min(-90).max(90),
    south: z.number().finite().min(-90).max(90),
    east: z.number().finite().min(-180).max(180),
    west: z.number().finite().min(-180).max(180),
  })
  .refine((bounds) => bounds.north >= bounds.south, {
    message: "Granica północna musi być większa lub równa południowej",
  });

export const trailImageInputSchema = z.object({
  url: z
    .string()
    .trim()
    .min(1, "Adres URL zdjęcia jest wymagany")
    .refine(isValidAssetUrl, {
      message: "Podaj poprawny adres URL zdjęcia (http/https lub ścieżka lokalna)",
    }),
  caption: optionalTrimmedString(240, "Podpis zdjęcia"),
  sortOrder: z.number().int().min(0).default(0),
});

export const trailPoiInputSchema = z.object({
  name: z
    .string()
    .trim()
    .min(1, "Nazwa punktu POI jest wymagana")
    .max(140, "Nazwa punktu POI może mieć maksymalnie 140 znaków"),
  category: z
    .union([
      z.enum(POI_CATEGORIES),
      z.string().trim().max(40, "Kategoria może mieć maksymalnie 40 znaków"),
    ])
    .optional()
    .nullable()
    .transform((v) => {
      if (v === undefined) return undefined;
      if (v === null || v === "") return null;
      return v;
    }),
  description: optionalTrimmedString(300, "Opis punktu POI"),
  lat: z.number().finite().min(-90).max(90),
  lng: z.number().finite().min(-180).max(180),
});

const baseTrailFields = {
  slug: z
    .string()
    .trim()
    .min(1, "Slug nie może być pusty")
    .max(160, "Slug może mieć maksymalnie 160 znaków"),
  title: z
    .string()
    .trim()
    .min(1, "Tytuł szlaku jest wymagany")
    .max(200, "Tytuł może mieć maksymalnie 200 znaków"),
  shortDescription: z
    .string()
    .trim()
    .min(1, "Krótki opis szlaku jest wymagany")
    .max(360, "Krótki opis może mieć maksymalnie 360 znaków"),
  content: z
    .string()
    .trim()
    .min(1, "Pełny opis szlaku jest wymagany"),
  region: z.enum(REGION_SLUGS, {
    message: "Wybierz poprawne województwo Polski",
  }),
  subregion: optionalTrimmedString(120, "Subregion"),
  difficulty: z.enum(DIFFICULTIES, {
    message: "Wybierz poprawny poziom trudności",
  }),
  surface: z.enum(SURFACES, {
    message: "Wybierz poprawny typ nawierzchni",
  }),
  trailColor: z.enum(TRAIL_COLORS, {
    message: "Wybierz poprawny kolor szlaku",
  }),
  distanceKm: z
    .number({ message: "Dystans musi być liczbą" })
    .finite("Dystans musi być skończoną liczbą")
    .gt(0, "Dystans musi być większy od 0 km")
    .max(2500, "Dystans nie może przekraczać 2500 km"),
  elevationGainM: z
    .number({ message: "Przewyższenie musi być liczbą" })
    .int("Przewyższenie musi być liczbą całkowitą")
    .min(0, "Przewyższenie nie może być ujemne")
    .max(50000, "Przewyższenie jest zbyt duże"),
  estimatedTimeMin: z
    .number({ message: "Szacowany czas musi być liczbą" })
    .int("Szacowany czas musi być liczbą całkowitą")
    .min(1, "Szacowany czas musi być dodatni")
    .max(30000, "Szacowany czas jest zbyt duży")
    .optional()
    .nullable(),
  isLoop: z.boolean(),
  coverImageUrl: z
    .string()
    .trim()
    .min(1, "Adres URL zdjęcia okładkowego jest wymagany")
    .refine(isValidAssetUrl, {
      message: "Podaj poprawny URL zdjęcia (https://, http:// lub /images/...)",
    }),
  sourceUrl: optionalHttpUrlField(
    "Niepoprawny URL źródła (wymagany protokół http:// lub https://)",
  ),
  sourceName: optionalTrimmedString(120, "Nazwa źródła"),
  gpxUrl: optionalAssetUrlField(
    "Niepoprawny URL pliku GPX (wymagany http://, https:// lub /sample-gpx/...)",
  ),
  routePoints: z.array(routePointSchema).max(2000),
  startLat: z.number().finite().min(-90).max(90).optional().nullable(),
  startLng: z.number().finite().min(-180).max(180).optional().nullable(),
  endLat: z.number().finite().min(-90).max(90).optional().nullable(),
  endLng: z.number().finite().min(-180).max(180).optional().nullable(),
  bounds: routeBoundsSchema.optional().nullable(),
  googleMapsEmbedUrl: optionalHttpUrlField(
    "Niepoprawny URL mapy Google (wymagany protokół http:// lub https://)",
  ),
  published: z.boolean(),
  images: z.array(trailImageInputSchema).max(30),
  pois: z.array(trailPoiInputSchema).max(50),
};

export const createTrailSchema = z.object({
  ...baseTrailFields,
  slug: baseTrailFields.slug.optional(),
  trailColor: baseTrailFields.trailColor.default("none"),
  elevationGainM: baseTrailFields.elevationGainM.default(0),
  isLoop: baseTrailFields.isLoop.default(false),
  routePoints: baseTrailFields.routePoints.default([]),
  published: baseTrailFields.published.default(true),
  images: baseTrailFields.images.default([]),
  pois: baseTrailFields.pois.default([]),
});

export const updateTrailSchema = z.object({
  slug: baseTrailFields.slug.optional(),
  title: baseTrailFields.title.optional(),
  shortDescription: baseTrailFields.shortDescription.optional(),
  content: baseTrailFields.content.optional(),
  region: baseTrailFields.region.optional(),
  subregion: baseTrailFields.subregion,
  difficulty: baseTrailFields.difficulty.optional(),
  surface: baseTrailFields.surface.optional(),
  trailColor: baseTrailFields.trailColor.optional(),
  distanceKm: baseTrailFields.distanceKm.optional(),
  elevationGainM: baseTrailFields.elevationGainM.optional(),
  estimatedTimeMin: baseTrailFields.estimatedTimeMin,
  isLoop: baseTrailFields.isLoop.optional(),
  coverImageUrl: baseTrailFields.coverImageUrl.optional(),
  sourceUrl: baseTrailFields.sourceUrl,
  sourceName: baseTrailFields.sourceName,
  gpxUrl: baseTrailFields.gpxUrl,
  routePoints: baseTrailFields.routePoints.optional(),
  startLat: baseTrailFields.startLat,
  startLng: baseTrailFields.startLng,
  endLat: baseTrailFields.endLat,
  endLng: baseTrailFields.endLng,
  bounds: baseTrailFields.bounds,
  googleMapsEmbedUrl: baseTrailFields.googleMapsEmbedUrl,
  published: baseTrailFields.published.optional(),
  images: baseTrailFields.images.optional(),
  pois: baseTrailFields.pois.optional(),
});

const optionalQueryNumber = (min: number, max: number) =>
  z.preprocess((val) => {
    if (val === undefined || val === null || val === "") {
      return undefined;
    }
    const parsed = typeof val === "number" ? val : Number(val);
    return Number.isFinite(parsed) ? parsed : undefined;
  }, z.number().min(min).max(max).optional().catch(undefined));

export const trailQuerySchema = z.object({
  region: z.enum(["all", ...REGION_SLUGS]).catch("all"),
  difficulty: z.enum(DIFFICULTIES).optional().catch(undefined),
  surface: z.enum(SURFACES).optional().catch(undefined),
  minDistance: optionalQueryNumber(0, 2500),
  maxDistance: optionalQueryNumber(0, 2500),
  q: z
    .preprocess(
      (val) => (typeof val === "string" ? val.trim() : undefined),
      z.string().max(200).optional(),
    )
    .transform((val) => (val && val.length > 0 ? val : undefined)),
  sort: z.enum(SORT_OPTIONS).catch("newest"),
  page: z.preprocess((val) => {
    if (val === undefined || val === null || val === "") return 1;
    const parsed = typeof val === "number" ? val : Number(val);
    return Number.isInteger(parsed) && parsed >= 1 ? parsed : 1;
  }, z.number().int().min(1).catch(1)),
  limit: z.preprocess((val) => {
    if (val === undefined || val === null || val === "") return 12;
    const parsed = typeof val === "number" ? val : Number(val);
    return Number.isInteger(parsed) && parsed >= 1 && parsed <= 50 ? parsed : 12;
  }, z.number().int().min(1).max(50).catch(12)),
  includeUnpublished: z
    .preprocess((val) => val === true || val === "true", z.boolean())
    .default(false),
});

export type CreateTrailSchemaOutput = z.infer<typeof createTrailSchema>;
export type UpdateTrailSchemaOutput = z.infer<typeof updateTrailSchema>;
export type TrailQuerySchemaOutput = z.infer<typeof trailQuerySchema>;
