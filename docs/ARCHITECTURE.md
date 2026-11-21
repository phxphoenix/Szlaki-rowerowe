# Architektura Systemu — Szlaki Rowerowe

## 1. Wybrany Stack Technologiczny (Wariant B — Full-stack na Vercel)

| Warstwa | Technologia | Uzasadnienie |
|---|---|---|
| **Framework** | **Next.js 16 (App Router)** + **React 19** + **TypeScript (strict)** | SSR/ISR dla szybkiego ładowania i SEO, Server Components, Route Handlers, natywne wsparcie na Vercel |
| **Stylowanie & UI** | **Tailwind CSS v4** + prymitywy UI (`button`, `badge`, `input`, `select`, `card`) + **Lucide Icons** | Spójny sportowy design system (*Velo Pulse*), pełna kontrola nad responsywnością iOS/Desktop |
| **Baza danych** | **Neon Postgres** (Vercel Marketplace: `vercel integration add neon`) + **Drizzle ORM** (`@neondatabase/serverless`) + fallback *in-memory* | Serverless Postgres bez utrzymania, pełne typowanie SQL, natywna integracja Vercel oraz lokalny tryb in-memory bez `DATABASE_URL` |
| **Przechowywanie plików** | **Vercel Blob** (`@vercel/blob` + direct client uploads `@vercel/blob/client`) | Zdjęcia szlaków (bezpieczne obrazy rastrowe JPEG/PNG/WebP do 10 MB) i pliki `.gpx` (do 15 MB) bez ograniczenia 4.5 MB na body w Vercel Functions |
| **Mapy** | **Google Maps JavaScript API** (`@vis.gl/react-google-maps`) + własny parser GPX (`fast-xml-parser`) | Oficjalna integracja React dla Google Maps, precyzyjne rysowanie śladu GPX, `AdvancedMarker`, tryb Teren/Mapa/Satelita, pełna trasa z `waypoints` i „Dojazdem do startu”, GPS na żywo oraz `MapFallback` SVG |
| **Wykresy** | **Własny responsywny wykres SVG** (`ElevationChart`) | Lekki interaktywny profil wysokościowy zsynchronizowany z mapą bez dodatkowych zależności |
| **Walidacja** | **Zod v4** | Współdzielona walidacja formularzy (klient) i API (serwer) |
| **Autoryzacja panelu dodawania** | **Sesja HTTP-only Cookie (`jose` JWT)** z `ADMIN_PASSWORD` (zmienna env) + **Rate Limiter** | Natychmiastowa ochrona akcji zapisu/edycji/usuwania z zabezpieczeniem logowania (10 prób / 15 min, HTTP 429) |
| **Hosting & Runtime** | **Vercel** (Node.js 24 LTS, Fluid Compute, konfiguracja w `vercel.ts`) | Automatyczne preview deploye z GitHub (`phxphoenix/Szlaki-rowerowe`), zero-config CDN |
| **Testowanie** | **Vitest** + **React Testing Library** + **Playwright** | Pełne pokrycie: logika GPX/filtrów, komponenty, API, E2E Desktop + iPhone (15 plików / 96 testów Vitest + 14 E2E Playwright) |

> **Ważne zasady platformy Vercel (2026):**
> - Nie używać `export const runtime = 'edge'` — korzystamy z domyślnego **Node.js 24 LTS na Fluid Compute**.
> - Nie używać wycofanych pakietów `@vercel/postgres` ani `@vercel/kv`.
> - Inicjalizacja połączenia z bazą Neon musi być **leniwa (`getDb()`)**, bez użycia `Proxy`, aby `next build` przechodził bezpiecznie bez zmiennej `DATABASE_URL`.
> - Upload zdjęć i plików `.gpx` realizować przez direct client upload (`@vercel/blob/client` + token endpoint `/api/upload`), omijając limit 4.5 MB dla żądań do Vercel Functions. Dozwolone są wyłącznie formaty rastrowe (JPEG/PNG/WebP); upload SVG został usunięty ze względów bezpieczeństwa (XSS), a `dangerouslyAllowSVG` usunięto z `next.config.ts`.

---

## 2. Architektura katalogów

