/**
 * SVG export: placed `<text>` elements sharing the preview layout, or
 * print-ready `<path>` outlines shaped with local font binaries.
 */

import {
  Font,
  UnicodeBuffer,
  getGlyphPath,
  glyphBufferToShapedGlyphs,
  shape,
} from "text-shaper";

import { getOutlineFontFiles } from "./brand-fonts";
import type { PlacedWord } from "./word-layout-types";
import type { ResolvedTypography } from "./word-font";
import type { WordTideLayout } from "./word-tide-renderer";

export type WordTideSvgOptions = {
  backgroundHex: string;
  height: number;
  highlightColor: string;
  includeBackground: boolean;
  layout: WordTideLayout;
  /** "editable" keeps <text> elements; "outlines" converts to <path>. */
  textMode: "editable" | "outlines";
  width: number;
};

function escapeXml(value: string): string {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;");
}

function round2(value: number): number {
  return Math.round(value * 100) / 100;
}

function wordTransform(word: PlacedWord): string {
  const degrees = (word.angle * 180) / Math.PI;
  return word.angle === 0
    ? `translate(${round2(word.x)} ${round2(word.y)})`
    : `translate(${round2(word.x)} ${round2(word.y)}) rotate(${round2(degrees)})`;
}

function buildHighlightRects(
  words: readonly PlacedWord[],
  typography: ResolvedTypography,
  highlightColor: string,
): string[] {
  const fontSize = typography.fontSize;
  const padX = fontSize * 0.18;
  const ascent = fontSize * 0.82;
  const descent = fontSize * 0.24;
  const lines: string[] = [];

  for (const word of words) {
    if (!word.highlighted) {
      continue;
    }
    const opacity = Math.min(1, word.opacity + 0.15);
    lines.push(
      `<rect x="${round2(-padX)}" y="${round2(-ascent)}" width="${round2(word.width + padX * 2)}" height="${round2(ascent + descent)}" fill="${highlightColor}" opacity="${round2(opacity)}" transform="${wordTransform(word)}"/>`,
    );
  }

  return lines;
}

export function buildWordTideSvg(options: WordTideSvgOptions): string {
  const { backgroundHex, height, highlightColor, includeBackground, layout, width } = options;
  const { canvasHeight, canvasWidth, typography, words } = layout;

  const lines: string[] = [
    `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${canvasWidth} ${canvasHeight}">`,
  ];

  if (includeBackground) {
    lines.push(`<rect width="${canvasWidth}" height="${canvasHeight}" fill="${backgroundHex}"/>`);
  }

  lines.push(...buildHighlightRects(words, typography, highlightColor));

  const letterSpacingPx = typography.letterSpacingEm * typography.fontSize;
  const spacingAttribute =
    letterSpacingPx !== 0 ? ` letter-spacing="${round2(letterSpacingPx)}"` : "";

  for (const word of words) {
    lines.push(
      `<text transform="${wordTransform(word)}" font-family='${escapeXml(typography.family)}' font-size="${typography.fontSize}" font-weight="${word.fontWeight}" fill="${escapeXml(word.color)}" opacity="${round2(word.opacity)}"${spacingAttribute}>${escapeXml(word.text)}</text>`,
    );
  }

  lines.push("</svg>");
  return lines.join("\n");
}

const outlineFontCache = new Map<string, Promise<Font | null>>();

async function loadOutlineFont(family: string, weight: number): Promise<Font | null> {
  const files = getOutlineFontFiles().filter((face) => face.family === family);
  if (files.length === 0) {
    return null;
  }

  let best = files[0]!;
  for (const face of files) {
    if (Math.abs(face.weight - weight) < Math.abs(best.weight - weight)) {
      best = face;
    }
  }

  const cacheKey = best.url;
  let pending = outlineFontCache.get(cacheKey);
  if (!pending) {
    pending = fetch(best.url)
      .then(async (response) => {
        if (!response.ok) {
          return null;
        }
        return Font.load(await response.arrayBuffer());
      })
      .catch(() => null);
    outlineFontCache.set(cacheKey, pending);
  }
  return pending;
}

/** First quoted family name in the resolved CSS family stack. */
function primaryFamilyName(familyStack: string): string {
  const match = familyStack.match(/"([^"]+)"/);
  return match?.[1] ?? familyStack.split(",")[0]!.trim();
}

