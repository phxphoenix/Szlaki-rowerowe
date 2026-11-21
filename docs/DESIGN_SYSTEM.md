# Design System — Velo Pulse (Szlaki Rowerowe)

## 1. Wizja wizualna i kierunek artystyczny

**Nazwa motywu:** *Velo Pulse — Alpine Telemetry*  
**Inspiracja:** Nowoczesne aplikacje kolarskie i outdoorowe (Strava, Komoot, Rapha, Garmin Connect) połączone z czystością i ergonomią natywnych aplikacji iOS.

### Kluczowe założenia estetyczne:
1. **Wysoki kontrast w pełnym słońcu:** Aplikacja będzie często używana w terenie na ekranie iPhone'a. Zamiast mdłych pasteli stosujemy matowe, neutralne tła (*Chalk Limestone*), głęboką czerń karbonową (*Deep Carbon*) oraz energetyczny akcent ostrzegawczo-sportowy (*Blaze Orange*).
2. **Telemetria na pierwszym planie:** Dystans (`km`), przewyższenie (`↑ m`), czas przejazdu, typ nawierzchni i kolor szlaku są traktowane jak odczyty z komputerka rowerowego — czytelne w ułamku sekundy dzięki krojowi monospace i wyrównanym cyfrom (`tabular-nums`).
3. **Mapa jako bohater (Map-First Detail View):** Na stronie szczegółów szlaku interaktywna mapa Google Maps z narysowanym śladem GPX oraz zsynchronizowanym profilem wysokościowym znajduje się w centralnym miejscu nad pełnym opisem.
4. **Native iOS Feel:** Obsługa bezpiecznych stref ekranu (Notch / Dynamic Island / Home Indicator), duże cele dotykowe (min. `44×44 px`), płynne przewijanie horyzontalne filtrów województw oraz przyklejony pasek akcji w widoku trasy.

---

## 2. Paleta kolorów (Design Tokens)

Zdefiniowana jako zmienne CSS w `src/app/globals.css` (Tailwind CSS v4 `@theme inline`).

### Tryb jasny (Domyślny — optymalny w terenie)

| Token | Wartość HEX | Zastosowanie |
|---|---|---|
| `--bg-canvas` | `#F5F6F2` | Główne tło aplikacji (matowy wapień, redukuje odblaski) |
| `--bg-surface` | `#FFFFFF` | Karty szlaków, formularze, panele filtrów |
| `--bg-surface-muted` | `#ECEFE9` | Tła pól wejściowych, nieaktywne pigułki filtrów |
| `--bg-carbon` | `#11161A` | Pasek nawigacji (Hero accent), HUD na mapie, stopka |
| `--bg-carbon-elevated` | `#1C242B` | Karty i przyciski na ciemnym tle karbonowym |
| `--border-subtle` | `#DFE4DC` | Subtelne obramowania kart i separatorów |
| `--text-primary` | `#11161A` | Główne tytuły i treść |
| `--text-secondary` | `#4E5D6C` | Opisy skrócone, etykiety, metadane |
| `--text-on-dark` | `#F8FAF7` | Tekst na elementach karbonowych i gradientach zdjęć |
| `--accent-primary` | `#FF4D1C` | **Blaze Orange** — główne CTA, aktywna trasa na mapie, aktywne filtry |
| `--accent-primary-hover` | `#E03E12` | Stan hover/active głównego CTA |
| `--accent-secondary` | `#16A34A` | **Trail Emerald** — szlaki łatwe/rodzinne, zieleń lasu, start trasy |
| `--accent-telemetry` | `#0284C7` | **Sky Telemetry** — wykres wysokości, akcenty dystansu, szlaki wodne |
| `--accent-warning` | `#D97706` | **Amber Gravel** — szlaki średnie, nawierzchnia szutrowa |
| `--accent-danger` | `#E11D48` | **Crimson Peak** — szlaki trudne/górskie, błędy walidacji, akcja usuwania |

### Tryb ciemny (`dark` — opcjonalny przełącznik / `prefers-color-scheme`)

