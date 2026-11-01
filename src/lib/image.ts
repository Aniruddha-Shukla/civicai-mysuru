import type { PHOTO_MIME_TYPES } from "@/lib/constants";

export type PhotoMime = (typeof PHOTO_MIME_TYPES)[number];

/**
 * Identify an image by its magic bytes. The browser-declared MIME type is not trusted:
 * a renamed .html or .svg file is rejected even if it claims to be image/jpeg.
 */
export function sniffImageType(bytes: Uint8Array): PhotoMime | null {
  if (bytes.length >= 3 && bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff) return "image/jpeg";
  const png = [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a];
  if (bytes.length >= 8 && png.every((b, i) => bytes[i] === b)) return "image/png";
  const ascii = (from: number, to: number) => String.fromCharCode(...bytes.slice(from, to));
  if (bytes.length >= 12 && ascii(0, 4) === "RIFF" && ascii(8, 12) === "WEBP") return "image/webp";
  return null;
}

export const EXTENSION_FOR: Record<PhotoMime, string> = { "image/jpeg": "jpg", "image/png": "png", "image/webp": "webp" };
