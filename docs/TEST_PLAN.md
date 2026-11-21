# Strategia i Plan Testów — Szlaki Rowerowe

## 1. Cel i filozofia testowania

Każdy etap developmentu podlega automatycznej **pętli weryfikacyjno-naprawczej (Test → Diagnose → Fix → Retest)**. Żaden etap nie może zostać oznaczony jako ukończony (`[x]`), dopóki wszystkie przypisane do niego bramki jakościowe nie zakończą się sukcesem (`exit code 0`).

### Piramida testów:
1. **Analiza statyczna (Gate 0):** `tsc --noEmit` (strict TypeScript) + `npm run lint` (ESLint) + `npm run build` (weryfikacja pełnego buildu produkcyjnego Next.js Turbopack).
2. **Testy jednostkowe — Vitest (`src/**/*.test.ts`):** Logika biznesowa, parser GPX, obliczenia geodezyjne Haversine, Douglas-Peucker, walidacja Zod, generowanie slugów, importer URL z auto-GPX, generator Google Maps `waypoints`, rate-limit logowania, formatowanie.
3. **Testy komponentów — Vitest + React Testing Library (`src/**/*.test.tsx`):** Interakcje UI, miniatury tras `RouteMiniMap` i kafelki `TrailCard`, `FilterBar`, formularz `TrailForm` z polem My Maps i `parsedGpx`, galeria zdjęć z fallbackiem `onError`, obsługa stanów pustych i `MapFallback`.
4. **Testy integracyjne API — Vitest (`tests/api/**/*.test.ts`):** Endpointy `/api/trails`, `/api/auth/*` (w tym rate limiting), `/api/upload` (blokada SVG), `/api/import-url` z mockowaną lub testową bazą danych.
   - *Aktualny stan testów Vitest:* **15 plików testowych / 96 testów (100% PASS)**.
5. **Testy End-to-End — Playwright (`e2e/**/*.spec.ts`):** Rzeczywista przeglądarka na dwóch profilach (łącznie **14 testów: 7 Desktop + 7 iPhone 15**, 100% PASS):
   - **Desktop Chromium:** `1440 × 900`
   - **Mobile iPhone 15 (Chromium z emulacją dotyku i viewportem iPhone 15):** `390 × 844`, `deviceScaleFactor: 3`, `isMobile: true`, `hasTouch: true`

---

## 2. Szczegółowa macierz przypadków testowych

### A. Testy jednostkowe — Parser GPX i geometria (`src/lib/gpx/parser.test.ts`, `src/components/map/utils.test.ts`)
| ID | Scenariusz | Oczekiwany rezultat |
|---|---|---|
| `GPX-01` | Poprawny plik GPX z wieloma punktami `<trkpt>` i wysokościami `<ele>` | Poprawnie obliczony dystans (Haversine, tolerancja ±2%), dodatnie przewyższenie (`elevationGainM`), poprawne współrzędne `start`/`end` i `bounds` |
| `GPX-02` | Plik GPX z dużą liczbą punktów (np. 5000 pkt) | Funkcja upraszczająca (Douglas-Peucker) redukuje liczbę punktów do ≤ 500 przy zachowaniu punktu startu, mety i kształtu trasy |
| `GPX-03` | Plik GPX bez tagów `<ele>` (brak wysokości) | Parser nie rzuca błędu, zwraca `elevationGainM = 0` i `hasElevation = false` |
| `GPX-04` | Plik GPX ze ścieżką w `<rtept>` (trasa zamiast śladu) | Obsługa zarówno `<trkpt>`, jak i `<rtept>` |
| `GPX-05` | Uszkodzony XML lub plik bez współrzędnych | Rzuca czytelny, kontrolowany błąd walidacji (bez crashu serwera) |
| `GPX-06` | Wykrywanie pętli (`isLoop`) | Jeśli dystans między startem a metą < 300 m, `isLoop` zwraca `true` |
| `MAP-01` | Ekstrakcja kluczowych punktów trasy (`extractKeyRouteWaypoints`) | Zwraca 3–9 punktów po skumulowanym dystansie; dla pętli `isLoop: true` pomija punkty < 200 m od startu i zapobiega zwinięciu trasy |
| `MAP-02` | Generowanie linków Google Maps (`buildGoogleMapsRouteUrl`, `buildGoogleMapsStartNavigationUrl`) | Pełna trasa zawiera `origin`, `destination`, `waypoints`, `travelmode=bicycling` (URL < 2000 zn.); dojazd do startu zawiera wyłącznie `destination=<START>` |

