# Plan Developmentu — Szlaki Rowerowe

> **Repozytorium:** `https://github.com/phxphoenix/Szlaki-rowerowe`  
> **Wariant:** Full-stack (Wariant B) — Next.js App Router + Neon Postgres (Drizzle ORM) + Vercel Blob + Google Maps API  
> **Hosting:** Vercel (Node.js 24 LTS, Fluid Compute, `vercel.ts`)  
> **Design System:** *Velo Pulse — Alpine Telemetry* ([docs/DESIGN_SYSTEM.md](./docs/DESIGN_SYSTEM.md))  
> **Architektura:** [docs/ARCHITECTURE.md](./docs/ARCHITECTURE.md)  
> **Plan testów:** [docs/TEST_PLAN.md](./docs/TEST_PLAN.md)

---

## 1. Macierz doboru modelu AI i poziomu złożoności (Model & Effort Routing)

Każdy etap ma przypisany optymalny profil modelu i głębokości rozumowania, aby łączyć najwyższą jakość architektury tam, gdzie występują trudne zależności, z maksymalną szybkością i oszczędnością tokenów w zadaniach powtarzalnych.

| Etap | Nazwa etapu | Złożoność | Rekomendowany Model | Poziom wysiłku (Effort) | Tryb delegacji (`invoke_subagent`) |
|---|---|---|---|---|---|
| **Etap 0** | Inicjalizacja repozytorium, Next.js, Tailwind, narzędzia testowe i `vercel.ts` | Niska | `Flash` / `Standard` | **Low** | `Model: "flash"` |
| **Etap 1** | Baza danych (Neon + Drizzle), schemat, seed (w tym `slaskie.travel/route/1019753`) i warstwa domenowa | Wysoka | `Pro` | **High** | `Model: "pro"` |
| **Etap 2** | Silnik GPX, geometria, autoryzacja sesyjna i pełne REST API (`/api/trails`, `/api/upload`, `/api/import-url`) | Wysoka | `Pro` | **High** | `Model: "pro"` |
| **Etap 3** | Sportowy Design System *Velo Pulse*, layout Desktop + iPhone (PWA, Safe Areas) i katalog główny (kafelki, filtry regionów, sortowanie) | Średnia | `Standard` / `Inherit` | **Medium** | `Model: "inherit"` |
| **Etap 4** | Widok artykułu szlaku, centralna mapa **Google Maps API**, zsynchronizowany profil wysokościowy i galeria swipe | Wysoka | `Pro` | **High** | `Model: "pro"` |
| **Etap 5** | Panel właściciela: logowanie, formularz `/dodaj` i `/edytuj`, importer z URL, upload GPX/zdjęć (Vercel Blob) | Średnia | `Standard` / `Inherit` | **Medium** | `Model: "inherit"` |
| **Etap 6** | Kompleksowe testy E2E Playwright (Desktop + iPhone 15), audyt dostępności, PWA i wydajności | Średnia / Wysoka | `Pro` (diagnoza) / `Flash` (powtarzalne scenariusze) | **Medium–High** | `Model: "pro"` / `"flash"` |
| **Etap 7** | Finalizacja dokumentacji, konfiguracja deploymentu Vercel, audyt bezpieczeństwa i weryfikacja końcowa | Niska | `Flash` / `Standard` | **Low** | `Model: "flash"` |

---

## 2. Tablica statusu etapów (aktualizowana automatycznie po każdym etapie)

- [x] **Etap 0:** Fundament projektu, konfiguracja Next.js, Tailwind v4, Vitest, Playwright, `vercel.ts`
- [x] **Etap 1:** Model danych PostgreSQL (Drizzle ORM + Neon), 16 województw, walidacja Zod i seed bazy
- [x] **Etap 2:** Parser GPX, sesyjna autoryzacja admina, API CRUD, Vercel Blob upload i importer URL
- [x] **Etap 3:** Sportowy UI *Velo Pulse*, responsywny layout Desktop/iPhone, strona główna z kafelkami, filtrami i sortowaniem
- [x] **Etap 4:** Strona szczegółów szlaku, centralna mapa Google Maps API + profil wysokościowy + galeria Lightbox
- [x] **Etap 5:** Panel dodawania/edycji szlaków, logowanie, importer z URL (np. `slaskie.travel`) i podgląd GPX na żywo
- [x] **Etap 6:** Pełny zestaw testów E2E (Desktop + iPhone 15), naprawa wykrytych defektów, optymalizacja Core Web Vitals
- [x] **Etap 7:** Finalna weryfikacja deploymentu na Vercel, checklist produkcyjny i aktualizacja całej dokumentacji

