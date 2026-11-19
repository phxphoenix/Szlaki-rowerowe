import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "Szlaki Rowerowe — Polska Kolekcja Tras",
    short_name: "Szlaki",
    description:
      "Katalog najpiękniejszych szlaków rowerowych w Polsce — interaktywne mapy Google Maps, ślady GPX, profile wysokościowe i galerie zdjęć.",
    start_url: "/",
    display: "standalone",
    background_color: "#11161A",
    theme_color: "#FF4D1C",
    lang: "pl",
    orientation: "portrait-primary",
    categories: ["sports", "travel", "navigation"],
    icons: [
      {
        src: "/icons/icon-192.png",
        sizes: "192x192",
        type: "image/png",
        purpose: "any",
      },
      {
        src: "/icons/icon-192.png",
        sizes: "192x192",
        type: "image/png",
        purpose: "maskable",
      },
      {
        src: "/icons/icon-512.png",
        sizes: "512x512",
        type: "image/png",
        purpose: "any",
      },
      {
        src: "/icons/icon-512.png",
        sizes: "512x512",
        type: "image/png",
        purpose: "maskable",
      },
      {
        src: "/icons/icon.svg",
        sizes: "any",
        type: "image/svg+xml",
        purpose: "any",
      },
    ],
  };
}
