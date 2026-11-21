# Plan Refaktoryzacji i Prompty — „Szlaki Rowerowe”

> **Cel dokumentu:** Kompleksowy plan naprawczy po audycie aplikacji oraz gotowe prompty dla **Orchestrator (Neon)** i zespołu agentów roboczych.  
> **Repozytorium:** `Szlaki rowerowe` (Next.js 16 App Router, React 19, TypeScript strict, Drizzle ORM + Neon Postgres, Vercel Blob, Google Maps API)  
> **Data audytu i planu:** 2026-11-20

---

## 1. Polityka doboru modeli AI (Strict Model Allowlist)

Wszystkie etapy refaktoryzacji koordynuje **Orchestrator (Neon)** (`gemini-pro-orchestrator-neon`).

### Dozwolona pula modeli dla workerów (STRICT — brak wyjątków)
Do delegowania zadań (`swarm`) wolno używać **wyłącznie** następujących modeli:
1. **Gemini 4 Neon** (`gemini-4-neon-high` / `gemini-4-neon-medium`) — najwyższa złożoność: algorytmy geodezyjne GPX/Google Maps, bezpieczeństwo, baza danych, SSRF, diagnoza trudnych błędów.
2. **Gemini 4 Argon** (`gemini-4-argon-high` / `gemini-4-argon-medium`) — złożony frontend/UI (miniatury SVG tras, integracja formularza), niezależny audyt i code review.
3. **Gemini 4 Hydrogen** (`gemini-4-hydrogen-high` / `gemini-4-hydrogen-medium`) — zadania full-stack o średniej złożoności: pozyskanie i optymalizacja prawdziwych zdjęć, komponenty galerii, rozbudowa i uruchomienie testów E2E (Playwright Desktop + iPhone 15).
4. **Gemini 3.8 Flash** (`gemini-3.8-flash-medium` / `gemini-3.8-flash-low`) — zadania proste: aktualizacja dokumentacji, porządki w repozytorium, końcowe checklisty.

> **Zakaz bezwzględny:** Nie wolno przypisywać żadnemu workerowi modeli spoza powyższej listy (w szczególności zakaz użycia Claude, GPT-OSS, `Orchestrator (Argon)` ani starszych generacji modeli).

### Macierz przypisania etapów i równoległości

| Fala | Etap / Rola | Zakres | Model (`swarm`) | Workspace | Zależności |
|---|---|---|---|---|---|
| **Fala 1** | **R1** (`backend-core`) | Bezpieczny seed/bootstrap DB, auto-GPX w importerze URL, usunięcie uploadu SVG, rate-limit logowania, optymalizacja `listTrails` + `routePreviewPoints`, `db.batch` | `gemini-4-neon-high` | `share` | brak (równolegle) |
| **Fala 1** | **R2** (`maps-google`) | **Priorytet #1:** pełna wyrysowana trasa w Google Maps (`origin` + `destination` + inteligentne `waypoints` do 9 pkt + obsługa pętli), osobny link „Dojazd do startu”, śledzenie GPS na mapie, obsługa Google My Maps, ukrycie martwego HUD w fallbacku | `gemini-4-neon-high` | `share` | brak (równolegle) |
| **Fala 1** | **R3** (`media-gallery`) | **Priorytet #3:** prawdziwe zdjęcia (21 plików `.webp`/`.jpg`) dla 7 szlaków na otwartej licencji + `ATTRIBUTIONS.md`, usunięcie szablonów SVG, fallback `onError` w galerii/Lightbox/Hero | `gemini-4-hydrogen-high` | `share` | brak (równolegle) |
| **Fala 2** | **R4** (`ui-cards-form`) | **Priorytet #2:** komponent `RouteMiniMap` z prawdziwym przebiegiem trasy GPX na kafelkach `TrailCard` + podpięcie `parsedGpx` i pola Google My Maps w `TrailForm` | `gemini-4-argon-high` | `inherit` | po zmergowaniu R1 + R2 + R3 |
| **Fala 3** | **R5** (`qa-e2e`) | Aktualizacja i rozbudowa testów Vitest + Playwright (Desktop 1440×900 + iPhone 15 390×844), pełna pętla naprawcza do 100% PASS | `gemini-4-hydrogen-high` *(eskalacja diagnozy: `gemini-4-neon-high`)* | `inherit` | po R4 |
| **Fala 3** | **R5b** (`reviewer`) | Niezależny przegląd kodu, bezpieczeństwa (XSS/SSRF/DB) i spójności UX | `gemini-4-argon-high` | `inherit` | po zielonym R5 |
| **Fala 4** | **R6** (`docs-cleanup`) | Aktualizacja `README.md`, `docs/*`, `DEVELOPMENT_PLAN.md`, `REFACTORING_PLAN.md`, finalna bramka jakości | `gemini-3.8-flash-medium` | `inherit` | po R5b |

---

## 2. Tablica statusu etapów

- [x] **R1:** Krytyczne poprawki DB (`bootstrap-db` / `seed`), auto-parsowanie GPX w importerze, bezpieczeństwo uploadu/logowania i lekkie `TrailSummary`
- [x] **R2:** Google Maps — pełna wyrysowana trasa z inteligentnymi `waypoints`, „Dojazd do startu”, przycisk „Moja pozycja GPS” i opcjonalny link Google My Maps
- [x] **R3:** Prawdziwe fotografie dla 7 szlaków (okładki + galeria), usunięcie atrap SVG i obsługa błędów ładowania obrazów (`onError`)
- [x] **R4:** Prawdziwe miniatury przebiegu tras GPX na kafelkach na stronie głównej (`RouteMiniMap` + `TrailCard`) oraz integracja formularza (`TrailForm`)
- [x] **R5:** Kompleksowe testy jednostkowe, API i E2E (Desktop + iPhone 15) + niezależny code review (`R5b`)
- [x] **R6:** Aktualizacja dokumentacji i końcowa weryfikacja wdrożeniowa

---

## 3. Szczegółowa specyfikacja techniczna etapów

### Etap R1 — Fundament danych, bezpieczeństwo i importer GPX (`gemini-4-neon-high`)

**Własność plików:**
- `scripts/bootstrap-db.ts`, `scripts/seed.ts`
- `src/types/trail.ts`, `src/lib/trails/repository.ts`, `src/lib/trails/repository.test.ts`
- `src/lib/upload/validation.ts`, `src/app/api/upload/route.ts`
- `src/lib/auth/rate-limit.ts` *(nowy)*, `src/app/api/auth/login/route.ts`
- `src/lib/importer/scraper.ts`, `src/app/api/import-url/route.ts`, `src/lib/importer/scraper.test.ts`
- `tests/api/auth-upload.test.ts`

