"use client";

import "mapbox-gl/dist/mapbox-gl.css";
import type { FeatureCollection } from "geojson";
import type { Map as MapboxMap, Marker } from "mapbox-gl";
import { useEffect, useRef } from "react";

export interface MapWard {
  id: string;
  name: string;
  geojson: unknown;
}

/**
 * Mapbox GL ward map. Any failure (invalid token, no WebGL, network) calls `onFail`
 * and the page keeps working with the plain ward list — the map is an enhancement only.
 */
export default function WardMap({
  token,
  wards,
  center,
  selectedWardId,
  pin,
  onPick,
  onFail,
}: {
  token: string;
  wards: MapWard[];
  center: { lng: number; lat: number; zoom: number };
  selectedWardId: string | null;
  pin: { lat: number; lng: number } | null;
  onPick: (lat: number, lng: number) => void;
  onFail: () => void;
}) {
  const container = useRef<HTMLDivElement>(null);
  const mapRef = useRef<MapboxMap | null>(null);
  const markerRef = useRef<Marker | null>(null);
  const loaded = useRef(false);
  const callbacks = useRef({ onPick, onFail });
  callbacks.current = { onPick, onFail };

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const mapboxgl = (await import("mapbox-gl")).default;
        if (cancelled || !container.current) return;
        mapboxgl.accessToken = token;
        const map = new mapboxgl.Map({
          container: container.current,
          style: "mapbox://styles/mapbox/streets-v12",
          center: [center.lng, center.lat],
          zoom: center.zoom,
          cooperativeGestures: true,
        });
        mapRef.current = map;
        map.addControl(new mapboxgl.NavigationControl({ showCompass: false }), "top-right");
        map.on("error", (event) => {
          const status = (event.error as { status?: number } | undefined)?.status;
          if (!loaded.current || status === 401 || status === 403) callbacks.current.onFail();
        });
        map.on("load", () => {
          loaded.current = true;
          const data: FeatureCollection = {
            type: "FeatureCollection",
            features: wards.map((w) => ({
              type: "Feature",
              properties: { id: w.id, name: w.name },
              geometry: w.geojson as GeoJSON.Polygon,
            })),
          };
          map.addSource("wards", { type: "geojson", data });
          map.addLayer({ id: "wards-fill", type: "fill", source: "wards", paint: { "fill-color": "#0f766e", "fill-opacity": 0.08 } });
          map.addLayer({
            id: "wards-selected",
            type: "fill",
            source: "wards",
            paint: { "fill-color": "#0f766e", "fill-opacity": 0.28 },
            filter: ["==", ["get", "id"], selectedWardId ?? ""],
          });
          map.addLayer({ id: "wards-line", type: "line", source: "wards", paint: { "line-color": "#0f766e", "line-width": 1.5 } });
          map.addLayer({
            id: "wards-label",
            type: "symbol",
            source: "wards",
            layout: { "text-field": ["get", "name"], "text-size": 11 },
            paint: { "text-color": "#134e4a", "text-halo-color": "#ffffff", "text-halo-width": 1.2 },
          });
        });
        map.on("click", (event) => callbacks.current.onPick(event.lngLat.lat, event.lngLat.lng));
      } catch {
        callbacks.current.onFail();
      }
    })();
    return () => {
      cancelled = true;
      mapRef.current?.remove();
      mapRef.current = null;
    };
    // The map is created once; selection and pin updates are applied below.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token]);

  useEffect(() => {
    const map = mapRef.current;
    if (map && loaded.current && map.getLayer("wards-selected")) {
      map.setFilter("wards-selected", ["==", ["get", "id"], selectedWardId ?? ""]);
    }
  }, [selectedWardId]);

  useEffect(() => {
    const map = mapRef.current;
    if (!map || !pin) return;
    void import("mapbox-gl").then(({ default: mapboxgl }) => {
      markerRef.current?.remove();
      markerRef.current = new mapboxgl.Marker({ color: "#0f766e" }).setLngLat([pin.lng, pin.lat]).addTo(map);
    });
  }, [pin]);

  return <div ref={container} className="h-64 w-full overflow-hidden rounded-lg border sm:h-80" role="application" aria-label="Ward map" />;
}
