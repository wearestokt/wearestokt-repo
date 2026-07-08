/**
 * Dither mode: words fill a line grid across the canvas; an optional source
 * image drives per-slot ink (opacity, weight, dropout) and tone zones.
 */

import { computeWordInk, opacityForInk, sparsitySkipsWord, zoneLuminance } from "./word-ink";
import type {
  HighlightSettings,
  InkSettings,
  MeasureWord,
  PlacedWord,
  ToneZoneSettings,
} from "./word-layout-types";
import { maskAdmitsWord, type ShapeMask } from "./word-mask";
import type { PreparedSourceImage } from "./word-source-sample";
import {
  applyTextCase,
  createTokenStream,
  hashUint,
  parseTokens,
  type TokenStream,
  type WordOrder,
} from "./word-tokens";
import { weightForInk, type ResolvedTypography } from "./word-font";

export type WordGridSettings = {
  /** Extra px between words and rows. */
  gap: number;
  highlight: HighlightSettings;
  ink: InkSettings;
  /** 0..100 positional jitter. */
  jitter: number;
  order: WordOrder;
  seed: number;
  words: string;
  zones: ToneZoneSettings;
};

export function layoutWordGrid(
  canvasWidth: number,
  canvasHeight: number,
  typography: ResolvedTypography,
  settings: WordGridSettings,
  image: PreparedSourceImage | null,
  mask: ShapeMask | null,
  measure: MeasureWord,
): PlacedWord[] {
  const mainTokens = parseTokens(settings.words).map((token) =>
    applyTextCase(token, typography.textCase),
  );
  if (mainTokens.length === 0) {
    return [];
  }

  const mainStream = createTokenStream(mainTokens, settings.order, settings.seed);
  const zoneStreams = buildZoneStreams(settings, typography, mainStream);
  const highlightSet = new Set(
    parseTokens(settings.highlight.words).map((token) => token.toLowerCase()),
  );

  const fontSize = typography.fontSize;
  const rowHeight = fontSize * typography.lineHeightFactor + settings.gap;
  const wordGap = fontSize * 0.55 + settings.gap;
  const pad = fontSize * 0.75;
  const jitterAmp = (settings.jitter / 100) * rowHeight * 0.45;
  const baselineDrop = fontSize * 0.8;

  const words: PlacedWord[] = [];
  let slotIndex = 0;

  for (let rowTop = pad, row = 0; rowTop + rowHeight <= canvasHeight - pad; rowTop += rowHeight, row += 1) {
    let x = pad;

    while (x < canvasWidth - pad) {
      slotIndex += 1;
      const jitterX = jitterAmp > 0 ? (hashUint(slotIndex, 7, settings.seed) - 0.5) * 2 * jitterAmp : 0;
      const jitterY = jitterAmp > 0 ? (hashUint(slotIndex, 11, settings.seed) - 0.5) * 2 * jitterAmp : 0;

      const stream = pickZoneStream(
        zoneStreams,
        settings.zones,
        image,
        x,
        rowTop,
        fontSize,
        rowHeight,
        canvasHeight,
      );
      const text = stream.next();
      if (text.length === 0) {
        break;
      }

      const noiseInk = 0.35 + 0.65 * hashUint(slotIndex, 23, settings.seed);
      const inkValue = computeWordInk(
        image,
        x,
        rowTop,
        fontSize * 3,
        rowHeight,
        settings.ink,
        noiseInk,
      );
      const weight = weightForInk(typography, inkValue, settings.ink.weightRange / 100);
      const width = measure(text, weight);

      if (x + width > canvasWidth - pad) {
        break;
      }

      const wordX = x + jitterX;
      const wordY = rowTop + baselineDrop + jitterY;
      const advance = width + wordGap;

      const preciseInk = computeWordInk(
        image,
        wordX,
        rowTop + jitterY,
        width,
        rowHeight,
        settings.ink,
        noiseInk,
      );
      const skipRoll = hashUint(slotIndex, 13, settings.seed);

      if (sparsitySkipsWord(preciseInk, settings.ink.sparsity, skipRoll)) {
        x += advance;
        continue;
      }

      const maskAlpha = maskAdmitsWord(mask, wordX, wordY, width, 0);
      if (maskAlpha === null) {
        x += advance;
        continue;
      }

      const highlighted =
        highlightSet.has(text.toLowerCase()) ||
        hashUint(slotIndex, 17, settings.seed) < settings.highlight.coverage / 100;

      words.push({
        angle: 0,
        fontWeight: weightForInk(typography, preciseInk, settings.ink.weightRange / 100),
        highlighted,
        opacity: opacityForInk(preciseInk, settings.ink) * maskAlpha * typography.opacity,
        text,
        width,
        x: wordX,
        y: wordY,
      });

      x += advance;
    }
  }

  return words;
}

type ZoneStreams = {
  dark: TokenStream;
  light: TokenStream;
  main: TokenStream;
  mid: TokenStream;
};

function buildZoneStreams(
  settings: WordGridSettings,
  typography: ResolvedTypography,
  mainStream: TokenStream,
): ZoneStreams {
  const buildStream = (raw: string, seedOffset: number): TokenStream => {
    const tokens = parseTokens(raw).map((token) => applyTextCase(token, typography.textCase));
    return tokens.length > 0
      ? createTokenStream(tokens, settings.order, settings.seed + seedOffset)
      : mainStream;
  };

  return {
    dark: buildStream(settings.zones.darkWords, 31),
    light: buildStream(settings.zones.lightWords, 47),
    main: mainStream,
    mid: buildStream(settings.zones.midWords, 39),
  };
}

function pickZoneStream(
  streams: ZoneStreams,
  zones: ToneZoneSettings,
  image: PreparedSourceImage | null,
  x: number,
  y: number,
  probeWidth: number,
  probeHeight: number,
  canvasHeight: number,
): TokenStream {
  if (!zones.enabled) {
    return streams.main;
  }

  const luminance = zoneLuminance(image, x, y, probeWidth, probeHeight, canvasHeight);
  const low = Math.min(zones.split[0], zones.split[1]) / 100;
  const high = Math.max(zones.split[0], zones.split[1]) / 100;

  if (luminance < low) {
    return streams.dark;
  }
  if (luminance > high) {
    return streams.light;
  }
  return streams.mid;
}
