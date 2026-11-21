import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { sanitizeNextPath } from "@/lib/auth/redirect";
import { SEED_TRAILS } from "@/lib/trails/seed-data";

const pushMock = vi.fn();
const refreshMock = vi.fn();
const blobUploadMock = vi.fn();

vi.mock("next/navigation", () => ({
  useRouter: () => ({
    push: pushMock,
    refresh: refreshMock,
  }),
}));

vi.mock("@vercel/blob/client", () => ({
  upload: (...args: unknown[]) => blobUploadMock(...args),
}));

import { TrailForm } from "@/components/forms/TrailForm";

const SAMPLE_GPX = `<?xml version="1.0" encoding="UTF-8"?>
<gpx version="1.1" creator="Vitest">
  <trk>
    <name>Testowa Pętla Jurajska</name>
    <trkseg>
      <trkpt lat="50.450000" lon="19.550000"><ele>320</ele></trkpt>
      <trkpt lat="50.470000" lon="19.570000"><ele>385</ele></trkpt>
      <trkpt lat="50.490000" lon="19.560000"><ele>410</ele></trkpt>
      <trkpt lat="50.450500" lon="19.550500"><ele>325</ele></trkpt>
    </trkseg>
  </trk>
</gpx>`;

describe("TrailForm (UI-05) & Open Redirect protection", () => {
  const fetchMock = vi.fn();

  beforeEach(() => {
    pushMock.mockReset();
    refreshMock.mockReset();
    blobUploadMock.mockReset();
    fetchMock.mockReset();
    vi.stubGlobal("fetch", fetchMock);
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("blocks submission and displays Polish validation errors when required fields are empty or invalid", async () => {
    const user = userEvent.setup({ delay: null });
    render(<TrailForm mode="create" />);

    const distanceInput = screen.getByLabelText(/Dystans \(km\)/i);
    await user.clear(distanceInput);
    await user.type(distanceInput, "0");

    await user.click(screen.getByRole("button", { name: /Opublikuj szlak/i }));

    expect(fetchMock).not.toHaveBeenCalled();

    const summary = screen.getByTestId("form-error-summary");
    expect(summary).toBeInTheDocument();
    expect(screen.getAllByText(/Tytuł szlaku jest wymagany/i).length).toBeGreaterThanOrEqual(1);
    expect(screen.getAllByText(/Krótki opis szlaku jest wymagany/i).length).toBeGreaterThanOrEqual(1);
    expect(screen.getAllByText(/Pełny opis szlaku jest wymagany/i).length).toBeGreaterThanOrEqual(1);
    expect(screen.getAllByText(/Dystans musi być większy od 0 km/i).length).toBeGreaterThanOrEqual(1);
  });

  it("parses uploaded .gpx file locally, auto-fills telemetry and keeps route preview when Blob upload returns 503", async () => {
    blobUploadMock.mockRejectedValueOnce(new Error("503 Blob not configured"));

    render(<TrailForm mode="create" />);

    const fileInput = screen.getByTestId("gpx-file-input");
    const gpxFile = new File([SAMPLE_GPX], "jura-test.gpx", {
      type: "application/gpx+xml",
    });

    fireEvent.change(fileInput, { target: { files: [gpxFile] } });

    await waitFor(() => {
      const distanceInput = screen.getByLabelText(/Dystans \(km\)/i) as HTMLInputElement;
      expect(Number(distanceInput.value)).toBeGreaterThan(5);
    });

    const elevationInput = screen.getByLabelText(/Przewyższenie \(m\)/i) as HTMLInputElement;
    expect(Number(elevationInput.value)).toBe(90);

    const estimatedTimeInput = screen.getByLabelText(/Szacowany czas \(min\)/i) as HTMLInputElement;
    expect(Number(estimatedTimeInput.value)).toBeGreaterThan(0);

    const loopCheckbox = screen.getByLabelText(/Trasa w formie pętli/i) as HTMLInputElement;
    expect(loopCheckbox.checked).toBe(true);

    expect(screen.getByTestId("gpx-live-preview")).toBeInTheDocument();
    expect(screen.getByTestId("map-fallback")).toBeInTheDocument();

    await waitFor(() => {
      expect(screen.getByTestId("gpx-status-message")).toHaveTextContent(
        /Ślad GPX wczytany \(zapis oryginalnego pliku wymaga Vercel Blob\)/i,
      );
    });
  });

  it("submits valid form data via POST /api/trails and redirects to created trail page", async () => {
    const user = userEvent.setup({ delay: null });
    blobUploadMock.mockRejectedValueOnce(new Error("503 Blob not configured"));

    fetchMock.mockResolvedValueOnce({
      ok: true,
      status: 201,
      json: async () => ({
        ...SEED_TRAILS[0],
        id: "created-trail-id",
        slug: "nowy-szlak-jurajski",
        title: "Nowy Szlak Jurajski",
      }),
    });

    render(<TrailForm mode="create" />);

    fireEvent.change(screen.getByLabelText(/Tytuł szlaku/i), {
      target: { value: "Nowy Szlak Jurajski" },
    });
    fireEvent.change(screen.getByLabelText(/Krótki opis/i), {
      target: {
        value: "Malownicza trasa rowerowa przez jurajskie wzgórza i doliny.",
      },
    });
    fireEvent.change(screen.getByLabelText(/Pełny opis artykułu/i), {
      target: {
        value: "## Przebieg\n\nŚwietny asfalt i leśne szutry na weekendowy wyjazd.",
      },
    });

    const gpxFile = new File([SAMPLE_GPX], "jura-test.gpx", {
      type: "application/gpx+xml",
    });
    fireEvent.change(screen.getByTestId("gpx-file-input"), {
      target: { files: [gpxFile] },
    });

    await waitFor(() => {
      const distanceInput = screen.getByLabelText(/Dystans \(km\)/i) as HTMLInputElement;
      expect(Number(distanceInput.value)).toBeGreaterThan(5);
    });

    await user.click(screen.getByRole("button", { name: /Opublikuj szlak/i }));

    await waitFor(() => {
      expect(fetchMock).toHaveBeenCalledTimes(1);
    });

    const [calledUrl, calledInit] = fetchMock.mock.calls[0] as [
      string,
      RequestInit,
    ];
    expect(calledUrl).toBe("/api/trails");
    expect(calledInit.method).toBe("POST");

    const parsedBody = JSON.parse(String(calledInit.body)) as Record<
      string,
      unknown
    >;
    expect(parsedBody.title).toBe("Nowy Szlak Jurajski");
    expect(parsedBody.region).toBe("slaskie");
    expect(parsedBody.googleMapsEmbedUrl).toBeNull();
    expect(Array.isArray(parsedBody.routePoints)).toBe(true);
    expect((parsedBody.routePoints as unknown[]).length).toBe(4);
    expect(parsedBody.elevationGainM).toBe(90);

    await waitFor(() => {
      expect(pushMock).toHaveBeenCalledWith("/szlaki/nowy-szlak-jurajski");
      expect(refreshMock).toHaveBeenCalled();
    });
  });

  it("imports parsedGpx via UrlImporterCard, renders live route preview immediately, and auto-fills telemetry", async () => {
    const user = userEvent.setup({ delay: null });
    fetchMock.mockResolvedValueOnce({
      ok: true,
      status: 200,
      json: async () => ({
        sourceUrl: "https://slaskie.travel/route/1019753",
        sourceName: "SLASKIE.travel",
        title: "Pętla Pogorii z GPX",
        shortDescription: "Opis zaimportowany z automatycznym GPX.",
        content: "Pełny opis trasy z GPX.",
        coverImageUrl: "https://slaskie.travel/media/cover.jpg",
        imageUrls: ["https://slaskie.travel/media/cover.jpg"],
        gpxUrl: "https://slaskie.travel/download/route/gpx/1019753",
        gpxUrls: ["https://slaskie.travel/download/route/gpx/1019753"],
        region: "slaskie",
        distanceKm: 20.0,
        elevationGainM: 100,
        difficulty: "easy",
        surface: "asphalt",
        parsedGpx: {
          name: "Pogoria GPX",
          distanceKm: 23.4,
          elevationGainM: 215,
          hasElevation: true,
          bounds: {
            north: 50.36,
            south: 50.33,
            east: 19.22,
            west: 19.18,
          },
          startLat: 50.344,
          startLng: 19.198,
          endLat: 50.344,
          endLng: 19.198,
          isLoop: true,
          routePoints: [
            { lat: 50.344, lng: 19.198, ele: 260, distKm: 0 },
            { lat: 50.355, lng: 19.21, ele: 310, distKm: 11.7 },
            { lat: 50.344, lng: 19.198, ele: 265, distKm: 23.4 },
          ],
          originalPointCount: 3,
        },
      }),
    });

    render(<TrailForm mode="create" />);

    fireEvent.change(screen.getByLabelText(/Adres URL strony ze szlakiem/i), {
      target: { value: "https://slaskie.travel/route/1019753" },
    });
    await user.click(
      screen.getByRole("button", { name: /Pobierz dane ze strony/i }),
    );

    await waitFor(() => {
      expect(screen.getByTestId("gpx-live-preview")).toBeInTheDocument();
    });

    expect(screen.getByTestId("map-fallback")).toBeInTheDocument();
    expect(
      (screen.getByLabelText(/Dystans \(km\)/i) as HTMLInputElement).value,
    ).toBe("23.4");
    expect(
      (screen.getByLabelText(/Przewyższenie \(m\)/i) as HTMLInputElement).value,
    ).toBe("215");
    expect(
      (screen.getByLabelText(/Szacowany czas \(min\)/i) as HTMLInputElement).value,
    ).toBe("94");
    expect(
      (screen.getByLabelText(/Trasa w formie pętli/i) as HTMLInputElement).checked,
    ).toBe(true);
    expect(
      (screen.getByLabelText(/Link do pliku GPX/i) as HTMLInputElement).value,
    ).toBe("https://slaskie.travel/download/route/gpx/1019753");
  });

  it("preserves HTML elevationGainM when imported parsedGpx has hasElevation: false", async () => {
    const user = userEvent.setup({ delay: null });
    fetchMock.mockResolvedValueOnce({
      ok: true,
      status: 200,
      json: async () => ({
        sourceUrl: "https://example.pl/trasa",
        sourceName: "Example",
        title: "Trasa bez wysokości w GPX",
        shortDescription: "Krótki opis testowy.",
        content: "Pełny opis testowy.",
        coverImageUrl: null,
        imageUrls: [],
        gpxUrl: "https://example.pl/trasa.gpx",
        gpxUrls: ["https://example.pl/trasa.gpx"],
        region: "malopolskie",
        distanceKm: 18,
        elevationGainM: 310,
        difficulty: "moderate",
        surface: "gravel",
        parsedGpx: {
          distanceKm: 19.2,
          elevationGainM: 0,
          hasElevation: false,
          bounds: {
            north: 49.5,
            south: 49.4,
            east: 20.5,
            west: 20.3,
          },
          startLat: 49.43,
          startLng: 20.32,
          endLat: 49.42,
          endLng: 20.46,
          isLoop: false,
          routePoints: [
            { lat: 49.43, lng: 20.32, distKm: 0 },
            { lat: 49.42, lng: 20.46, distKm: 19.2 },
          ],
          originalPointCount: 2,
        },
      }),
    });

    render(<TrailForm mode="create" />);

    fireEvent.change(screen.getByLabelText(/Adres URL strony ze szlakiem/i), {
      target: { value: "https://example.pl/trasa" },
    });
    await user.click(
      screen.getByRole("button", { name: /Pobierz dane ze strony/i }),
    );

    await waitFor(() => {
      expect(screen.getByTestId("gpx-live-preview")).toBeInTheDocument();
    });

    expect(
      (screen.getByLabelText(/Dystans \(km\)/i) as HTMLInputElement).value,
    ).toBe("19.2");
    expect(
      (screen.getByLabelText(/Przewyższenie \(m\)/i) as HTMLInputElement).value,
    ).toBe("310");
  });

  it("validates googleMapsEmbedUrl and submits it in POST /api/trails payload", async () => {
    const user = userEvent.setup({ delay: null });
    fetchMock.mockResolvedValueOnce({
      ok: true,
      status: 201,
      json: async () => ({
        ...SEED_TRAILS[0],
        id: "created-mymaps-id",
        slug: "szlak-z-mymaps",
      }),
    });

    render(<TrailForm mode="create" />);

    fireEvent.change(screen.getByLabelText(/Tytuł szlaku/i), {
      target: { value: "Szlak z Google My Maps" },
    });
    fireEvent.change(screen.getByLabelText(/Krótki opis/i), {
      target: { value: "Trasa rowerowa z podpiętą mapą Google My Maps." },
    });
    fireEvent.change(screen.getByLabelText(/Pełny opis artykułu/i), {
      target: { value: "## Opis\n\nSzczegółowy opis trasy z mapą 1:1." },
    });
    fireEvent.change(screen.getByLabelText(/Dystans \(km\)/i), {
      target: { value: "28.5" },
    });

    const myMapsInput = screen.getByLabelText(/Link do Google My Maps/i);
    fireEvent.change(myMapsInput, { target: { value: "notaurl" } });

    await user.click(screen.getByRole("button", { name: /Opublikuj szlak/i }));

    expect(fetchMock).not.toHaveBeenCalled();
    expect(
      screen.getAllByText(/Niepoprawny URL mapy Google/i).length,
    ).toBeGreaterThanOrEqual(1);

    fireEvent.change(myMapsInput, {
      target: { value: "https://www.google.com/maps/d/viewer?mid=123456" },
    });

    await user.click(screen.getByRole("button", { name: /Opublikuj szlak/i }));

    await waitFor(() => {
      expect(fetchMock).toHaveBeenCalledTimes(1);
    });

    const [, calledInit] = fetchMock.mock.calls[0] as [string, RequestInit];
    const parsedBody = JSON.parse(String(calledInit.body)) as Record<
      string,
      unknown
    >;
    expect(parsedBody.googleMapsEmbedUrl).toBe(
      "https://www.google.com/maps/d/viewer?mid=123456",
    );
  });

  it("imports metadata via UrlImporterCard and fills TrailForm inputs", async () => {
    const user = userEvent.setup({ delay: null });
    fetchMock.mockResolvedValueOnce({
      ok: true,
      status: 200,
      json: async () => ({
        sourceUrl: "https://slaskie.travel/route/1019753",
        sourceName: "SLASKIE.travel",
        title: "Szlak Orlich Gniazd Importowany",
        shortDescription: "Zaimportowany krótki opis szlaku.",
        content: "Szczegółowy opis zaimportowany ze strony.",
        coverImageUrl: "https://slaskie.travel/media/cover.jpg",
        imageUrls: ["https://slaskie.travel/media/cover.jpg"],
        gpxUrl: null,
        gpxUrls: [],
        region: "slaskie",
        distanceKm: 42.5,
        elevationGainM: 310,
        difficulty: "moderate",
        surface: "mixed",
      }),
    });

    render(<TrailForm mode="create" />);

    fireEvent.change(screen.getByLabelText(/Adres URL strony ze szlakiem/i), {
      target: { value: "https://slaskie.travel/route/1019753" },
    });
    await user.click(
      screen.getByRole("button", { name: /Pobierz dane ze strony/i }),
    );

    await waitFor(() => {
      expect(
        (screen.getByLabelText(/Tytuł szlaku/i) as HTMLInputElement).value,
      ).toBe("Szlak Orlich Gniazd Importowany");
    });

    expect(
      (screen.getByLabelText(/Dystans \(km\)/i) as HTMLInputElement).value,
    ).toBe("42.5");
    expect(
      (screen.getByLabelText(/Nazwa źródła/i) as HTMLInputElement).value,
    ).toBe("SLASKIE.travel");
  });

  it("preserves HTML telemetry and user-entered estimatedTimeMin when parsedGpx is null", async () => {
    const user = userEvent.setup({ delay: null });
    fetchMock.mockResolvedValueOnce({
      ok: true,
      status: 200,
      json: async () => ({
        sourceUrl: "https://example.pl/html-only",
        sourceName: "Example HTML",
        title: "Szlak bez GPX",
        shortDescription: "Krótki opis bez GPX.",
        content: "Pełny opis bez GPX.",
        coverImageUrl: null,
        imageUrls: [],
        gpxUrl: null,
        gpxUrls: [],
        region: "slaskie",
        distanceKm: 15,
        elevationGainM: 80,
        difficulty: "easy",
        surface: "asphalt",
        parsedGpx: null,
      }),
    });

    render(<TrailForm mode="create" />);

    fireEvent.change(screen.getByLabelText(/Szacowany czas \(min\)/i), {
      target: { value: "145" },
    });
    fireEvent.change(screen.getByLabelText(/Adres URL strony ze szlakiem/i), {
      target: { value: "https://example.pl/html-only" },
    });

    await user.click(
      screen.getByRole("button", { name: /Pobierz dane ze strony/i }),
    );

    await waitFor(() => {
      expect(
        (screen.getByLabelText(/Tytuł szlaku/i) as HTMLInputElement).value,
      ).toBe("Szlak bez GPX");
    });

    expect(screen.queryByTestId("gpx-live-preview")).not.toBeInTheDocument();
    expect(
      (screen.getByLabelText(/Dystans \(km\)/i) as HTMLInputElement).value,
    ).toBe("15");
    expect(
      (screen.getByLabelText(/Przewyższenie \(m\)/i) as HTMLInputElement).value,
    ).toBe("80");
    expect(
      (screen.getByLabelText(/Szacowany czas \(min\)/i) as HTMLInputElement).value,
    ).toBe("145");
  });

  it("initializes googleMapsEmbedUrl in edit mode and submits trimmed value via PATCH", async () => {
    const user = userEvent.setup({ delay: null });
    const trail = {
      ...SEED_TRAILS[0],
      googleMapsEmbedUrl: "https://www.google.com/maps/d/viewer?mid=edit999",
    };

    fetchMock.mockResolvedValueOnce({
      ok: true,
      status: 200,
      json: async () => ({
        ...trail,
        googleMapsEmbedUrl: "https://mymaps.google.com/maps/d/viewer?mid=updated777",
      }),
    });

    render(<TrailForm mode="edit" initialTrail={trail} />);

    const myMapsInput = screen.getByLabelText(
      /Link do Google My Maps/i,
    ) as HTMLInputElement;
    expect(myMapsInput.value).toBe(
      "https://www.google.com/maps/d/viewer?mid=edit999",
    );

    fireEvent.change(myMapsInput, {
      target: {
        value: "  https://mymaps.google.com/maps/d/viewer?mid=updated777  ",
      },
    });

    await user.click(screen.getByRole("button", { name: /Zapisz zmiany/i }));

    await waitFor(() => {
      expect(fetchMock).toHaveBeenCalledTimes(1);
    });

    const [calledUrl, calledInit] = fetchMock.mock.calls[0] as [
      string,
      RequestInit,
    ];
    expect(calledUrl).toBe(`/api/trails/${encodeURIComponent(trail.id)}`);
    expect(calledInit.method).toBe("PATCH");

    const parsedBody = JSON.parse(String(calledInit.body)) as Record<
      string,
      unknown
    >;
    expect(parsedBody.googleMapsEmbedUrl).toBe(
      "https://mymaps.google.com/maps/d/viewer?mid=updated777",
    );
  });

  it("supports edit mode PATCH and delete confirmation modal DELETE", async () => {
    const user = userEvent.setup({ delay: null });
    const trail = SEED_TRAILS[0];

    fetchMock.mockResolvedValueOnce({
      ok: true,
      status: 200,
      json: async () => ({ deleted: true, id: trail.id }),
    });

    render(<TrailForm mode="edit" initialTrail={trail} />);

    // UrlImporterCard is hidden in edit mode
    expect(
      screen.queryByRole("button", { name: /Pobierz dane ze strony/i }),
    ).not.toBeInTheDocument();

    // Open delete confirmation modal
    await user.click(screen.getByRole("button", { name: /Usuń szlak/i }));
    expect(screen.getByRole("dialog")).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: /Tak, usuń szlak/i }));

    await waitFor(() => {
      expect(fetchMock).toHaveBeenCalledWith(
        `/api/trails/${encodeURIComponent(trail.id)}`,
        expect.objectContaining({ method: "DELETE" }),
      );
      expect(pushMock).toHaveBeenCalledWith("/");
      expect(refreshMock).toHaveBeenCalled();
    });
  });

  it("sanitizeNextPath prevents Open Redirect attacks", () => {
    expect(sanitizeNextPath("/dodaj")).toBe("/dodaj");
    expect(sanitizeNextPath("/szlaki/orle-gniazda/edytuj")).toBe(
      "/szlaki/orle-gniazda/edytuj",
    );
    expect(sanitizeNextPath("//evil.com/phish")).toBe("/dodaj");
    expect(sanitizeNextPath("https://evil.com")).toBe("/dodaj");
    expect(sanitizeNextPath("/\\evil.com")).toBe("/dodaj");
    expect(sanitizeNextPath("/logowanie")).toBe("/dodaj");
    expect(sanitizeNextPath(undefined)).toBe("/dodaj");
  });
});