```text
szlaki-rowerowe/
├── docs/
│   ├── ARCHITECTURE.md           # Ten dokument
│   ├── DESIGN_SYSTEM.md          # Sportowy design system Velo Pulse
│   └── TEST_PLAN.md              # Kompleksowa strategia testów
├── drizzle/                      # Migracje SQL generowane przez `npm run db:generate`
├── e2e/                          # Testy End-to-End Playwright (Desktop + iPhone 15)
│   ├── helpers.ts
│   ├── catalog.spec.ts
│   ├── trail-detail.spec.ts
│   ├── admin-flow.spec.ts
│   └── responsive-pwa.spec.ts
├── public/
│   ├── icons/                    # Ikony PWA (icon.svg, 192, 512, apple-touch-icon 180)
│   ├── images/trails/            # 21 fotografii JPEG dla 7 szlaków + ATTRIBUTIONS.md
│   │   └── ATTRIBUTIONS.md       # Licencje i autorzy zdjęć z Wikimedia Commons
│   └── sample-gpx/               # Przykładowe pliki GPX do seedowania i testów
├── scripts/
│   ├── bootstrap-db.ts           # Bezpieczny bootstrap bazy przy deployu Vercel (force: false)
│   └── seed.ts                   # Seed bazy z flagą --force (w tym trasa slaskie.travel/route/1019753)
├── src/
│   ├── app/
│   │   ├── layout.tsx            # Root layout, fonty, metadane PWA i iOS safe areas
│   │   ├── globals.css           # Tokeny Velo Pulse (Tailwind v4)
│   │   ├── manifest.ts           # Dynamiczny manifest PWA
│   │   ├── not-found.tsx         # Strona 404
│   │   ├── page.tsx              # Strona główna: Hero, FilterBar, siatka kafelków
│   │   ├── szlaki/
│   │   │   └── [slug]/
│   │   │       ├── page.tsx      # Widok artykułu szlaku + centralna Google Map + galeria
│   │   │       └── edytuj/
│   │   │           └── page.tsx  # Edycja szlaku (chroniona sesją)
│   │   ├── dodaj/
│   │   │   └── page.tsx          # Formularz dodawania szlaku + importer URL (chroniony)
│   │   ├── logowanie/
│   │   │   └── page.tsx          # Logowanie właściciela kolekcji
│   │   └── api/
│   │       ├── health/route.ts
│   │       ├── auth/
│   │       │   ├── login/route.ts
│   │       │   ├── logout/route.ts
│   │       │   └── session/route.ts
│   │       ├── trails/
│   │       │   ├── route.ts      # GET (filtrowanie/sortowanie/paginacja), POST (dodaj)
│   │       │   └── [id]/route.ts # GET, PATCH, DELETE
│   │       ├── upload/route.ts   # Vercel Blob client-upload handler (obrazy JPG/PNG/WebP + GPX)
│   │       └── import-url/route.ts # Ekstrakcja metadanych + auto-parsowanie GPX (parsedGpx)
│   ├── components/
│   │   ├── ui/                   # Komponenty bazowe (button, badge, input, select, card)
│   │   ├── layout/               # Navbar, Footer, ThemeToggle
│   │   ├── trails/               # TrailCard, RouteMiniMap, TrailGrid, FilterBar, RegionPills, SortSelect
│   │   ├── map/                  # TrailMapSection, TrailGoogleMap, ElevationChart, MapActionsBar, MapFallback, utils
│   │   ├── gallery/              # TrailGallery, PhotoLightbox, TrailHeroImage
│   │   └── forms/                # TrailForm, UrlImporterCard, GpxDropzone, ImageUploader, LoginForm, LogoutButton
│   ├── db/
│   │   ├── index.ts              # Leniwa inicjalizacja Neon + Drizzle (getDb())
│   │   └── schema.ts             # Schemat tabel PostgreSQL i typy TypeScript
│   ├── lib/
│   │   ├── constants/
│   │   │   └── regions.ts        # 16 województw Polski (slug, nazwa, współrzędne centrum)
│   │   ├── gpx/
│   │   │   ├── parser.ts         # Parsowanie i eksport GPX, dystans Haversine, przewyższenia, bbox
│   │   │   └── simplify.ts       # Upraszczanie śladu (Douglas-Peucker) dla płynnego renderu na mobile
│   │   ├── trails/
│   │   │   ├── repository.ts     # Repozytorium (Neon Postgres + deterministyczny in-memory fallback, jawny select, db.batch)
│   │   │   ├── seed-data.ts      # 7 predefiniowanych polskich szlaków (fotografie JPEG)
│   │   │   └── seed-routes.ts    # Punkty tras i próbki wysokości dla szlaków seedowych
│   │   ├── upload/
│   │   │   └── validation.ts     # Walidacja MIME (wyłącznie JPEG/PNG/WebP i GPX, limit 10/15 MB)
│   │   ├── validation/
│   │   │   └── trail.ts          # Schematy Zod dla tworzenia/edycji/filtrowania szlaków
│   │   ├── auth/
│   │   │   ├── session.ts        # Podpisywanie i weryfikacja JWT cookie (`jose`)
│   │   │   ├── redirect.ts       # Bezpieczna walidacja ścieżek przekierowań (`sanitizeNextPath`)
│   │   │   └── rate-limit.ts     # Sliding-window rate limiter logowania (10 prób / 15 min, HTTP 429)
│   │   ├── importer/
│   │   │   └── scraper.ts        # Ekstraktor metadanych + bezpieczne pobieranie GPX (SSRF, timeout 8s, max 5 MB)
│   │   └── utils/
│   │       ├── cn.ts             # Helper klas Tailwind (`clsx` + `tailwind-merge`)
│   │       ├── format.ts         # Formatowanie km, m, czasu, dat (pl-PL)
│   │       ├── image.ts          # Walidacja bezpiecznych adresów obrazów
│   │       └── slug.ts           # Generowanie unikalnych slugów z polskimi znakami
│   ├── test/
│   │   └── setup.ts              # Konfiguracja środowiska Vitest (`@testing-library/jest-dom`)
│   └── types/
│       └── trail.ts              # Wspólne interfejsy domenowe (w tym routePreviewPoints w TrailSummary)
├── tests/
│   └── api/
│       ├── auth-upload.test.ts   # Testy integracyjne auth + upload
│       └── trails.test.ts        # Testy integracyjne API szlaków
├── DEVELOPMENT_PLAN.md           # Pierwotny plan rozwoju (Etapy 0–7)
├── REFACTORING_PLAN.md           # Plan refaktoryzacji i wdrożenia R1–R6
├── MASTER_PROMPT.md              # Automatyczny prompt wykonawczy
├── drizzle.config.ts
├── next.config.ts
├── playwright.config.ts
├── vercel.ts                     # Konfiguracja Vercel (TypeScript)
├── vitest.config.ts
└── .env.example
```

