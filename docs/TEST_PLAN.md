# Strategia i Plan Testów — Szlaki Rowerowe

## 1. Cel i filozofia testowania

Każdy etap developmentu podlega automatycznej **pętli weryfikacyjno-naprawczej (Test → Diagnose → Fix → Retest)**. Żaden etap nie może zostać oznaczony jako ukończony (`[x]`), dopóki wszystkie przypisane do niego bramki jakościowe nie zakończą się sukcesem (`exit code 0`).

### Piramida testów:
1. **Analiza statyczna (Gate 0):** `tsc --noEmit` (strict TypeScript) + `npm run lint` (ESLint) + `npm run build` (weryfikacja pełnego buildu produkcyjnego Next.js).
2. **Testy jednostkowe — Vitest (`src/**/*.test.ts`):** Logika biznesowa, parser GPX, obliczenia geodezyjne, walidacja Zod, generowanie slugów, importer URL, formatowanie.
3. **Testy komponentów — Vitest + React Testing Library (`src/**/*.test.tsx`):** Interakcje UI, renderowanie kafelków, filtrów województw, formularza, obsługa stanów pustych i błędów mapy.
4. **Testy integracyjne API — Vitest (`tests/api/**/*.test.ts`):** Endpointy `/api/trails`, `/api/auth/*`, `/api/upload`, `/api/import-url` z mockowaną lub testową bazą danych (weryfikacja statusów 200/201/400/401/404).
5. **Testy End-to-End — Playwright (`e2e/**/*.spec.ts`):** Rzeczywista przeglądarka na dwóch obowiązkowych profilach:
   - **Desktop Chromium:** `1440 × 900`
   - **Mobile iPhone 15 (Chromium z emulacją dotyku i viewportem iPhone 15):** `390 × 844`, `deviceScaleFactor: 3`, `isMobile: true`, `hasTouch: true`

---

## 2. Szczegółowa macierz przypadków testowych

### A. Testy jednostkowe — Parser GPX i geometria (`src/lib/gpx/parser.test.ts`)
| ID | Scenariusz | Oczekiwany rezultat |
|---|---|---|
| `GPX-01` | Poprawny plik GPX z wieloma punktami `<trkpt>` i wysokościami `<ele>` | Poprawnie obliczony dystans (Haversine, tolerancja ±2%), dodatnie przewyższenie (`elevationGainM`), poprawne współrzędne `start`/`end` i `bounds` |
| `GPX-02` | Plik GPX z dużą liczbą punktów (np. 5000 pkt) | Funkcja upraszczająca (Douglas-Peucker) redukuje liczbę punktów do ≤ 500 przy zachowaniu punktu startu, mety i kształtu trasy |
| `GPX-03` | Plik GPX bez tagów `<ele>` (brak wysokości) | Parser nie rzuca błędu, zwraca `elevationGainM = 0` i `hasElevation = false` |
| `GPX-04` | Plik GPX ze ścieżką w `<rtept>` (trasa zamiast śladu) | Obsługa zarówno `<trkpt>`, jak i `<rtept>` |
| `GPX-05` | Uszkodzony XML lub plik bez współrzędnych | Rzuca czytelny, kontrolowany błąd walidacji (bez crashu serwera) |
| `GPX-06` | Wykrywanie pętli (`isLoop`) | Jeśli dystans między startem a metą < 300 m, `isLoop` zwraca `true` |

### B. Testy jednostkowe — Walidacja, Regiony, Formatowanie, Importer (`src/lib/**/*.test.ts`)
| ID | Scenariusz | Oczekiwany rezultat |
|---|---|---|
| `REG-01` | Lista województw Polski (`regions.ts`) | Dokładnie 16 unikalnych województw z poprawnymi polskimi nazwami, slugami i współrzędnymi centrum |
| `SLG-01` | Generowanie sluga z polskimi znakami | `"Żelazny Szlak Rowerowy — Śląsk!"` → `"zelazny-szlak-rowerowy-slask"` |
| `VAL-01` | Walidacja schematu `createTrailSchema` (Zod) | Odrzuca ujemny dystans, pusty tytuł, nieistniejące województwo, niepoprawny URL źródłowy |
| `VAL-02` | Walidacja parametrów zapytań `trailQuerySchema` | Bezpieczne domyślne wartości przy błędnych/brakujących parametrach `page`, `limit`, `sort` |
| `FMT-01` | Formatowanie metryk (`formatDistance`, `formatDuration`, `formatElevation`) | `45.83` → `"45,8 km"`, `135` min → `"2h 15m"`, `320` → `"↑ 320 m"` |
| `IMP-01` | Ekstrakcja metadanych z przykładowego HTML (`slaskie.travel`-like i generyczny OG) | Zwraca `title`, `shortDescription`, `coverImageUrl`, wykrywa potencjalny link `.gpx` i sugeruje region `slaskie` dla domeny `slaskie.travel` |
| `IMP-02` | Ochrona SSRF w importerze URL | Odrzuca `http://localhost`, `http://127.0.0.1`, `http://169.254.169.254`, `file://` |
| `REP-01` | Warstwa repozytorium (`src/lib/trails/repository.ts`) | Filtrowanie, sortowanie, paginacja, `regionCounts` i CRUD w trybie lokalnym *in-memory* |

