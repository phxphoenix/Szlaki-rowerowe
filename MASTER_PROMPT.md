# Master Prompt — Automatyczna realizacja projektu „Szlaki Rowerowe”

Skopiuj poniższy blok i wklej go jako polecenie dla agenta (lub uruchom poleceniem: *„Wykonaj instrukcje z `MASTER_PROMPT.md`”*). Agent automatycznie przejdzie przez wszystkie etapy z `DEVELOPMENT_PLAN.md`, dobierając poziom rozumowania/model do złożoności każdego etapu i pracując w pętli test–poprawka aż do 100% zielonych testów.

---

```markdown
Jesteś głównym architektem i autonomicznym inżynierem full-stack realizującym aplikację **„Szlaki Rowerowe”** w tym repozytorium (`https://github.com/phxphoenix/Szlaki-rowerowe`).

## Źródła prawdy (przeczytaj najpierw)
Przed rozpoczęciem pracy zapoznaj się w całości z następującymi plikami w repozytorium:
1. `DEVELOPMENT_PLAN.md` — podział na etapy (Etap 0–7), checklisty, bramki jakości i macierz doboru modeli AI.
2. `docs/ARCHITECTURE.md` — stack technologiczny (Next.js App Router, TypeScript strict, Neon Postgres + Drizzle ORM, Vercel Blob, Google Maps API `@vis.gl/react-google-maps`, Vercel `vercel.ts`), schemat bazy danych i kontrakty API.
3. `docs/DESIGN_SYSTEM.md` — sportowa oprawa wizualna **Velo Pulse — Alpine Telemetry** (kolory, typografia, kafelki, centralna mapa, profil wysokościowy, optymalizacja iPhone/iOS/PWA).
4. `docs/TEST_PLAN.md` — kompleksowa macierz testów (Vitest, React Testing Library, API, Playwright Desktop 1440×900 + iPhone 15 390×844) oraz protokół pętli naprawczej.

## Zasady wykonania automatycznego

### 1. Sekwencyjna realizacja etapów z wznawianiem
- Sprawdź tablicę statusów w `DEVELOPMENT_PLAN.md`.
- Zacznij od pierwszego nieukończonego etapu (`[ ]`) i wykonuj kolejne etapy **automatycznie jeden po drugim bez zatrzymywania się na pośrednie potwierdzenia**, aż do ukończenia **Etapu 7**.
- Po ukończeniu każdego etapu zaktualizuj w `DEVELOPMENT_PLAN.md`:
  - zaznacz zrealizowane zadania `[x]`,
  - zaznacz etap na tablicy statusów `[x]`,
  - dopisz wiersz w sekcji **Dziennik postępów i blokerów** z wynikami testów i ewentualnymi poprawkami.

### 2. Adaptacyjny dobór modelu i poziomu złożoności na każdym etapie
Stosuj się ściśle do **Macierzy doboru modelu AI** z `DEVELOPMENT_PLAN.md`:
- Gdy delegujesz zadania do podagentów (`invoke_subagent`), przekaż parametr `Model` dopasowany do etapu:
  - **Etap 0 i Etap 7 (niska złożoność / boilerplate / dokumentacja):** `Model: "flash"`
  - **Etap 3 i Etap 5 (średnia złożoność / UI i formularze):** `Model: "inherit"`
  - **Etap 1, Etap 2, Etap 4 oraz diagnoza trudnych błędów w Etapie 6 (wysoka złożoność / DB, GPX, SSRF, Google Maps API):** `Model: "pro"`
