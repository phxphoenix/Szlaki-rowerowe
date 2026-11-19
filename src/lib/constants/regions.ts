export const REGION_SLUGS = [
  "dolnoslaskie",
  "kujawsko-pomorskie",
  "lubelskie",
  "lubuskie",
  "lodzkie",
  "malopolskie",
  "mazowieckie",
  "opolskie",
  "podkarpackie",
  "podlaskie",
  "pomorskie",
  "slaskie",
  "swietokrzyskie",
  "warminsko-mazurskie",
  "wielkopolskie",
  "zachodniopomorskie",
] as const;

export type RegionSlug = (typeof REGION_SLUGS)[number];

export interface RegionInfo {
  slug: RegionSlug;
  name: string;
  fullName: string;
  shortCode: string;
  center: {
    lat: number;
    lng: number;
  };
  defaultZoom: number;
}

export const REGIONS: readonly RegionInfo[] = [
  {
    slug: "dolnoslaskie",
    name: "Dolnośląskie",
    fullName: "Województwo dolnośląskie",
    shortCode: "DS",
    center: { lat: 51.1079, lng: 17.0385 },
    defaultZoom: 8,
  },
  {
    slug: "kujawsko-pomorskie",
    name: "Kujawsko-Pomorskie",
    fullName: "Województwo kujawsko-pomorskie",
    shortCode: "KP",
    center: { lat: 53.0138, lng: 18.5984 },
    defaultZoom: 8,
  },
  {
    slug: "lubelskie",
    name: "Lubelskie",
    fullName: "Województwo lubelskie",
    shortCode: "LU",
    center: { lat: 51.2465, lng: 22.5684 },
    defaultZoom: 8,
  },
  {
    slug: "lubuskie",
    name: "Lubuskie",
    fullName: "Województwo lubuskie",
    shortCode: "LB",
    center: { lat: 52.2305, lng: 15.5062 },
    defaultZoom: 8,
  },
  {
    slug: "lodzkie",
    name: "Łódzkie",
    fullName: "Województwo łódzkie",
    shortCode: "LD",
    center: { lat: 51.7592, lng: 19.456 },
    defaultZoom: 8,
  },
  {
    slug: "malopolskie",
    name: "Małopolskie",
    fullName: "Województwo małopolskie",
    shortCode: "MA",
    center: { lat: 49.8562, lng: 20.118 },
    defaultZoom: 8,
  },
  {
    slug: "mazowieckie",
    name: "Mazowieckie",
    fullName: "Województwo mazowieckie",
    shortCode: "MZ",
    center: { lat: 52.2297, lng: 21.0122 },
    defaultZoom: 8,
  },
  {
    slug: "opolskie",
    name: "Opolskie",
    fullName: "Województwo opolskie",
    shortCode: "OP",
    center: { lat: 50.6751, lng: 17.9213 },
    defaultZoom: 9,
  },
  {
    slug: "podkarpackie",
    name: "Podkarpackie",
    fullName: "Województwo podkarpackie",
    shortCode: "PK",
    center: { lat: 49.94, lng: 22.0 },
    defaultZoom: 8,
  },
  {
    slug: "podlaskie",
    name: "Podlaskie",
    fullName: "Województwo podlaskie",
    shortCode: "PD",
    center: { lat: 53.1325, lng: 23.1688 },
    defaultZoom: 8,
  },
  {
    slug: "pomorskie",
    name: "Pomorskie",
    fullName: "Województwo pomorskie",
    shortCode: "PM",
    center: { lat: 54.175, lng: 18.0 },
    defaultZoom: 8,
  },
  {
    slug: "slaskie",
    name: "Śląskie",
    fullName: "Województwo śląskie",
    shortCode: "SL",
    center: { lat: 50.2649, lng: 19.0238 },
    defaultZoom: 8,
  },
  {
    slug: "swietokrzyskie",
    name: "Świętokrzyskie",
    fullName: "Województwo świętokrzyskie",
    shortCode: "SK",
    center: { lat: 50.8661, lng: 20.6286 },
    defaultZoom: 9,
  },
  {
    slug: "warminsko-mazurskie",
    name: "Warmińsko-Mazurskie",
    fullName: "Województwo warmińsko-mazurskie",
    shortCode: "WM",
    center: { lat: 53.7784, lng: 20.4801 },
    defaultZoom: 8,
  },
  {
    slug: "wielkopolskie",
    name: "Wielkopolskie",
    fullName: "Województwo wielkopolskie",
    shortCode: "WP",
    center: { lat: 52.4064, lng: 16.9252 },
    defaultZoom: 8,
  },
  {
    slug: "zachodniopomorskie",
    name: "Zachodniopomorskie",
    fullName: "Województwo zachodniopomorskie",
    shortCode: "ZP",
    center: { lat: 53.4285, lng: 15.2 },
    defaultZoom: 8,
  },
] as const;