### C. Testy komponentów UI (`src/components/**/*.test.tsx`)
| ID | Scenariusz | Oczekiwany rezultat |
|---|---|---|
| `UI-01` | Renderowanie `TrailCard` | Wyświetla zdjęcie okładkowe, plakietkę województwa, poziom trudności, tytuł, krótki opis, dystans, przewyższenie oraz link do `/szlaki/[slug]` |
| `UI-02` | `RegionPills` i `FilterBar` | Kliknięcie województwa „Śląskie” aktualizuje stan/parametr URL `region=slaskie`; zmiana sortowania aktualizuje `sort=...` |
| `UI-03` | `TrailGoogleMap` (tryb z kluczem i fallback bez klucza) | Gdy brak klucza API, renderuje czytelny fallback SVG z kształtem trasy i linkiem „Otwórz w Google Maps” (bez wyjątku JS) |
| `UI-04` | `ElevationChart` | Renderuje profil wysokościowy gdy punkty mają `ele`, wywołuje callback `onHoverPoint` po interakcji; ukrywa się elegancko przy braku danych wysokościowych |
| `UI-05` | `TrailForm` | Walidacja pól wymaganych przed wysłaniem, wyświetlenie komunikatów błędów po polsku |
| `UI-06` | `TrailGallery` & `PhotoLightbox` | Miniatury galerii, otwieranie Lightboxa, nawigacja klawiaturą i zamykanie |

### D. Testy integracyjne API (`tests/api/trails.test.ts`, `tests/api/auth-upload.test.ts`)
| ID | Scenariusz | Oczekiwany rezultat |
|---|---|---|
| `API-01` | `GET /api/trails` bez parametrów | HTTP `200`, lista opublikowanych szlaków, `regionCounts` i metadane paginacji |
| `API-02` | `GET /api/trails?region=slaskie&sort=distance_desc` | Zwraca wyłącznie szlaki ze Śląskiego posortowane malejąco po dystansie |
| `API-03` | `POST /api/trails` bez sesji autoryzacyjnej | HTTP `401 Unauthorized` |
| `API-04` | `POST /api/trails` z poprawną sesją i poprawnym payloadem | HTTP `201 Created`, zwraca utworzony obiekt z wygenerowanym `slug` |
| `API-05` | `POST /api/trails` z błędnymi danymi | HTTP `400 Bad Request` ze szczegółami błędów Zod |
| `API-06` | `POST /api/auth/login` (błędne vs poprawne hasło) | `401` dla błędnego hasła; `200` + `Set-Cookie` z `HttpOnly` dla poprawnego |
| `API-07` | `POST /api/upload` (walidacja MIME) | Odrzuca niedozwolone typy plików (np. `.exe`, `.html`) |

### E. Testy End-to-End — Playwright (`e2e/**/*.spec.ts`)
Uruchamiane na **Desktop (1440×900)** ORAZ **iPhone 15 (390×844)**:

| ID | Scenariusz | Asercje |
|---|---|---|
| `E2E-01` | Strona główna — ładowanie i kafelki | Widoczny nagłówek, pasek regionów, lista kafelków z tytułami, zdjęciami i opisami; brak błędów konsoli i sieciowych `5xx` |
| `E2E-02` | Filtrowanie po województwie (`Śląskie`) i sortowanie | Po kliknięciu `Śląskie` widoczne są wyłącznie szlaki śląskie (w tym przykładowy szlak ze `slaskie.travel/route/1019753`), URL zawiera `region=slaskie`; zmiana sortowania zmienia kolejność kafelków |
| `E2E-03` | Wyszukiwarka tekstowa i stan pusty | Wpisanie nieistniejącej frazy wyświetla czytelny stan pusty z przyciskiem „Wyczyść filtry”, który przywraca listę |
| `E2E-04` | Widok szczegółów szlaku (artykuł + centralna mapa + galeria) | Kliknięcie kafelka przenosi na `/szlaki/[slug]`; widoczny opis, sekcja mapy Google Maps (lub fallback z trasą), przycisk „Otwórz w Google Maps”, link źródłowy, galeria zdjęć (otwieranie/zamykanie Lightboxa) |
| `E2E-05` | Pełny przepływ autoryzacji i dodania nowego szlaku | Wejście na `/dodaj` przekierowuje do `/logowanie`; po zalogowaniu dodanie nowego szlaku z formularza (z wgraniem testowego pliku GPX) tworzy szlak i wyświetla go na stronie głównej |
| `E2E-06` | Audyt responsywności iPhone (`390×844`) | `document.documentElement.scrollWidth <= window.innerWidth` (brak poziomego przepełnienia strony na `/`, `/szlaki/[slug]`, `/dodaj`), przyciski CTA mają wysokość `>= 44px`, widoczny dolny pasek akcji w widoku szlaku |
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