| Token | Wartość HEX | Zastosowanie |
|---|---|---|
| `--bg-canvas` | `#0D1114` | Główne tło |
| `--bg-surface` | `#161C22` | Karty szlaków |
| `--bg-surface-muted` | `#202932` | Filtry i inputy |
| `--border-subtle` | `#293440` | Obramowania |
| `--text-primary` | `#F4F6F3` | Tekst główny |
| `--text-secondary` | `#96A4B2` | Tekst pomocniczy |
| `--accent-primary` | `#FF5E33` | Lekko rozjaśniony Blaze Orange dla kontrastu WCAG AA |

### Kolory oznakowania polskich szlaków rowerowych (PTTK)

| Oznakowanie (`trailColor`) | HEX | Tekst na odznace |
|---|---|---|
| `red` (Czerwony) | `#DC2626` | `#FFFFFF` |
| `blue` (Niebieski) | `#2563EB` | `#FFFFFF` |
| `green` (Zielony) | `#16A34A` | `#FFFFFF` |
| `yellow` (Żółty) | `#EAB308` | `#11161A` |
| `black` (Czarny) | `#18181B` | `#FFFFFF` |
| `none` (Nieoznakowany / Własny) | `#FF4D1C` | `#FFFFFF` |

---

## 3. Typografia

Ładowana przez `next/font/google` z podzbiorem `latin-ext` (pełna obsługa polskich znaków diakrytycznych `ąćęłńóśźż`).

| Rola | Font | Wagi | Zastosowanie |
|---|---|---|---|
| **Display / Sport** | `Barlow Condensed` | `600`, `700`, `800` | Tytuły Hero, tytuły szlaków w nagłówkach, wielkie liczniki statystyk, etykiety sekcji (UPPERCASE, lekkie `tracking-wide`) |
| **Body / Editorial** | `Plus Jakarta Sans` | `400`, `500`, `600`, `700` | Opisy artykułów, kafelki, formularze, nawigacja, filtry |
| **Telemetry / Data** | `JetBrains Mono` | `500`, `600`, `700` | Liczby z jednostkami (`46.2 km`, `↑ 410 m`, `2h 40m`), współrzędne GPS, osie wykresu wysokości (`font-variant-numeric: tabular-nums`) |

### Skala typograficzna:
- **Hero H1:** `clamp(2.25rem, 5vw, 4rem)`, `font-display`, `font-extrabold`, `leading-[0.95]`, uppercase
- **Szlak Detail H1:** `clamp(1.85rem, 3.5vw, 3rem)`, `font-display`, `font-bold`, `leading-[1.05]`
- **Tytuł kafelka:** `1.25rem` (`20px`), `font-sans`, `font-bold`, `leading-snug` (max 2 linie — `line-clamp-2`)
- **Treść artykułu:** `1rem` (`16px`) na mobile, `1.0625rem` (`17px`) na desktop, `leading-relaxed` (`1.7`), max szerokość kolumny `72ch`
- **Telemetria (metryki):** `0.875rem`–`1.125rem`, `font-mono`, `font-semibold`

---

## 4. Układ i responsywność (Desktop + iPhone)

### Breakpointy:
- **iPhone (Mobile-first):** `< 640px` (testowane na `390×844` iPhone 15 / `375×812` iPhone Mini / `430×932` Pro Max)
- **Tablet:** `640px – 1023px` (2 kolumny kafelków)
- **Desktop:** `>= 1024px` (3 kolumny kafelków, kontener max `1280px` z paddingiem `24px–32px`)

### Specyfika iPhone / iOS Safari:
1. **Viewport:** `viewport-fit=cover` w metadanych Next.js + klasy obsługujące `padding-bottom: env(safe-area-inset-bottom)` na dolnym pasku nawigacji/akcji.
2. **Brak auto-zoomu w formularzach iOS:** Wszystkie pola `<input>`, `<select>`, `<textarea>` muszą mieć `font-size >= 16px` na mobile (`text-base`).
3. **Brak poziomego przewijania strony:** `overflow-x: clip` na kontenerach sekcji; paski z filtrami województw mają własne, płynne przewijanie horyzontalne (`overflow-x-auto snap-x no-scrollbar`).
4. **Mapa przyjazna dotykowi:** Google Maps skonfigurowana z `gestureHandling: 'cooperative'` (przewijanie strony jednym palcem nie blokuje się na mapie; mapa reaguje na dwa palce lub po kliknięciu przycisku „Pełny ekran”).
5. **PWA (Add to Home Screen):** Plik `manifest.webmanifest`, `apple-mobile-web-app-capable`, `apple-mobile-web-app-status-bar-style: black-translucent`, dedykowane ikony `192×192`, `512×512`, `180×180` (Apple Touch Icon).

