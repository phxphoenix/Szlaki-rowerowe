import type { ReactNode } from "react";
import { act, fireEvent, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";
import { MapActionsBar } from "@/components/map/MapActionsBar";
import { TrailMapSection } from "@/components/map/TrailMapSection";
import {
  buildGoogleMapsDirectionsUrl,
  buildGoogleMapsRouteUrl,
  buildGoogleMapsStartNavigationUrl,
  extractKeyRouteWaypoints,
  getTrailStrokeColor,
  haversineMeters,
  isGoogleMyMapsUrl,
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

import {
  TrailGoogleMap,
  isPlausibleGoogleMapsApiKey,
} from "@/components/map/TrailGoogleMap";

const SLASKIE_TRAIL: Trail = SEED_TRAILS[0];
const BARYCZ_TRAIL: Trail = SEED_TRAILS.find(
  (t) => t.slug === "dolnoslaska-cyklostrada-dolina-baryczy",
)!;
const DUNAJEC_TRAIL: Trail = SEED_TRAILS.find(
  (t) => t.slug === "velo-dunajec-przelom-dunajca-czorsztyn-stary-sacz",
)!;

const originalGeolocationDescriptor = Object.getOwnPropertyDescriptor(
  navigator,
  "geolocation",
);

afterEach(() => {
  vi.restoreAllMocks();
  panToMock.mockReset();
  fitBoundsMock.mockReset();
  setMapTypeIdMock.mockReset();
  if (originalGeolocationDescriptor) {
    Object.defineProperty(
      navigator,
      "geolocation",
      originalGeolocationDescriptor,
    );
  } else {
    Reflect.deleteProperty(navigator, "geolocation");
  }
});

describe("Map utils, Google Maps route URLs & TrailGoogleMap (Stage R2)", () => {
  it("extractKeyRouteWaypoints samples by cumulative geodesic distance, enforces >= 150 m spacing and <= 9 waypoints", () => {
    // Clustered first 20 points inside ~100 m, followed by a sparse 10 km stretch
    const clusteredPoints = Array.from({ length: 20 }, (_, i) => ({
      lat: 50.0 + i * 0.00004,
      lng: 19.0,
    }));
    const sparsePoints = Array.from({ length: 10 }, (_, i) => ({
      lat: 50.0008 + (i + 1) * 0.009, // ~1 km per step
      lng: 19.0,
    }));
    const route = [...clusteredPoints, ...sparsePoints];

    const waypoints = extractKeyRouteWaypoints(route, {
      maxWaypoints: 9,
      isLoop: false,
    });

    expect(waypoints.length).toBeGreaterThanOrEqual(3);
    expect(waypoints.length).toBeLessThanOrEqual(9);
    // First waypoint should be along the sparse stretch (~1 km), NOT stuck in the 100 m cluster
    expect(haversineMeters(route[0], waypoints[0])).toBeGreaterThanOrEqual(500);

    for (let i = 1; i < waypoints.length; i += 1) {
      expect(
        haversineMeters(waypoints[i - 1], waypoints[i]),
      ).toBeGreaterThanOrEqual(150);
    }
  });

  it("extractKeyRouteWaypoints handles closed loops and open-endpoint loops (Dolina Baryczy)", () => {
    // Closed loop: Pogoria
    const closedWaypoints = extractKeyRouteWaypoints(SLASKIE_TRAIL.routePoints, {
      maxWaypoints: 9,
      isLoop: true,
    });
    expect(closedWaypoints.length).toBe(9);
    const startPoint = SLASKIE_TRAIL.routePoints[0];
    for (let i = 0; i < closedWaypoints.length; i += 1) {
      expect(haversineMeters(startPoint, closedWaypoints[i])).toBeGreaterThanOrEqual(200);
      if (i > 0) {
        expect(
          haversineMeters(closedWaypoints[i - 1], closedWaypoints[i]),
        ).toBeGreaterThanOrEqual(150);
      }
    }

    // Open-endpoint loop: Dolina Baryczy (isLoop: true while lastPoint is ~32.4 km from start)
    const baryczWaypoints = extractKeyRouteWaypoints(BARYCZ_TRAIL.routePoints, {
      maxWaypoints: 9,
      isLoop: true,
    });
    expect(baryczWaypoints.length).toBe(9);
    const baryczStart = BARYCZ_TRAIL.routePoints[0];
    const baryczLast =
      BARYCZ_TRAIL.routePoints[BARYCZ_TRAIL.routePoints.length - 1];
    expect(baryczWaypoints[baryczWaypoints.length - 1]).toEqual({
      lat: baryczLast.lat,
      lng: baryczLast.lng,
    });
    for (let i = 0; i < baryczWaypoints.length; i += 1) {
      expect(
        haversineMeters(baryczStart, baryczWaypoints[i]),
      ).toBeGreaterThanOrEqual(200);
      if (i > 0) {
        expect(
          haversineMeters(baryczWaypoints[i - 1], baryczWaypoints[i]),
        ).toBeGreaterThanOrEqual(150);
      }
    }
  });

  it("buildGoogleMapsRouteUrl builds full-route URL < 2000 chars with 3-9 waypoints for all 7 SEED_TRAILS", () => {
    expect(SEED_TRAILS).toHaveLength(7);

    for (const trail of SEED_TRAILS) {
      const urlStr = buildGoogleMapsRouteUrl(trail, { forceDirections: true });
      expect(urlStr.length).toBeLessThan(2000);

      const parsed = new URL(urlStr);
      expect(parsed.origin + parsed.pathname).toBe(
        "https://www.google.com/maps/dir/",
      );
      expect(parsed.searchParams.get("api")).toBe("1");
      expect(parsed.searchParams.get("travelmode")).toBe("bicycling");

      const originParam = parsed.searchParams.get("origin");
      const destParam = parsed.searchParams.get("destination");
      const waypointsParam = parsed.searchParams.get("waypoints");

      expect(originParam).toBeTruthy();
      expect(destParam).toBeTruthy();
      if (trail.isLoop) {
        expect(destParam).toBe(originParam);
      } else {
        expect(destParam).not.toBe(originParam);
      }

      const wpParts = waypointsParam ? waypointsParam.split("|") : [];
      expect(wpParts.length).toBeGreaterThanOrEqual(3);
      expect(wpParts.length).toBeLessThanOrEqual(9);
    }

    // Point-to-point check on Velo Dunajec
    const dunajecUrl = new URL(buildGoogleMapsRouteUrl(DUNAJEC_TRAIL));
    expect(dunajecUrl.searchParams.get("origin")).toBe(
      `${Number(DUNAJEC_TRAIL.startLat!.toFixed(6))},${Number(DUNAJEC_TRAIL.startLng!.toFixed(6))}`,
    );
    expect(dunajecUrl.searchParams.get("destination")).toBe(
      `${Number(DUNAJEC_TRAIL.endLat!.toFixed(6))},${Number(DUNAJEC_TRAIL.endLng!.toFixed(6))}`,
    );
  });

  it("isGoogleMyMapsUrl validates My Maps URLs and buildGoogleMapsRouteUrl honors forceDirections", () => {
    expect(
      isGoogleMyMapsUrl("https://www.google.com/maps/d/viewer?mid=1abcXYZ"),
    ).toBe(true);
    expect(
      isGoogleMyMapsUrl("https://www.google.pl/maps/d/edit?mid=1abcXYZ"),
    ).toBe(true);
    expect(
      isGoogleMyMapsUrl("https://www.google.com/maps/d/u/0/viewer?mid=1abcXYZ"),
    ).toBe(true);
    expect(isGoogleMyMapsUrl("https://mymaps.google.com/map?id=123")).toBe(
      true,
    );
    expect(
      isGoogleMyMapsUrl("https://www.google.com/maps/dir/?api=1&destination=50,19"),
    ).toBe(false);
    expect(
      isGoogleMyMapsUrl("https://evil.example/maps/d/viewer?mid=123"),
    ).toBe(false);
    expect(
      isGoogleMyMapsUrl("https://user:pass@www.google.com/maps/d/viewer"),
    ).toBe(false);
    expect(
      isGoogleMyMapsUrl("https://user@mymaps.google.com/map?id=123"),
    ).toBe(false);
    expect(isGoogleMyMapsUrl("https://www.google.com/maps/d/")).toBe(false);
    expect(isGoogleMyMapsUrl("https://www.google.com/maps/d")).toBe(false);
    expect(isGoogleMyMapsUrl("javascript:alert(1)")).toBe(false);
    expect(isGoogleMyMapsUrl(null)).toBe(false);

    const myMapsTrail: Trail = {
      ...SLASKIE_TRAIL,
      googleMapsEmbedUrl: "https://www.google.com/maps/d/viewer?mid=1abcXYZ",
    };

    expect(buildGoogleMapsRouteUrl(myMapsTrail)).toBe(
      "https://www.google.com/maps/d/viewer?mid=1abcXYZ",
    );
    const forced = new URL(
      buildGoogleMapsRouteUrl(myMapsTrail, { forceDirections: true }),
    );
    expect(forced.pathname).toBe("/maps/dir/");
    expect(forced.searchParams.get("waypoints")).toBeTruthy();
  });

  it("buildGoogleMapsStartNavigationUrl and buildGoogleMapsDirectionsUrl behave correctly for routes vs single POI", () => {
    const startNav = new URL(buildGoogleMapsStartNavigationUrl(SLASKIE_TRAIL));
    expect(startNav.searchParams.get("destination")).toBe(
      `${Number(SLASKIE_TRAIL.startLat!.toFixed(6))},${Number(SLASKIE_TRAIL.startLng!.toFixed(6))}`,
    );
    expect(startNav.searchParams.get("origin")).toBeNull();
    expect(startNav.searchParams.get("waypoints")).toBeNull();
    expect(startNav.searchParams.get("travelmode")).toBe("bicycling");

    // Full trail -> full route URL
    const fullDir = new URL(buildGoogleMapsDirectionsUrl(SLASKIE_TRAIL));
    expect(fullDir.searchParams.get("origin")).toBeTruthy();
    expect(fullDir.searchParams.get("waypoints")).toBeTruthy();
    expect(fullDir.searchParams.get("travelmode")).toBe("bicycling");

    // Single POI (no routePoints) -> single destination
    const poiDir = new URL(
      buildGoogleMapsDirectionsUrl({ startLat: 50.1234, startLng: 19.5678 }),
    );
    expect(poiDir.searchParams.get("destination")).toBe("50.1234,19.5678");
    expect(poiDir.searchParams.get("origin")).toBeNull();
    expect(poiDir.searchParams.get("waypoints")).toBeNull();

    // Explicit overrides preserved
    const withWaypoints = new URL(
      buildGoogleMapsDirectionsUrl(SLASKIE_TRAIL, {
        origin: { lat: 50.25, lng: 19.02 },
        waypoints: [
          { lat: 50.36, lng: 19.21 },
          { lat: 50.38, lng: 19.22 },
        ],
      }),
    );
    expect(withWaypoints.searchParams.get("origin")).toBe("50.25,19.02");
    expect(withWaypoints.searchParams.get("waypoints")).toBe(
      "50.36,19.21|50.38,19.22",
    );
  });

  it("getTrailStrokeColor maps PTTK trail colors and isPlausibleGoogleMapsApiKey validates keys", () => {
    expect(getTrailStrokeColor("red")).toBe("#DC2626");
    expect(getTrailStrokeColor("blue")).toBe("#2563EB");
    expect(getTrailStrokeColor("green")).toBe("#16A34A");
    expect(getTrailStrokeColor("yellow")).toBe("#EAB308");
    expect(getTrailStrokeColor("black")).toBe("#18181B");
    expect(getTrailStrokeColor("none")).toBe("#FF4D1C");

    expect(isPlausibleGoogleMapsApiKey("")).toBe(false);
    expect(isPlausibleGoogleMapsApiKey("AQ.InvalidPrefixKey123456789")).toBe(
      false,
    );
    expect(isPlausibleGoogleMapsApiKey("AIzaShort")).toBe(false);
    expect(isPlausibleGoogleMapsApiKey("AIzaTestKeyForUnitTests")).toBe(true);
  });

  it("MapActionsBar renders full-route CTA, Dojazd do startu, and conditional Mapa 1:1 (My Maps)", () => {
    const { rerender } = render(<MapActionsBar trail={SLASKIE_TRAIL} />);

    const routeLink = screen.getByRole("link", {
      name: /Otwórz trasę w Google Maps/i,
    });
    expect(routeLink).toHaveAttribute(
      "href",
      buildGoogleMapsRouteUrl(SLASKIE_TRAIL, { forceDirections: true }),
    );
    expect(routeLink.className).toContain("min-h-[44px]");
    expect(routeLink.className).toContain("flex-auto");
    expect(routeLink.className).toContain("sm:flex-initial");
    expect(routeLink.className).not.toContain("min-w-0");
    expect(routeLink.className).not.toContain("flex-1");

    const startLink = screen.getByRole("link", {
      name: /Dojazd do startu/i,
    });
    expect(startLink).toHaveAttribute(
      "href",
      buildGoogleMapsStartNavigationUrl(SLASKIE_TRAIL),
    );
    expect(startLink.className).toContain("min-h-[44px]");

    expect(
      screen.queryByRole("link", { name: /Mapa 1:1 \(My Maps\)/i }),
    ).not.toBeInTheDocument();

    const trailWithMyMaps: Trail = {
      ...SLASKIE_TRAIL,
      googleMapsEmbedUrl: "https://www.google.com/maps/d/viewer?mid=1testMapId",
    };
    rerender(<MapActionsBar trail={trailWithMyMaps} />);

    const myMapsLink = screen.getByRole("link", {
      name: /Mapa 1:1 \(My Maps\)/i,
    });
    expect(myMapsLink).toHaveAttribute(
      "href",
      "https://www.google.com/maps/d/viewer?mid=1testMapId",
    );
    expect(myMapsLink.className).toContain("min-h-[44px]");
    expect(routeLink.className).toContain("flex-auto");
    expect(routeLink.className).not.toContain("min-w-0");

    const gpxAction = screen.getByText(/Pobierz GPX/i).closest("a, button");
    expect(gpxAction).not.toBeNull();
    expect(gpxAction!.className).toContain("min-h-[44px]");

    const shareBtn = screen.getByRole("button", { name: /Udostępnij szlak/i });
    expect(shareBtn.className).toContain("min-h-[44px]");
  });

  it("renders SVG vector fallback with full route and start navigation links when API key is missing", () => {
    render(<TrailGoogleMap trail={SLASKIE_TRAIL} apiKey="" activePointIndex={3} />);

    expect(screen.getByTestId("map-fallback")).toBeInTheDocument();
    expect(screen.getByTestId("fallback-route-path")).toBeInTheDocument();
    expect(screen.getByTestId("fallback-active-point")).toBeInTheDocument();

    const gmapsLink = screen.getByRole("link", {
      name: /Otwórz trasę w Google Maps/i,
    });
    expect(gmapsLink).toHaveAttribute(
      "href",
      buildGoogleMapsRouteUrl(SLASKIE_TRAIL, { forceDirections: true }),
    );
    expect(gmapsLink).toHaveAttribute("target", "_blank");

    const startNavLink = screen.getByRole("link", {
      name: /Dojazd do startu/i,
    });
    expect(startNavLink).toHaveAttribute(
      "href",
      buildGoogleMapsStartNavigationUrl(SLASKIE_TRAIL),
    );
  });

  it("renders SVG vector fallback when API key does not have valid AIza prefix", () => {
    render(
      <TrailGoogleMap
        trail={SLASKIE_TRAIL}
        apiKey="AQ.NonGoogleMapsTokenValue1234567890"
      />,
    );
    expect(screen.getByTestId("map-fallback")).toBeInTheDocument();
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

  it("renders Google Maps provider, double polyline, markers, and pulsing GPS user marker when API key is provided", () => {
    polylineCalls.length = 0;

    const { rerender } = render(
      <TrailGoogleMap
        trail={SLASKIE_TRAIL}
        apiKey="AIzaTestKeyForUnitTests"
        mapTypeId="terrain"
        activePointIndex={2}
        userPosition={{ lat: 50.35, lng: 19.2 }}
        userCenterTrigger={1}
      />,
    );

    const provider = screen.getByTestId("mock-api-provider");
    expect(provider).toHaveAttribute("data-api-key", "AIzaTestKeyForUnitTests");

    const mapEl = screen.getByTestId("mock-google-map");
    expect(mapEl).toHaveAttribute("data-gesture-handling", "cooperative");
    expect(mapEl).toHaveAttribute("data-map-type", "terrain");

    expect(polylineCalls).toHaveLength(2);
    expect(polylineCalls[0].strokeWeight).toBe(8);
    expect(polylineCalls[1].strokeWeight).toBe(4.5);
    expect(polylineCalls[1].strokeColor).toBe(
      getTrailStrokeColor(SLASKIE_TRAIL.trailColor),
    );

    expect(fitBoundsMock).toHaveBeenCalled();
    expect(panToMock).toHaveBeenCalledWith({ lat: 50.35, lng: 19.2 });
    expect(setMapTypeIdMock).toHaveBeenCalledWith("terrain");

    // START + POIs + active elevation point + GPS user marker
    const markers = screen.getAllByTestId("mock-marker");
    expect(markers.length).toBeGreaterThanOrEqual(
      1 + SLASKIE_TRAIL.pois.length + 2,
    );
    expect(
      markers.some(
        (m) => m.getAttribute("data-title") === "Moja aktualna pozycja GPS",
      ),
    ).toBe(true);

    // Subsequent userPosition update without incrementing userCenterTrigger should NOT re-center
    panToMock.mockClear();
    rerender(
      <TrailGoogleMap
        trail={SLASKIE_TRAIL}
        apiKey="AIzaTestKeyForUnitTests"
        mapId="DEMO_MAP_ID"
        mapTypeId="terrain"
        activePointIndex={2}
        userPosition={{ lat: 50.352, lng: 19.202 }}
        userCenterTrigger={1}
      />,
    );
    expect(panToMock).not.toHaveBeenCalled();
    expect(screen.getByTestId("gps-user-marker")).toBeInTheDocument();
  });

  it("TrailMapSection hides layer switcher in fallback mode and shows it in live Google Maps mode", async () => {
    const user = userEvent.setup();

    const { rerender } = render(
      <TrailMapSection trail={SLASKIE_TRAIL} apiKey="" />,
    );

    expect(screen.getByTestId("map-fallback")).toBeInTheDocument();
    expect(
      screen.queryByRole("button", { name: /^Teren$/i }),
    ).not.toBeInTheDocument();
    expect(
      screen.queryByRole("button", { name: /^Mapa$/i }),
    ).not.toBeInTheDocument();
    expect(
      screen.queryByRole("button", { name: /^Satelita$/i }),
    ).not.toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: /Moja pozycja/i }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: /Wyśrodkuj trasę/i }),
    ).toBeInTheDocument();

    rerender(
      <TrailMapSection
        trail={SLASKIE_TRAIL}
        apiKey="AIzaTestKeyForUnitTests"
      />,
    );

    const satBtn = screen.getByRole("button", { name: /^Satelita$/i });
    expect(satBtn).toBeInTheDocument();
    await user.click(satBtn);
    expect(satBtn).toHaveAttribute("aria-pressed", "true");
  });

  it("TrailMapSection coordinates HUD controls, ElevationChart, MapActionsBar, and GPS watchPosition lifecycle", async () => {
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

    let successCb: PositionCallback | null = null;
    const watchPositionMock = vi.fn(
      (onSuccess: PositionCallback) => {
        successCb = onSuccess;
        return 42;
      },
    );
    const clearWatchMock = vi.fn();
    Object.defineProperty(navigator, "geolocation", {
      value: {
        watchPosition: watchPositionMock,
        clearWatch: clearWatchMock,
      },
      configurable: true,
    });

    const { unmount } = render(
      <TrailMapSection
        trail={SLASKIE_TRAIL}
        apiKey="AIzaTestKeyForUnitTests"
      />,
    );

    expect(screen.getByTestId("trail-google-map")).toBeInTheDocument();
    expect(screen.getByTestId("elevation-chart")).toBeInTheDocument();
    expect(screen.getByTestId("map-actions-bar")).toBeInTheDocument();

    // Start GPS tracking
    const gpsBtn = screen.getByRole("button", { name: /Moja pozycja/i });
    expect(gpsBtn).toHaveAttribute("aria-pressed", "false");
    await user.click(gpsBtn);

    expect(watchPositionMock).toHaveBeenCalledTimes(1);
    expect(watchPositionMock).toHaveBeenCalledWith(
      expect.any(Function),
      expect.any(Function),
      expect.objectContaining({ enableHighAccuracy: true }),
    );
    expect(gpsBtn).toHaveAttribute("aria-pressed", "true");

    // Emit first GPS fix -> centers map once
    panToMock.mockClear();
    act(() => {
      successCb?.({
        coords: {
          latitude: 50.345,
          longitude: 19.199,
          accuracy: 10,
          altitude: null,
          altitudeAccuracy: null,
          heading: null,
          speed: null,
          toJSON: () => ({}),
        },
        timestamp: Date.now(),
        toJSON: () => ({}),
      });
    });
    expect(panToMock).toHaveBeenCalledWith({ lat: 50.345, lng: 19.199 });

    // Toggle off -> clearWatch
    await user.click(gpsBtn);
    expect(clearWatchMock).toHaveBeenCalledWith(42);
    expect(gpsBtn).toHaveAttribute("aria-pressed", "false");

    // Start again and unmount -> clearWatch cleanup
    await user.click(gpsBtn);
    expect(watchPositionMock).toHaveBeenCalledTimes(2);
    unmount();
    expect(clearWatchMock).toHaveBeenCalledTimes(2);
  });

  it("TrailMapSection displays non-intrusive Polish message on GPS permission denial and handles missing geolocation", async () => {
    const user = userEvent.setup();
    let errorCb: PositionErrorCallback | null = null;
    const watchPositionMock = vi.fn(
      (_onSuccess: PositionCallback, onError?: PositionErrorCallback | null) => {
        errorCb = onError ?? null;
        return 77;
      },
    );
    const clearWatchMock = vi.fn();

    Object.defineProperty(navigator, "geolocation", {
      value: {
        watchPosition: watchPositionMock,
        clearWatch: clearWatchMock,
      },
      configurable: true,
    });

    const { rerender } = render(
      <TrailMapSection trail={SLASKIE_TRAIL} apiKey="" />,
    );

    const gpsBtn = screen.getByRole("button", { name: /Moja pozycja/i });
    await user.click(gpsBtn);

    act(() => {
      errorCb?.({
        code: 1,
        message: "User denied Geolocation",
        PERMISSION_DENIED: 1,
        POSITION_UNAVAILABLE: 2,
        TIMEOUT: 3,
      });
    });

    expect(screen.getByTestId("gps-error-banner")).toHaveTextContent(
      /Brak zgody na dostęp do lokalizacji GPS/i,
    );
    expect(gpsBtn).toHaveAttribute("aria-pressed", "false");

    await user.click(
      screen.getByRole("button", { name: /Zamknij komunikat GPS/i }),
    );
    expect(screen.queryByTestId("gps-error-banner")).not.toBeInTheDocument();

    // Missing geolocation API
    Object.defineProperty(navigator, "geolocation", {
      value: undefined,
      configurable: true,
    });
    rerender(<TrailMapSection trail={SLASKIE_TRAIL} apiKey="" />);
    await user.click(gpsBtn);
    expect(screen.getByTestId("gps-error-banner")).toHaveTextContent(
      /Geolokalizacja nie jest obsługiwana/i,
    );
  });

  it("TrailMapSection recovers cleanly when watchPosition throws synchronously", async () => {
    const user = userEvent.setup();
    const watchPositionMock = vi.fn(() => {
      throw new DOMException("Only secure origins are allowed", "SecurityError");
    });
    const clearWatchMock = vi.fn();

    Object.defineProperty(navigator, "geolocation", {
      value: {
        watchPosition: watchPositionMock,
        clearWatch: clearWatchMock,
      },
      configurable: true,
    });

    render(<TrailMapSection trail={SLASKIE_TRAIL} apiKey="" />);

    const gpsBtn = screen.getByRole("button", { name: /Moja pozycja/i });
    expect(gpsBtn).toHaveAttribute("aria-pressed", "false");

    await user.click(gpsBtn);

    expect(watchPositionMock).toHaveBeenCalledTimes(1);
    expect(gpsBtn).toHaveAttribute("aria-pressed", "false");
    expect(screen.getByTestId("gps-error-banner")).toHaveTextContent(
      /Nie udało się uruchomić śledzenia lokalizacji GPS/i,
    );
  });

  it("TrailMapSection coordinates ElevationChart hover, Recenter, Fullscreen and Share", async () => {
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

    const chartSvg = screen.getByTestId("elevation-chart-svg");
    fireEvent.mouseMove(chartSvg, { clientX: 300, clientY: 80 });
    expect(screen.getByTestId("fallback-active-point")).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: /Wyśrodkuj trasę/i }));
    expect(
      screen.queryByTestId("fallback-active-point"),
    ).not.toBeInTheDocument();

    const fsBtn = screen.getByRole("button", { name: /Pełny ekran mapy/i });
    await user.click(fsBtn);
    expect(
      screen.getByRole("button", { name: /Zamknij pełny ekran mapy/i }),
    ).toHaveAttribute("aria-pressed", "true");
    fireEvent.keyDown(window, { key: "Escape" });

    const shareBtn = screen.getByRole("button", { name: /Udostępnij szlak/i });
    await user.click(shareBtn);
    await waitFor(() => {
      expect(writeTextMock).toHaveBeenCalledTimes(1);
    });
    expect(screen.getByText("Skopiowano")).toBeInTheDocument();
  });
});
