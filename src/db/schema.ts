import { relations } from "drizzle-orm";
import {
  boolean,
  doublePrecision,
  index,
  integer,
  jsonb,
  pgEnum,
  pgTable,
  real,
  text,
  timestamp,
  uuid,
  varchar,
} from "drizzle-orm/pg-core";
import {
  DIFFICULTIES,
  REGION_SLUGS,
  SURFACES,
  TRAIL_COLORS,
} from "@/lib/constants/regions";
import type { RouteBounds, RoutePoint } from "@/types/trail";

export const regionEnum = pgEnum("region_enum", REGION_SLUGS);
export const difficultyEnum = pgEnum("difficulty_enum", DIFFICULTIES);
export const surfaceEnum = pgEnum("surface_enum", SURFACES);
export const trailColorEnum = pgEnum("trail_color_enum", TRAIL_COLORS);

export const trails = pgTable(
  "trails",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    slug: varchar("slug", { length: 160 }).notNull().unique(),
    title: varchar("title", { length: 200 }).notNull(),
    shortDescription: varchar("short_description", { length: 360 }).notNull(),
    content: text("content").notNull(),
    region: regionEnum("region").notNull(),
    subregion: varchar("subregion", { length: 120 }),
    difficulty: difficultyEnum("difficulty").notNull(),
    surface: surfaceEnum("surface").notNull(),
    trailColor: trailColorEnum("trail_color").notNull().default("none"),
    distanceKm: real("distance_km").notNull(),
    elevationGainM: integer("elevation_gain_m").notNull().default(0),
    estimatedTimeMin: integer("estimated_time_min"),
    isLoop: boolean("is_loop").notNull().default(false),
    coverImageUrl: text("cover_image_url").notNull(),
    sourceUrl: text("source_url"),
    sourceName: varchar("source_name", { length: 120 }),
    gpxUrl: text("gpx_url"),
    routePointsJson: jsonb("route_points_json")
      .$type<RoutePoint[]>()
      .notNull()
      .default([]),
    startLat: doublePrecision("start_lat"),
    startLng: doublePrecision("start_lng"),
    endLat: doublePrecision("end_lat"),
    endLng: doublePrecision("end_lng"),
    boundsJson: jsonb("bounds_json").$type<RouteBounds | null>(),
    googleMapsEmbedUrl: text("google_maps_embed_url"),
    published: boolean("published").notNull().default(true),
    createdAt: timestamp("created_at", { withTimezone: true, mode: "date" })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true, mode: "date" })
      .notNull()
      .defaultNow(),
  },
  (table) => [
    index("trails_region_idx").on(table.region),
    index("trails_difficulty_idx").on(table.difficulty),
    index("trails_distance_km_idx").on(table.distanceKm),
    index("trails_created_at_idx").on(table.createdAt),
  ],
);

export const trailImages = pgTable(
  "trail_images",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    trailId: uuid("trail_id")
      .notNull()
      .references(() => trails.id, { onDelete: "cascade" }),
    url: text("url").notNull(),
    caption: varchar("caption", { length: 240 }),
    sortOrder: integer("sort_order").notNull().default(0),
  },
  (table) => [index("trail_images_trail_id_idx").on(table.trailId)],
);

export const trailPois = pgTable(
  "trail_pois",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    trailId: uuid("trail_id")
      .notNull()
      .references(() => trails.id, { onDelete: "cascade" }),
    name: varchar("name", { length: 140 }).notNull(),
    category: varchar("category", { length: 40 }),
    description: varchar("description", { length: 300 }),
    lat: doublePrecision("lat").notNull(),
    lng: doublePrecision("lng").notNull(),
  },
  (table) => [index("trail_pois_trail_id_idx").on(table.trailId)],
);

export const trailsRelations = relations(trails, ({ many }) => ({
  images: many(trailImages),
  pois: many(trailPois),
}));

export const trailImagesRelations = relations(trailImages, ({ one }) => ({
  trail: one(trails, {
    fields: [trailImages.trailId],
    references: [trails.id],
  }),
}));

export const trailPoisRelations = relations(trailPois, ({ one }) => ({
  trail: one(trails, {
    fields: [trailPois.trailId],
    references: [trails.id],
  }),
}));

export type TrailRow = typeof trails.$inferSelect;
export type NewTrailRow = typeof trails.$inferInsert;
export type TrailImageRow = typeof trailImages.$inferSelect;
export type NewTrailImageRow = typeof trailImages.$inferInsert;
export type TrailPoiRow = typeof trailPois.$inferSelect;
export type NewTrailPoiRow = typeof trailPois.$inferInsert;
