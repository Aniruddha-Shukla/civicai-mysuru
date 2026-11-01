import { describe, expect, it } from "vitest";
import { DEMO_WARDS } from "@/lib/demo/wards";
import {
  BOUNDARY_TOLERANCE_METERS,
  citizenInWard,
  parseWardGeometry,
  resolveWardForPoint,
  type WardShape,
} from "@/lib/geo";

const wards: WardShape[] = DEMO_WARDS.map((w) => ({ id: w.key, name: w.name, geojson: w.geojson }));
// Shared edges of the demo grid: x = 76.655 (west|east), y = 12.31 (north|south).

describe("resolveWardForPoint", () => {
  it("point well inside a ward → that ward, no confirmation needed", () => {
    const r = resolveWardForPoint(12.32, 76.64, wards);
    expect(r).toMatchObject({ status: "inside", wardId: "w1", requiresConfirmation: false });
  });

  it("point well outside every ward → outside, nothing selected", () => {
    const r = resolveWardForPoint(12.5, 76.9, wards);
    expect(r.status).toBe("outside");
    expect(r.wardId).toBeNull();
    expect(r.requiresConfirmation).toBe(true);
  });

  it("point a few metres from the w1|w2 boundary → nearest centroid wins, but citizen must confirm", () => {
    // ~33 m west of the shared edge (inside the 40 m tolerance), clearly nearer w1's centroid.
    const r = resolveWardForPoint(12.32, 76.6547, wards);
    expect(r.status).toBe("near_boundary");
    expect(r.wardId).toBe("w1");
    expect(r.requiresConfirmation).toBe(true);
    expect(r.candidates.map((c) => c.wardId).sort()).toEqual(["w1", "w2"]);
  });

  it("point exactly on a shared boundary, equidistant from both centroids → ambiguous, nothing pre-selected", () => {
    const r = resolveWardForPoint(12.32, 76.655, wards);
    expect(r.status).toBe("ambiguous");
    expect(r.wardId).toBeNull();
    expect(r.requiresConfirmation).toBe(true);
  });

  it("point exactly on the four-ward corner → ambiguous", () => {
    const r = resolveWardForPoint(12.31, 76.655, wards);
    expect(r.status).toBe("ambiguous");
    expect(r.candidates).toHaveLength(4);
  });

  it("point just outside the service area but within tolerance → near_boundary for that ward", () => {
    // ~20 m north of w1's northern edge (12.33)
    const r = resolveWardForPoint(12.33018, 76.64, wards);
    expect(BOUNDARY_TOLERANCE_METERS).toBeGreaterThan(20);
    expect(r).toMatchObject({ status: "near_boundary", wardId: "w1" });
  });

  it("invalid coordinates never throw", () => {
    expect(resolveWardForPoint(Number.NaN, 76.64, wards).status).toBe("outside");
    expect(resolveWardForPoint(120, 76.64, wards).status).toBe("outside");
  });

  it("skips malformed stored GeoJSON instead of crashing", () => {
    const r = resolveWardForPoint(12.32, 76.64, [...wards, { id: "bad", name: "Bad", geojson: { type: "Polygon", coordinates: [[1, 2]] } }]);
    expect(r.wardId).toBe("w1");
    expect(parseWardGeometry({ type: "Point", coordinates: [1, 2] })).toBeNull();
  });
});

describe("citizenInWard", () => {
  it("matches only the citizen's registered ward", () => {
    expect(citizenInWard({ wardId: "w1" }, "w1")).toBe(true);
    expect(citizenInWard({ wardId: "w2" }, "w1")).toBe(false);
    expect(citizenInWard({ wardId: null }, "w1")).toBe(false);
  });
});
