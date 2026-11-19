import {
  BALTICA_GEOMETRY,
  BARYCZ_GEOMETRY,
  DUNAJEC_GEOMETRY,
  ORLE_GEOMETRY,
  PODLASIE_GEOMETRY,
  POGORIA_GEOMETRY,
  ZELAZNY_GEOMETRY,
  type SeedRouteGeometry,
} from "@/lib/trails/seed-routes";
import type { Trail, TrailImage, TrailPoi } from "@/types/trail";

interface SeedTrailSpec {
  id: string;
  slug: string;
  title: string;
  shortDescription: string;
  content: string;
  region: Trail["region"];
  subregion: string;
  difficulty: Trail["difficulty"];
  surface: Trail["surface"];
  trailColor: Trail["trailColor"];
  estimatedTimeMin: number;
  isLoop: boolean;
  coverImageUrl: string;
  sourceUrl: string | null;
  sourceName: string | null;
  gpxUrl: string | null;
  geometry: SeedRouteGeometry;
  createdAt: string;
  images: Array<{
    id: string;
    url: string;
    caption: string;
  }>;
  pois: Array<{
    id: string;
    name: string;
    category: TrailPoi["category"];
    description: string;
    lat: number;
    lng: number;
  }>;
}

const SEED_SPECS: readonly SeedTrailSpec[] = [
  {
    id: "11111111-1111-4111-8111-000000000001",
    slug: "pogoria-iii-pogoria-iv-i-park-zielona-petla-slaskie",
    title: "Pogoria III, Pogoria IV i Park Zielona — Pętla Rodzinna",
    shortDescription:
      "Bezpieczna, asfaltowa pętla wokół jezior Pojezierza Dąbrowskiego ze startem przy molo Pogorii III, przejazdem przez Park Zielona i tamę Kuźnicy Warężyńskiej.",
    content: `## Charakterystyka trasy

Jedna z najprzyjemniejszych rekreacyjnych pętli w województwie śląskim, idealna zarówno na rodzinny wyjazd z dziećmi lub przyczepką, jak i lekki trening szosowy czy gravelowy. Znakomita większość trasy prowadzi **wydzielonymi drogami rowerowymi o gładkiej nawierzchni asfaltowej**, odseparowanymi od ruchu samochodowego.

### Przebieg pętli

1. **Start przy molo nad Pogorią III (Dąbrowa Górnicza):** Wygodny parking, wypożyczalnia rowerów i szeroka promenada nad wodą.
2. **Park Zielona:** Płaski, zacieniony odcinek wśród starych drzew nad Czarną Przemszą — świetne miejsce na przerwę przy placu zabaw i strefie wypoczynku.
3. **Przejazd na Pogorię IV (Kuźnica Warężyńska):** Bezkolizyjny przejazd prowadzi wzdłuż największego zbiornika Pojezierza Dąbrowskiego, skąd przy dobrej widoczności widać kominy Jury i Beskidy na horyzoncie.
4. **Korona zapory i powrót:** Malownicza asfaltowa aleja wzdłuż wschodniego brzegu domyka pętlę z powrotem nad Pogorię III.

### Wskazówki praktyczne

- W słoneczne weekendy na odcinku promenady Pogorii III bywa tłoczno — warto wyruszyć rano.
- Na całej długości pętli znajdują się ławki, punkty gastronomiczne oraz Miejsca Obsługi Rowerzystów (MOR).`,
    region: "slaskie",
    subregion: "Zagłębie Dąbrowskie — Pojezierze Dąbrowskie",
    difficulty: "easy",
    surface: "asphalt",
    trailColor: "blue",
    estimatedTimeMin: 80,
    isLoop: true,
    coverImageUrl: "/images/trails/slaskie-1019753-cover.svg",
    sourceUrl: "https://slaskie.travel/route/1019753",
    sourceName: "SLASKIE.travel",
    gpxUrl: "/sample-gpx/slaskie-1019753.gpx",
    geometry: POGORIA_GEOMETRY,
    createdAt: "2026-11-18T10:00:00.000Z",
    images: [
      {
        id: "21111111-1111-4111-8111-000000000101",
        url: "/images/trails/slaskie-1019753-cover.svg",
        caption: "Panorama jezior Pogoria III i IV w Dąbrowie Górniczej",
      },
      {
        id: "21111111-1111-4111-8111-000000000102",
        url: "/images/trails/slaskie-1019753-1.svg",
        caption: "Wydzielona asfaltowa ścieżka rowerowa wzdłuż brzegu Pogorii IV",
      },
      {
        id: "21111111-1111-4111-8111-000000000103",
        url: "/images/trails/slaskie-1019753-2.svg",
        caption: "Zacieniona aleja przez Park Zielona nad Czarną Przemszą",
      },
    ],
    pois: [
      {
        id: "31111111-1111-4111-8111-000000000101",
        name: "Molo i plaża Pogoria III",
        category: "parking",
        description: "Punkt startowy pętli z dużym parkingiem, toaletami i strefą gastronomii.",
        lat: 50.3514,
        lng: 19.1995,
      },
      {
        id: "31111111-1111-4111-8111-000000000102",
        name: "Park Zielona",
        category: "food",
        description: "Historyczny park miejski z alejami rowerowymi, placem zabaw i kawiarniami.",
        lat: 50.3415,
        lng: 19.1865,
      },
      {
        id: "31111111-1111-4111-8111-000000000103",
        name: "Zapora Pogoria IV (Kuźnica Warężyńska)",
        category: "viewpoint",
        description: "Szeroki punkt widokowy na największy zbiornik Pojezierza Dąbrowskiego.",
        lat: 50.3712,
        lng: 19.2185,
      },
    ],
  },
  {
    id: "11111111-1111-4111-8111-000000000002",
    slug: "zelazny-szlak-rowerowy-jastrzebie-zebrzydowice",
    title: "Żelazny Szlak Rowerowy",
    shortDescription:
      "Transgraniczna pętla po dawnych nasypach kolejowych między Jastrzębiem-Zdrojem, Godowem, Zebrzydowicami i czeską Karwiną.",
    content: `## Szlakiem dawnych linii kolejowych

**Żelazny Szlak Rowerowy** to flagowa trasa rekreacyjna południowej części województwa śląskiego. Poprowadzona w dużej mierze po zlikwidowanych torowiskach kolei wąskotorowych i normalnotorowych, zachwyca łagodnymi podjazdami, brakiem stromych ścian oraz znakomitą infrastrukturą postojową.

### Główne atrakcje na trasie

- **Park Zdrojowy w Jastrzębiu-Zdroju** z inhalatorium i drewnianą architekturą uzdrowiskową.
- **Dolina Olzy i Piotrówki** — spokojne odcinki wśród pól i łęgów na polsko-czeskim pograniczu.
- **Zamek w Zebrzydowicach** nad stawem Młyńszczok — idealny punkt na obiad i uzupełnienie bidonów.

### Nawierzchnia i sprzęt

Ponad 85% pętli to równy asfalt i drobny tłuczeń kolejowy — trasa świetnie sprawdza się na rowerze trekkingowym, crossowym i gravelowym.`,
    region: "slaskie",
    subregion: "Ziemia Jastrzębska i Pogranicze Polsko-Czeskie",
    difficulty: "easy",
    surface: "asphalt",
    trailColor: "red",
    estimatedTimeMin: 185,
    isLoop: true,
    coverImageUrl: "/images/trails/zelazny-szlak-cover.svg",
    sourceUrl: "https://zelaznyszlak.pl",
    sourceName: "Żelazny Szlak",
    gpxUrl: null,
    geometry: ZELAZNY_GEOMETRY,
    createdAt: "2026-11-17T14:30:00.000Z",
    images: [
      {
        id: "21111111-1111-4111-8111-000000000201",
        url: "/images/trails/zelazny-szlak-cover.svg",
        caption: "Dawny nasyp kolejowy zamieniony w asfaltową drogę rowerową",
      },
      {
        id: "21111111-1111-4111-8111-000000000202",
        url: "/images/trails/zelazny-szlak-1.svg",
        caption: "Miejsce Obsługi Rowerzystów w klimacie dawnej stacyjki",
      },
      {
        id: "21111111-1111-4111-8111-000000000203",
        url: "/images/trails/zelazny-szlak-2.svg",
        caption: "Leśny wiadukt na pograniczu polsko-czeskim",
      },
    ],
    pois: [
      {
        id: "31111111-1111-4111-8111-000000000201",
        name: "Park Zdrojowy w Jastrzębiu-Zdroju",
        category: "monument",
        description: "Zabytkowy zespół uzdrowiskowy z Domem Zdrojowym i punktem startowym szlaku.",
        lat: 49.9478,
        lng: 18.5985,
      },
      {
        id: "31111111-1111-4111-8111-000000000202",
        name: "Zamek w Zebrzydowicach",
        category: "food",
        description: "Odrestaurowany pałac nad stawem, przystań kajakowa i restauracja.",
        lat: 49.8825,
        lng: 18.618,
      },
    ],
  },
  {
    id: "11111111-1111-4111-8111-000000000003",
    slug: "velo-dunajec-przelom-dunajca-czorsztyn-stary-sacz",
    title: "Velo Dunajec — Przełom Dunajca (Czorsztyn – Stary Sącz)",
    shortDescription:
      "Spektakularny odcinek Velo Dunajec z widokiem na Trzy Korony i Sokolice, prowadzący Drogą Pienińską ze Sromowiec przez Szczawnicę aż do Starego Sącza.",
    content: `## Najpiękniejszy rzeczny szlak w Polsce

**Velo Dunajec** między Jeziorem Czorsztyńskim a Starym Sączem łączy wysokogórską scenerię Pienin z płynną, komfortową jazdą wzdłuż biegu rzeki. Odcinek z Sromowiec Niżnych przez **Drogę Pienińską** pod wapiennymi ścianami Trzech Koron to absolutny klasyk polskiego kolarstwa turystycznego.

### Etapy trasy

- **Czorsztyn / Niedzica – Sromowce:** Zjazd spod zamku w Niedzicy z panoramą Pienińskiego Parku Narodowego.
- **Droga Pienińska (Sromowce – Szczawnica):** Szutrowo-kamienny odcinek bezpośrednio nad przełomem Dunajca — uwaga na pieszych turystów w sezonie!
- **Szczawnica – Krościenko – Stary Sącz:** Szybki, nowoczesny asfalt poprowadzony doliną rzeki, z licznymi kładkami rowerowymi i miejscami postojowymi.`,
    region: "malopolskie",
    subregion: "Pieniny i Kotlina Sądecka",
    difficulty: "moderate",
    surface: "mixed",
    trailColor: "blue",
    estimatedTimeMin: 165,
    isLoop: false,
    coverImageUrl: "/images/trails/velo-dunajec-cover.svg",
    sourceUrl: "https://narowery.visitmalopolska.pl",
    sourceName: "VeloMałopolska",
    gpxUrl: "/sample-gpx/velo-dunajec.gpx",
    geometry: DUNAJEC_GEOMETRY,
    createdAt: "2026-11-16T09:15:00.000Z",
    images: [
      {
        id: "21111111-1111-4111-8111-000000000301",
        url: "/images/trails/velo-dunajec-cover.svg",
        caption: "Przełom Dunajca widziany z Drogi Pienińskiej",
      },
      {
        id: "21111111-1111-4111-8111-000000000302",
        url: "/images/trails/velo-dunajec-1.svg",
        caption: "Wapienne turnie Trzech Koron nad nurtem rzeki",
      },
      {
        id: "21111111-1111-4111-8111-000000000303",
        url: "/images/trails/velo-dunajec-2.svg",
        caption: "Nowoczesna kładka rowerowa w dolinie Dunajca",
      },
    ],
    pois: [
      {
        id: "31111111-1111-4111-8111-000000000301",
        name: "Zamek w Niedzicy i zapora",
        category: "monument",
        description: "Średniowieczna warownia nad Jeziorem Czorsztyńskim i punkt widokowy.",
        lat: 49.4355,
        lng: 20.2895,
      },
      {
        id: "31111111-1111-4111-8111-000000000302",
        name: "Czerwony Klasztor / Kładka w Sromowcach",
        category: "viewpoint",
        description: "Przejście na słowacką stronę i wjazd na słynną Drogę Pienińską.",
        lat: 49.3948,
        lng: 20.411,
      },
      {
        id: "31111111-1111-4111-8111-000000000303",
        name: "Promenada nad Grajcarkiem w Szczawnicy",
        category: "bike_service",
        description: "Stacja naprawcza, wypożyczalnie oraz bogata oferta gastronomiczna.",
        lat: 49.4208,
        lng: 20.464,
      },
    ],
  },
  {
    id: "11111111-1111-4111-8111-000000000004",
    slug: "rowerowy-szlak-orlich-gniazd-jura",
    title: "Rowerowy Szlak Orlich Gniazd",
    shortDescription:
      "Wymagająca wyprawa MTB i gravel przez Jurę Krakowsko-Częstochowską, łącząca warowne zamki w Olsztynie, Mirowie, Bobolicach, Ogrodzieńcu i Rabsztynie.",
    content: `## Królewski klasyk Jury Krakowsko-Częstochowskiej

Czerwony **Rowerowy Szlak Orlich Gniazd** to propozycja dla osób szukających prawdziwych wrażeń terenowych: piaszczystych duktów leśnych, wapiennych kamienistych podjazdów oraz krótkich, ale treściwych interwałów pod średniowiecznymi zamkami.

### Co czeka po drodze?

- **Zamek w Olsztynie k. Częstochowy** — rozległe ruiny z panoramą wzgórz Sokolich Gór.
- **Złoty Potok i Rezerwat Parkowe** — chłodne lasy bukowe i stawy pstrągowe.
- **Grzęda Mirowsko-Bobolicka** — najbardziej fotogeniczny odcinek szlaku łączący dwa bliźniacze zamki.
- **Góra Zborów i Zamek Ogrodzieniec** — najwyższe wapienne ostańce Jury z największym przewyższeniem na trasie.

### Rekomendowany rower

Zalecamy rower **MTB (hardtail/full)** lub **gravel z oponą min. 42–45 mm** na niższym ciśnieniu ze względu na odcinki głębszego jurajskiego piasku i wapiennych korzeni.`,
    region: "slaskie",
    subregion: "Jura Krakowsko-Częstochowska",
    difficulty: "hard",
    surface: "offroad",
    trailColor: "red",
    estimatedTimeMin: 360,
    isLoop: false,
    coverImageUrl: "/images/trails/orle-gniazda-cover.svg",
    sourceUrl: "https://www.orlegniazda.pl",
    sourceName: "Szlak Orlich Gniazd",
    gpxUrl: null,
    geometry: ORLE_GEOMETRY,
    createdAt: "2026-11-15T11:20:00.000Z",
    images: [
      {
        id: "21111111-1111-4111-8111-000000000401",
        url: "/images/trails/orle-gniazda-cover.svg",
        caption: "Wapienne ostańce i ruiny warowni na Szlaku Orlich Gniazd",
      },
      {
        id: "21111111-1111-4111-8111-000000000402",
        url: "/images/trails/orle-gniazda-1.svg",
        caption: "Terenowy singletrack pod Grzędą Mirowsko-Bobolicką",
      },
      {
        id: "21111111-1111-4111-8111-000000000403",
        url: "/images/trails/orle-gniazda-2.svg",
        caption: "Podjazd pod Zamek Ogrodzieniec na Górze Janowskiego",
      },
    ],
    pois: [
      {
        id: "31111111-1111-4111-8111-000000000401",
        name: "Zamek w Olsztynie",
        category: "monument",
        description: "Ruiny XIV-wiecznej warowni królewskiej na wapiennym wzgórzu.",
        lat: 50.7495,
        lng: 19.272,
      },
      {
        id: "31111111-1111-4111-8111-000000000402",
        name: "Grzęda Mirowsko-Bobolicka",
        category: "viewpoint",
        description: "Malowniczy pas skałek łączący zamki w Mirowie i Bobolicach.",
        lat: 50.6148,
        lng: 19.473,
      },
      {
        id: "31111111-1111-4111-8111-000000000403",
        name: "Zamek Ogrodzieniec (Podzamcze)",
        category: "monument",
        description: "Największa warownia Jury na najwyższym wzniesieniu Wyżyny Krakowsko-Częstochowskiej.",
        lat: 50.4535,
        lng: 19.5528,
      },
    ],
  },
  {
    id: "11111111-1111-4111-8111-000000000005",
    slug: "green-velo-podlaski-szlak-bociani-narwia-biebrza",
    title: "Green Velo — Podlaski Szlak Bociani",
    shortDescription:
      "Spokojna szutrowo-asfaltowa trasa przez Krainę Rozlewisk Narwi i Biebrzy — z Białegostoku przez Tykocin i Bocianią Wioskę Pentowo do Twierdzy Osowiec.",
    content: `## Dzika przyroda Podlasia z perspektywy siodełka

Podlaski odcinek **Wschodniego Szlaku Rowerowego Green Velo** w połączeniu z Podlaskim Szlakiem Bocianim to jedna z najbardziej klimatycznych tras nizinnych w kraju. Minimalny ruch aut, zapach łąk i rozległe panoramy bagiennych dolin Narwi oraz Biebrzy pozwalają całkowicie oderwać się od miejskiego zgiełku.

### Najważniejsze punkty

- **Choroszcz i Kurowo:** Siedziba Narwiańskiego Parku Narodowego z kładkami edukacyjnymi nad rozlewiskami.
- **Tykocin:** Perła podlaskiego baroku z zamkiem Zygmunta Augusta i Wielką Synagogą.
- **Pentowo — Europejska Wioska Bociania:** Kilkadziesiąt gniazd na terenie starego dworu i wieże obserwacyjne.
- **Osowiec-Twierdza:** Historyczne fortyfikacje XIX-wiecznej twierdzy carskiej w sercu Biebrzańskiego PN.`,
    region: "podlaskie",
    subregion: "Dolina Narwi i Biebrzy",
    difficulty: "easy",
    surface: "gravel",
    trailColor: "green",
    estimatedTimeMin: 220,
    isLoop: false,
    coverImageUrl: "/images/trails/green-velo-podlasie-cover.svg",
    sourceUrl: "https://greenvelo.pl",
    sourceName: "Green Velo",
    gpxUrl: null,
    geometry: PODLASIE_GEOMETRY,
    createdAt: "2026-11-14T08:00:00.000Z",
    images: [
      {
        id: "21111111-1111-4111-8111-000000000501",
        url: "/images/trails/green-velo-podlasie-cover.svg",
        caption: "Rozlewiska Narwi i Biebrzy o poranku",
      },
      {
        id: "21111111-1111-4111-8111-000000000502",
        url: "/images/trails/green-velo-podlasie-1.svg",
        caption: "Szutrowy odcinek w okolicach Tykocina i Pentowa",
      },
      {
        id: "21111111-1111-4111-8111-000000000503",
        url: "/images/trails/green-velo-podlasie-2.svg",
        caption: "Drewniana kładka i wieża widokowa w Biebrzańskim PN",
      },
    ],
    pois: [
      {
        id: "31111111-1111-4111-8111-000000000501",
        name: "Kurowo — Narwiański Park Narodowy",
        category: "viewpoint",
        description: "Ośrodek edukacyjny parku i kładki na bagnach Narwi.",
        lat: 53.168,
        lng: 22.845,
      },
      {
        id: "31111111-1111-4111-8111-000000000502",
        name: "Rynek i Zamek w Tykocinie",
        category: "monument",
        description: "Historyczne miasteczko z brukowanym rynkiem i zamkiem nad Narwią.",
        lat: 53.204,
        lng: 22.771,
      },
      {
        id: "31111111-1111-4111-8111-000000000503",
        name: "Twierdza Osowiec",
        category: "bike_service",
        description: "MOR Green Velo, stacja PKP oraz wejście na szlaki Biebrzańskiego PN.",
        lat: 53.472,
        lng: 22.634,
      },
    ],
  },
  {
    id: "11111111-1111-4111-8111-000000000006",
    slug: "dolnoslaska-cyklostrada-dolina-baryczy",
    title: "Dolnośląska Cyklostrada — Dolina Baryczy",
    shortDescription:
      "Płaska, komfortowa pętla śladem dawnej kolejki wąskotorowej przez największy w Europie kompleks Stawów Milickich między Miliczem a Żmigrodem.",
    content: `## Kraina Stawów Milickich na dwóch kółkach

**Trasa Rowerowa Doliny Baryczy** (element sieci Dolnośląskiej Cyklostrady) biegnie w dużej części po dawnym torowisku kolejki wąskotorowej łączącej Milicz, Sułów i Żmigród. Płaski profil, szeroki asfalt i wszechobecna woda czynią z niej jedną z najlepszych tras całodniowych na Dolnym Śląsku.

### Co warto zobaczyć

- **Kompleks Stawów Milickich (Ruda Sułowska i Grabownica):** Rezerwat ornitologiczny z czatowniami do obserwacji żurawi, bielików i czapli.
- **Zespół Pałacowo-Parkowy w Żmigrodzie:** Ruiny zamku oraz odrestaurowana baszta z punktem widokowym.
- **Kolorowe Stacje Kolejki Wąskotorowej:** Stylowe wiaty odpoczynkowe w miejscu dawnych przystanków kolejowych.`,
    region: "dolnoslaskie",
    subregion: "Dolina Baryczy",
    difficulty: "easy",
    surface: "asphalt",
    trailColor: "blue",
    estimatedTimeMin: 170,
    isLoop: true,
    coverImageUrl: "/images/trails/dolina-baryczy-cover.svg",
    sourceUrl: "https://dolnyslaskrowerem.pl",
    sourceName: "Dolny Śląsk Rowerem",
    gpxUrl: null,
    geometry: BARYCZ_GEOMETRY,
    createdAt: "2026-11-13T15:45:00.000Z",
    images: [
      {
        id: "21111111-1111-4111-8111-000000000601",
        url: "/images/trails/dolina-baryczy-cover.svg",
        caption: "Grobla rowerowa między Stawami Milickimi",
      },
      {
        id: "21111111-1111-4111-8111-000000000602",
        url: "/images/trails/dolina-baryczy-1.svg",
        caption: "Asfaltowy szlak dawnej kolejki wąskotorowej",
      },
      {
        id: "21111111-1111-4111-8111-000000000603",
        url: "/images/trails/dolina-baryczy-2.svg",
        caption: "Wieża ornitologiczna w rezerwacie Stawy Milickie",
      },
    ],
    pois: [
      {
        id: "31111111-1111-4111-8111-000000000601",
        name: "Dawna stacja kolejki w Miliczu",
        category: "parking",
        description: "Punkt startowy z tablicami informacyjnymi i wiatą turystyczną.",
        lat: 51.528,
        lng: 17.2715,
      },
      {
        id: "31111111-1111-4111-8111-000000000602",
        name: "Zespół Pałacowo-Parkowy w Żmigrodzie",
        category: "monument",
        description: "Zabytkowa baszta widokowa i park angielski.",
        lat: 51.4715,
        lng: 16.955,
      },
      {
        id: "31111111-1111-4111-8111-000000000603",
        name: "Centrum Edukacji Przyrodniczej Ruda Sułowska",
        category: "food",
        description: "Restauracja z karpiem milickim i ścieżka dydaktyczna po groblach.",
        lat: 51.531,
        lng: 17.075,
      },
    ],
  },
  {
    id: "11111111-1111-4111-8111-000000000007",
    slug: "velo-baltica-r10-wybrzeze-slowinskie-ustka-leba",
    title: "Velo Baltica (EuroVelo 10 / R10) — Wybrzeże Środkowe",
    shortDescription:
      "Nadmorski klasyk Pomorza między Ustką, Rowami, skansenem w Klukach i Łebą, prowadzący przez nadmorskie bory, klify i okolice Słowińskiego Parku Narodowego.",
    content: `## Bałtycka przygoda wzdłuż Słowińskiego Parku Narodowego

Odcinek **Velo Baltica (R10 / EuroVelo 10)** z Ustki do Łeby i latarni Stilo to prawdziwa gratka dla miłośników nadmorskiego klimatu. Choć profil jest łagodny, charakterystyczne leśne drogi, odcinki płyt betonowych oraz zmienny nadmorski wiatr nadają trasie sportowego charakteru.

### Główne etapy

- **Ustka – Orzechowo – Rowy:** Przejazd nadmorskimi klifami i ścieżką w borze bażynowym z pięknym punktem widokowym na wydmach w Orzechowie.
- **Słowiński Park Narodowy (Gardna Wielka – Kluki):** Droga wzdłuż brzegów jezior Gardno i Łebsko oraz wizyta w Muzeum Wsi Słowińskiej w Klukach.
- **Łeba – Sasino / Stilo:** Nadmorskie wydmy i leśne trakty prowadzące ku jednej z najpiękniejszych latarni morskich na polskim wybrzeżu.`,
    region: "pomorskie",
    subregion: "Wybrzeże Słowińskie",
    difficulty: "moderate",
    surface: "mixed",
    trailColor: "green",
    estimatedTimeMin: 255,
    isLoop: false,
    coverImageUrl: "/images/trails/velo-baltica-cover.svg",
    sourceUrl: "https://velobaltica.pl",
    sourceName: "Velo Baltica / R10",
    gpxUrl: null,
    geometry: BALTICA_GEOMETRY,
    createdAt: "2026-11-12T12:00:00.000Z",
    images: [
      {
        id: "21111111-1111-4111-8111-000000000701",
        url: "/images/trails/velo-baltica-cover.svg",
        caption: "Nadmorski szlak R10 wśród wydm i sosnowych borów",
      },
      {
        id: "21111111-1111-4111-8111-000000000702",
        url: "/images/trails/velo-baltica-1.svg",
        caption: "Klify w Orzechowie i zejście nad otwarty Bałtyk",
      },
      {
        id: "21111111-1111-4111-8111-000000000703",
        url: "/images/trails/velo-baltica-2.svg",
        caption: "Okolice Jeziora Łebsko i ruchomych wydm",
      },
    ],
    pois: [
      {
        id: "31111111-1111-4111-8111-000000000701",
        name: "Promenada i Port w Ustce",
        category: "parking",
        description: "Start trasy przy usteckiej latarni morskiej i molo.",
        lat: 54.5805,
        lng: 16.8615,
      },
      {
        id: "31111111-1111-4111-8111-000000000702",
        name: "Muzeum Wsi Słowińskiej w Klukach",
        category: "monument",
        description: "Unikalny skansen dawnej architektury Słowińców nad Jeziorem Łebsko.",
        lat: 54.674,
        lng: 17.338,
      },
      {
        id: "31111111-1111-4111-8111-000000000703",
        name: "Port Jachtowy w Łebie",
        category: "food",
        description: "Strefa odpoczynku, smażalnie i baza wypadowa na Wydmę Łącką.",
        lat: 54.7605,
        lng: 17.5545,
      },
    ],
  },
];