---

## 3. Szczegółowy plan etapów

### Etap 0: Fundament projektu i środowisko deweloperskie
**Profil AI:** `Flash / Low` — konfiguracja szkieletu, instalacja zależności i skryptów CI.

**Zadania:**
- [x] Zainicjalizować projekt Next.js (App Router, TypeScript strict, Tailwind CSS v4, ESLint, katalog `src/`) bez nadpisywania istniejących plików dokumentacji (`docs/`, `DEVELOPMENT_PLAN.md`, `MASTER_PROMPT.md`, `README.md`).
- [x] Jeśli katalog nie jest jeszcze repozytorium Git, zainicjalizować Git i skonfigurować `origin` na `https://github.com/phxphoenix/Szlaki-rowerowe.git` (bez wymuszania push bez zgody użytkownika).
- [x] Zainstalować podstawowe zależności produkcyjne i deweloperskie:
  - UI: `lucide-react`, `clsx`, `tailwind-merge`, `class-variance-authority` (+ inicjalizacja `shadcn/ui`)
  - Baza i walidacja: `drizzle-orm`, `@neondatabase/serverless`, `zod`, `dotenv-cli`, `drizzle-kit`, `tsx`
  - Storage & Auth & Mapy: `@vercel/blob`, `@vis.gl/react-google-maps`, `fast-xml-parser`, `jose`, `react-markdown`, `remark-gfm`
  - Konfiguracja Vercel: `@vercel/config`
  - Testy: `vitest`, `@vitejs/plugin-react`, `jsdom`, `@testing-library/react`, `@testing-library/jest-dom`, `@testing-library/user-event`, `@playwright/test`
- [x] Skonfigurować `package.json` ze skryptami: `dev`, `build`, `start`, `lint`, `typecheck`, `test`, `test:watch`, `test:e2e`, `db:generate`, `db:push`, `db:seed`.
- [x] Utworzyć `.env.example`, `vercel.ts`, `next.config.ts` (ze zdalnymi wzorcami obrazów `images.remotePatterns` dla Vercel Blob i zaufanych źródeł), `vitest.config.ts` oraz `playwright.config.ts` (z projektami `desktop-chromium` 1440×900 oraz `iphone-15` 390×844).
- [x] Dodać endpoint `src/app/api/health/route.ts`.

**Bramka jakości (Loop Gate 0):**
`npm run typecheck && npm run lint && npm run build` -> 0 błędów.

---

### Etap 1: Model danych, 16 województw Polski i seed kolekcji
**Profil AI:** `Pro / High` — krytyczna architektura danych, bezpieczeństwo build-time dla Neon i poprawność typów domenowych.

**Zadania:**
- [x] Utworzyć `src/lib/constants/regions.ts` z pełną listą 16 województw Polski (slug, polska nazwa, skrót, współrzędne środka i domyślny zoom).
- [x] Utworzyć `src/types/trail.ts` oraz schematy walidacji Zod w `src/lib/validation/trail.ts` (tworzenie, edycja, parametry filtrowania i sortowania).
- [x] Zaimplementować `src/db/schema.ts` zgodnie z `docs/ARCHITECTURE.md` (enumy `region`, `difficulty`, `surface`, `trail_color`; tabele `trails`, `trail_images`, `trail_pois`; indeksy pod filtrowanie i sortowanie).
- [x] Zaimplementować `src/db/index.ts` z **leniwą inicjalizacją `getDb()`** (bez `Proxy`, bezpieczne dla `next build` bez `DATABASE_URL`) oraz `drizzle.config.ts`.
- [x] Utworzyć helpery `src/lib/utils/slug.ts` i `src/lib/utils/format.ts` (polskie znaki, dystans, czas, przewyższenie).
- [x] Utworzyć warstwę repozytorium `src/lib/trails/repository.ts` z czystym interfejsem zapytań (filtrowanie po województwie, trudności, nawierzchni, dystansie, wyszukiwarce `q`, sortowanie, licznik `regionCounts`) oraz opcjonalnym deterministycznym fallbackiem w pamięci dla lokalnego preview/testów, gdy brak skonfigurowanego `DATABASE_URL` (z wyraźnym flagowaniem, przy pełnym priorytecie dla prawdziwej bazy Neon Postgres, gdy `DATABASE_URL` jest ustawione).
- [x] Przygotować `public/sample-gpx/` oraz skrypt `scripts/seed.ts` zawierający minimum 6 realistycznych polskich szlaków z różnych województw, w tym **przykładowy szlak ze źródłem `https://slaskie.travel/route/1019753`** (województwo śląskie, pełny opis, realistyczny ślad GPX i punkty POI), Wiślaną Trasę Rowerową, Velo Dunajec (Małopolskie), Green Velo (Podlaskie), Szlak Wokół Tatr, Dolnośląską Cyklostradę oraz Pomorską R10.
- [x] Napisać testy jednostkowe: `regions.test.ts`, `slug.test.ts`, `format.test.ts`, `trail.validation.test.ts`.

