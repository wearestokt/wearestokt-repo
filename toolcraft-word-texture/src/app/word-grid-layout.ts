/**
 * Dither mode: words fill a line grid across the canvas; an optional source
 * image drives per-slot ink (opacity, dropout), tone zones, and luminance spacing.
 */

import { colorForInk, type ColorSettings } from "./word-brand-colors";
import { computeWordInk, opacityForInk, sparsitySkipsWord, zoneLuminance } from "./word-ink";
import { horizontalWordAdvance, luminanceGapMultiplier, verticalRowAdvance } from "./word-spacing";
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
import type { ResolvedTypography } from "./word-font";

export type WordGridSettings = {
  colors: ColorSettings;
  /** Literal px between words and rows; 0 means no extra spacing beyond the font box. */
  gap: number;
  highlight: HighlightSettings;
  ink: InkSettings;
  /** 0..100 positional jitter. */
  jitter: number;
  /** Pack words over each other in very dark ink areas. */
  overlap: boolean;
  order: WordOrder;
  seed: number;
  /** -100..100: darker zones tighter left, lighter zones tighter right. */
  spacingBias: number;
  /** 0..100 spacing bias strength. */
  spacingRange: number;
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
  const pad = fontSize * 0.75;

  const words: PlacedWord[] = [];
  let slotIndex = 0;

  for (let rowTop = pad; rowTop + fontSize <= canvasHeight - pad; ) {
    const rowLuminance = zoneLuminance(
      image,
      pad,
      rowTop,
      canvasWidth - pad * 2,
      fontSize,
      canvasHeight,
      settings.ink.contrast,
    );
    const rowGapMultiplier = luminanceGapMultiplier(
      rowLuminance,
      settings.spacingBias,
      settings.spacingRange,
    );
    const rowHeight = verticalRowAdvance(fontSize, settings.gap, rowGapMultiplier);
    const jitterAmp = (settings.jitter / 100) * rowHeight * 0.45;

    let x = pad;

    while (x < canvasWidth - pad) {
      slotIndex += 1;
      const jitterX =
        jitterAmp > 0 ? (hashUint(slotIndex, 7, settings.seed) - 0.5) * 2 * jitterAmp : 0;
      const jitterY =
        jitterAmp > 0 ? (hashUint(slotIndex, 11, settings.seed) - 0.5) * 2 * jitterAmp : 0;

      const stream = pickZoneStream(
        zoneStreams,
        settings.zones,
        image,
        x,
        rowTop,
        fontSize,
        rowHeight,
        canvasHeight,
        settings.ink.contrast,
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
      const width = measure(text, typography.weight);

      if (x + width > canvasWidth - pad) {
        break;
      }

      const wordX = x + jitterX;
      const wordY = rowTop + fontSize + jitterY;
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
      const luminance = zoneLuminance(
        image,
        wordX,
        rowTop + jitterY,
        width,
        rowHeight,
        canvasHeight,
        settings.ink.contrast,
      );
      const advance = slotAdvance(width, preciseInk, luminance, settings);

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
        color: colorForInk(settings.colors, preciseInk),
        fontWeight: typography.weight,
        highlighted,
        opacity: opacityForInk(preciseInk, settings.ink) * maskAlpha * typography.opacity,
        text,
        width,
        x: wordX,
        y: wordY,
      });

      x += advance;
    }

    rowTop += rowHeight;
  }

  return words;
}

function slotAdvance(
  width: number,
  ink: number,
  luminance: number,
  settings: WordGridSettings,
): number {
  const gapMultiplier = luminanceGapMultiplier(
    luminance,
    settings.spacingBias,
    settings.spacingRange,
  );
  return horizontalWordAdvance(width, settings.gap, gapMultiplier, ink, settings.overlap);
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
  contrast: number,
): TokenStream {
  if (!zones.enabled) {
    return streams.main;
  }

  const luminance = zoneLuminance(image, x, y, probeWidth, probeHeight, canvasHeight, contrast);
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
