import type { ReactNode } from "react";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { TrailMapSection } from "@/components/map/TrailMapSection";
import {
  buildGoogleMapsDirectionsUrl,
  getTrailStrokeColor,
} from "@/components/map/utils";
import { SEED_TRAILS } from "@/lib/trails/seed-data";
import type { Trail } from "@/types/trail";

const polylineCalls: Array<Record<string, unknown>> = [];
const setMapTypeIdMock = vi.fn();
const fitBoundsMock = vi.fn();
const panToMock = vi.fn();

vi.mock("@vis.gl/react-google-maps", () => {
  class MockPolyline {
    options: Record<string, unknown>;
    constructor(options: Record<string, unknown>) {
      this.options = options;
      polylineCalls.push(options);
    }
    setMap = vi.fn();
  }

  return {
    APILoadingStatus: {
      NOT_LOADED: "NOT_LOADED",
      LOADING: "LOADING",
      LOADED: "LOADED",
      FAILED: "FAILED",
      AUTH_FAILURE: "AUTH_FAILURE",
    },
    APIProvider: ({
      apiKey,
      children,
    }: {
      apiKey: string;
      children: ReactNode;
    }) => (
      <div data-testid="mock-api-provider" data-api-key={apiKey}>
        {children}
      </div>
    ),
    Map: ({
      gestureHandling,
      mapTypeId,
      children,
    }: {
      gestureHandling?: string;
      mapTypeId?: string;
      children?: ReactNode;
    }) => (
      <div
        data-testid="mock-google-map"
        data-gesture-handling={gestureHandling}
        data-map-type={mapTypeId}
      >
        {children}
      </div>
    ),
    Marker: ({ title }: { title?: string }) => (
      <div data-testid="mock-marker" data-title={title} />
    ),
    AdvancedMarker: ({
      title,
      children,
    }: {
      title?: string;
      children?: ReactNode;
    }) => (
      <div data-testid="mock-advanced-marker" data-title={title}>
        {children}
      </div>
    ),
    InfoWindow: ({ children }: { children?: ReactNode }) => (
      <div data-testid="mock-info-window">{children}</div>
    ),
    useMap: () => ({
      setMapTypeId: setMapTypeIdMock,
      fitBounds: fitBoundsMock,
      panTo: panToMock,
    }),
    useMapsLibrary: () => ({
      Polyline: MockPolyline,
    }),
    useApiLoadingStatus: () => "LOADED",
  };
});

import { TrailGoogleMap } from "@/components/map/TrailGoogleMap";

const SLASKIE_TRAIL: Trail = SEED_TRAILS[0];