**Bramka jakości (Loop Gate 1):**
`npm run typecheck && npm run lint && npm run test && npm run build` -> 100% PASS.

---

### Etap 2: Silnik GPX, autoryzacja i kompletne REST API
**Profil AI:** `Pro / High` — algorytmy geodezyjne, bezpieczeństwo SSRF, JWT cookie, integracja Vercel Blob i kontrakty API.

**Zadania:**
- [x] Zaimplementować `src/lib/gpx/parser.ts` oraz `src/lib/gpx/simplify.ts`:
  - Parsowanie `<trkpt>` i `<rtept>` przez `fast-xml-parser`.
  - Obliczanie dystansu (wzór Haversine), skumulowanego dystansu w każdym punkcie, sumy podjazdów (`elevationGainM`), granic mapy (`bounds`), wykrywanie pętli (`isLoop`).
  - Redukcja punktów algorytmem Douglas-Peucker (do max 500 punktów dla szybkiego renderowania na iPhonie).
- [x] Zaimplementować `src/lib/auth/session.ts` (`jose` JWT w ciasteczku `HttpOnly`, `SameSite=Lax`, `Secure` w produkcji) oraz endpointy `/api/auth/login`, `/api/auth/logout`, `/api/auth/session`.
- [x] Zaimplementować endpointy szlaków:
  - `GET /api/trails` (filtrowanie, sortowanie, paginacja, `regionCounts`) i `POST /api/trails` (chroniony sesją).
  - `GET /api/trails/[id]`, `PATCH /api/trails/[id]`, `DELETE /api/trails/[id]` (obsługa wyszukiwania po UUID lub `slug`, mutacje chronione sesją).
- [x] Zaimplementować `POST /api/upload` (Vercel Blob `handleUpload` z autoryzacją sesji i rygorystyczną białą listą typów MIME dla obrazów i `.gpx`).
- [x] Zaimplementować `src/lib/importer/scraper.ts` oraz `POST /api/import-url`:
  - Ochrona SSRF (walidacja protokołu `http/https`, blokada prywatnych adresów IP i `localhost`, timeout 8s).
  - Ekstrakcja OpenGraph, JSON-LD, meta description, zdjęć i ewentualnych linków `.gpx`.
  - Dedykowana heurystyka dla portalu `slaskie.travel` (automatyczne wykrywanie województwa `slaskie`, nazwy źródła `SLASKIE.travel`, pobieranie parametrów trasy ze strony).
- [x] Napisać testy jednostkowe parsera GPX (`GPX-01..06`), importera i SSRF (`IMP-01..02`) oraz testy integracyjne API (`API-01..07`).

**Bramka jakości (Loop Gate 2):**
`npm run typecheck && npm run lint && npm run test && npm run build` -> 100% PASS.

---

### Etap 3: Sportowy Design System *Velo Pulse* i strona główna (Katalog kafelków)
**Profil AI:** `Standard / Medium` — wdrożenie wizualne, responsywne komponenty UI, dostępność i ergonomia iPhone.

