/**
 * ILLUSTRATIVE DEMO WARD BOUNDARIES — NOT OFFICIAL MCC WARD SHAPEFILES.
 *
 * Four simple adjacent rectangles laid out as a 2×2 grid around central Mysuru,
 * sharing edges so that boundary handling can be demonstrated. A real deployment
 * would import the official ward boundaries from Mysuru City Corporation / Survey
 * of India instead (see README → Limitations).
 */
import type { Polygon } from "geojson";

export interface DemoWard {
  key: "w1" | "w2" | "w3" | "w4";
  name: string;
  zone: string;
  geojson: Polygon;
}

const LNG = { west: 76.63, mid: 76.655, east: 76.68 };
const LAT = { south: 12.29, mid: 12.31, north: 12.33 };

function box(west: number, south: number, east: number, north: number): Polygon {
  return {
    type: "Polygon",
    coordinates: [
      [
        [west, south],
        [east, south],
        [east, north],
        [west, north],
        [west, south],
      ],
    ],
  };
}

export const DEMO_WARDS: DemoWard[] = [
  { key: "w1", name: "Ward 1 – Chamarajapuram", zone: "Zone 1", geojson: box(LNG.west, LAT.mid, LNG.mid, LAT.north) },
  { key: "w2", name: "Ward 2 – Devaraja Mohalla", zone: "Zone 1", geojson: box(LNG.mid, LAT.mid, LNG.east, LAT.north) },
  { key: "w3", name: "Ward 3 – Lakshmipuram", zone: "Zone 2", geojson: box(LNG.west, LAT.south, LNG.mid, LAT.mid) },
  { key: "w4", name: "Ward 4 – Nazarbad", zone: "Zone 2", geojson: box(LNG.mid, LAT.south, LNG.east, LAT.mid) },
];

/** Map centre for the demo area. */
export const DEMO_MAP_CENTER = { lng: LNG.mid, lat: LAT.mid, zoom: 12.5 };