### B. Testy jednostkowe — Walidacja, Regiony, Formatowanie, Importer, Auth (`src/lib/**/*.test.ts`)
| ID | Scenariusz | Oczekiwany rezultat |
|---|---|---|
| `REG-01` | Lista województw Polski (`regions.ts`) | Dokładnie 16 unikalnych województw z poprawnymi polskimi nazwami, slugami i współrzędnymi centrum |
| `SLG-01` | Generowanie sluga z polskimi znakami | `"Żelazny Szlak Rowerowy — Śląsk!"` → `"zelazny-szlak-rowerowy-slask"` |
| `VAL-01` | Walidacja schematu `createTrailSchema` (Zod) | Odrzuca ujemny dystans, pusty tytuł, nieistniejące województwo, niepoprawny URL źródłowy |
| `VAL-02` | Walidacja parametrów zapytań `trailQuerySchema` | Bezpieczne domyślne wartości przy błędnych/brakujących parametrach `page`, `limit`, `sort` |
| `FMT-01` | Formatowanie metryk (`formatDistance`, `formatDuration`, `formatElevation`) | `45.83` → `"45,8 km"`, `135` min → `"2h 15m"`, `320` → `"↑ 320 m"` |
| `IMP-01` | Ekstrakcja metadanych z przykładowego HTML (`slaskie.travel`-like i generyczny OG) | Zwraca `title`, `shortDescription`, `coverImageUrl`, sugeruje region `slaskie` dla domeny `slaskie.travel` |
| `IMP-02` | Ochrona SSRF w importerze URL | Odrzuca `http://localhost`, `http://127.0.0.1`, `http://169.254.169.254`, `file://` |
| `IMP-03` | Automatyczne pobieranie i parsowanie GPX w importerze URL | Wykrywa link `.gpx`, bezpiecznie pobiera (timeout 8s, max 5 MB) i zwraca `parsedGpx` z geometrią i telemetrią |
| `AUT-01` | Sliding-window rate limiter logowania (`rate-limit.ts`) | Rejestruje nieudane próby per IP; po przekroczeniu progu (10 prób / 15 min) blokuje żądania z nagłówkiem `Retry-After`; `resetLoginRateLimit` resetuje stan |
| `REP-01` | Warstwa repozytorium (`src/lib/trails/repository.ts`) | Filtrowanie, sortowanie, paginacja, `regionCounts`, jawny select `routePreviewPoints` i CRUD w trybie *in-memory* oraz Neon |

### C. Testy komponentów UI (`src/components/**/*.test.tsx`)
| ID | Scenariusz | Oczekiwany rezultat |
|---|---|---|
| `UI-01` | Renderowanie `TrailCard` | Wyświetla prawdziwe zdjęcie okładkowe JPEG, plakietkę województwa, poziom trudności, tytuł, opis, metryki oraz nakładkę `RouteMiniMap` |
| `UI-02` | `RegionPills` i `FilterBar` | Kliknięcie województwa „Śląskie” aktualizuje parametr URL `region=slaskie`; zmiana sortowania aktualizuje `sort=...` |
| `UI-03` | `TrailGoogleMap` (tryb z kluczem i fallback bez klucza) | Gdy brak klucza API, renderuje czytelny fallback SVG z kształtem trasy i ukrytym przełącznikiem warstw Teren/Mapa/Satelita |
| `UI-04` | `ElevationChart` | Renderuje profil wysokościowy gdy punkty mają `ele`, wywołuje callback `onHoverPoint` po interakcji; ukrywa się elegancko przy braku danych wysokościowych |
| `UI-05` | `TrailForm` | Obsługa importu URL z auto-wypełnieniem `parsedGpx`, opcjonalne pole Google My Maps, walidacja Zod przed wysłaniem |
| `UI-06` | `TrailGallery` & `PhotoLightbox` | Miniatury galerii JPEG, otwieranie Lightboxa, obsługa zdarzenia `onError`, nawigacja klawiaturą i gestami swipe |
| `UI-07` | Miniatury tras `RouteMiniMap` | Rzutowanie współrzędnych GPX na SVG (`data-testid="trail-card-route-path"`), unikalne ścieżki dla różnych tras, fallback `variant="full"` na błąd zdjęcia |

### D. Testy integracyjne API (`tests/api/trails.test.ts`, `tests/api/auth-upload.test.ts`)
| ID | Scenariusz | Oczekiwany rezultat |
|---|---|---|
| `API-01` | `GET /api/trails` bez parametrów | HTTP `200`, lista opublikowanych szlaków z `routePreviewPoints`, `regionCounts` i metadane paginacji |
| `API-02` | `GET /api/trails?region=slaskie&sort=distance_desc` | Zwraca wyłącznie szlaki ze Śląskiego posortowane malejąco po dystansie |
| `API-03` | `POST /api/trails` bez sesji autoryzacyjnej | HTTP `401 Unauthorized` |
| `API-04` | `POST /api/trails` z poprawną sesją i poprawnym payloadem | HTTP `201 Created`, zwraca utworzony obiekt z wygenerowanym `slug` (atomowy `db.batch`) |
| `API-05` | `POST /api/trails` z błędnymi danymi | HTTP `400 Bad Request` ze szczegółami błędów Zod |
| `API-06` | `POST /api/auth/login` (błędne hasło, rate limiter, poprawne hasło) | `401` dla błędnego hasła; po 10 próbach `429 Too Many Requests`; `200` + `Set-Cookie` z `HttpOnly` dla poprawnego |
| `API-07` | `POST /api/upload` (walidacja MIME) | Akceptuje `image/jpeg`, `image/png`, `image/webp` i GPX; odrzuca `image/svg+xml` (HTTP `400`) oraz pliki niedozwolone |

