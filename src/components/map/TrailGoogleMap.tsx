"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  APILoadingStatus,
  APIProvider,
  AdvancedMarker,
  InfoWindow,
  Map as GoogleMap,
  Marker,
  useApiLoadingStatus,
  useMap,
  useMapsLibrary,
} from "@vis.gl/react-google-maps";
import {
  POI_CATEGORY_LABELS,
  getRegionInfo,
  type PoiCategory,
} from "@/lib/constants/regions";
import { formatDistance } from "@/lib/utils/format";
import type { Trail } from "@/types/trail";
import { MapFallback } from "@/components/map/MapFallback";
import {
  buildGoogleMapsDirectionsUrl,
  getRouteBoundsAndCenter,
  getTrailOutlineColor,
  getTrailStrokeColor,
  type LatLngPoint,
} from "@/components/map/utils";

export type MapTypeOption = "terrain" | "roadmap" | "hybrid";

export interface TrailGoogleMapProps {
  trail: Trail;
  apiKey?: string;
  mapId?: string;
  mapTypeId?: MapTypeOption;
  activePointIndex?: number | null;
  recenterTrigger?: number;
  userPosition?: LatLngPoint | null;
  userCenterTrigger?: number;
  onFallbackChange?: (isFallback: boolean) => void;
  className?: string;
}

export function isPlausibleGoogleMapsApiKey(apiKey?: string): boolean {
  const resolved = (
    apiKey !== undefined
      ? apiKey
      : (process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY ?? "")
  ).trim();
  return resolved.length >= 20 && resolved.startsWith("AIza");
}

interface SelectedInfoState {
  id: string;
  title: string;
  subtitle?: string;
  description?: string | null;
  position: { lat: number; lng: number };
}