---

## 3. Schemat bazy danych (PostgreSQL + Drizzle ORM)

### Enumy domenowe:
1. **`region` (16 województw Polski):**
   `dolnoslaskie`, `kujawsko-pomorskie`, `lubelskie`, `lubuskie`, `lodzkie`, `malopolskie`, `mazowieckie`, `opolskie`, `podkarpackie`, `podlaskie`, `pomorskie`, `slaskie`, `swietokrzyskie`, `warminsko-mazurskie`, `wielkopolskie`, `zachodniopomorskie`
2. **`difficulty`:** `easy` (Łatwy / Rodzinny), `moderate` (Średni), `hard` (Trudny / Górski)
3. **`surface`:** `asphalt` (Asfalt), `gravel` (Szuter / Drogi leśne), `mixed` (Mieszana), `offroad` (Teren / MTB)
4. **`trail_color`:** `red`, `blue`, `green`, `yellow`, `black`, `none`

### Tabela `trails`
| Kolumna | Typ | Opis |
|---|---|---|
| `id` | `uuid` (PK, default random) | Unikalny identyfikator |
| `slug` | `varchar(160)` (UNIQUE, NOT NULL) | Przyjazny URL (np. `szlak-rowerowy-orlich-gniazd`) |
| `title` | `varchar(200)` (NOT NULL) | Nazwa szlaku |
| `short_description` | `varchar(360)` (NOT NULL) | Krótki opis na kafelek na stronie głównej |
| `content` | `text` (NOT NULL) | Pełny opis artykułu (obsługa Markdown) |
| `region` | `region_enum` (NOT NULL, INDEX) | Województwo w Polsce |
| `subregion` | `varchar(120)` | Kraina / obszar (np. *Jura Krakowsko-Częstochowska*, *Beskid Śląski*) |
| `difficulty` | `difficulty_enum` (NOT NULL, INDEX) | Poziom trudności |
| `surface` | `surface_enum` (NOT NULL) | Dominująca nawierzchnia |
| `trail_color` | `trail_color_enum` (DEFAULT `'none'`) | Kolor oznakowania szlaku |
| `distance_km` | `real` (NOT NULL, INDEX) | Długość trasy w km |
| `elevation_gain_m` | `integer` (DEFAULT 0) | Suma podjazdów (m) |
| `estimated_time_min` | `integer` | Szacowany czas przejazdu w minutach |
| `is_loop` | `boolean` (DEFAULT false) | Czy trasa jest pętlą |
| `cover_image_url` | `text` (NOT NULL) | URL głównego zdjęcia (Vercel Blob lub zaufane źródło) |
| `source_url` | `text` | Oryginalny link z internetu (np. `https://slaskie.travel/route/1019753`) |
| `source_name` | `varchar(120)` | Nazwa źródła (np. `SLASKIE.travel`) |
| `gpx_url` | `text` | URL pliku `.gpx` w Vercel Blob (do pobrania przez użytkownika) |
| `route_points_json` | `jsonb` | Uproszczona tablica punktów `[{ lat, lng, ele?, distKm? }]` do błyskawicznego rysowania na Google Maps bez dodatkowego requestu! |
| `start_lat` / `start_lng` | `double precision` | Współrzędne startu (do Google Maps Directions i centrowania) |
| `end_lat` / `end_lng` | `double precision` | Współrzędne mety |
| `bounds_json` | `jsonb` | `{ north, south, east, west }` do natychmiastowego `fitBounds` |
| `google_maps_embed_url` | `text` | Opcjonalny fallback / link Google Maps, gdy brak pliku GPX |
| `published` | `boolean` (DEFAULT true) | Widoczność w katalogu |
| `created_at` / `updated_at` | `timestamp with time zone` | Daty utworzenia i modyfikacji (INDEX na `created_at DESC`) |