### E. Testy End-to-End — Playwright (`e2e/**/*.spec.ts`)
Uruchamiane na **Desktop (1440×900)** ORAZ **iPhone 15 (390×844)** (14 testów, 100% PASS):

| ID | Scenariusz | Asercje |
|---|---|---|
| `E2E-01` | Strona główna — ładowanie, kafelki, miniatury GPX i zdjęcia | Widoczne karty szlaków; każda karta posiada `data-testid="trail-card-route-path"`, różne szlaki mają różne wartości atrybutu `d` (unikalne miniatury tras); wszystkie obrazy to pliki rastrowe (`naturalWidth > 0`, brak `.svg`) |
| `E2E-02` | Filtrowanie po województwie (`Śląskie`) i sortowanie | Po kliknięciu `Śląskie` widoczne są wyłącznie szlaki śląskie (w tym szlak ze `slaskie.travel/route/1019753`), URL zawiera `region=slaskie`; zmiana sortowania zmienia kolejność kafelków |
| `E2E-03` | Wyszukiwarka tekstowa i stan pusty | Wpisanie nieistniejącej frazy wyświetla czytelny stan pusty z przyciskiem „Wyczyść filtry”, który przywraca listę |
| `E2E-04` | Widok szczegółów szlaku (artykuł + centralna mapa + galeria) | Przycisk „Otwórz trasę w Google Maps” zawiera `origin=`, `destination=`, `waypoints=` (min. 3 punkty) oraz `travelmode=bicycling`; obecny przycisk „Dojazd do startu”; w trybie fallback ukryty przełącznik warstw Teren/Mapa/Satelita; zdjęcia w galerii to prawdziwe obrazy rastrowe (`naturalWidth > 0`) |
| `E2E-05` | Pełny przepływ autoryzacji i dodania nowego szlaku | Wejście na `/dodaj` przekierowuje do `/logowanie`; po zalogowaniu dodanie nowego szlaku z formularza (z wgraniem pliku GPX i presetem okładki JPEG `/images/trails/velo-dunajec-cover.jpg`) tworzy szlak z widoczną miniaturą trasy `trail-card-route-path` na stronie głównej |
| `E2E-06` | Audyt responsywności iPhone (`390×844`) | `document.documentElement.scrollWidth <= window.innerWidth` (brak poziomego scrolla na `/`, `/szlaki/[slug]`, `/dodaj`); cele dotykowe `>= 44px` dla wszystkich przycisków w tym `MapActionsBar` („Dojazd do startu”) i HUD („Moja pozycja”) |
| `E2E-07` | Weryfikacja PWA i SEO | `/manifest.webmanifest` zwraca HTTP `200` z poprawnym JSON (`name`, `icons`, `display: "standalone"`), meta tag `viewport` zawiera `viewport-fit=cover` |

---

## 3. Protokół pętli naprawczej (Autonomous Test-Fix Loop)

Po każdym etapie rozwoju wykonywana jest sekwencja:

```text
[Kod Etapu N]
     │
     ▼
1. npm run typecheck  ──(FAIL)──▶ Analiza błędów TS ──▶ Poprawka ──┐
     │ (PASS)                                                      │
     ▼                                                             │
2. npm run lint       ──(FAIL)──▶ Analiza ESLint ────▶ Poprawka ───┤
     │ (PASS)                                                      │
     ▼                                                             │
3. npm run test       ──(FAIL)──▶ Diagnoza root cause ▶ Poprawka ──┤
     │ (PASS)                                                      │
     ▼                                                             │
4. npm run build      ──(FAIL)──▶ Naprawa buildu SSR ─▶ Poprawka ──┤
     │ (PASS)                                                      │
     ▼                                                             │
5. npm run test:e2e   ──(FAIL)──▶ Inspekcja trace/DOM ▶ Poprawka ──┘
   (Etapy 5-7)
     │ (PASS)
     ▼
[Etap N ZALICZONY -> Aktualizacja DEVELOPMENT_PLAN.md -> Następny Etap]
```

### Zasady bezpieczeństwa pętli:
- **Nigdy nie obchodź testów** (zakaz `test.skip`, zakaz wyłączania reguł TS przez `@ts-ignore` / `any`, zakaz obniżania asercji, aby ukryć błąd).
- **Maksymalna liczba iteracji na jeden błąd:** 5 prób. Jeśli po 5 próbach ten sam problem nadal występuje (np. brak zmiennej środowiskowej lub zewnętrzny problem sieciowy), agent musi odnotować dokładną przyczynę w `DEVELOPMENT_PLAN.md` (sekcja *Blokery*) i zaraportować ją użytkownikowi.
- **Testy E2E bez płatnego klucza Google Maps / zewnętrznej bazy w CI:** Skrypt testowy musi wspierać uruchomienie z testowym/lokalnym trybem bazy lub mockiem warstwy repozytorium dla E2E tylko wtedy, gdy `DATABASE_URL` nie jest ustawiony w środowisku lokalnym; gdy `DATABASE_URL` jest dostępny, testy weryfikują pełny przepływ z prawdziwą bazą Postgres.
