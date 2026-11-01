/**
 * Ward-level GIS targeting with turf.js (deliberate substitute for PostGIS —
 * see README → Design decisions). Pure functions, no I/O; safe on server and client.
 *
 * Privacy: a citizen's precise point is used only transiently to resolve a
 * ward at onboarding. Only the resulting wardId is stored for routine targeting.
 */
import { booleanPointInPolygon, centroid, distance, lineString, point, pointToLineDistance } from "@turf/turf";
import type { MultiPolygon, Polygon, Position } from "geojson";

/** A point closer than this to any ward boundary is treated as "on the boundary". */
export const BOUNDARY_TOLERANCE_METERS = 40;
/** If the two nearest candidate centroids are within this distance of each other, we refuse to guess. */
export const CENTROID_TIE_TOLERANCE_METERS = 25;

export interface WardShape {
  id: string;
  name: string;
  geojson: unknown;
}

export interface WardCandidate {
  wardId: string;
  name: string;
  centroidDistanceMeters: number;
  boundaryDistanceMeters: number;
  containsPoint: boolean;
}

export type WardResolution =
  | { status: "inside"; wardId: string; requiresConfirmation: false; candidates: WardCandidate[] }
  /** Near a boundary: the nearest-centroid ward wins, but the citizen must confirm it. */
  | { status: "near_boundary"; wardId: string; requiresConfirmation: true; candidates: WardCandidate[] }
  /** Centroids are effectively tied: no ward is pre-selected; the citizen must choose. */
  | { status: "ambiguous"; wardId: null; requiresConfirmation: true; candidates: WardCandidate[] }
  | { status: "outside"; wardId: null; requiresConfirmation: true; candidates: WardCandidate[] };

function isPosition(value: unknown): value is Position {
  return (
    Array.isArray(value) &&
    value.length >= 2 &&
    typeof value[0] === "number" &&
    typeof value[1] === "number" &&
    Number.isFinite(value[0]) &&
    Number.isFinite(value[1])
  );
}

function isRing(value: unknown): value is Position[] {
  return Array.isArray(value) && value.length >= 4 && value.every(isPosition);
}

/** Validates stored GeoJSON (a geometry or a Feature wrapping one). Returns null when unusable. */
export function parseWardGeometry(geojson: unknown): Polygon | MultiPolygon | null {
  if (!geojson || typeof geojson !== "object") return null;
  const candidate = (geojson as { type?: string; geometry?: unknown }).type === "Feature"
    ? (geojson as { geometry?: unknown }).geometry
    : geojson;
  if (!candidate || typeof candidate !== "object") return null;
  const { type, coordinates } = candidate as { type?: unknown; coordinates?: unknown };
  if (type === "Polygon" && Array.isArray(coordinates) && coordinates.length > 0 && coordinates.every(isRing)) {
    return { type: "Polygon", coordinates: coordinates as Position[][] };
  }
  if (
    type === "MultiPolygon" &&
    Array.isArray(coordinates) &&
    coordinates.length > 0 &&
    coordinates.every((poly) => Array.isArray(poly) && poly.length > 0 && poly.every(isRing))
  ) {
    return { type: "MultiPolygon", coordinates: coordinates as Position[][][] };
  }
  return null;
}

function rings(geometry: Polygon | MultiPolygon): Position[][] {
  return geometry.type === "Polygon" ? geometry.coordinates : geometry.coordinates.flat();
}

/** Shortest distance (metres) from the point to any ring of the ward boundary. */
export function distanceToBoundaryMeters(lng: number, lat: number, geometry: Polygon | MultiPolygon): number {
  const pt = point([lng, lat]);
  let best = Number.POSITIVE_INFINITY;
  for (const ring of rings(geometry)) {
    best = Math.min(best, pointToLineDistance(pt, lineString(ring), { units: "meters" }));
  }
  return best;
}

export function isValidLatLng(lat: number, lng: number): boolean {
  return Number.isFinite(lat) && Number.isFinite(lng) && lat >= -90 && lat <= 90 && lng >= -180 && lng <= 180;
}

/**
 * Resolve which ward a point belongs to, deterministically:
 *  1. Strictly inside exactly one ward and not within tolerance of any boundary → that ward.
 *  2. Near a boundary (or inside several) → candidates are the containing / nearby wards;
 *     nearest ward centroid wins, and the UI asks the citizen to confirm.
 *  3. If the two nearest candidate centroids are within CENTROID_TIE_TOLERANCE_METERS,
 *     it is ambiguous: nothing is pre-selected and the citizen must pick.
 *  4. Not inside or near any ward → outside the service area.
 */
export function resolveWardForPoint(lat: number, lng: number, wards: WardShape[]): WardResolution {
  if (!isValidLatLng(lat, lng)) {
    return { status: "outside", wardId: null, requiresConfirmation: true, candidates: [] };
  }
  const pt = point([lng, lat]);
  const infos: WardCandidate[] = [];
  for (const ward of wards) {
    const geometry = parseWardGeometry(ward.geojson);
    if (!geometry) continue;
    infos.push({
      wardId: ward.id,
      name: ward.name,
      containsPoint: booleanPointInPolygon(pt, geometry),
      boundaryDistanceMeters: distanceToBoundaryMeters(lng, lat, geometry),
      centroidDistanceMeters: distance(pt, centroid(geometry), { units: "meters" }),
    });
  }

  const byCentroid = (a: WardCandidate, b: WardCandidate) => a.centroidDistanceMeters - b.centroidDistanceMeters;
  const containing = infos.filter((i) => i.containsPoint);
  const nearBoundary = infos.filter((i) => i.boundaryDistanceMeters <= BOUNDARY_TOLERANCE_METERS);

  if (containing.length === 1 && nearBoundary.length === 0) {
    return { status: "inside", wardId: containing[0]!.wardId, requiresConfirmation: false, candidates: containing };
  }

  const candidates = [...new Map([...containing, ...nearBoundary].map((c) => [c.wardId, c])).values()].sort(byCentroid);

  if (candidates.length === 0) {
    return { status: "outside", wardId: null, requiresConfirmation: true, candidates: [...infos].sort(byCentroid).slice(0, 3) };
  }

  const [first, second] = candidates;
  if (second && second.centroidDistanceMeters - first!.centroidDistanceMeters <= CENTROID_TIE_TOLERANCE_METERS) {
    return { status: "ambiguous", wardId: null, requiresConfirmation: true, candidates };
  }
  return { status: "near_boundary", wardId: first!.wardId, requiresConfirmation: true, candidates };
}

/**
 * Location matching used by the notification engine. Targeting is ward-level:
 * the citizen's ward was resolved from a point (above) at registration and only
 * the wardId is stored. A citizen without a ward is never "in" any ward.
 */
export function citizenInWard(citizen: { wardId: string | null | undefined }, wardId: string): boolean {
  return typeof citizen.wardId === "string" && citizen.wardId.length > 0 && citizen.wardId === wardId;
}