**Zadania szczegółowe:**
1. **Ochrona przed utratą danych przy deployu Vercel (`bootstrap-db.ts` + `seed.ts`):**
   - `seedDatabase(options?: { force?: boolean })`:
     - Domyślnie (`force: false`, używane przez `bootstrap-db.ts` podczas `vercel-build`): wstawia brakujące szlaki seedowe przez `onConflictDoNothing({ target: trails.slug })` i dodaje zdjęcia/POI **wyłącznie dla nowo wstawionych szlaków** (nigdy nie modyfikuje ani nie kasuje zdjęć/POI istniejących rekordów).
     - Tryb `force: true` (wywoływany ręcznie przez `npm run db:seed -- --force`): zachowuje możliwość jawnego nadpisania szlaków referencyjnych.
2. **Optymalizacja `listTrails()` i lekki ślad podglądowy `routePreviewPoints`:**
   - W `src/types/trail.ts` dodać do `TrailSummary` pole `routePreviewPoints: Array<{ lat: number; lng: number }>`.
   - W `src/lib/trails/repository.ts`:
     - W `listTrails()` używać jawnej selekcji kolumn w Drizzle (bez pobierania ciężkiego `trails.content`).
     - Wyliczać lekką tablicę `routePreviewPoints` (uproszczoną przez `simplifyRoutePoints` do maks. **48 punktów**, same `{ lat, lng }`) z `routePointsJson` (w DB oraz w pamięci), aby `TrailCard` mógł narysować dokładną miniaturę trasy bez przesyłania 500-punktowych tablic i treści Markdown.
   - W `createTrail()` i `updateTrail()` użyć atomowości `db.batch([...])` (lub transakcji jeśli wspierana) dla operacji na `trails` + `trail_images` + `trail_pois`.
3. **Automatyczne pobieranie i parsowanie GPX w importerze URL:**
   - W `src/lib/importer/scraper.ts` rozszerzyć `ImportedTrailMetadata` o opcjonalne `parsedGpx: ParsedGpxResult | null`.
   - Jeśli HTML zawiera `gpxUrl` (w tym heurystyka `/download/route/gpx/<id>` dla `slaskie.travel`), bezpiecznie pobrać ten plik GPX z **tą samą ochroną SSRF** (`validateSafeExternalUrl` + `assertSafeResolvedHost` + ręczne przekierowania max 3 + timeout 8s + limit rozmiaru 5 MB), sparsować przez `parseGpx()` i dołączyć wynik do odpowiedzi `POST /api/import-url`. Błąd pobrania/parsowania GPX nie może przerywać całego importu (wtedy `parsedGpx: null`).
4. **Bezpieczeństwo uploadu i logowania:**
   - W `src/lib/upload/validation.ts`: usunąć `image/svg+xml` oraz `.svg` z `ALLOWED_IMAGE_MIME_TYPES` (zostawić wyłącznie `image/jpeg`, `image/png`, `image/webp`).
   - Dodać `src/lib/auth/rate-limit.ts` (sliding-window rate limiter po IP z `x-forwarded-for`, np. max 10 nieudanych prób / 15 minut -> HTTP `429 Too Many Requests` z nagłówkiem `Retry-After`, plus helper `resetLoginRateLimit()` dla testów).

**Kryteria akceptacji R1:**
- `seedDatabase()` wywołane drugi raz nie nadpisuje zmodyfikowanego szlaku ani nie usuwa jego zdjęć/POI.
- `listTrails()` zwraca `routePreviewPoints` (<= 48 pkt) dla tras mających ślad i nie pobiera `content` z DB.
- `POST /api/import-url` z mockowanym `fetchFn` zwraca `parsedGpx` wraz z `routePoints`, `distanceKm`, `elevationGainM`, `bounds`, `isLoop`.
- `POST /api/upload` odrzuca `image/svg+xml` (HTTP 400).
- `POST /api/auth/login` zwraca HTTP 429 po przekroczeniu progu nieudanych logowań.

---

### Etap R2 — Google Maps: cała wyrysowana trasa + GPS + My Maps (`gemini-4-neon-high`)

**Własność plików:**
- `src/components/map/utils.ts`
- `src/components/map/MapActionsBar.tsx`
- `src/components/map/MapFallback.tsx`
- `src/components/map/TrailGoogleMap.tsx`
- `src/components/map/TrailMapSection.tsx`
- `src/components/map/TrailGoogleMap.test.tsx`

**Zadania szczegółowe:**
1. **Inteligentny generator linków pełnej trasy (`src/components/map/utils.ts`):**
   - Zaimplementować `extractKeyRouteWaypoints(routePoints, options: { maxWaypoints?: number; isLoop?: boolean })`:
     - Domyślnie `maxWaypoints = 9` (maksimum obsługiwane przez Google Maps Desktop oraz natywną aplikację Google Maps na iOS/Android; łączna długość URL gwarantowanie `< 2000` znaków).
     - Wybór punktów nie może brać prostego `step = len / 9` po indeksie (bo punkty GPX bywają gęstsze w jednych miejscach niż innych). Wybierać punkty **po skumulowanym dystansie wzdłuż trasy** (np. dla `k` waypointów na ułamkach `1/(k+1), 2/(k+1), ..., k/(k+1)` całkowitego dystansu) z minimalnym odstępem między punktami (`>= 150 m`), aby uniknąć zduplikowanych waypointów.
     - **Specjalna obsługa pętli (`isLoop === true`):**
       - `origin` = `startPoint`, `destination` = `startPoint`,
       - `waypoints` = 8–9 punktów rozłożonych po całym obwodzie pętli (z pominięciem punktów leżących bliżej niż 200 m od startu/mety), dzięki czemu Google Maps rysuje całą pętlę zamiast trasy 0 m!
     - **Trasy punkt–punkt (`isLoop === false`):**
       - `origin` = `startPoint`, `destination` = `endPoint`,
       - `waypoints` = do 9 punktów pośrednich wzdłuż przebiegu GPX.
   - Rozdzielić funkcje eksportowane z `utils.ts`:
     - `buildGoogleMapsRouteUrl(trail, options?)`: zwraca URL do **całej wyrysowanej trasy** (lub `trail.googleMapsEmbedUrl`, jeśli jest poprawnym linkiem Google My Maps `https://www.google.com/maps/d/...` i nie wymuszono trybu directions).
     - `buildGoogleMapsStartNavigationUrl(trail)`: zwraca URL nawigacji z bieżącej pozycji użytkownika do punktu startowego (`destination=START&travelmode=bicycling`) — dla funkcji „Dojazd do startu”.
     - `buildGoogleMapsDirectionsUrl(trail, options?)`: zachować dla wstecznej kompatybilności jako alias lub wyraźnie udokumentować (domyślnie dla pełnego `trail` z `routePoints.length >= 2` ma budować **pełną trasę** z `origin`, `destination` i `waypoints`, a dla pojedynczego punktu bez `routePoints` — jak InfoWindow POI — nawigację do tego punktu!).
2. **Przebudowa `MapActionsBar.tsx` i `MapFallback.tsx`:**
   - Główny przycisk CTA: **„Otwórz trasę w Google Maps”** (link do pełnej wyrysowanej trasy z `origin` + `destination` + `waypoints` + `travelmode=bicycling`). Jeśli trasa ma skonfigurowany opcjonalny link Google My Maps (`googleMapsEmbedUrl`), dodać dedykowany przycisk/link **„Mapa 1:1 (My Maps)”** obok lub jako główny podgląd.
   - Drugi przycisk Google: **„Dojazd do startu”** (otwiera nawigację do punktu startu trasy).
   - Zachować przyciski **„Pobierz GPX”**, **„Udostępnij”** oraz wymogi ergonomii iPhone (`min-h-[44px]`, zero poziomego przewijania na `390px`, sticky bottom bar na mobile).
