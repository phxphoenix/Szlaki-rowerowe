# Szlaki Rowerowe

Aplikacja webowa (Desktop + iPhone / PWA) służąca do gromadzenia, przeglądania i katalogowania najciekawszych szlaków rowerowych w Polsce znalezionych w internecie (np. [slaskie.travel/route/1019753](https://slaskie.travel/route/1019753)).

Każdy szlak prezentowany jest jako bogaty artykuł z opisem, galerią zdjęć, parametrami telemetrycznymi oraz umieszczoną w centralnym miejscu **interaktywną mapą Google Maps** z narysowanym śladem GPX i profilem wysokościowym.

---

## Kluczowe funkcje

- **Katalog kafelkowy:** Przejrzyste karty szlaków na stronie głównej z prawdziwą fotografią krajobrazową (JPEG), miniaturowym podglądem śladu GPX (`RouteMiniMap`), odznaką województwa, poziomem trudności, krótkim opisem i metrykami (`km`, `↑ m`, nawierzchnia).
- **Filtrowanie i sortowanie:**
  - Filtrowanie po wszystkich **16 województwach w Polsce** (szybki pasek „pastylek” dopasowany do kciuka na iPhonie).
  - Filtry trudności, nawierzchni, dystansu oraz wyszukiwarka pełnotekstowa.
  - Sortowanie: *Najnowsze*, *Najkrótsze*, *Najdłuższe*, *Największe przewyższenie*, *Od najłatwiejszych* — z pełną synchronizacją z adresem URL (`searchParams`).
- **Centralna mapa Google Maps + GPX (Priorytet #1):**
  - Rysowanie trasy z pliku `.gpx` na mapie Google Maps (`Teren` / `Mapa` / `Satelita`) z automatycznym podglądem wektorowym SVG (`MapFallback`), gdy klucz Google Maps API nie jest ustawiony.
  - Interaktywny profil wysokościowy (`ElevationChart`) zsynchronizowany z mapą.
  - Pasek akcji terenowych:
    - **Otwórz trasę w Google Maps** — generuje URL z całą trasą (parametry `origin`, `destination` oraz do 9 inteligentnych `waypoints` wyliczanych po skumulowanym dystansie Haversine, z pełną obsługą pętli `isLoop`).
    - **Dojazd do startu** — nawigacja samochodowa bezpośrednio do punktu startowego szlaku.
    - **Mapa 1:1 (My Maps)** — opcjonalne otwarcie dedykowanej mapy Google My Maps, jeśli trasa posiada skonfigurowany link.
    - **Pobierz GPX** (z pliku lub generowany na żywo z punktów trasy) oraz **Udostępnij**.
  - **Moja pozycja GPS** na mapie: geolokalizacja na żywo (`navigator.geolocation.watchPosition`) z pulsującym znacznikiem i wskaźnikiem dokładności.
- **Panel dodawania i edycji szlaków (Wariant B — Full-stack):**
  - Strony `/logowanie`, `/dodaj` oraz `/szlaki/[slug]/edytuj` chronione sesją właściciela (`HttpOnly` JWT cookie) z ochroną brute-force (rate limiter: max 10 prób / 15 min, HTTP 429).
  - **Importer z URL:** wklej link (np. `https://slaskie.travel/route/1019753`), aby automatycznie pobrać metadane ORAZ plik GPX (`parsedGpx`) z podglądem trasy na żywo (z pełną ochroną SSRF, DNS, limitem 5 MB i timeoutem 8s).
  - Wgrywanie plików `.gpx` (parsowanie i podgląd na żywo) oraz galerii zdjęć bezpośrednio do **Vercel Blob** (wyłącznie bezpieczne obrazy rastrowe `image/jpeg`, `image/png`, `image/webp` bez SVG).
- **Sportowa oprawa wizualna *Velo Pulse* & optymalizacja pod iPhone:**
  - Kontrastowa paleta czytelna w pełnym słońcu (tryb jasny i ciemny), techniczna typografia telemetryczna (`Barlow Condensed`, `Plus Jakarta Sans`, `JetBrains Mono`), 21 prawdziwych zdjęć z Wikimedia Commons ([ATTRIBUTIONS.md](./public/images/trails/ATTRIBUTIONS.md)), tryb PWA (`manifest.webmanifest`, ikony `180/192/512`), obsługa iOS Safe Areas i gestów swipe w galerii (`PhotoLightbox`).

---

## Stack technologiczny

- **Frontend & Backend:** Next.js 16 (App Router), React 19, TypeScript (strict)
- **Stylizacja:** Tailwind CSS v4, komponenty UI (`button`, `badge`, `input`, `select`, `card`), Lucide Icons
- **Baza danych:** Neon Postgres (Vercel Marketplace) + Drizzle ORM (`@neondatabase/serverless`) oraz deterministyczny tryb lokalny *in-memory* bez zewnętrznej bazy
- **Pliki i media:** Vercel Blob (`@vercel/blob` — direct client upload zdjęć i plików `.gpx`)
- **Mapy:** Google Maps JavaScript API (`@vis.gl/react-google-maps`) + parser GPX (`fast-xml-parser`) + wykres wysokościowy SVG
- **Walidacja i Auth:** Zod v4 + sesyjny JWT (`jose`, `HttpOnly`, `SameSite=Lax`)
- **Hosting:** Vercel (Node.js 24 LTS, Fluid Compute, `vercel.ts`)
- **Testy:** Vitest, React Testing Library, Playwright (`desktop-chromium` 1440×900 + `iphone-15` 390×844)

---

## Architektura danych: Tryb lokalny in-memory vs Neon Postgres

Aplikacja wspiera dwa tryby pracy warstwy repozytorium (`src/lib/trails/repository.ts`):

1. **Tryb lokalny (in-memory) — brak `DATABASE_URL`:**
   - Jeśli zmienna `DATABASE_URL` nie jest ustawiona, aplikacja automatycznie uruchamia się z deterministycznym magazynem w pamięci zawierającym **7 predefiniowanych polskich szlaków** (w tym przykładowy szlak ze źródłem `https://slaskie.travel/route/1019753`, Velo Dunajec, Green Velo, Szlak Orlich Gniazd, Żelazny Szlak Rowerowy, Velo Baltica oraz Dolinę Baryczy) wraz z 21 prawdziwymi fotografiami JPEG i śladami GPX.
   - Zapytania `listTrails()` korzystają ze zoptymalizowanego, lekkiego rzutu miniatur tras `routePreviewPoints` (<= 48 punktów) i nie wczytują zbędnego pola `content`.
   - Tryb ten pozwala na natychmiastowe uruchomienie aplikacji lokalnie oraz wykonywanie testów E2E bez zewnętrznej bazy danych.
2. **Tryb produkcyjny (Neon Postgres) — ustawione `DATABASE_URL`:**
   - Gdy `DATABASE_URL` jest skonfigurowane, połączenie inicjowane jest leniwie przez `getDb()` w `src/db/index.ts` (bez `Proxy`, bezpieczne dla `next build`), a wszystkie operacje CRUD, filtrowanie i liczniki `regionCounts` wykonywane są bezpośrednio w bazie PostgreSQL (Neon + Drizzle ORM) z atomowymi operacjami `db.batch`.
   - Skrypt `scripts/bootstrap-db.ts` wywoływany w procesie budowania produkcyjnego używa bezpiecznego `seedDatabase({ force: false })` (`onConflictDoNothing`), dzięki czemu nie nadpisuje i nie usuwa danych użytkowników wprowadzonych w aplikacji.

---

## Dokumentacja projektu

| Dokument | Opis |
|---|---|
| [DEVELOPMENT_PLAN.md](./DEVELOPMENT_PLAN.md) | Kompletny plan realizacji (Etapy 0–7), dobór modeli AI na każdy etap, checklisty i dziennik postępów |
| [REFACTORING_PLAN.md](./REFACTORING_PLAN.md) | Plan i wdrożenie refaktoryzacji R1–R6: pełne trasy Google Maps (waypoints), miniatury GPX na kafelkach, 21 zdjęć JPEG, ochrona DB, bezpieczeństwo uploadu i rate-limit |
| [MASTER_PROMPT.md](./MASTER_PROMPT.md) | Gotowy prompt do automatycznego wykonania całego planu w pętli test–poprawka |
| [docs/ARCHITECTURE.md](./docs/ARCHITECTURE.md) | Architektura systemu, schemat PostgreSQL (Drizzle), kontrakty API, integracja Google Maps i zmienne środowiskowe |
| [docs/DESIGN_SYSTEM.md](./docs/DESIGN_SYSTEM.md) | Sportowy design system *Velo Pulse*, paleta kolorów, typografia, specyfikacja komponentów i zasady UX dla iPhone |
| [docs/TEST_PLAN.md](./docs/TEST_PLAN.md) | Strategia testów, macierz przypadków (unit, komponenty, API, E2E Desktop + iPhone) i protokół pętli naprawczej |
| [public/images/trails/ATTRIBUTIONS.md](./public/images/trails/ATTRIBUTIONS.md) | Źródła, autorzy i licencje (CC-BY / CC-BY-SA / CC0) dla 21 fotografii szlaków |

---

## Szybki start

### 1. Instalacja i konfiguracja zmiennych środowiskowych
```bash
npm install
cp .env.example .env.local
```

> Na Windows PowerShell zamiast `cp` możesz użyć `Copy-Item .env.example .env.local`, a komendy `npm` uruchamiaj jako `npm` lub `npm.cmd`.

Uzupełnij w `.env.local` (dla pracy z zewnętrznymi usługami; do uruchomienia samego podglądu lokalnego w trybie in-memory wystarczy `ADMIN_PASSWORD` i `SESSION_SECRET`):
- `DATABASE_URL` — połączenie z Neon Postgres (opcjonalne lokalnie — bez niego działa tryb in-memory; lub `vercel env pull .env.local` po podłączeniu Vercel).
- `BLOB_READ_WRITE_TOKEN` — token Vercel Blob do uploadu zdjęć i plików `.gpx`.
- `NEXT_PUBLIC_GOOGLE_MAPS_API_KEY` — klucz z Google Cloud Console (włączone wyłącznie **Maps JavaScript API**).
- `NEXT_PUBLIC_GOOGLE_MAPS_MAP_ID` — opcjonalny Map ID dla `AdvancedMarker`.
- `ADMIN_PASSWORD` oraz `SESSION_SECRET` (min. 32 znaki) — dane dostępowe do panelu dodawania i edycji szlaków.
- `NEXT_PUBLIC_APP_URL` — adres bazowy aplikacji (domyślnie `http://localhost:3000`).

### 2. Migracja i seed bazy danych (gdy używasz Neon Postgres)
```bash
npm run db:push
npm run db:seed
```
> Domyślnie `db:seed` (oraz automatyczny `scripts/bootstrap-db.ts` podczas deploymentu na Vercel) działa bezpiecznie (`force: false` / `onConflictDoNothing`), nie usuwając ani nie modyfikując istniejących szlaków. Aby wymusić nadpisanie tras referencyjnych, uruchom: `npm run db:seed -- --force`.  
*(Opcjonalnie `npm run db:generate` generuje pliki migracji Drizzle SQL w katalogu `drizzle/`).*

### 3. Uruchomienie lokalne
```bash
npm run dev
```

### 4. Uruchomienie pełnej weryfikacji i testów
```bash
npm run typecheck
npm run lint
npm run test
npm run build
npm run test:e2e
```
Dodatkowo dostępne są `npm run test:watch` (tryb watch Vitest) oraz `npm run start` (serwer produkcyjny po `npm run build`).

---

## Konfiguracja Google Maps API (bezpieczeństwo klucza)

Ponieważ `NEXT_PUBLIC_GOOGLE_MAPS_API_KEY` jest używany po stronie przeglądarki, przed wdrożeniem produkcyjnym ogranicz klucz w **Google Cloud Console → APIs & Services → Credentials**:
1. **Application restrictions → Websites (HTTP referrers):**
   - `https://*.vercel.app/*`
   - `https://twoja-domena.pl/*` (jeśli używasz własnej domeny)
   - `http://localhost:3000/*` (opcjonalnie na czas rozwoju lokalnego)
2. **API restrictions → Restrict key:**
   - Zaznacz wyłącznie **Maps JavaScript API**.

---

## Checklist wdrożenia na Vercel

1. Połącz projekt z Vercel i podepnij bazę Neon Postgres oraz magazyn Vercel Blob:
   ```bash
   vercel link
   vercel integration add neon
   vercel blob create-store szlaki-rowerowe-media --access public
   ```
2. Pobierz zmienne środowiskowe do lokalnego pliku i wykonaj migrację oraz seed bazy produkcyjnej:
   ```bash
   vercel env pull .env.local
   npm run db:push
   npm run db:seed
   ```
3. Skonfiguruj pozostałe zmienne środowiskowe w ustawieniach projektu Vercel (Production & Preview):
   - `NEXT_PUBLIC_GOOGLE_MAPS_API_KEY` (z ograniczeniem HTTP referrer i API restriction opisanymi wyżej)
   - `NEXT_PUBLIC_GOOGLE_MAPS_MAP_ID` (opcjonalnie)
   - `ADMIN_PASSWORD` (silne hasło właściciela)
   - `SESSION_SECRET` (losowy ciąg min. 32 znaków do podpisywania JWT)
   - `NEXT_PUBLIC_APP_URL` (docelowy adres HTTPS aplikacji, np. `https://szlaki-rowerowe.vercel.app`)
4. Uruchom wdrożenie produkcyjne:
   ```bash
   vercel --prod
   ```
