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
    const user = userEvent.setup();
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
    const user = userEvent.setup();
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

    await user.type(
      screen.getByLabelText(/Tytuł szlaku/i),
      "Nowy Szlak Jurajski",
    );
    await user.type(
      screen.getByLabelText(/Krótki opis/i),
      "Malownicza trasa rowerowa przez jurajskie wzgórza i doliny.",
    );
    await user.type(
      screen.getByLabelText(/Pełny opis artykułu/i),
      "## Przebieg\n\nŚwietny asfalt i leśne szutry na weekendowy wyjazd.",
    );

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
    expect(Array.isArray(parsedBody.routePoints)).toBe(true);
    expect((parsedBody.routePoints as unknown[]).length).toBe(4);
    expect(parsedBody.elevationGainM).toBe(90);

    await waitFor(() => {
      expect(pushMock).toHaveBeenCalledWith("/szlaki/nowy-szlak-jurajski");
      expect(refreshMock).toHaveBeenCalled();
    });
  });

  it("imports metadata via UrlImporterCard and fills TrailForm inputs", async () => {
    const user = userEvent.setup();
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

    await user.type(
      screen.getByLabelText(/Adres URL strony ze szlakiem/i),
      "https://slaskie.travel/route/1019753",
    );
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

  it("supports edit mode PATCH and delete confirmation modal DELETE", async () => {
    const user = userEvent.setup();
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