3. **Śledzenie pozycji GPS na żywo na mapie aplikacji (`TrailMapSection.tsx` + `TrailGoogleMap.tsx`):**
   - Dodać w HUD mapy przycisk **„Moja pozycja”** (ikona `Crosshair` / `Locate`, `min-h-[44px] min-w-[44px]`, `aria-pressed`).
   - Po kliknięciu uruchamia `navigator.geolocation.watchPosition` (z `enableHighAccuracy: true`), centruje mapę przy pierwszym odczycie i wyświetla pulsujący niebieski znacznik pozycji użytkownika na mapie Google (a przy ponownym kliknięciu zatrzymuje `clearWatch`).
   - Czytelny, nienachalny komunikat w razie odmowy uprawnień GPS lub braku obsługi geolokalizacji.
4. **Czystszy HUD w trybie `MapFallback`:**
   - Gdy renderowany jest `MapFallback` (brak poprawnego klucza `NEXT_PUBLIC_GOOGLE_MAPS_API_KEY` lub błąd ładowania API), ukryć lub dezaktywować przyciski przełączania warstw `Teren / Mapa / Satelita` (które nic nie zmieniają na mapie wektorowej SVG), pozostawiając działające `Wyśrodkuj trasę` i `Pełny ekran`.

**Kryteria akceptacji R2:**
- Kliknięcie „Otwórz trasę w Google Maps” dla każdego z 7 szlaków otwiera URL zawierający `origin=`, `destination=`, `waypoints=` (od 3 do 9 współrzędnych oddzielonych `|`) oraz `travelmode=bicycling`.
- Dla pętli (np. Pogoria, Żelazny Szlak, Dolina Baryczy) `origin` i `destination` to punkt startowy, a `waypoints` obejmują punkty po całym obwodzie.
- Przycisk „Dojazd do startu” generuje link z samym `destination=<START>`.
- Przycisk „Moja pozycja” poprawnie włącza/wyłącza `watchPosition` i sprząta watcher przy unmount.

---

### Etap R3 — Prawdziwe zdjęcia w okładkach i galerii (`gemini-4-hydrogen-high`)

**Własność plików:**
- `public/images/trails/*` *(usunięcie 21 plików `.svg`, dodanie 21 prawdziwych zdjęć `.jpg`/`.webp` + `public/images/trails/ATTRIBUTIONS.md`)*
- `src/lib/trails/seed-data.ts`
- `src/components/gallery/TrailGallery.tsx`, `src/components/gallery/PhotoLightbox.tsx`, `src/components/gallery/TrailGallery.test.tsx`
- `src/components/forms/ImageUploader.tsx`
- `src/app/szlaki/[slug]/page.tsx`
- `next.config.ts`

**Zadania szczegółowe:**
1. **Pozyskanie 21 prawdziwych, tematycznych fotografii (po 3 na szlak):**
   - Pobrać prawdziwe fotografie na otwartych licencjach (np. Wikimedia Commons CC-BY / CC-BY-SA / CC0 lub Unsplash) przedstawiające faktyczne miejsca na każdym z 7 szlaków:
     1. `slaskie-1019753-{cover,1,2}.jpg` — Jezioro Pogoria III / Pogoria IV (Kuźnica Warężyńska) / Park Zielona w Dąbrowie Górniczej.
     2. `zelazny-szlak-{cover,1,2}.jpg` — Park Zdrojowy Jastrzębie-Zdrój / Zamek w Zebrzydowicach / ścieżka rowerowa po dawnym nasypie.
     3. `velo-dunajec-{cover,1,2}.jpg` — Przełom Dunajca i Trzy Korony / Zamek w Niedzicy nad Jeziorem Czorsztyńskim / Droga Pienińska.
     4. `orle-gniazda-{cover,1,2}.jpg` — Zamek Ogrodzieniec / Zamki Mirów i Bobolice / Zamek w Olsztynie i wapienne skałki Jury.
     5. `green-velo-podlasie-{cover,1,2}.jpg` — Rozlewiska Narwi / Tykocin / Biebrzański Park Narodowy / Twierdza Osowiec.
     6. `dolina-baryczy-{cover,1,2}.jpg` — Stawy Milickie / Zespół Pałacowo-Parkowy w Żmigrodzie / aleja/grobla w Dolinie Baryczy.
     7. `velo-baltica-{cover,1,2}.jpg` — Wydmy Słowińskiego Parku Narodowego / Ustka wybrzeże / skansen w Klukach lub nadmorski bór.
   - Zoptymalizować pliki lokalnie (format `.jpg` lub `.webp`, szerokość ~1200 px, waga ok. 60–220 KB każdy) i zapisać w `public/images/trails/`.
   - Zweryfikować, że każdy plik jest prawdziwym, nieuszkodzonym obrazem rastrowym (sprawdzić magic bytes / wymiary > 600 px, `naturalWidth > 0`).
   - Dodać plik `public/images/trails/ATTRIBUTIONS.md` z wykazem źródeł, autorów i licencji dla wszystkich 21 zdjęć.
   - Usunąć wszystkie 21 starych plików `public/images/trails/*.svg`.
2. **Aktualizacja referencji i konfiguracji:**
   - Zaktualizować ścieżki w `src/lib/trails/seed-data.ts` (dla `coverImageUrl` oraz `images[]`).
   - Zaktualizować `PRESET_TRAIL_IMAGES` oraz `accept="image/jpeg,image/png,image/webp"` w `src/components/forms/ImageUploader.tsx`.
   - W `next.config.ts` usunąć `dangerouslyAllowSVG: true` (zostawić bezpieczne `remotePatterns` dla Vercel Blob, `slaskie.travel`, `images.unsplash.com`).
3. **Odporność na zepsute obrazy (`onError` fallback):**
   - W `TrailGallery.tsx`, `PhotoLightbox.tsx` oraz w sekcji Hero w `src/app/szlaki/[slug]/page.tsx` dodać stan błędu ładowania zdjęcia (elegancki placeholder z ikoną aparatu i komunikatem zamiast zepsutego obrazka przeglądarki).

**Kryteria akceptacji R3:**
- Zero plików `*.svg` w `public/images/trails/`.
- Wszystkie 21 zdjęć są prawdziwymi fotografiami rastrowymi (`.jpg`/`.webp`), ładują się bez błędów i mają spis licencji w `ATTRIBUTIONS.md`.
- `dangerouslyAllowSVG` usunięte z `next.config.ts`.

---

### Etap R4 — Prawdziwa miniatura przebiegu trasy GPX na kafelkach + integracja formularza (`gemini-4-argon-high`)

