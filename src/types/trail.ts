import type {
  Difficulty,
  PoiCategory,
  RegionSlug,
  SortOption,
  Surface,
  TrailColor,
} from "@/lib/constants/regions";

export type {
  Difficulty,
  PoiCategory,
  RegionSlug,
  SortOption,
  Surface,
  TrailColor,
};

export interface RoutePoint {
  lat: number;
  lng: number;
  ele?: number;
  distKm?: number;
}

export interface RouteBounds {
  north: number;
  south: number;
  east: number;
  west: number;
}

export interface TrailImage {
  id: string;
  trailId: string;
  url: string;
  caption: string | null;
  sortOrder: number;
}

export interface TrailPoi {
  id: string;
  trailId: string;
  name: string;
  category: PoiCategory | string | null;
  description: string | null;
  lat: number;
  lng: number;
}

export interface Trail {
  id: string;
  slug: string;
  title: string;
  shortDescription: string;
  content: string;
  region: RegionSlug;
  subregion: string | null;
  difficulty: Difficulty;
  surface: Surface;
  trailColor: TrailColor;
  distanceKm: number;
  elevationGainM: number;
  estimatedTimeMin: number | null;
  isLoop: boolean;
  coverImageUrl: string;
  sourceUrl: string | null;
  sourceName: string | null;
  gpxUrl: string | null;
  routePoints: RoutePoint[];
  startLat: number | null;
  startLng: number | null;
  endLat: number | null;
  endLng: number | null;
  bounds: RouteBounds | null;
  googleMapsEmbedUrl: string | null;
  published: boolean;
  createdAt: string;
  updatedAt: string;
  images: TrailImage[];
  pois: TrailPoi[];
}

export type TrailSummary = Pick<
  Trail,
  | "id"
  | "slug"
  | "title"
  | "shortDescription"
  | "region"
  | "subregion"
  | "difficulty"
  | "surface"
  | "trailColor"
  | "distanceKm"
  | "elevationGainM"
  | "estimatedTimeMin"
  | "isLoop"
  | "coverImageUrl"
  | "sourceUrl"
  | "sourceName"
  | "published"
  | "createdAt"
  | "updatedAt"
>;

export interface TrailQueryParams {
  region?: RegionSlug | "all";
  difficulty?: Difficulty;
  surface?: Surface;
  minDistance?: number;
  maxDistance?: number;
  q?: string;
  sort?: SortOption;
  page?: number;
  limit?: number;
  includeUnpublished?: boolean;
}

export interface TrailListResponse {
  items: TrailSummary[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
  regionCounts: Record<RegionSlug, number>;
}

export interface TrailImageInput {
  url: string;
  caption?: string | null;
  sortOrder?: number;
}

export interface TrailPoiInput {
  name: string;
  category?: string | null;
  description?: string | null;
  lat: number;
  lng: number;
}

export interface CreateTrailInput {
  slug?: string;
  title: string;
  shortDescription: string;
  content: string;
  region: RegionSlug;
  subregion?: string | null;
  difficulty: Difficulty;
  surface: Surface;
  trailColor?: TrailColor;
  distanceKm: number;
  elevationGainM?: number;
  estimatedTimeMin?: number | null;
  isLoop?: boolean;
  coverImageUrl: string;
  sourceUrl?: string | null;
  sourceName?: string | null;
  gpxUrl?: string | null;
  routePoints?: RoutePoint[];
  startLat?: number | null;
  startLng?: number | null;
  endLat?: number | null;
  endLng?: number | null;
  bounds?: RouteBounds | null;
  googleMapsEmbedUrl?: string | null;
  published?: boolean;
  images?: TrailImageInput[];
  pois?: TrailPoiInput[];
}

export type UpdateTrailInput = Partial<CreateTrailInput>;