**Zadania:**
- [x] Skonfigurować fonty `Barlow Condensed`, `Plus Jakarta Sans`, `JetBrains Mono` (z `latin-ext`) w `src/app/layout.tsx` oraz tokeny kolorystyczne *Velo Pulse* (Light + Dark) w `src/app/globals.css`.
- [x] Skonfigurować metadane PWA (`src/app/manifest.ts`), ikony w `public/icons/` (SVG/PNG 180, 192, 512), `viewport-fit=cover` i obsługę `env(safe-area-inset-bottom)`.
- [x] Zbudować nawigację (`Navbar` z sportowym logo, przełącznikiem motywu, przyciskiem „Dodaj szlak”) i stopkę (`Footer`).
- [x] Zbudować stronę główną (`src/app/page.tsx`):
  - Dynamiczny, sportowy nagłówek Hero (kompaktowy, żeby kafelki i filtry były widoczne od razu nad załamaniem ekranu).
  - Komponent `FilterBar` + `RegionPills` (wszystkie 16 województw + `Cała Polska` z licznikami szlaków, przewijane dotykiem na iPhonie).
  - Filtry dodatkowe: poziom trudności, typ nawierzchni, przedział dystansu oraz wyszukiwarka tekstowa i `SortSelect` (`Najnowsze`, `Najkrótsze`, `Najdłuższe`, `Największe przewyższenie`, `Najłatwiejsze`).
  - Pełna synchronizacja filtrów i sortowania z parametrami URL (`searchParams`) — bookmarkable & shareable!
  - Responsywna siatka kafelków `TrailGrid` (1 kolumna na iPhone, 2 na tablecie, 3 na desktopie) i sportowa karta `TrailCard` ze zdjęciem `16:10`, odznaką regionu, koloru szlaku PTTK, trudności, tytułem, krótkim opisem oraz paskiem telemetrii (`km`, `↑ m`, nawierzchnia).
  - Czytelny stan pusty z przyciskiem „Wyczyść filtry” oraz paginacja / „Pokaż więcej”.
- [x] Napisać testy komponentów (`UI-01`, `UI-02`).

**Bramka jakości (Loop Gate 3):**
`npm run typecheck && npm run lint && npm run test && npm run build` -> 100% PASS.

---

### Etap 4: Widok szczegółów szlaku, centralna mapa Google Maps API i galeria
**Profil AI:** `Pro / High` — integracja `@vis.gl/react-google-maps`, synchronizacja mapy z profilem wysokościowym i UX terenowy iOS.

**Zadania:**
- [x] Zbudować stronę artykułu szlaku `src/app/szlaki/[slug]/page.tsx` z dynamicznym SEO (`generateMetadata`, OpenGraph) i 404 (`notFound()`).
- [x] Nagłówek artykułu z dużym zdjęciem/hero, plakietką regionu, kolorem szlaku, kafelkami telemetrii (Dystans, Przewyższenie, Szacowany czas, Trudność, Nawierzchnia, Pętla/Punkt-Punkt) oraz odnośnikiem do oryginalnego źródła (np. `slaskie.travel/route/1019753`).
- [x] **Centralna sekcja mapy (`TrailMapSection`):**
  - Integracja `@vis.gl/react-google-maps` z renderowaniem `Polyline` (podwójna linia kontrastowa), markerów `START` / `META` oraz punktów `POI`.
  - Pływający panel HUD na mapie: przełącznik typu mapy (`Teren` / `Mapa` / `Satelita`), przycisk `Wyśrodkuj trasę`, tryb pełnoekranowy oraz `gestureHandling="cooperative"` dla wygody przewijania na iPhonie.
  - Elegancki, funkcjonalny `MapFallback` z podglądem wektorowym SVG śladu trasy, gdy brak klucza `NEXT_PUBLIC_GOOGLE_MAPS_API_KEY`.
- [x] **Interaktywny Profil Wysokościowy (`ElevationChart`):**
  - Zsynchronizowany z Google Maps (najechanie/dotknięcie na wykresie pokazuje wysokość i dystans oraz przesuwa znacznik na mapie).
- [x] **Terenowy pasek akcji (`MapActionsBar`):**
  - Przyklejony na dole ekranu na iPhonie (`safe-area-inset-bottom`), inline na desktopie.
  - Przycisk `Nawiguj w Google Maps` (otwierający start trasy w aplikacji Google Maps), przycisk `Pobierz GPX` (pobiera plik lub generuje plik `.gpx` na żywo z zapisanych punktów!), przycisk `Udostępnij` (`navigator.share` na iOS / kopiuj link na desktopie).
- [x] **Treść artykułu i Galeria zdjęć (`TrailGallery` + `PhotoLightbox`):**
  - Renderowanie bogatego opisu Markdown z czytelną typografią editorial.
  - Responsywna galeria zdjęć z pełnoekranowym Lightboxem obsługującym gesty swipe na iPhonie oraz strzałki klawiatury na desktopie.
