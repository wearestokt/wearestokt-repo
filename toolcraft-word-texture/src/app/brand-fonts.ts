/**
 * Project font files.
 *
 * Drop font files into `public/fonts/` (TTF/OTF preferred) and register them
 * below. Two registries:
 *
 * - `brandFontFaces`: the project's brand typeface. When at least one face is
 *   registered here, Word Tide renders every word with it and the font
 *   picker's family selection becomes the fallback. Leave empty to let the
 *   font picker own the family.
 * - `outlineFontFiles`: local binaries used by the SVG "Outlined paths"
 *   export to convert words into vector paths. Entries here do not change
 *   rendering; they only enable outline conversion for the matching family.
 */

export type BrandFontFace = {
  /** CSS font family name of this file, e.g. "IBM Plex Mono". */
  family: string;
  /** URL under public/, e.g. "/fonts/MyFont-Regular.ttf". */
  url: string;
  /** Numeric weight of this file, e.g. 400 or 700. */
  weight: number;
};

export const brandFontFaces: readonly BrandFontFace[] = [
  { family: "Tay Big Bird", url: "/fonts/TAYBigBird.otf", weight: 400 },
];

/** IBM Plex Mono (OFL) ships with the app so default SVG outlines work. */
export const outlineFontFiles: readonly BrandFontFace[] = [
  { family: "IBM Plex Mono", url: "/fonts/IBMPlexMono-Thin.ttf", weight: 100 },
  { family: "IBM Plex Mono", url: "/fonts/IBMPlexMono-ExtraLight.ttf", weight: 200 },
  { family: "IBM Plex Mono", url: "/fonts/IBMPlexMono-Light.ttf", weight: 300 },
  { family: "IBM Plex Mono", url: "/fonts/IBMPlexMono-Regular.ttf", weight: 400 },
  { family: "IBM Plex Mono", url: "/fonts/IBMPlexMono-Medium.ttf", weight: 500 },
  { family: "IBM Plex Mono", url: "/fonts/IBMPlexMono-SemiBold.ttf", weight: 600 },
  { family: "IBM Plex Mono", url: "/fonts/IBMPlexMono-Bold.ttf", weight: 700 },
];

export function getBrandFontFamily(): string | null {
  return brandFontFaces[0]?.family ?? null;
}

export function getBrandFontWeights(): number[] {
  return Array.from(new Set(brandFontFaces.map((face) => face.weight))).sort(
    (a, b) => a - b,
  );
}

/** All local font binaries usable for outline conversion. */
export function getOutlineFontFiles(): readonly BrandFontFace[] {
  return [...brandFontFaces, ...outlineFontFiles];
}