function createPinDataUri(fill: string, label: string, stroke = "#FFFFFF"): string {
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="32" height="32" viewBox="0 0 32 32"><circle cx="16" cy="16" r="12" fill="${fill}" stroke="${stroke}" stroke-width="3"/><text x="16" y="20" text-anchor="middle" fill="#FFFFFF" font-family="Arial,sans-serif" font-size="11" font-weight="700">${label}</text></svg>`;
  return `data:image/svg+xml;charset=UTF-8,${encodeURIComponent(svg)}`;
}

const START_ICON_URI = createPinDataUri("#16A34A", "S");
const END_ICON_URI = createPinDataUri("#E11D48", "M");
const POI_ICON_URI = createPinDataUri("#0284C7", "P");
const ACTIVE_ICON_URI = createPinDataUri("#FF4D1C", "•");
const USER_GPS_ICON_URI = (() => {
  const svg =
    '<svg xmlns="http://www.w3.org/2000/svg" width="36" height="36" viewBox="0 0 36 36"><circle cx="18" cy="18" r="15" fill="#38BDF8" fill-opacity="0.32"/><circle cx="18" cy="18" r="8" fill="#2563EB" stroke="#FFFFFF" stroke-width="3"/></svg>';
  return `data:image/svg+xml;charset=UTF-8,${encodeURIComponent(svg)}`;
})();

function getPoiCategoryLabel(category: string | null): string {
  if (!category) return "Punkt na trasie";
  if (Object.prototype.hasOwnProperty.call(POI_CATEGORY_LABELS, category)) {
    return POI_CATEGORY_LABELS[category as PoiCategory];
  }
  return "Punkt na trasie";
}

interface TrailMapInnerProps {
  trail: Trail;
  hasMapId: boolean;
  mapTypeId: MapTypeOption;
  activePointIndex: number | null;
  recenterTrigger: number;
  userPosition: LatLngPoint | null;
  userCenterTrigger: number;
  onFallbackRequired: () => void;
}

function TrailMapInner({
  trail,
  hasMapId,
  mapTypeId,
  activePointIndex,
  recenterTrigger,
  userPosition,
  userCenterTrigger,
  onFallbackRequired,
}: TrailMapInnerProps) {
  const map = useMap();
  const mapsLib = useMapsLibrary("maps");
  const apiStatus = useApiLoadingStatus();
  const [selectedInfo, setSelectedInfo] = useState<SelectedInfoState | null>(
    null,
  );
  const lastCenteredTriggerRef = useRef(0);

  const geometry = useMemo(() => getRouteBoundsAndCenter(trail), [trail]);
  const strokeColor = getTrailStrokeColor(trail.trailColor);
  const outlineColor = getTrailOutlineColor(trail.trailColor);

  useEffect(() => {
    if (
      apiStatus === APILoadingStatus.FAILED ||
      apiStatus === APILoadingStatus.AUTH_FAILURE
    ) {
      onFallbackRequired();
    }
  }, [apiStatus, onFallbackRequired]);

  // Synchronize mapTypeId
  useEffect(() => {
    if (!map) return;
    map.setMapTypeId(mapTypeId);
  }, [map, mapTypeId]);

  // Fit bounds on initial load and whenever recenterTrigger changes
  useEffect(() => {
    if (!map) return;
    if (geometry.bounds) {
      map.fitBounds(geometry.bounds, {
        top: 56,
        right: 36,
        bottom: 44,
        left: 36,
      });
    } else {
      map.panTo(geometry.center);
    }
  }, [map, geometry.bounds, geometry.center, recenterTrigger]);

  // Center map once when first GPS fix arrives (or userCenterTrigger increments)
  useEffect(() => {
    if (
      !map ||
      !userPosition ||
      userCenterTrigger <= 0 ||
      userCenterTrigger === lastCenteredTriggerRef.current
    ) {
      return;
    }
    lastCenteredTriggerRef.current = userCenterTrigger;
    map.panTo(userPosition);
    const currentZoom = map.getZoom?.();
    if (typeof currentZoom === "number" && currentZoom < 14) {
      map.setZoom?.(14);
    }
  }, [map, userCenterTrigger, userPosition]);

  // Render double Polyline (outline + primary PTTK stroke)
  useEffect(() => {
    if (!map || !mapsLib || trail.routePoints.length < 2) {
      return;
    }

    const path = trail.routePoints.map((pt) => ({ lat: pt.lat, lng: pt.lng }));

    const outlinePolyline = new mapsLib.Polyline({
      path,
      geodesic: true,
      strokeColor: outlineColor,
      strokeOpacity: 0.92,
      strokeWeight: 8,
      zIndex: 10,
      map,
    });

    const mainPolyline = new mapsLib.Polyline({
      path,
      geodesic: true,
      strokeColor,
      strokeOpacity: 1,
      strokeWeight: 4.5,
      zIndex: 20,
      map,
    });

    return () => {
      outlinePolyline.setMap(null);
      mainPolyline.setMap(null);
    };
  }, [map, mapsLib, trail.routePoints, strokeColor, outlineColor]);

  const activePoint =
    activePointIndex !== null &&
    activePointIndex >= 0 &&
    activePointIndex < trail.routePoints.length
      ? trail.routePoints[activePointIndex]
      : null;

  const renderMarker = (params: {
    key: string;
    position: { lat: number; lng: number };
    title: string;
    badgeText: string;
    badgeBg: string;
    iconUri: string;
    zIndex?: number;
    onClick?: () => void;
  }) => {
    if (hasMapId) {
      return (
        <AdvancedMarker
          key={params.key}
          position={params.position}
          title={params.title}
          zIndex={params.zIndex}
          onClick={params.onClick}
        >
          <span
            className="inline-flex h-7 min-w-[28px] items-center justify-center rounded-full border-2 border-white px-2 font-mono text-[11px] font-bold text-white shadow-md"
            style={{ backgroundColor: params.badgeBg }}
          >
            {params.badgeText}
          </span>
        </AdvancedMarker>
      );
    }

    return (
      <Marker
        key={params.key}
        position={params.position}
        title={params.title}
        icon={params.iconUri}
        zIndex={params.zIndex}
        onClick={params.onClick}
      />
    );
  };

  return (
    <>
      {geometry.startPoint &&
        renderMarker({
          key: "start-marker",
          position: geometry.startPoint,
          title: trail.isLoop ? "START / META" : "START trasy",
          badgeText: trail.isLoop ? "START / META" : "START",
          badgeBg: "#16A34A",
          iconUri: START_ICON_URI,
          zIndex: 40,
          onClick: () => {
            if (!geometry.startPoint) return;
            setSelectedInfo({
              id: "start",
              title: trail.isLoop ? "Start i meta pętli" : "Start trasy",
              subtitle: trail.title,
              description: `Długość trasy: ${formatDistance(trail.distanceKm)}`,
              position: geometry.startPoint,
            });
          },
        })}

      {geometry.endPoint &&
        !trail.isLoop &&
        renderMarker({
          key: "end-marker",
          position: geometry.endPoint,
          title: "META trasy",
          badgeText: "META",
          badgeBg: "#E11D48",
          iconUri: END_ICON_URI,
          zIndex: 35,
          onClick: () => {
            if (!geometry.endPoint) return;
            setSelectedInfo({
              id: "end",
              title: "Meta trasy",
              subtitle: trail.title,
              description: "Punkt końcowy szlaku",
              position: geometry.endPoint,
            });
          },
        })}

      {trail.pois.map((poi) =>
        renderMarker({
          key: poi.id,
          position: { lat: poi.lat, lng: poi.lng },
          title: poi.name,
          badgeText: "POI",
          badgeBg: "#0284C7",
          iconUri: POI_ICON_URI,
          zIndex: 30,
          onClick: () =>
            setSelectedInfo({
              id: poi.id,
              title: poi.name,
              subtitle: getPoiCategoryLabel(poi.category),
              description: poi.description,
              position: { lat: poi.lat, lng: poi.lng },
            }),
        }),
      )}

      {activePoint &&
        (hasMapId ? (
          <AdvancedMarker
            position={{ lat: activePoint.lat, lng: activePoint.lng }}
            zIndex={60}
            title="Wybrany punkt profilu wysokościowego"
          >
            <span className="flex h-5 w-5 items-center justify-center rounded-full border-2 border-white bg-[#FF4D1C] shadow-lg ring-4 ring-[#FF4D1C]/35" />
          </AdvancedMarker>
        ) : (
          <Marker
            position={{ lat: activePoint.lat, lng: activePoint.lng }}
            icon={ACTIVE_ICON_URI}
            zIndex={60}
            title="Wybrany punkt profilu wysokościowego"
          />
        ))}

      {userPosition &&
        (hasMapId ? (
          <AdvancedMarker
            position={userPosition}
            zIndex={70}
            title="Moja aktualna pozycja GPS"
          >
            <span
              data-testid="gps-user-marker"
              className="relative flex h-6 w-6 items-center justify-center"
            >
              <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-[#38BDF8] opacity-75" />
              <span className="relative inline-flex h-3.5 w-3.5 rounded-full border-2 border-white bg-[#2563EB] shadow-md" />
            </span>
          </AdvancedMarker>
        ) : (
          <Marker
            position={userPosition}
            icon={USER_GPS_ICON_URI}
            zIndex={70}
            title="Moja aktualna pozycja GPS"
          />
        ))}

      {selectedInfo && (
        <InfoWindow
          position={selectedInfo.position}
          onCloseClick={() => setSelectedInfo(null)}
        >
          <div className="max-w-[240px] space-y-1 p-1 text-[#11161A]">
            {selectedInfo.subtitle && (
              <p className="font-mono text-[10px] font-semibold uppercase tracking-wider text-[#0284C7]">
                {selectedInfo.subtitle}
              </p>
            )}
            <p className="text-sm font-bold leading-snug text-[#11161A]">
              {selectedInfo.title}
            </p>
            {selectedInfo.description && (
              <p className="text-xs leading-relaxed text-[#4E5D6C]">
                {selectedInfo.description}
              </p>
            )}
            <a
              href={buildGoogleMapsDirectionsUrl({
                startLat: selectedInfo.position.lat,
                startLng: selectedInfo.position.lng,
              })}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-block pt-1 text-xs font-semibold text-[#FF4D1C] underline underline-offset-2"
            >
              Nawiguj do punktu
            </a>
          </div>
        </InfoWindow>
      )}
    </>
  );
}

export function TrailGoogleMap({
  trail,
  apiKey,
  mapId,
  mapTypeId = "terrain",
  activePointIndex = null,
  recenterTrigger = 0,
  userPosition = null,
  userCenterTrigger = 0,
  onFallbackChange,
  className,
}: TrailGoogleMapProps) {
  const [hasLoadError, setHasLoadError] = useState(false);

  const resolvedApiKey = (
    apiKey !== undefined
      ? apiKey
      : (process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY ?? "")
  ).trim();

  const resolvedMapId = (
    mapId !== undefined
      ? mapId
      : (process.env.NEXT_PUBLIC_GOOGLE_MAPS_MAP_ID ?? "")
  ).trim();

  const geometry = useMemo(() => getRouteBoundsAndCenter(trail), [trail]);
  const regionInfo = getRegionInfo(trail.region);

  const handleFallback = useCallback(() => {
    setHasLoadError(true);
  }, []);

  useEffect(() => {
    if (typeof window === "undefined") return;
    const win = window as Window & { gm_authFailure?: () => void };
    const previousHandler = win.gm_authFailure;
    win.gm_authFailure = () => {
      setHasLoadError(true);
      previousHandler?.();
    };
    return () => {
      if (win.gm_authFailure) {
        win.gm_authFailure = previousHandler;
      }
    };
  }, []);

  const isPlausibleGoogleMapsKey = isPlausibleGoogleMapsApiKey(resolvedApiKey);
  const isFallback = !isPlausibleGoogleMapsKey || hasLoadError;

  useEffect(() => {
    onFallbackChange?.(isFallback);
  }, [isFallback, onFallbackChange]);

  if (isFallback) {
    return (
      <MapFallback
        trail={trail}
        activePointIndex={activePointIndex}
        className={className}
      />
    );
  }

  return (
    <div
      data-testid="trail-google-map"
      className={className ?? "h-full w-full"}
    >
      <APIProvider
        apiKey={resolvedApiKey}
        language="pl"
        region="PL"
        onError={handleFallback}
      >
        <GoogleMap
          className="h-full w-full"
          {...(geometry.bounds
            ? {
                defaultBounds: {
                  ...geometry.bounds,
                  padding: 48,
                },
              }
            : {
                defaultCenter: geometry.center,
                defaultZoom: regionInfo.defaultZoom,
              })}
          mapId={resolvedMapId || undefined}
          mapTypeId={mapTypeId}
          gestureHandling="cooperative"
          mapTypeControl={false}
          streetViewControl={false}
          fullscreenControl={false}
          zoomControl={true}
        >
          <TrailMapInner
            trail={trail}
            hasMapId={Boolean(resolvedMapId)}
            mapTypeId={mapTypeId}
            activePointIndex={activePointIndex}
            recenterTrigger={recenterTrigger}
            userPosition={userPosition}
            userCenterTrigger={userCenterTrigger}
            onFallbackRequired={handleFallback}
          />
        </GoogleMap>
      </APIProvider>
    </div>
  );
}