function buildWordPathData(
  font: Font,
  text: string,
  fontSize: number,
  letterSpacingPx: number,
): string | null {
  const buffer = new UnicodeBuffer();
  buffer.addStr(text);
  const glyphBuffer = shape(font, buffer);
  const shapedGlyphs = glyphBufferToShapedGlyphs(glyphBuffer);
  const scale = fontSize / font.unitsPerEm;

  let penX = 0;
  const segments: string[] = [];

  for (const shaped of shapedGlyphs) {
    const glyphPath = getGlyphPath(font, shaped.glyphId);
    if (glyphPath) {
      const offsetX = penX + shaped.xOffset * scale;
      const offsetY = -shaped.yOffset * scale;
      for (const command of glyphPath.commands) {
        switch (command.type) {
          case "M":
            segments.push(
              `M${round2(offsetX + command.x * scale)} ${round2(offsetY - command.y * scale)}`,
            );
            break;
          case "L":
            segments.push(
              `L${round2(offsetX + command.x * scale)} ${round2(offsetY - command.y * scale)}`,
            );
            break;
          case "Q":
            segments.push(
              `Q${round2(offsetX + command.x1 * scale)} ${round2(offsetY - command.y1 * scale)} ${round2(offsetX + command.x * scale)} ${round2(offsetY - command.y * scale)}`,
            );
            break;
          case "C":
            segments.push(
              `C${round2(offsetX + command.x1 * scale)} ${round2(offsetY - command.y1 * scale)} ${round2(offsetX + command.x2 * scale)} ${round2(offsetY - command.y2 * scale)} ${round2(offsetX + command.x * scale)} ${round2(offsetY - command.y * scale)}`,
            );
            break;
          case "Z":
            segments.push("Z");
            break;
        }
      }
    }
    penX += shaped.xAdvance * scale + letterSpacingPx;
  }

  return segments.length > 0 ? segments.join("") : null;
}

/**
 * Outline variant: words become `<path>` geometry when a local font binary
 * matches the rendered family. Words without a matching binary fall back to
 * editable `<text>` so the export is never silently empty.
 */
export async function buildWordTideSvgOutlined(options: WordTideSvgOptions): Promise<string> {
  const { backgroundHex, height, highlightColor, includeBackground, layout, width } = options;
  const { canvasHeight, canvasWidth, typography, words } = layout;
  const family = primaryFamilyName(typography.family);
  const letterSpacingPx = typography.letterSpacingEm * typography.fontSize;

  const weights = Array.from(new Set(words.map((word) => word.fontWeight)));
  const fontByWeight = new Map<number, Font | null>();
  for (const weight of weights) {
    fontByWeight.set(weight, await loadOutlineFont(family, weight));
  }

  const lines: string[] = [
    `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${canvasWidth} ${canvasHeight}">`,
  ];

  if (includeBackground) {
    lines.push(`<rect width="${canvasWidth}" height="${canvasHeight}" fill="${backgroundHex}"/>`);
  }

  lines.push(...buildHighlightRects(words, typography, highlightColor));

  const pathDataCache = new Map<string, string | null>();
  let fallbackTextCount = 0;

  for (const word of words) {
    const font = fontByWeight.get(word.fontWeight) ?? null;
    let pathData: string | null = null;

    if (font) {
      const cacheKey = `${word.fontWeight}:${word.text}`;
      if (pathDataCache.has(cacheKey)) {
        pathData = pathDataCache.get(cacheKey) ?? null;
      } else {
        pathData = buildWordPathData(font, word.text, typography.fontSize, letterSpacingPx);
        pathDataCache.set(cacheKey, pathData);
      }
    }

    if (pathData) {
      lines.push(
        `<path d="${pathData}" fill="${escapeXml(word.color)}" opacity="${round2(word.opacity)}" transform="${wordTransform(word)}"/>`,
      );
    } else {
      fallbackTextCount += 1;
      lines.push(
        `<text transform="${wordTransform(word)}" font-family='${escapeXml(typography.family)}' font-size="${typography.fontSize}" font-weight="${word.fontWeight}" fill="${escapeXml(word.color)}" opacity="${round2(word.opacity)}">${escapeXml(word.text)}</text>`,
      );
    }
  }

  if (fallbackTextCount > 0) {
    lines.push(
      `<!-- ${fallbackTextCount} word(s) kept as editable text: no local font binary for "${escapeXml(family)}". Add TTF/OTF files to public/fonts and register them in src/app/brand-fonts.ts. -->`,
    );
  }
  lines.push("</svg>");
  return lines.join("\n");
}