describe("Map utils & TrailGoogleMap (UI-03)", () => {
  it("buildGoogleMapsDirectionsUrl constructs valid Google Maps cycling directions URL", () => {
    const urlStr = buildGoogleMapsDirectionsUrl(SLASKIE_TRAIL);
    const parsed = new URL(urlStr);

    expect(parsed.origin + parsed.pathname).toBe("https://www.google.com/maps/dir/");
    expect(parsed.searchParams.get("api")).toBe("1");
    expect(parsed.searchParams.get("travelmode")).toBe("bicycling");
    expect(parsed.searchParams.get("destination")).toBe(
      `${Number(SLASKIE_TRAIL.startLat!.toFixed(6))},${Number(SLASKIE_TRAIL.startLng!.toFixed(6))}`,
    );

    const withWaypoints = buildGoogleMapsDirectionsUrl(SLASKIE_TRAIL, {
      origin: { lat: 50.25, lng: 19.02 },
      waypoints: [
        { lat: 50.36, lng: 19.21 },
        { lat: 50.38, lng: 19.22 },
      ],
    });
    const parsedWithWaypoints = new URL(withWaypoints);
    expect(parsedWithWaypoints.searchParams.get("origin")).toBe("50.25,19.02");
    expect(parsedWithWaypoints.searchParams.get("waypoints")).toBe(
      "50.36,19.21|50.38,19.22",
    );
  });

  it("getTrailStrokeColor maps PTTK trail colors with high contrast", () => {
    expect(getTrailStrokeColor("red")).toBe("#DC2626");
    expect(getTrailStrokeColor("blue")).toBe("#2563EB");
    expect(getTrailStrokeColor("green")).toBe("#16A34A");
    expect(getTrailStrokeColor("yellow")).toBe("#EAB308");
    expect(getTrailStrokeColor("black")).toBe("#18181B");
    expect(getTrailStrokeColor("none")).toBe("#FF4D1C");
  });

  it("renders SVG vector fallback and Google Maps link without error when API key is missing", () => {
    render(<TrailGoogleMap trail={SLASKIE_TRAIL} apiKey="" activePointIndex={3} />);

    expect(screen.getByTestId("map-fallback")).toBeInTheDocument();
    expect(screen.getByTestId("fallback-route-path")).toBeInTheDocument();
    expect(screen.getByTestId("fallback-active-point")).toBeInTheDocument();

    const gmapsLink = screen.getByRole("link", {
      name: /Otwórz w Google Maps/i,
    });
    expect(gmapsLink).toHaveAttribute(
      "href",
      buildGoogleMapsDirectionsUrl(SLASKIE_TRAIL),
    );
    expect(gmapsLink).toHaveAttribute("target", "_blank");
  });

  it("handles a trail without routePoints gracefully in fallback mode", () => {
    const emptyRouteTrail: Trail = {
      ...SLASKIE_TRAIL,
      routePoints: [],
      bounds: null,
      startLat: null,
      startLng: null,
      endLat: null,
      endLng: null,
    };

    render(<TrailGoogleMap trail={emptyRouteTrail} apiKey="" />);

    expect(screen.getByTestId("map-fallback")).toBeInTheDocument();
    expect(screen.queryByTestId("fallback-route-path")).not.toBeInTheDocument();
    expect(
      screen.getByText(/brak wgranego śladu GPX/i),
    ).toBeInTheDocument();
  });

  it("renders Google Maps provider, cooperative gesture handling, double polyline and markers when API key is provided", () => {
    polylineCalls.length = 0;
    fitBoundsMock.mockReset();
    setMapTypeIdMock.mockReset();

    render(
      <TrailGoogleMap
        trail={SLASKIE_TRAIL}
        apiKey="AIzaTestKeyForUnitTests"
        mapTypeId="terrain"
        activePointIndex={2}
      />,
    );

    const provider = screen.getByTestId("mock-api-provider");
    expect(provider).toHaveAttribute("data-api-key", "AIzaTestKeyForUnitTests");

    const mapEl = screen.getByTestId("mock-google-map");
    expect(mapEl).toHaveAttribute("data-gesture-handling", "cooperative");
    expect(mapEl).toHaveAttribute("data-map-type", "terrain");

    // Double Polyline: outline (8px) + route stroke (4.5px)
    expect(polylineCalls).toHaveLength(2);
    expect(polylineCalls[0].strokeWeight).toBe(8);
    expect(polylineCalls[1].strokeWeight).toBe(4.5);
    expect(polylineCalls[1].strokeColor).toBe(
      getTrailStrokeColor(SLASKIE_TRAIL.trailColor),
    );

    expect(fitBoundsMock).toHaveBeenCalled();
    expect(setMapTypeIdMock).toHaveBeenCalledWith("terrain");

    // START + POIs + active elevation point markers
    const markers = screen.getAllByTestId("mock-marker");
    expect(markers.length).toBeGreaterThanOrEqual(
      1 + SLASKIE_TRAIL.pois.length + 1,
    );
  });

  it("TrailMapSection coordinates HUD controls, synchronized ElevationChart and MapActionsBar", async () => {
    const user = userEvent.setup();
    const writeTextMock = vi.fn().mockResolvedValue(undefined);
    Object.defineProperty(navigator, "clipboard", {
      value: { writeText: writeTextMock },
      configurable: true,
    });
    Object.defineProperty(navigator, "share", {
      value: undefined,
      configurable: true,
    });

    render(<TrailMapSection trail={SLASKIE_TRAIL} apiKey="" />);

    expect(screen.getByTestId("map-fallback")).toBeInTheDocument();
    expect(screen.getByTestId("elevation-chart")).toBeInTheDocument();
    expect(screen.getByTestId("map-actions-bar")).toBeInTheDocument();

    // Hovering elevation chart highlights the active point on the map
    const chartSvg = screen.getByTestId("elevation-chart-svg");
    fireEvent.mouseMove(chartSvg, { clientX: 300, clientY: 80 });
    expect(screen.getByTestId("fallback-active-point")).toBeInTheDocument();

    // Recenter button clears active point
    await user.click(screen.getByRole("button", { name: /Wyśrodkuj trasę/i }));
    expect(
      screen.queryByTestId("fallback-active-point"),
    ).not.toBeInTheDocument();

    // Map type HUD toggles aria-pressed
    const satBtn = screen.getByRole("button", { name: /Satelita/i });
    await user.click(satBtn);
    expect(satBtn).toHaveAttribute("aria-pressed", "true");

    // Fullscreen toggle
    const fsBtn = screen.getByRole("button", { name: /Pełny ekran mapy/i });
    await user.click(fsBtn);
    expect(
      screen.getByRole("button", { name: /Zamknij pełny ekran mapy/i }),
    ).toHaveAttribute("aria-pressed", "true");
    fireEvent.keyDown(window, { key: "Escape" });

    // Share copies URL to clipboard and shows Skopiowano
    const shareBtn = screen.getByRole("button", { name: /Udostępnij szlak/i });
    await user.click(shareBtn);
    await waitFor(() => {
      expect(writeTextMock).toHaveBeenCalledTimes(1);
    });
    expect(screen.getByText("Skopiowano")).toBeInTheDocument();
  });
});
