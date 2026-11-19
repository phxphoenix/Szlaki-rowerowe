import type { Metadata, Viewport } from "next";
import {
  Barlow_Condensed,
  JetBrains_Mono,
  Plus_Jakarta_Sans,
} from "next/font/google";
import { Footer } from "@/components/layout/Footer";
import { Navbar } from "@/components/layout/Navbar";
import "./globals.css";

const barlowCondensed = Barlow_Condensed({
  subsets: ["latin", "latin-ext"],
  weight: ["600", "700", "800"],
  variable: "--font-barlow-condensed",
  display: "swap",
});

const plusJakartaSans = Plus_Jakarta_Sans({
  subsets: ["latin", "latin-ext"],
  weight: ["400", "500", "600", "700"],
  variable: "--font-plus-jakarta-sans",
  display: "swap",
});

const jetbrainsMono = JetBrains_Mono({
  subsets: ["latin", "latin-ext"],
  weight: ["500", "600", "700"],
  variable: "--font-jetbrains-mono",
  display: "swap",
});

const appUrl = process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000";

export const metadata: Metadata = {
  metadataBase: new URL(appUrl),
  title: {
    default: "Szlaki Rowerowe — Polska Kolekcja Tras",
    template: "%s | Szlaki Rowerowe",
  },
  description:
    "Odkrywaj najpiękniejsze szlaki rowerowe w całej Polsce — mapy Google Maps, ślady GPX, profile wysokościowe, opisy i galerie z podziałem na 16 województw.",
  applicationName: "Szlaki Rowerowe",
  manifest: "/manifest.webmanifest",
  appleWebApp: {
    capable: true,
    statusBarStyle: "black-translucent",
    title: "Szlaki Rowerowe",
  },
  icons: {
    icon: [
      { url: "/icons/icon.svg", type: "image/svg+xml" },
      { url: "/icons/icon-192.png", sizes: "192x192", type: "image/png" },
      { url: "/icons/icon-512.png", sizes: "512x512", type: "image/png" },
    ],
    apple: [
      { url: "/icons/apple-touch-icon.png", sizes: "180x180", type: "image/png" },
    ],
  },
  openGraph: {
    type: "website",
    locale: "pl_PL",
    siteName: "Szlaki Rowerowe",
    title: "Szlaki Rowerowe — Polska Kolekcja Tras",
    description:
      "Sportowa kolekcja najpiękniejszych tras rowerowych w Polsce — 16 województw, mapy GPX i profile wysokościowe.",
  },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#11161A" },
    { media: "(prefers-color-scheme: dark)", color: "#0D1114" },
  ],
};

const THEME_INIT_SCRIPT = `(function(){try{var k='velo-pulse-theme';var s=localStorage.getItem(k);var d=s==='dark'||(!s&&window.matchMedia('(prefers-color-scheme: dark)').matches);if(d){document.documentElement.classList.add('dark');}else{document.documentElement.classList.remove('dark');}}catch(e){}})();`;

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="pl"
      suppressHydrationWarning
      className={`${barlowCondensed.variable} ${plusJakartaSans.variable} ${jetbrainsMono.variable}`}
    >
      <head>
        <script
          dangerouslySetInnerHTML={{ __html: THEME_INIT_SCRIPT }}
        />
      </head>
      <body className="flex min-h-dvh flex-col bg-[var(--bg-canvas)] font-sans text-[var(--text-primary)] antialiased">
        <Navbar />
        <div className="flex-1">{children}</div>
        <Footer />
      </body>
    </html>
  );
}