**Własność plików:**
- `src/components/trails/RouteMiniMap.tsx` *(nowy)*
- `src/components/trails/TrailCard.tsx`, `src/components/trails/TrailCard.test.tsx`
- `src/components/forms/TrailForm.tsx`, `src/components/forms/TrailForm.test.tsx`

**Zadania szczegółowe:**
1. **Komponent `RouteMiniMap.tsx`:**
   - Przyjmuje `points: ReadonlyArray<{ lat: number; lng: number }>`, `trailColor: TrailColor`, `isLoop: boolean`, `variant: "overlay" | "full"`.
   - Korzysta z istniejącej funkcji `projectRouteToSvg()` z `src/components/map/utils.ts` (korekta `cos(lat)`).
   - Renderuje **faktyczny kształt konkretnej trasy**:
     - Podwójna linia kontrastowa (biała/ciemna obwódka + główny kolor szlaku PTTK z `getTrailStrokeColor`),
     - Punkt START (zielony `#16A34A`), punkt META (czerwony `#E11D48` gdy `!isLoop`),
     - Wariant `"overlay"`: kompaktowa, półprzezroczysta ciemna karta HUD (`backdrop-blur-md`, subtelna siatka topograficzna) w prawym dolnym rogu zdjęcia na kafelku.
     - Wariant `"full"`: pełnowymiarowa topograficzna mapa wektorowa karty 16:10 (używana gdy brak zdjęcia okładkowego lub gdy zdjęcie zwróci `onError`).
   - Dodać `data-testid="trail-card-route-minimap"` oraz `data-testid="trail-card-route-path"` na elemencie `<path>` (ułatwi automatyczną weryfikację, że każda trasa ma własny unikalny przebieg!).
2. **Integracja w `TrailCard.tsx`:**
   - Na zdjęciu okładkowym `16:10` wyświetlać prawdziwe zdjęcie + nakładkę `<RouteMiniMap variant="overlay" ... />` w prawym dolnym rogu (jeśli `trail.routePreviewPoints.length >= 2`).
   - Obsłużyć `onError` obrazka przełączając się na `<RouteMiniMap variant="full" ... />`.
   - Sprawdzić czytelność badge'ów (region w lewym górnym, trudność w prawym górnym, pętla w lewym dolnym, miniatura trasy w prawym dolnym — zero nachodzenia na siebie na 390px i 1440px!).
3. **Integracja nowych funkcji w `TrailForm.tsx`:**
   - W `handleUrlImport`: jeśli `data.parsedGpx` zostało zwrócone z `/api/import-url` (Etap R1), automatycznie wypełnić `routePoints`, `bounds`, `startLat`, `startLng`, `endLat`, `endLng`, `isLoop`, `distanceKm`, `elevationGainM` — tak aby mapa podglądu narysowała się natychmiast po kliknięciu „Pobierz dane ze strony”!
   - Dodać opcjonalne pole formularza **„Link do Google My Maps (opcjonalnie)”** zapisywane do istniejącego pola `googleMapsEmbedUrl` (z walidacją URL i krótką podpowiedzią, że pozwala podpiąć mapę 1:1 z `mymaps.google.com`).
   - Upewnić się, że `DEFAULT_COVER_IMAGE` wskazuje na nowe prawdziwe zdjęcie z `PRESET_TRAIL_IMAGES[0].url`.

**Kryteria akceptacji R4:**
- Na stronie głównej każda karta szlaku pokazuje prawdziwe zdjęcie ORAZ rzeczywistą, unikalną miniaturę kształtu własnej trasy GPX.
- Test jednostkowy potwierdza, że `TrailCard` dla Pogorii i `TrailCard` dla Velo Dunajec generują różne ścieżki SVG `d`.
- Import URL z GPX od razu zasila podgląd trasy w `TrailForm`.

---

### Etap R5 — Testy, E2E (Desktop + iPhone 15) i Code Review (`gemini-4-hydrogen-high` + `gemini-4-argon-high`)

**Zadania szczegółowe (R5 — `gemini-4-hydrogen-high`):**
1. Zaktualizować istniejące testy pod nowe kontrakty (bez obchodzenia testów i bez `test.skip`):
   - `e2e/admin-flow.spec.ts`: zaktualizować asercję okładki z `.svg` na nowy preset `.jpg`/`.webp` i zweryfikować widoczność miniatury trasy na nowo dodanej karcie.
   - `e2e/catalog.spec.ts`: dodać asercję, że na stronie głównej karty mają widoczne `data-testid="trail-card-route-path"` i że ścieżki `d` różnych tras różnią się od siebie (koniec z jedną skopiowaną krzywą!).
   - `e2e/trail-detail.spec.ts`: zweryfikować, że przycisk Google Maps ma w `href` parametry `origin=`, `destination=`, `waypoints=` i `travelmode=bicycling`, że istnieje też link „Dojazd do startu”, a wszystkie zdjęcia w galerii to prawdziwe obrazy (`naturalWidth > 0`, brak `.svg`).
   - `e2e/responsive-pwa.spec.ts`: potwierdzić zero poziomego przewijania na `390×844` i cele dotykowe `>= 44px` po zmianach w `MapActionsBar` i `TrailMapSection`.
2. Uruchomić pełną bramkę jakości w pętli naprawczej:
   ```bash
   npm run typecheck
   npm run lint
   npm run test
   npm run build
   npm run test:e2e
   ```
   *(Jeśli pojawi się trudny błąd architektury/mapy/Playwright, Orchestrator eskaluje diagnozę do `gemini-4-neon-high`.)*