### Tabela `trail_images`
| Kolumna | Typ | Opis |
|---|---|---|
| `id` | `uuid` (PK) | Identyfikator zdjęcia |
| `trail_id` | `uuid` (FK -> `trails.id` ON DELETE CASCADE) | Powiązany szlak |
| `url` | `text` (NOT NULL) | URL zdjęcia |
| `caption` | `varchar(240)` | Podpis zdjęcia |
| `sort_order` | `integer` (DEFAULT 0) | Kolejność w galerii |

### Tabela `trail_pois` (Opcjonalne punkty warte zobaczenia na trasie)
| Kolumna | Typ | Opis |
|---|---|---|
| `id` | `uuid` (PK) | Identyfikator POI |
| `trail_id` | `uuid` (FK -> `trails.id` ON DELETE CASCADE) | Powiązany szlak |
| `name` | `varchar(140)` (NOT NULL) | Nazwa miejsca (np. „Zamek Ogrodzieniec”, „Parking PKP”) |
| `category` | `varchar(40)` | `viewpoint` / `parking` / `food` / `monument` / `bike_service` |
| `description` | `varchar(300)` | Krótka notatka |
| `lat` / `lng` | `double precision` (NOT NULL) | Współrzędne pinezki na Google Maps |

### Optymalizacje warstwy bazy danych i repozytorium
1. **Lekki rzut kafelków (`listTrails`):** Zapytanie pobierające listę szlaków wykonuje jawny `select` bez ciężkiego pola `trails.content`. Zawiera wyliczaną, uproszczoną tablicę `routePreviewPoints` (maksymalnie 48 punktów `{ lat, lng }`), co redukuje narzut sieciowy i pozwala komponentom `TrailCard` / `RouteMiniMap` natychmiast renderować miniatury śladu.
2. **Atomowość transakcji:** Zapis (`createTrail`) oraz edycja (`updateTrail`) powiązanych tabel (`trails`, `trail_images`, `trail_pois`) realizowane są w pojedynczym atomowym wywołaniu `db.batch()`.
3. **Bezpieczny seed produkcyjny:** Funkcja `seedDatabase({ force = false })` w `scripts/seed.ts` i `scripts/bootstrap-db.ts` korzysta z `onConflictDoNothing({ target: trails.slug })` i modyfikuje powiązane zdjęcia/POI tylko dla nowych szlaków, zapobiegając nadpisaniu danych użytkowników podczas wdrożenia.