- [x] Napisać testy komponentów (`UI-03`, `UI-04`).

**Bramka jakości (Loop Gate 4):**
`npm run typecheck && npm run lint && npm run test && npm run build` -> 100% PASS.

---

### Etap 5: Panel właściciela — dodawanie, edycja szlaków i importer z URL
**Profil AI:** `Standard / Medium` — formularze, upload plików do Vercel Blob, komunikacja z API i ochrona sesji.

**Zadania:**
- [x] Zbudować stronę logowania `src/app/logowanie/page.tsx` (wygodna także na iPhonie, `font-size >= 16px`, obsługa komunikatu błędu i przekierowania po zalogowaniu).
- [x] Zbudować formularz `TrailForm` wykorzystywany na `src/app/dodaj/page.tsx` oraz `src/app/szlaki/[slug]/edytuj/page.tsx`:
  - **Karta „Importuj z linku” (`UrlImporterCard`):** Wklejenie adresu np. `https://slaskie.travel/route/1019753` wywołuje `POST /api/import-url` i automatycznie wypełnia tytuł, opis, zdjęcie, region oraz źródło.
  - **Strefa pliku GPX (`GpxDropzone`):** Upload `.gpx` do Vercel Blob + natychmiastowe parsowanie po stronie klienta, automatyczne uzupełnienie dystansu, przewyższenia, współrzędnych i podgląd trasy na mapie przed zapisaniem!
  - **Uploader galerii zdjęć (`ImageUploader`):** Direct upload do Vercel Blob (`@vercel/blob/client`), możliwość dodania wielu zdjęć, ustawienia zdjęcia okładkowego, dodania podpisów i usunięcia zdjęcia (z opcjonalnym wklejeniem zewnętrznego URL zdjęcia).
  - Sekcja dodawania opcjonalnych punktów POI na trasie.
  - Przycisk usuwania szlaku (z modalem potwierdzenia) na stronie edycji.
- [x] Dodać przycisk „Edytuj szlak” na stronie szczegółów szlaku (widoczny wyłącznie dla zalogowanego właściciela).
- [x] Napisać testy komponentu formularza (`UI-05`).

**Bramka jakości (Loop Gate 5):**
`npm run typecheck && npm run lint && npm run test && npm run build` -> 100% PASS.

---

### Etap 6: Kompleksowy zestaw testów E2E (Desktop + iPhone 15) i pętla naprawcza
**Profil AI:** `Pro / High` (diagnoza i poprawki) + `Flash / Low` (generowanie scenariuszy powtarzalnych).

**Zadania:**
- [x] Zaimplementować pełny zestaw testów Playwright w katalogu `e2e/` zgodnie z `docs/TEST_PLAN.md`:
  - `e2e/catalog.spec.ts` (`E2E-01`, `E2E-02`, `E2E-03` — kafelki, filtrowanie województwem Śląskie, sortowanie, wyszukiwanie i stan pusty).
  - `e2e/trail-detail.spec.ts` (`E2E-04` — opis, centralna mapa, link Google Maps, profil wysokościowy, galeria + Lightbox).
  - `e2e/admin-flow.spec.ts` (`E2E-05` — ochrona `/dodaj`, logowanie, dodanie nowego szlaku z plikiem GPX, weryfikacja na liście).
  - `e2e/responsive-pwa.spec.ts` (`E2E-06`, `E2E-07` — brak poziomego scrolla na iPhone 15 `390×844`, wymiary przycisków dotykowych `>= 44px`, widoczny sticky bar, manifest PWA, meta tagi iOS).
- [x] Uruchomić pełną suitę testów na profilach **Desktop Chromium (1440×900)** oraz **iPhone 15 (390×844)**.
- [x] Wykonać pełną pętlę naprawczą dla każdego wykrytego problemu UI, API lub responsywności aż do 100% zielonych testów.

**Bramka jakości (Loop Gate 6):**
`npm run typecheck && npm run lint && npm run test && npm run build && npm run test:e2e` -> 100% PASS (oba profile: Desktop + iPhone).

---

### Etap 7: Finalizacja dokumentacji i gotowość do wdrożenia na Vercel
**Profil AI:** `Flash / Low` — weryfikacja dokumentacji, porządek w repozytorium i checklist wdrożeniowy.

