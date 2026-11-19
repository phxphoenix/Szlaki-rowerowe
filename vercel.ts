import { routes, type VercelConfig } from "@vercel/config/v1";

export const config: VercelConfig = {
  framework: "nextjs",
  fluid: true,
  headers: [
    routes.header("/(.*)", [
      { key: "X-Content-Type-Options", value: "nosniff" },
      { key: "X-Frame-Options", value: "SAMEORIGIN" },
      { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
      {
        key: "Permissions-Policy",
        value: "camera=(), microphone=(), geolocation=(self)",
      },
    ]),
    routes.cacheControl("/icons/(.*)", {
      public: true,
      maxAge: "1week",
      staleWhileRevalidate: "30days",
    }),
    routes.cacheControl("/sample-gpx/(.*)", {
      public: true,
      maxAge: "1day",
      staleWhileRevalidate: "7days",
    }),
  ],
};