export const REGION_MAP: Record<RegionSlug, RegionInfo> = Object.fromEntries(
  REGIONS.map((region) => [region.slug, region]),
) as Record<RegionSlug, RegionInfo>;

export function isValidRegionSlug(value: string): value is RegionSlug {
  return Object.prototype.hasOwnProperty.call(REGION_MAP, value);
}

export function getRegionInfo(slug: RegionSlug): RegionInfo {
  return REGION_MAP[slug];
}

export const DIFFICULTIES = ["easy", "moderate", "hard"] as const;
export type Difficulty = (typeof DIFFICULTIES)[number];

export interface DifficultyMeta {
  value: Difficulty;
  label: string;
  shortLabel: string;
  color: string;
}

export const DIFFICULTY_LABELS: Record<Difficulty, string> = {
  easy: "Łatwy",
  moderate: "Średni",
  hard: "Trudny",
};

export const DIFFICULTY_META: Record<Difficulty, DifficultyMeta> = {
  easy: {
    value: "easy",
    label: "Łatwy / Rodzinny",
    shortLabel: "Łatwy",
    color: "#16A34A",
  },
  moderate: {
    value: "moderate",
    label: "Średni",
    shortLabel: "Średni",
    color: "#D97706",
  },
  hard: {
    value: "hard",
    label: "Trudny / Górski",
    shortLabel: "Trudny",
    color: "#E11D48",
  },
};

export const SURFACES = ["asphalt", "gravel", "mixed", "offroad"] as const;
export type Surface = (typeof SURFACES)[number];

export const SURFACE_LABELS: Record<Surface, string> = {
  asphalt: "Asfalt",
  gravel: "Szuter / Drogi leśne",
  mixed: "Mieszana",
  offroad: "Teren / MTB",
};

export const SURFACE_SHORT_LABELS: Record<Surface, string> = {
  asphalt: "Asfalt",
  gravel: "Szuter",
  mixed: "Mieszana",
  offroad: "Teren / MTB",
};

export const TRAIL_COLORS = [
  "red",
  "blue",
  "green",
  "yellow",
  "black",
  "none",
] as const;
export type TrailColor = (typeof TRAIL_COLORS)[number];

export interface TrailColorMeta {
  value: TrailColor;
  label: string;
  hex: string;
  textHex: string;
}

export const TRAIL_COLOR_LABELS: Record<TrailColor, string> = {
  red: "Czerwony",
  blue: "Niebieski",
  green: "Zielony",
  yellow: "Żółty",
  black: "Czarny",
  none: "Nieoznakowany",
};

export const TRAIL_COLOR_META: Record<TrailColor, TrailColorMeta> = {
  red: {
    value: "red",
    label: "Szlak czerwony",
    hex: "#DC2626",
    textHex: "#FFFFFF",
  },
  blue: {
    value: "blue",
    label: "Szlak niebieski",
    hex: "#2563EB",
    textHex: "#FFFFFF",
  },
  green: {
    value: "green",
    label: "Szlak zielony",
    hex: "#16A34A",
    textHex: "#FFFFFF",
  },
  yellow: {
    value: "yellow",
    label: "Szlak żółty",
    hex: "#EAB308",
    textHex: "#11161A",
  },
  black: {
    value: "black",
    label: "Szlak czarny",
    hex: "#18181B",
    textHex: "#FFFFFF",
  },
  none: {
    value: "none",
    label: "Nieoznakowany / Własny",
    hex: "#FF4D1C",
    textHex: "#FFFFFF",
  },
};

export const SORT_OPTIONS = [
  "newest",
  "distance_asc",
  "distance_desc",
  "elevation_desc",
  "difficulty_asc",
] as const;
export type SortOption = (typeof SORT_OPTIONS)[number];

export const SORT_OPTION_LABELS: Record<SortOption, string> = {
  newest: "Najnowsze",
  distance_asc: "Najkrótsze",
  distance_desc: "Najdłuższe",
  elevation_desc: "Największe przewyższenie",
  difficulty_asc: "Najłatwiejsze",
};

export const POI_CATEGORIES = [
  "viewpoint",
  "parking",
  "food",
  "monument",
  "bike_service",
] as const;
export type PoiCategory = (typeof POI_CATEGORIES)[number];

export const POI_CATEGORY_LABELS: Record<PoiCategory, string> = {
  viewpoint: "Punkt widokowy",
  parking: "Parking",
  food: "Gastronomia / Odpoczynek",
  monument: "Zabytek / Atrakcja",
  bike_service: "Serwis rowerowy / MOR",
};