function materializeTrail(spec: SeedTrailSpec): Trail {
  const images: TrailImage[] = spec.images.map((img, index) => ({
    id: img.id,
    trailId: spec.id,
    url: img.url,
    caption: img.caption,
    sortOrder: index,
  }));

  const pois: TrailPoi[] = spec.pois.map((poi) => ({
    id: poi.id,
    trailId: spec.id,
    name: poi.name,
    category: poi.category,
    description: poi.description,
    lat: poi.lat,
    lng: poi.lng,
  }));

  return {
    id: spec.id,
    slug: spec.slug,
    title: spec.title,
    shortDescription: spec.shortDescription,
    content: spec.content,
    region: spec.region,
    subregion: spec.subregion,
    difficulty: spec.difficulty,
    surface: spec.surface,
    trailColor: spec.trailColor,
    distanceKm: spec.geometry.distanceKm,
    elevationGainM: spec.geometry.elevationGainM,
    estimatedTimeMin: spec.estimatedTimeMin,
    isLoop: spec.isLoop,
    coverImageUrl: spec.coverImageUrl,
    sourceUrl: spec.sourceUrl,
    sourceName: spec.sourceName,
    gpxUrl: spec.gpxUrl,
    routePoints: spec.geometry.points.map((point) => ({ ...point })),
    startLat: spec.geometry.startLat,
    startLng: spec.geometry.startLng,
    endLat: spec.geometry.endLat,
    endLng: spec.geometry.endLng,
    bounds: { ...spec.geometry.bounds },
    googleMapsEmbedUrl: null,
    published: true,
    createdAt: spec.createdAt,
    updatedAt: spec.createdAt,
    images,
    pois,
  };
}

export const SEED_TRAILS: readonly Trail[] = SEED_SPECS.map(materializeTrail);

export function cloneTrail(trail: Trail): Trail {
  return {
    ...trail,
    routePoints: trail.routePoints.map((point) => ({ ...point })),
    bounds: trail.bounds ? { ...trail.bounds } : null,
    images: trail.images.map((image) => ({ ...image })),
    pois: trail.pois.map((poi) => ({ ...poi })),
  };
}

export function createInitialSeedTrails(): Trail[] {
  return SEED_TRAILS.map(cloneTrail);
}