---

## 4. Kontrakty API

### Publiczne (Odczyt)
- `GET /api/health` — status aplikacji i połączenia z bazą danych.
- `GET /api/trails` — lista szlaków z parametrami:
  - `region`: kod województwa (np. `slaskie`) lub `all`
  - `difficulty`: `easy` | `moderate` | `hard`
  - `surface`: `asphalt` | `gravel` | `mixed` | `offroad`
  - `minDistance`, `maxDistance`: liczby (km)
  - `q`: wyszukiwanie pełnotekstowe (`ILIKE` po tytule, krótkim opisie, subregionie)
  - `sort`: `newest` (domyślne) | `distance_asc` | `distance_desc` | `elevation_desc` | `difficulty_asc`
  - `page`, `limit`: paginacja (domyślnie `limit=12`)
  - Zwraca `{ items, total, page, totalPages, regionCounts }`.
- `GET /api/trails/[id]` — pobranie pełnego szlaku (po `id` lub `slug`) wraz z `images` i `pois`.

### Chronione sesją właściciela (Zapis / Zarządzanie)
- `POST /api/auth/login` — weryfikacja `ADMIN_PASSWORD` chroniona sliding-window rate limiterem (max 10 nieudanych prób / 15 min na IP z `x-forwarded-for`; po przekroczeniu HTTP `429 Too Many Requests` z nagłówkiem `Retry-After`), ustawienie ciasteczka `HttpOnly`, `Secure` (prod), `SameSite=Lax`.
- `POST /api/auth/logout` — usunięcie sesji.
- `GET /api/auth/session` — zwraca `{ authenticated: boolean }`.
- `POST /api/trails` — walidacja Zod, generowanie unikalnego sluga, atomowy zapis `db.batch` (szlak + zdjęcia + POI).
- `PATCH /api/trails/[id]` — aktualizacja szlaku (atomowe `db.batch`).
- `DELETE /api/trails/[id]` — usunięcie szlaku oraz powiązanych zasobów.
- `POST /api/upload` — handler tokenów `@vercel/blob/client` (akceptuje wyłącznie bezpieczne obrazy rastrowe `image/jpeg`, `image/png`, `image/webp` do 10 MB — brak `image/svg+xml` — oraz pliki GPX `application/gpx+xml`, `application/xml`, `text/xml` do 15 MB).
- `POST /api/import-url` — bezpieczny fetcher po stronie serwera z ochroną SSRF (walidacja protokołu, manual redirects max 3, timeout 8s, limit 5 MB), parsujący OpenGraph, meta tagi, nagłówki, wykrywający obrazy/linki GPX oraz automatycznie pobierający i parsujący znaleziony plik GPX do `parsedGpx` (dla natychmiastowego wypełnienia geometrii i telemetrii).

---

## 5. Integracja Google Maps API

