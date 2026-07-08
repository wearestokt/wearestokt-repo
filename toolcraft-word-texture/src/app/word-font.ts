/**
 * Resolves Tay Big Bird typography into concrete numbers the layout and
 * renderers consume. Family, case, and weight are fixed for this brand app.
 */

import { brandFontFaces, getBrandFontFamily } from "./brand-fonts";

const FALLBACK_STACK = `"IBM Plex Mono", ui-monospace, monospace`;
const BRAND_WEIGHT = 400;
const LINE_HEIGHT_FACTOR = 1.375;

export type ResolvedTypography = {
  family: string;
  fontSize: number;
  letterSpacingEm: number;
  lineHeightFactor: number;
  opacity: number;
  textCase: "uppercase";
  weight: number;
};

export function resolveTypography(fontSize: number): ResolvedTypography {
  const brandFamily = getBrandFontFamily();
  const family = brandFamily
    ? `"${brandFamily}", ${FALLBACK_STACK}`
    : FALLBACK_STACK;

  return {
    family,
    fontSize: Math.max(4, fontSize),
    letterSpacingEm: 0,
    lineHeightFactor: LINE_HEIGHT_FACTOR,
    opacity: 1,
    textCase: "uppercase",
    weight: BRAND_WEIGHT,
  };
}

export function buildCanvasFont(typography: ResolvedTypography, weight = typography.weight): string {
  return `${weight} ${typography.fontSize}px ${typography.family}`;
}

let brandFontLoadPromise: Promise<void> | null = null;

/** Registers configured brand font files with document.fonts (idempotent). */
export async function ensureBrandFontsLoaded(): Promise<void> {
  if (brandFontFaces.length === 0 || typeof document === "undefined") {
    return;
  }

  brandFontLoadPromise ??= Promise.all(
    brandFontFaces.map(async (face) => {
      const fontFace = new FontFace(face.family, `url("${face.url}")`, {
        weight: String(face.weight),
      });
      try {
        document.fonts.add(await fontFace.load());
      } catch {
        // Missing or invalid file: fall back to monospace stack.
      }
    }),
  ).then(() => undefined);

  await brandFontLoadPromise;
}