**Zadania szczegółowe (R5b — `gemini-4-argon-high`, niezależny reviewer):**
- Przejrzeć `git diff` pod kątem:
  - bezpieczeństwa (SSRF przy pobieraniu GPX, brak SVG w uploadzie, brak wycieku danych w rate-limiterze, brak nadpisywania danych przez `bootstrap-db.ts`),
  - jakości linków Google Maps (szczególnie pętli i długich tras — limit znaków URL i max 9 waypointów),
  - wizualnej czystości kart i galerii (brak nakładających się badge'ów na mobile),
  - braku nieużywanego kodu i martwych referencji do starych `.svg`.

---

### Etap R6 — Dokumentacja i finalizacja (`gemini-3.8-flash-medium`)

**Zadania szczegółowe:**
- Zaktualizować `README.md`, `docs/ARCHITECTURE.md`, `docs/DESIGN_SYSTEM.md`, `docs/TEST_PLAN.md` oraz `DEVELOPMENT_PLAN.md` o wprowadzone zmiany (pełna trasa w Google Maps, GPS, miniatury tras, prawdziwe zdjęcia, bezpieczny `bootstrap-db`, usunięcie uploadu SVG, rate-limit logowania).
- Zaktualizować tablicę statusu i dziennik w tym pliku (`REFACTORING_PLAN.md`).
- Uruchomić końcowe `npm run typecheck && npm run lint && npm run test && npm run build`.

---

## 4. Gotowy Master Prompt dla Orchestrator (Neon)

> **Instrukcja uruchomienia:**  
> Przełącz model czatu na **Orchestrator (Neon)** i wklej poniższy blok jako polecenie startowe.

```markdown
Jesteś **Orchestrator (Neon)** prowadzącym kompleksową refaktoryzację projektu „Szlaki Rowerowe” na podstawie pliku `REFACTORING_PLAN.md`.

## 1. Źródło prawdy
Przeczytaj najpierw w całości `REFACTORING_PLAN.md` (oraz w razie potrzeby istniejące pliki kodu wskazywane w etapach R1–R6).

## 2. BEZWZGLĘDNA ZASADA DOBORU MODELI (ALLOWLIST)
Korzystaj z narzędzia `swarm` do delegowania prac. Wolno Ci wybierać **WYŁĄCZNIE** modele z poniższej puli (i ŻADNE inne — zakaz Claude, GPT-OSS, Orchestrator Argon i starszych modeli):
- `gemini-4-neon-high` / `gemini-4-neon-medium` (Neon — zadania najtrudniejsze: DB/seed, SSRF/GPX, Google Maps routing/waypoints/GPS, diagnoza trudnych błędów)
- `gemini-4-argon-high` / `gemini-4-argon-medium` (Argon — UI miniatur tras `RouteMiniMap`/`TrailCard`, integracja `TrailForm`, niezależny code review)
- `gemini-4-hydrogen-high` / `gemini-4-hydrogen-medium` (Hydrogen — prawdziwe zdjęcia i galeria, testy Vitest i E2E Playwright)
- `gemini-3.8-flash-medium` / `gemini-3.8-flash-low` (Flash — dokumentacja, porządki, szybkie sprawdzenia)

Sprawdź `swarm(action: "models", all: true)` tylko jeśli musisz zweryfikować dostępność, ale trzymaj się ściśle powyższej listy.

## 3. Strategia wykonania falami (Wave Orchestration)
Realizuj etapy automatycznie, fala po fali, bez zatrzymywania się na pośrednie potwierdzenia:

### Fala 1 (równolegle — 3 workerów w izolowanych `workspace: "share"`):
1. Uruchom `worker-r1` (`model: "gemini-4-neon-high"`, `workspace: "share"`) z briefem **Etapu R1** z `REFACTORING_PLAN.md`.
2. Uruchom `worker-r2` (`model: "gemini-4-neon-high"`, `workspace: "share"`) z briefem **Etapu R2** z `REFACTORING_PLAN.md`.
3. Uruchom `worker-r3` (`model: "gemini-4-hydrogen-high"`, `workspace: "share"`) z briefem **Etapu R3** z `REFACTORING_PLAN.md`.
- Poczekaj aż wszyscy trzej zakończą i zameldują status.
- **Zintegruj (zmerguj) zmiany z R1, R2 i R3** do głównego workspace'u, rozwiąż ewentualne drobne konflikty, zweryfikuj `npm run typecheck`, a dopiero po bezpiecznym zlandowaniu zmian zakończ workerów Fali 1 (`kill`).

### Fala 2 (sekwencyjnie po integracji Fali 1):
4. Uruchom `worker-r4` (`model: "gemini-4-argon-high"`, `workspace: "inherit"`) z briefem **Etapu R4** (miniatury prawdziwych tras GPX w `RouteMiniMap`/`TrailCard` + podpięcie `parsedGpx` i pola Google My Maps w `TrailForm`).
- Po ukończeniu zaktualizuj status w `REFACTORING_PLAN.md` i zakończ `worker-r4`.

### Fala 3 (testy E2E + niezależny Code Review):
5. Uruchom `worker-r5` (`model: "gemini-4-hydrogen-high"`, `workspace: "inherit"`) z briefem **Etapu R5** (aktualizacja i rozbudowa testów Vitest + Playwright Desktop i iPhone 15, uruchomienie pełnej bramki: `typecheck`, `lint`, `test`, `build`, `test:e2e`).
   - Jeśli pojawi się skomplikowany błąd, którego `worker-r5` nie rozwiąże w 2 próbach, włącz do diagnozy worker `gemini-4-neon-high`.
6. Po uzyskaniu 100% zielonych testów uruchom `worker-review` (`model: "gemini-4-argon-high"`, `workspace: "inherit"`) do niezależnego przeglądu całego `git diff` (bezpieczeństwo, Google Maps URLs, jakość obrazów, brak martwych SVG, responsywność).
   - Jeśli reviewer zgłosi realne defekty krytyczne lub ważne, popraw je i ponownie uruchom bramkę jakości.

### Fala 4 (dokumentacja i zamknięcie):
7. Uruchom `worker-r6` (`model: "gemini-3.8-flash-medium"`, `workspace: "inherit"`) z briefem **Etapu R6** (aktualizacja dokumentacji, odhaczenie tablicy w `REFACTORING_PLAN.md`, końcowe `typecheck && lint && test && build`).
8. Zakończ wszystkich pozostałych workerów (`kill`), upewnij się że repozytorium jest w czystym stanie (nie rób `git push` bez zgody użytkownika) i przedstaw zwięzły raport końcowy z:
   - zestawieniem użytych modeli per etap,
   - podsumowaniem zmian dla każdego z 3 priorytetów użytkownika + poprawek z audytu,
   - wynikami wszystkich bramek jakości (`typecheck`, `lint`, `test`, `build`, `test:e2e` Desktop + iPhone 15).

## 4. Zakazy i standardy jakości
- Zero `test.skip`, `@ts-ignore`, `@ts-expect-error`, `eslint-disable`.
- Zero `export const runtime = 'edge'`, zero `Proxy` w `src/db/index.ts`.
- Zachowaj ergonomię iPhone (`>= 44px` przyciski dotykowe, zero poziomego scrolla na 390px, czcionki formularzy `>= 16px`).
- Przed każdym `kill` upewnij się, że cała praca workera została przeniesiona do głównego workspace'u!

Rozpocznij teraz od uruchomienia Fali 1 (R1, R2, R3 równolegle).
```

---

## 5. Gotowe Briefy dla workerów (do użycia przez Orchestrator Neon)

### Brief R1 (`worker-r1` · `gemini-4-neon-high` · `workspace: "share"`)
```markdown
Realizujesz **Etap R1** z `REFACTORING_PLAN.md` (własność wyłącznie plików backend/DB/security/importer).

Zakres obowiązkowy:
1. `scripts/bootstrap-db.ts` i `scripts/seed.ts`: napraw błąd nadpisywania danych przy deployu — `seedDatabase({ force = false })` w trybie domyślnym używa `onConflictDoNothing({ target: trails.slug })` i wstawia zdjęcia/POI wyłącznie dla nowo dodanych rekordów (nie kasuje istniejących `trail_images` ani `trail_pois`). Zachowaj opcję `--force` dla ręcznego re-seedu.
2. `src/types/trail.ts` i `src/lib/trails/repository.ts`:
   - Dodaj `routePreviewPoints: Array<{ lat: number; lng: number }>` do `TrailSummary`.
   - W `listTrails()` wybierz jawnie kolumny podsumowania (bez pobierania `trails.content`) i wygeneruj lekkie `routePreviewPoints` (max 48 pkt przez `simplifyRoutePoints`) zarówno dla DB jak i trybu in-memory.
   - Zastosuj `db.batch(...)` dla atomowego zapisu `trails` + `trail_images` + `trail_pois` w `createTrail` i `updateTrail` (gdy DB skonfigurowane).
3. `src/lib/importer/scraper.ts` i `src/app/api/import-url/route.ts`:
   - Dodaj `parsedGpx: ParsedGpxResult | null` do `ImportedTrailMetadata`.
   - Jeśli znaleziono `gpxUrl`, pobierz plik GPX z pełną ochroną SSRF (`validateSafeExternalUrl`, `assertSafeResolvedHost`, max 3 przekierowania, timeout 8s, limit 5 MB) i sparsuj przez `parseGpx()`. Błąd pobrania/parsowania GPX nie może psuć całego importu (zwróć wtedy `parsedGpx: null`).
4. `src/lib/upload/validation.ts` i `src/app/api/upload/route.ts`: usuń `image/svg+xml` i `.svg` z dozwolonych formatów uploadu obrazów.
5. `src/lib/auth/rate-limit.ts` (nowy) i `src/app/api/auth/login/route.ts`: dodaj prosty sliding-window rate limiter (np. max 10 błędnych prób / 15 min per IP -> HTTP 429 z `Retry-After`) + funkcję resetującą dla testów.
6. Zaktualizuj/dodaj testy: `src/lib/trails/repository.test.ts`, `src/lib/importer/scraper.test.ts`, `tests/api/auth-upload.test.ts`.

NIE dotykaj plików mapy (`src/components/map/*`), galerii (`src/components/gallery/*`) ani grafik (`public/images/trails/*`).
Warunek ukończenia: `npm run typecheck && npm run test` przechodzi czysto (w zakresie Twoich zmian), a w raporcie podaj listę zmodyfikowanych plików i krótki opis kontraktów dla Fali 2.
```

### Brief R2 (`worker-r2` · `gemini-4-neon-high` · `workspace: "share"`)
```markdown
Realizujesz **Etap R2** z `REFACTORING_PLAN.md` (Priorytet #1: pełna wyrysowana trasa w Google Maps na telefonie i desktopie + GPS na żywo).

Własność plików: wyłącznie `src/components/map/*`.

Zakres obowiązkowy:
1. `src/components/map/utils.ts`:
   - Zaimplementuj `extractKeyRouteWaypoints(routePoints, { maxWaypoints = 9, isLoop = false })` wybierający do 9 kluczowych punktów pośrednich **równomiernie po skumulowanym dystansie wzdłuż trasy** (z minimalnym odstępem >= 150 m i zachowaniem długości URL < 2000 znaków).
   - Dla pętli (`isLoop: true`): `origin = startPoint`, `destination = startPoint`, a `waypoints` rozmieszczone po całym obwodzie (z pominięciem punktów < 200 m od startu), żeby Google Maps narysowało całą pętlę.
   - Dla tras punkt–punkt (`isLoop: false`): `origin = startPoint`, `destination = endPoint`, `waypoints` do 9 pkt pośrednich.
   - Zaimplementuj/zaktualizuj:
     - `buildGoogleMapsDirectionsUrl(trail, options?)`: gdy trasa ma `routePoints.length >= 2` i nie podano ręcznie `options`, automatycznie generuje pełną trasę (`origin`, `destination`, `waypoints`, `travelmode=bicycling`). Gdy brak `routePoints` (np. pojedynczy punkt POI z InfoWindow), generuje nawigację do tego punktu.
     - `buildGoogleMapsStartNavigationUrl(trail)`: nawigacja z bieżącej pozycji do punktu startu (`destination=START&travelmode=bicycling`).
     - Helper rozpoznający poprawny opcjonalny link Google My Maps (`isGoogleMyMapsUrl(url)` dla `google.com/maps/d/...`).
2. `src/components/map/MapActionsBar.tsx` i `src/components/map/MapFallback.tsx`:
   - Główny przycisk CTA: „Otwórz trasę w Google Maps” (`href={routeUrl}` z pełną trasą).
   - Drugi przycisk Google: „Dojazd do startu” (`href={startNavUrl}`).
   - Jeśli `trail.googleMapsEmbedUrl` jest poprawnym linkiem Google My Maps, pokaż dodatkowy link „Mapa 1:1 (My Maps)”.
   - Zachowaj przyciski „Pobierz GPX” i „Udostępnij”, ergonomię iPhone (`min-h-[44px]`, zero poziomego scrolla na 390px).
3. `src/components/map/TrailMapSection.tsx` i `src/components/map/TrailGoogleMap.tsx`:
   - Dodaj w HUD przycisk „Moja pozycja” (`watchPosition`, niebieski pulsujący marker pozycji użytkownika na mapie Google, wyłączanie śledzenia + `clearWatch` na unmount, estetyczna obsługa odmowy uprawnień).
   - Gdy renderowany jest `MapFallback` (brak poprawnego klucza API lub błąd ładowania Google Maps), ukryj bezużyteczny przełącznik `Teren / Mapa / Satelita` (zostaw `Wyśrodkuj trasę` i `Pełny ekran`).
4. Zaktualizuj i rozbuduj `src/components/map/TrailGoogleMap.test.tsx` (testy pełnej trasy, pętli, limitu 9 waypointów, `buildGoogleMapsStartNavigationUrl`, przycisku GPS i ukrywania warstw w fallbacku).

NIE dotykaj plików backendu, seeda ani kart katalogu.
Warunek ukończenia: `npm run typecheck && npx vitest run src/components/map/` przechodzi w 100%, a zmiany są gotowe do zmergowania przez Orchestratora.
```

### Brief R3 (`worker-r3` · `gemini-4-hydrogen-high` · `workspace: "share"`)
```markdown
Realizujesz **Etap R3** z `REFACTORING_PLAN.md` (Priorytet #3: prawdziwe zdjęcia dla wszystkich 7 szlaków i galerii).

Własność plików: `public/images/trails/*`, `src/lib/trails/seed-data.ts`, `src/components/gallery/*`, `src/components/forms/ImageUploader.tsx`, `src/app/szlaki/[slug]/page.tsx`, `next.config.ts`.

Zakres obowiązkowy:
1. Pozyskaj i zapisz lokalnie w `public/images/trails/` **21 prawdziwych, zweryfikowanych fotografii** (format `.jpg` lub `.webp`, szerokość ~1200 px, rozsądny rozmiar ~60–220 KB, otwarte licencje np. Wikimedia Commons CC-BY / CC-BY-SA / CC0) — po 3 różne zdjęcia na każdy z 7 szlaków:
   - `slaskie-1019753-{cover,1,2}.jpg` (Pogoria III / IV, Dąbrowa Górnicza, Park Zielona)
   - `zelazny-szlak-{cover,1,2}.jpg` (Jastrzębie-Zdrój / Zebrzydowice / trasa rowerowa)
   - `velo-dunajec-{cover,1,2}.jpg` (Przełom Dunajca, Trzy Korony, Niedzica / Szczawnica)
   - `orle-gniazda-{cover,1,2}.jpg` (Ogrodzieniec, Mirów/Bobolice, Olsztyn / Jura)
   - `green-velo-podlasie-{cover,1,2}.jpg` (Narwiański PN, Tykocin, Biebrza / Osowiec)
   - `dolina-baryczy-{cover,1,2}.jpg` (Stawy Milickie, Żmigród, Dolina Baryczy)
   - `velo-baltica-{cover,1,2}.jpg` (Ustka, Słowiński PN wydmy, Kluki / Łeba)
   Zweryfikuj każdy pobrany plik (poprawny nagłówek obrazu rastrowego, nie HTML/404, wymiary > 600 px). Zapisz pełną listę źródeł, autorów i licencji w `public/images/trails/ATTRIBUTIONS.md`.
2. Usuń wszystkie 21 starych plików `public/images/trails/*.svg`.
3. Zaktualizuj wszystkie ścieżki obrazów w `src/lib/trails/seed-data.ts` oraz `PRESET_TRAIL_IMAGES` (i `accept="image/jpeg,image/png,image/webp"`) w `src/components/forms/ImageUploader.tsx`.
4. Usuń `dangerouslyAllowSVG: true` z `next.config.ts`.
5. Dodaj bezpieczną obsługę błędu ładowania obrazów (`onError` fallback UI) w `src/components/gallery/TrailGallery.tsx`, `src/components/gallery/PhotoLightbox.tsx` oraz na zdjęciu Hero w `src/app/szlaki/[slug]/page.tsx` (wyodrębnij mały komponent kliencki dla Hero image jeśli potrzeba).
6. Zaktualizuj `src/components/gallery/TrailGallery.test.tsx` (w tym test fallbacku `onError`).

NIE dotykaj `src/components/map/*`, `src/lib/trails/repository.ts` ani `TrailCard.tsx`.
Warunek ukończenia: wszystkie 21 plików to prawdziwe zdjęcia, `npm run typecheck && npx vitest run src/components/gallery/` przechodzi czysto.
```

### Brief R4 (`worker-r4` · `gemini-4-argon-high` · `workspace: "inherit"`)
```markdown
Realizujesz **Etap R4** z `REFACTORING_PLAN.md` (Priorytet #2: prawdziwa miniatura trasy GPX na kafelkach strony głównej + integracja formularza po zmergowaniu R1–R3).

Zakres obowiązkowy:
1. Utwórz `src/components/trails/RouteMiniMap.tsx`:
   - Przyjmuje `points: ReadonlyArray<{ lat: number; lng: number }>`, `trailColor: TrailColor`, `isLoop: boolean`, `variant: "overlay" | "full"`.
   - Rzutuje faktyczne punkty trasy za pomocą `projectRouteToSvg()` z `src/components/map/utils.ts`.
   - Rysuje podwójną linię kontrastową w kolorze szlaku PTTK (`getTrailStrokeColor` / `getTrailOutlineColor`), znacznik START (zielony) i META (czerwony dla `!isLoop`), atrybuty `data-testid="trail-card-route-minimap"` oraz `data-testid="trail-card-route-path"`.
   - Wariant `"overlay"`: estetyczna, kompaktowa nakładka HUD w stylu *Velo Pulse* w prawym dolnym rogu zdjęcia karty.
   - Wariant `"full"`: pełna karta topograficzna 16:10 (używana jako fallback gdy brak zdjęcia lub `onError`).
2. Zaktualizuj `src/components/trails/TrailCard.tsx`:
   - Renderuje prawdziwe zdjęcie okładkowe + `<RouteMiniMap variant="overlay" ... />` w prawym dolnym rogu (gdy `trail.routePreviewPoints.length >= 2`), z czystą kompozycją bez nakładania się badge'ów na 390px i 1440px.
   - Obsługa `onError` na zdjęciu przełącza okładkę na `<RouteMiniMap variant="full" ... />`.
3. Zaktualizuj `src/components/forms/TrailForm.tsx`:
   - W `handleUrlImport`: jeśli `data.parsedGpx` jest obecne, automatycznie uzupełnij `routePoints`, `bounds`, `startLat`, `startLng`, `endLat`, `endLng`, `isLoop`, `distanceKm`, `elevationGainM` (podgląd mapy GPX pojawia się od razu po imporcie URL).
   - Dodaj opcjonalne pole „Link Google My Maps (opcjonalnie)” podpięte do `googleMapsEmbedUrl`.
   - Upewnij się, że `DEFAULT_COVER_IMAGE` korzysta z nowego prawdziwego zdjęcia z `PRESET_TRAIL_IMAGES[0].url`.
4. Rozbuduj `src/components/trails/TrailCard.test.tsx` (w tym test dowodzący, że różne szlaki renderują różne ścieżki SVG `d`) oraz `src/components/forms/TrailForm.test.tsx` (test importu URL z `parsedGpx` i pola My Maps).

Warunek ukończenia: `npm run typecheck && npm run lint && npm run test` przechodzi w 100%.
```

### Brief R5 (`worker-r5` · `gemini-4-hydrogen-high` · `workspace: "inherit"`)
```markdown
Realizujesz **Etap R5** z `REFACTORING_PLAN.md` (pełna weryfikacja QA + testy E2E Desktop i iPhone 15).

Zakres obowiązkowy:
1. Zaktualizuj testy E2E w katalogu `e2e/` pod nowe wymagania:
   - `e2e/catalog.spec.ts`: sprawdź obecność `trail-card-route-path` na kartach i zweryfikuj, że różne szlaki mają różne atrybuty `d` (prawdziwe unikalne miniatury tras) oraz że obrazy okładek ładują się poprawnie (brak `.svg` w obrazach kart).
   - `e2e/trail-detail.spec.ts`: zweryfikuj, że główny przycisk Google Maps ma w `href` parametry `origin=`, `destination=`, `waypoints=` i `travelmode=bicycling`, że obecny jest przycisk „Dojazd do startu”, oraz że galeria zawiera prawdziwe zdjęcia rastrowe (`naturalWidth > 0`).
   - `e2e/admin-flow.spec.ts`: zaktualizuj selektor/asercję presetu okładki na nowy plik rastrowy `.jpg`/`.webp`.
   - `e2e/responsive-pwa.spec.ts`: sprawdź brak poziomego scrolla na `390×844` i wymiary przycisków `>= 44px` na zaktualizowanym `MapActionsBar` i `TrailMapSection`.
2. Uruchom pełną bramkę jakości w pętli test–poprawka aż do 100% PASS (zero `test.skip`, `@ts-ignore`, `eslint-disable`):
   - `npm run typecheck`
   - `npm run lint`
   - `npm run test`
   - `npm run build`
   - `npm run test:e2e` (oba projekty: `desktop-chromium` i `iphone-15`).
3. Jeśli trafisz na trudny błąd, którego nie usuniesz w 2 próbach, zgłoś go Orchestratorowi z pełnym stack trace do eskalacji na `gemini-4-neon-high`.
```

### Brief R5b — Code Review (`worker-review` · `gemini-4-argon-high` · `workspace: "inherit"`)
```markdown
Pełnisz rolę niezależnego **Code & Security Reviewera** dla refaktoryzacji z `REFACTORING_PLAN.md` (tylko analiza i raport — nie wprowadzaj zmian bez zlecenia Orchestratora).

Przejrzyj cały `git diff` oraz nowo dodane pliki pod kątem:
1. Bezpieczeństwa: brak XSS (usunięcie uploadu SVG i `dangerouslyAllowSVG`), pełna ochrona SSRF przy pobieraniu GPX w `scraper.ts`, poprawny rate-limiter w `/api/auth/login`, brak nadpisywania danych przez `bootstrap-db.ts` i `seed.ts`.
2. Google Maps (Priorytet #1): poprawność generowania URL dla pętli i tras punkt–punkt, limit <= 9 waypointów i < 2000 znaków URL, brak wycieków `watchPosition`.
3. Miniatur tras (Priorytet #2) i zdjęć (Priorytet #3): prawdziwe obrazy (sprawdź `public/images/trails/` i `ATTRIBUTIONS.md`), brak pozostałych referencji do usuniętych `.svg`, czytelność UI na mobile 390px.
4. Wydajności i integralności DB: jawny select bez `content` w `listTrails`, atomowość `db.batch`.

Zwróć zwięzły raport z podziałem na: Blokery / Ważne / Drobne / Werdykt (APPROVE albo CHANGES_REQUESTED).
```

### Brief R6 (`worker-r6` · `gemini-3.8-flash-medium` · `workspace: "inherit"`)
```markdown
Realizujesz **Etap R6** z `REFACTORING_PLAN.md` (aktualizacja dokumentacji i porządki końcowe).

Zakres obowiązkowy:
1. Zaktualizuj `README.md`, `docs/ARCHITECTURE.md`, `docs/DESIGN_SYSTEM.md`, `docs/TEST_PLAN.md` oraz `DEVELOPMENT_PLAN.md` tak, aby w 100% odzwierciedlały aktualny stan kodu (Google Maps z pełną trasą/waypoints + GPS + My Maps, `RouteMiniMap` na kartach, prawdziwe zdjęcia w `public/images/trails/` + `ATTRIBUTIONS.md`, bezpieczny `bootstrap-db.ts`, auto-GPX w importerze URL, brak uploadu SVG, rate-limit logowania).
2. Odhacz zrealizowane etapy `[x]` w tablicy statusu `REFACTORING_PLAN.md` i dopisz krótki dziennik zmian na końcu pliku.
3. Uruchom końcową weryfikację: `npm run typecheck && npm run lint && npm run test && npm run build`.
4. Zamelduj Orchestratorowi gotowość i podsumowanie zaktualizowanych plików.
```

---

## 6. Dziennik realizacji refaktoryzacji *(aktualizowany przez Orchestrator Neon)*

| Data | Etap | Model | Status | Wynik bramek jakości | Uwagi |
|---|---|---|---|---|---|
| 2026-11-20 | Audyt i plan | Gemini 4 Neon (High) | Ukończony | — | Przygotowano pełny audyt, specyfikację etapów R1–R6 oraz prompty z allowlistą modeli dla Orchestrator (Neon). |
| 2026-11-21 | **R1** (`backend-core`) | Gemini 4 Neon (High) | Ukończony | `typecheck`, `lint`, `test` PASS | Bezpieczny seed (`force: false` domyślnie w `bootstrap-db.ts`, `--force` ręcznie), auto-pobieranie GPX w scraperze (`parsedGpx`) z ochroną SSRF, usunięcie `image/svg+xml`, rate limiter logowania (`rate-limit.ts`, 10 prób / 15 min), lekki `routePreviewPoints` (<= 48 pkt) w `listTrails` bez `content`, atomowe `db.batch`. |
| 2026-11-21 | **R2** (`maps-google`) | Gemini 4 Neon (High) | Ukończony | `typecheck`, `lint`, `test` PASS | Pełna trasa Google Maps (`extractKeyRouteWaypoints` — 3 do 9 waypointów po skumulowanym dystansie Haversine, poprawna obsługa pętli `isLoop`), osobny link „Dojazd do startu”, HUD „Moja pozycja GPS” z geolokalizacją na żywo, obsługa Google My Maps (`googleMapsEmbedUrl`), ukrycie przełącznika stylów mapy w fallbacku. |
| 2026-11-21 | **R3** (`media-gallery`) | Gemini 4 Hydrogen (High) | Ukończony | `typecheck`, `lint`, `test` PASS | Pozyskanie 21 prawdziwych fotografii krajobrazowych JPEG z Wikimedia Commons (po 3 na szlak, 72–249 KB), usunięcie szablonów SVG, utworzenie `ATTRIBUTIONS.md` z autorami i licencjami CC, usunięcie `dangerouslyAllowSVG` z `next.config.ts`, fallback `onError` w `TrailGallery`, `PhotoLightbox` i `TrailHeroImage`. |
| 2026-11-21 | **R4** (`ui-cards-form`) | Gemini 4 Argon (High) | Ukończony | `typecheck`, `lint`, `test` PASS | Wdrożenie `RouteMiniMap` z unikalnymi rzutami GPX (`trail-card-route-path`), integracja nakładki na `TrailCard` z fallbackiem na pełną mapę przy `onError`, integracja `data.parsedGpx` i pola Google My Maps w `TrailForm`. |
| 2026-11-21 | **R5** (`qa-e2e`) | Gemini 4 Hydrogen (High) | Ukończony | 100% PASS (5 bramek) | `typecheck` PASS, `lint` PASS, `test` PASS (15 plików / 96 testów), `build` PASS, `test:e2e` PASS (14/14: 7 Desktop + 7 iPhone 15). Aktualizacja asercji `trail-card-route-path`, parametrów waypoints w Google Maps, „Dojazd do startu”, zdjęć rastrowych i celów dotykowych `>= 44px`. Zero pominięć (`test.skip`), zero obejść. |
| 2026-11-21 | **R5b** (`reviewer`) | Gemini 4 Argon (High) | Ukończony | **APPROVE** | Niezależny Code & Security Review: 0 blokerów, 0 uwag ważnych. Pełna zgodność w zakresie bezpieczeństwa (brak SVG, SSRF safe, rate limiter, bezpieczny seed), Google Maps waypoints i pętli, miniatur GPX, fotografii JPEG oraz integralności DB. |
| 2026-11-21 | **R6** (`docs-cleanup`) | Gemini 3.8 Flash (Medium) | Ukończony | 100% PASS (4 bramki) | Zaktualizowano `README.md`, `docs/ARCHITECTURE.md`, `docs/DESIGN_SYSTEM.md`, `docs/TEST_PLAN.md`, `DEVELOPMENT_PLAN.md` oraz `REFACTORING_PLAN.md`. Zweryfikowano stan projektu: `typecheck`, `lint`, `test` (15/15 plików, 96 testów), `build` (Next.js Turbopack). |