**Zadania:**
- [x] Zweryfikować, że `README.md`, `docs/ARCHITECTURE.md`, `docs/DESIGN_SYSTEM.md`, `docs/TEST_PLAN.md` oraz `.env.example` w 100% odpowiadają finalnemu kodowi.
- [x] Sprawdzić bezpieczeństwo: brak wycieków sekretów w repozytorium, poprawna konfiguracja nagłówków bezpieczeństwa w `vercel.ts` / `next.config.ts`, leniwa inicjalizacja DB.
- [x] Uruchomić finalny pełny zestaw weryfikacyjny (`typecheck`, `lint`, `test`, `build`, `test:e2e`).
- [x] Zaktualizować tablicę statusów w `DEVELOPMENT_PLAN.md` i przygotować krótkie podsumowanie wdrożenia na Vercel (komendy `vercel link`, `vercel integration add neon`, `vercel blob create-store`, konfiguracja klucza Google Maps API i `vercel --prod`).

**Bramka jakości (Loop Gate 7):**
Wszystkie testy zielone, czysty build produkcyjny, kompletna dokumentacja.

---

## 4. Dziennik postępów i blokerów (aktualizowany przez agenta)

| Data | Etap | Status | Wynik testów | Uwagi / Naprawione błędy |
|---|---|---|---|---|
| 2026-11-19 | Etap 0 | Ukończony | `typecheck`, `lint`, `build` PASS | Zainicjalizowano Git (`main` + `origin`), Next.js 16.4.6, React 19.3.1, Tailwind CSS 4.3.5, `vercel.ts`, Vitest 5.1.1, Playwright 1.65.1, szkielet `src/` i `/api/health`. |
| 2026-11-19 | Etap 1 | Ukończony | `typecheck`, `lint`, `test` (5 plików, 18 testów), `build` PASS | Dodano 16 województw (`regions.ts`), typy (`trail.ts`), walidację Zod v4, schemat Drizzle + leniwe `getDb()`, helpery `slug`/`format`, 21 grafik SVG *Velo Pulse*, 2 pliki GPX (`slaskie-1019753.gpx`, `velo-dunajec.gpx`), 7 szlaków seedowych (w tym `slaskie.travel/route/1019753`), `scripts/seed.ts`, repozytorium Neon + in-memory oraz testy Vitest. |
| 2026-11-19 | Etap 2 | Ukończony | `typecheck`, `lint`, `test` (9 plików, 39 testów), `build` PASS | Wdrożono parser GPX + Douglas-Peucker (`simplify.ts`, `parser.ts`, `generateGpxXml`), sesyjną autoryzację JWT (`session.ts`, `/api/auth/*`), pełne CRUD REST API (`/api/trails`, `/api/trails/[id]`), walidację i upload Vercel Blob (`/api/upload`), importer URL z ochroną SSRF i heurystykami `slaskie.travel` (`scraper.ts`, `/api/import-url`) oraz testy `GPX-01..06`, `IMP-01..02`, `API-01..07`. |
| 2026-11-19 | Etap 3 | Ukończony | `typecheck`, `lint`, `test` (11 plików, 46 testów), `build` PASS | Wdrożono Design System *Velo Pulse* (Light/Dark CSS vars + Tailwind v4 `@theme inline`, fonty `Barlow Condensed`, `Plus Jakarta Sans`, `JetBrains Mono`), manifest PWA + ikony (`icon.svg`, `icon-192.png`, `icon-512.png`, `apple-touch-icon.png`), komponenty bazowe UI (`button`, `badge`, `input`, `select`, `card`), layout (`Navbar`, `ThemeToggle`, `Footer`), stronę główną z kompaktowym Hero, `FilterBar` + `RegionPills` (16 województw), `SortSelect`, `TrailCard`, `TrailGrid` oraz testy komponentów `UI-01` i `UI-02`. |
| 2026-11-19 | Etap 4 | Ukończony | `typecheck`, `lint`, `test` (14 plików, 58 testów), `build` PASS | Wdrożono stronę 404 (`not-found.tsx`), stronę artykułu szlaku `src/app/szlaki/[slug]/page.tsx` (`generateMetadata`, Hero, 6 metryk telemetrii, `.trail-prose` Markdown, lista POI, warunkowy przycisk edycji), centralną mapę (`utils.ts`, `MapFallback.tsx`, `TrailGoogleMap.tsx` z `@vis.gl/react-google-maps` i podwójną `Polyline`, `ElevationChart.tsx` z synchronizacją hover/touch, `MapActionsBar.tsx` ze sticky barem iOS + downloadem/generowaniem GPX, `TrailMapSection.tsx` z Floating HUD i trybem pełnoekranowym), galerię (`TrailGallery.tsx`, `PhotoLightbox.tsx` z obsługą klawiatury i gestów swipe) oraz testy `UI-03`, `UI-04` i galerii. |
| 2026-11-19 | Etap 5 | Ukończony | `typecheck`, `lint`, `test` (15 plików, 64 testy), `build` PASS | Wdrożono panel właściciela: walidację przekierowań `sanitizeNextPath` (`redirect.ts`), stronę logowania `src/app/logowanie/page.tsx` + `LoginForm.tsx`, przycisk `LogoutButton.tsx`, chronione strony `src/app/dodaj/page.tsx` i `src/app/szlaki/[slug]/edytuj/page.tsx`, pełny formularz `TrailForm.tsx` (tryby create/edit, walidacja Zod po stronie klienta, sekcja POI, modal potwierdzenia usuwania), `UrlImporterCard.tsx`, `GpxDropzone.tsx` (lokalne parsowanie `parseGpx`, podgląd mapy na żywo i nieblokujący upload Vercel Blob), `ImageUploader.tsx` (upload Blob + URL + gotowe grafiki Velo Pulse) oraz testy `UI-05` (`TrailForm.test.tsx`). |
| 2026-11-19 | Etap 6 | Ukończony | `typecheck`, `lint`, `test` (15 plików, 64 testy), `build`, `test:e2e` (14 testów: 7 Desktop + 7 iPhone 15) PASS | Skonfigurowano `playwright.config.ts` (`desktop-chromium` 1440×900 i `iphone-15` 390×844 z serwerem `next start` na `127.0.0.1:3100` i `workers: 1`), wdrożono `e2e/helpers.ts`, `catalog.spec.ts`, `trail-detail.spec.ts`, `admin-flow.spec.ts` i `responsive-pwa.spec.ts` (`E2E-01..07`). Wykryto i naprawiono w pętli naprawczej: (1) nieprawidłowe XML z nieeskejpowanym `&` w 3 plikach SVG `public/images/trails/slaskie-1019753-*.svg` powodujące `naturalWidth === 0` w przeglądarce (`&` → `&amp;`); (2) niepotrzebne żądania `503` do `/api/upload` przy braku `BLOB_READ_WRITE_TOKEN` (dodano `isBlobTokenConfigured()` przekazywane jako `blobConfigured` z `/dodaj` i `/edytuj` do `TrailForm`/`GpxDropzone`/`ImageUploader`); (3) flagę `Secure` ciasteczka sesji w `session.ts` dostosowaną do protokołu żądania (`shouldUseSecureCookie` dla lokalnego HTTP `next start` vs HTTPS Vercel); (4) cele dotykowe `< 44px` na mobile w `TrailMapSection.tsx` (przełącznik `Teren/Mapa/Satelita`), `FilterBar.tsx` (`Wyczyść filtry`), `MapFallback.tsx` i `Footer.tsx`. |
| 2026-11-19 | Etap 7 | Ukończony | `typecheck` PASS, `lint` PASS, `test` (15 plików / 64 testy) PASS, `build` PASS, `test:e2e` (14/14: 7 Desktop + 7 iPhone 15) PASS | Zaktualizowano `README.md` (rzeczywiste skrypty, tryb lokalny in-memory vs Neon Postgres, konfiguracja Google Maps API z HTTP referrer, pełny checklist Vercel), `docs/ARCHITECTURE.md` (drzewo katalogów z `public/images/trails/`, `tests/api/`, `e2e/`, `ElevationChart` SVG, `image/svg+xml` w `/api/upload`), `docs/DESIGN_SYSTEM.md` (etykiety sortowania zgodne z `SortSelect.tsx`) i `docs/TEST_PLAN.md` (profil `iphone-15`, testy `REP-01`, `UI-06`, `tests/api/`). Audyt bezpieczeństwa potwierdził brak sekretów i `.env.local` w repozytorium, brak `runtime = 'edge'`, brak `Proxy` w `src/db/index.ts` oraz poprawne nagłówki bezpieczeństwa w `vercel.ts` i `next.config.ts`. |