1. **Biblioteka:** `@vis.gl/react-google-maps` ładowana z kluczem `NEXT_PUBLIC_GOOGLE_MAPS_API_KEY` oraz opcjonalnym `NEXT_PUBLIC_GOOGLE_MAPS_MAP_ID` (wymaganym dla `AdvancedMarker`; gdy brak Map ID, komponent płynnie stosuje standardowy `Marker`).
2. **Generowanie pełnej trasy w Google Maps (`src/components/map/utils.ts`):**
   - Funkcja `extractKeyRouteWaypoints` wylicza od 3 do 9 kluczowych punktów pośrednich (`waypoints`) po **skumulowanym dystansie Haversine** wzdłuż trasy (z minimalnym odstępem `>= 150 m` i pominięciem punktów `< 200 m` od startu w pętlach).
   - `buildGoogleMapsRouteUrl`: tworzy URL nawigacji rowerowej (`travelmode=bicycling`) z pełną trasą (`origin`, `destination`, `waypoints`), pilnując limitu długości URL `< 2000` znaków.
   - **Obsługa pętli (`isLoop: true`):** `origin` i `destination` ustawiane na start, a `waypoints` rozkładane po obwodzie, dzięki czemu Google Maps nie zwija trasy do 0 m.
   - **Dojazd do startu (`buildGoogleMapsStartNavigationUrl`):** osobny dedykowany URL z samym `destination=<START>`, umożliwiający szybką nawigację do punktu rozpoczęcia wycieczki.
   - **Google My Maps (`googleMapsEmbedUrl`):** jeśli trasa posiada link My Maps (`isGoogleMyMapsUrl`), interfejs wyświetla dedykowany przycisk „Mapa 1:1 (My Maps)”.
3. **Śledzenie pozycji na żywo (HUD „Moja pozycja GPS”):**
   - Przycisk w HUD mapy (`Crosshair` / `Locate`) uruchamia `navigator.geolocation.watchPosition` z `enableHighAccuracy: true`.
   - Jednokrotne centrowanie na pierwszym fixie GPS, pulsujący marker pozycji użytkownika na mapie Google z kołem dokładności, bezpieczny cleanup `clearWatch` przy wyłączeniu lub odmontowaniu komponentu.
4. **Renderowanie trasy:**
   - Dane `route_points_json` są przekazywane bezpośrednio z Server Componentu do komponentu mapy — zero dodatkowego opóźnienia sieciowego.
   - `Polyline` rysowana z obwódką (podwójna linia: ciemna/biała podstawa `8px` + właściwy kolor `4.5px`) dla maksymalnej widoczności na podkładzie satelitarnym i terenowym.
   - Automatyczne dopasowanie kadru (`map.fitBounds(bounds, padding)`).
   - Synchronizacja z wykresem `ElevationChart`: `activePointIndex` steruje ruchomym markerem podglądu na trasie.
5. **Fallback / Graceful Degradation (`MapFallback`):**
   - Gdy brak klucza `NEXT_PUBLIC_GOOGLE_MAPS_API_KEY` (np. w środowisku testowym CI lub przed konfiguracją), komponent mapy wyświetla estetyczny, funkcjonalny widok zastępczy z wizualizacją SVG kształtu trasy (z `route_points_json`), współrzędnymi startu/mety, aktywnym przyciskiem „Otwórz trasę w Google Maps” oraz „Dojazd do startu”.
   - W trybie fallback przełącznik warstw `Teren / Mapa / Satelita` jest automatycznie ukryty, aby nie wprowadzać użytkownika w błąd.
6. **Bezpieczeństwo klucza Google Maps API:**
   - W Google Cloud Console klucz `NEXT_PUBLIC_GOOGLE_MAPS_API_KEY` należy ograniczyć:
     - *Application restrictions:* HTTP referrers (`https://*.vercel.app/*`, domena produkcyjna, `http://localhost:3000/*`).
     - *API restrictions:* wyłącznie **Maps JavaScript API**.

---

## 6. Zmienne środowiskowe (`.env.example`)

```env
# Baza danych Neon Postgres (auto-provisioned przez Vercel Marketplace)
DATABASE_URL="postgresql://user:password@host/dbname?sslmode=require"

# Vercel Blob (auto-provisioned po podłączeniu Vercel Blob Store)
BLOB_READ_WRITE_TOKEN="vercel_blob_rw_..."

# Google Maps JavaScript API
NEXT_PUBLIC_GOOGLE_MAPS_API_KEY="AIza..."
NEXT_PUBLIC_GOOGLE_MAPS_MAP_ID=""

# Autoryzacja panelu dodawania i edycji szlaków
ADMIN_PASSWORD="twoje-silne-haslo-admina"
SESSION_SECRET="minimum-32-znakowy-losowy-sekret-do-jwt"

# Adres aplikacji (do generowania canonical URL i metadanych OG)
NEXT_PUBLIC_APP_URL="http://localhost:3000"
```