---

## 5. Kluczowe komponenty UI

### A. Kafelek szlaku (`TrailCard`) i miniatura trasy (`RouteMiniMap`)
- **Proporcje zdjęcia:** `aspect-[16/10]`, `rounded-2xl`, `overflow-hidden`, delikatny zoom zdjęcia (`scale-105 duration-500`) na hover (desktop).
- **Kompozycja 4 rogów na zdjęciu (brak nakładania się badge'ów na 390px i 1440px):**
  - **Lewy górny róg:** Plakietka województwa (półprzezroczysty `bg-[#11161A]/80 backdrop-blur-md text-white`) z kropką koloru szlaku PTTK.
  - **Prawy górny róg:** Plakietka poziomu trudności (`Łatwy` / `Średni` / `Trudny`) z semantycznym kolorem.
  - **Lewy dolny róg:** Plakietka szacowanego czasu (`Clock` icon) lub typu nawierzchni.
  - **Prawy dolny róg:** Kompaktowa nakładka miniatury trasy GPX `<RouteMiniMap variant="overlay" />` (`data-testid="trail-card-route-path"`) renderująca rzeczywisty ślad z podwójną linią kontrastową w kolorze szlaku oraz wskaźnikiem startu/mety.
- **Odporność na błędy zdjęć (Graceful Fallback):**
  - Jeśli zdjęcie okładkowe nie załaduje się (`onError`), karta płynnie przełącza się na pełny rzut wektorowy `<RouteMiniMap variant="full" />`, zachowując czytelność i układ kafelka.
- **Część dolna karty:**
  - Tytuł szlaku (max 2 linie).
  - Krótki opis (max 2 linie, kolor `text-secondary`).
  - **Pasek telemetrii (3 kolumny z ikonami Lucide):**
    - Dystans (`Route` icon): np. `45.8 km`
    - Przewyższenie (`TrendingUp` icon): np. `↑ 320 m`
    - Nawierzchnia (`Layers` / `Compass` icon): np. `Asfalt / Szuter`
- **Efekt interakcji:** Na desktopie subtelne podniesienie (`-translate-y-1 shadow-lg`) i pomarańczowa linia akcentowa na dolnej krawędzi.

### B. Pasek filtrowania i sortowania (`FilterBar`)
- **Przyklejany (sticky)** pod głównym nagłówkiem na desktopie i w kompaktowej formie na iPhone.
- **Poziom 1:** Pole wyszukiwania + przełącznik sortowania (`Najnowsze`, `Najkrótsze`, `Najdłuższe`, `Największe przewyższenie`, `Od najłatwiejszych`) + dodatkowe filtry (trudność, nawierzchnia, zakres dystansu).
- **Poziom 2 (Regiony Polski):** Poziomy, przewijalny pasek „pastylek” dla wszystkich 16 województw (+ `Cała Polska`) z opcjonalnym licznikiem dostępnych szlaków w danym regionie (np. `Śląskie (4)`). Aktywne województwo podświetlone kolorem `Blaze Orange`.
- **Synchronizacja z URL:** Wszystkie aktywne filtry i sortowanie zapisywane w query params (`?region=slaskie&difficulty=easy&sort=distance_asc&q=wisla`) — link do przefiltrowanej listy można udostępnić lub odświeżyć bez utraty stanu.

### C. Centralna sekcja mapy (`TrailMapSection`) i akcje terenowe (`MapActionsBar`)
- **Pozycja:** Centralny element widoku szczegółowego szlaku (`/szlaki/[slug]`).
- **Wysokość:** `420px` na iPhone, `560px` na desktopie + tryb pełnoekranowy.
- **Elementy na mapie (Google Maps API):**
  - Wyraźna linia trasy (`Polyline`, grubość `5px`, kolor zgodny z kolorem szlaku lub `#FF4D1C` z białą obwódką dla kontrastu na zdjęciach satelitarnych).
  - Niestandardowe markery `AdvancedMarker`: zielony **START**, flaga w szachownicę **META**, opcjonalne pinezki **POI** (punkty widokowe, parkingi, schroniska).
  - **Floating Map HUD:**
    - Przycisk **Moja pozycja GPS** (`Crosshair` icon, min. `44×44 px`, `aria-pressed`) z geolokalizacją na żywo, pulsującym znacznikiem i wskaźnikiem dokładności.
    - Przełącznik stylów mapy (`Teren` / `Mapa` / `Satelita`) — w trybie `MapFallback` przełącznik stylów jest automatycznie ukrywany.
    - Przycisk `Wyśrodkuj trasę` i `Pełny ekran`.
- **Zintegrowany Profil Wysokościowy (`ElevationChart`):**
  - Bezpośrednio pod mapą (jeśli GPX zawiera dane wysokościowe `<ele>`).
  - Wykres obszarowy w kolorze `Blaze Orange` / `Sky Telemetry` pokazujący profil wzniesień wzdłuż dystansu.
  - Interakcja: najechanie/dotknięcie punktu na wykresie pokazuje wysokość i dystans oraz dynamicznie przesuwa marker podglądu na mapie Google Maps.
- **Pasek akcji terenowych (`MapActionsBar` — Sticky Bottom Bar na iPhone, inline na desktopie):**
  - Główny przycisk (`Blaze Orange`): **Otwórz trasę w Google Maps** — otwiera wyrysowaną całą trasę (z `origin`, `destination` i inteligentnymi `waypoints` w trybie rowerowym).
  - Drugi przycisk: **Dojazd do startu** — wyznacza trasę do punktu startowego szlaku.
  - Warunkowy przycisk: **Mapa 1:1 (My Maps)** — dostępny, gdy trasa posiada link Google My Maps.
  - Przyciski narzędziowe: **Pobierz GPX** (plik z Vercel Blob lub generowany na żywo) oraz **Udostępnij** (`navigator.share` / clipboard).
  - Wszystkie cele dotykowe spełniają normę iOS `min-h-[44px]`.

### D. Galeria zdjęć i komponenty fotograficzne (`TrailGallery`, `PhotoLightbox`, `TrailHeroImage`)
- **Prawdziwe fotografie krajobrazowe:** Wszystkie 7 szlaków posiada po 3 zoptymalizowane fotografie JPEG (1200 px, 72–249 KB) z legalną atrybucją w `ATTRIBUTIONS.md`.
- Siatka miniatur na desktopie + pełnoekranowy **Lightbox** ze wsparciem klawiatury (`←`, `→`, `Esc`) oraz gestów **swipe** na iPhonie.
- Licznik zdjęć (`2 / 6`) i podpisy pod zdjęciami.
- Komponenty `TrailGallery`, `PhotoLightbox` oraz `TrailHeroImage` wyposażone w obsługę zdarzenia `onError`, zabezpieczającą przed przerwaniem renderu przy niedostępności obrazu.

### E. Formularz dodawania / edycji szlaku (`/dodaj`, `/szlaki/[slug]/edytuj`)
- **Sekcja Szybkiego Importu z URL:** Pole do wklejenia linku (np. `https://slaskie.travel/route/1019753`) + przycisk „Pobierz dane ze strony”. Automatycznie uzupełnia metadane ORAZ pobiera i parsuje ślad GPX (`parsedGpx`), natychmiast wyświetlając podgląd geometrii na mapie!
- **Strefa Drag & Drop na plik `.gpx`:** Po wrzuceniu pliku natychmiast parsuje trasę po stronie klienta, pokazuje podgląd na żywo na Google Maps oraz automatycznie wylicza dystans (km) i przewyższenie (m).
- **Upload zdjęć:** Direct upload do Vercel Blob z akceptacją wyłącznie bezpiecznych formatów rastrowych JPG/PNG/WebP (brak SVG), podglądem miniatur i możliwością wyboru zdjęcia okładkowego z prawdziwych presetów.
- **Opcjonalne pole Google My Maps:** Pole `googleMapsEmbedUrl` z walidacją adresu URL.