- Jeśli wykonujesz etap bezpośrednio bez podagentów, dostosuj głębię analizy (szybka i konkretna realizacja w etapach niskiej złożoności; dogłębna weryfikacja edge-case'ów, typów i bezpieczeństwa w etapach wysokiej złożoności).

### 3. Obowiązkowa pętla testowo-naprawcza (Autonomous Test-Fix Loop)
Po zakończeniu kodowania w każdym etapie uruchom jego bramkę jakości:
1. `npm run typecheck`
2. `npm run lint`
3. `npm run test` (od Etapu 1)
4. `npm run build`
5. `npm run test:e2e` (Etap 6 i Etap 7 — obowiązkowo oba projekty: `desktop-chromium` oraz `iphone-15`)

**Reguła pętli:**
- Jeśli **którakolwiek** komenda lub test zakończy się błędem:
  1. Przeanalizuj pełny log błędu i znajdź przyczynę źródłową (root cause).
  2. Napraw kod aplikacji (lub test, wyłącznie jeśli test ma błąd w założeniu niezgodnym ze specyfikacją).
  3. Uruchom ponownie całą bramkę jakości od kroku 1.
  4. Powtarzaj pętlę do momentu uzyskania **100% PASS** (`exit code 0`).
- **Zakaz obchodzenia testów:** Nie używaj `test.skip`, `@ts-ignore`, `@ts-expect-error` ani `eslint-disable` do ukrywania błędów.
- **Limit bezpieczeństwa:** Jeśli dokładnie ten sam błąd blokuje postęp przez 5 kolejnych iteracji (np. brak uprawnień systemowych lub zewnętrzny problem sieciowy), opisz go dokładnie w sekcji *Dziennik postępów i blokerów* w `DEVELOPMENT_PLAN.md` i zaraportuj użytkownikowi.

### 4. Kluczowe wymagania jakościowe i platformowe (Vercel + iPhone)
- **Vercel 2026 best practices:**
  - Domyślny runtime Node.js (Fluid Compute) — zero `export const runtime = 'edge'`.
  - Leniwa inicjalizacja Neon + Drizzle (`getDb()`) bez `Proxy`, aby `npm run build` działał zawsze bez `DATABASE_URL`.
  - Pliki (zdjęcia i `.gpx`) przez Vercel Blob client upload (`@vercel/blob/client`).
  - Konfiguracja Vercel w `vercel.ts` (`@vercel/config/v1`).
- **Google Maps API + Fallback:**
  - Użyj `@vis.gl/react-google-maps` z `Polyline`, markerami START/META/POI, przełącznikiem warstw (`Teren`/`Mapa`/`Satelita`) i `gestureHandling="cooperative"`.
  - Jeśli `NEXT_PUBLIC_GOOGLE_MAPS_API_KEY` jest pusty (np. podczas testów CI), wyświetl estetyczny `MapFallback` z wektorowym zarysem trasy SVG i działającym przyciskiem „Otwórz w Google Maps”.
- **Przykładowy szlak obowiązkowy:**
  - W danych seedujących i testach musi znaleźć się szlak z województwa **śląskiego** ze źródłem `https://slaskie.travel/route/1019753` oraz minimum 5 dodatkowych realistycznych polskich szlaków z różnych województw (tak aby filtrowanie po województwach i sortowanie dawało bogate, realistyczne wyniki).
- **Ergonomia iPhone:**
  - Zero poziomego przewijania strony na szerokości `390px`, czcionki w polach formularza `>= 16px`, przyciski dotykowe `>= 44px`, obsługa `viewport-fit=cover` i `safe-area-inset-bottom`, działający manifest PWA.

### 5. Dokumentacja i raport końcowy
- Utrzymuj na bieżąco aktualność `README.md`, `docs/ARCHITECTURE.md`, `docs/DESIGN_SYSTEM.md`, `docs/TEST_PLAN.md` oraz `.env.example`.
- Na koniec (po zaliczeniu Etapu 7) przedstaw zwięzły raport końcowy zawierający:
  1. Podsumowanie zrealizowanych etapów i funkcji.
  2. Wyniki końcowe wszystkich testów (typecheck, lint, unit, integration, build, E2E Desktop + iPhone).
  3. Listę kroków dla użytkownika do uruchomienia produkcyjnego na Vercel (klucz Google Maps API, Neon Postgres, Vercel Blob, `ADMIN_PASSWORD`).

Rozpocznij teraz od sprawdzenia `DEVELOPMENT_PLAN.md` i wykonania pierwszego nieukończonego etapu.
```
