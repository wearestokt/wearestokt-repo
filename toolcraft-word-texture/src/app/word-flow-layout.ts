/**
 * Flow mode: traces evenly-spaced streamlines through the vector field, then
 * walks each streamline placing whole words on low-curvature chords so every
 * word stays readable while the texture follows the current.
 */

import type { VectorField } from "./flow-vector-field";
import { computeWordInk, opacityForInk, sparsitySkipsWord } from "./word-ink";
import type {
  HighlightSettings,
  InkSettings,
  MeasureWord,
  PlacedWord,
} from "./word-layout-types";
import { maskAdmitsWord, type ShapeMask } from "./word-mask";
import type { PreparedSourceImage } from "./word-source-sample";
import {
  applyTextCase,
  createTokenStream,
  hashUint,
  parseTokens,
  type WordOrder,
} from "./word-tokens";
import { weightForInk, type ResolvedTypography } from "./word-font";

export type WordFlowSettings = {
  /** 0..100 streamline packing density. */
  density: number;
  highlight: HighlightSettings;
  ink: InkSettings;
  order: WordOrder;
  seed: number;
  /** Extra px between consecutive words on a line. */
  wordGap: number;
  words: string;
};

type Point = { x: number; y: number };

/** Max tangent deviation from the word chord before a spot is too curvy. */
const MAX_CHORD_DEVIATION = 0.32;

export function layoutWordFlow(
  canvasWidth: number,
  canvasHeight: number,
  typography: ResolvedTypography,
  settings: WordFlowSettings,
  field: VectorField,
  image: PreparedSourceImage | null,
  mask: ShapeMask | null,
  measure: MeasureWord,
): PlacedWord[] {
  const tokens = parseTokens(settings.words).map((token) =>
    applyTextCase(token, typography.textCase),
  );
  if (tokens.length === 0) {
    return [];
  }

  const stream = createTokenStream(tokens, settings.order, settings.seed);
  const highlightSet = new Set(
    parseTokens(settings.highlight.words).map((token) => token.toLowerCase()),
  );

  const fontSize = typography.fontSize;
  const rowHeight = fontSize * typography.lineHeightFactor;
  const densityNorm = Math.min(1, Math.max(0, settings.density / 100));
  const separation = rowHeight * (0.85 + (1 - densityNorm) * 2.4);
  const streamlines = traceStreamlines(canvasWidth, canvasHeight, field, separation, settings.seed);

  const wordGap = fontSize * 0.55 + settings.wordGap;
  const words: PlacedWord[] = [];
  let slotIndex = 0;

  for (const line of streamlines) {
    const lengths = cumulativeLengths(line);
    const totalLength = lengths[lengths.length - 1] ?? 0;
    if (totalLength < fontSize * 2) {
      continue;
    }

    let cursor = hashUint(slotIndex, 3, settings.seed) * wordGap;

    while (cursor < totalLength) {
      slotIndex += 1;
      const text = stream.peek();
      if (text.length === 0) {
        break;
      }

      const noiseInk = 0.35 + 0.65 * hashUint(slotIndex, 23, settings.seed);
      const probePoint = pointAt(line, lengths, cursor);
      const probeInk = computeWordInk(
        image,
        probePoint.x - fontSize,
        probePoint.y - rowHeight / 2,
        fontSize * 3,
        rowHeight,
        settings.ink,
        noiseInk,
      );
      const weight = weightForInk(typography, probeInk, settings.ink.weightRange / 100);
      const width = measure(text, weight);

      if (cursor + width > totalLength) {
        break;
      }

      const start = pointAt(line, lengths, cursor);
      const end = pointAt(line, lengths, cursor + width);
      const angle = Math.atan2(end.y - start.y, end.x - start.x);

      if (!chordIsStraightEnough(line, lengths, cursor, width, angle)) {
        cursor += fontSize * 0.75;
        continue;
      }

      stream.next();

      const midX = (start.x + end.x) / 2;
      const midY = (start.y + end.y) / 2;
      const inkValue = computeWordInk(
        image,
        midX - width / 2,
        midY - rowHeight / 2,
        width,
        rowHeight,
        settings.ink,
        noiseInk,
      );
      const skipRoll = hashUint(slotIndex, 13, settings.seed);

      if (sparsitySkipsWord(inkValue, settings.ink.sparsity, skipRoll)) {
        cursor += width + wordGap;
        continue;
      }

      const maskAlpha = maskAdmitsWord(mask, start.x, start.y, width, angle);
      if (maskAlpha === null) {
        cursor += width + wordGap;
        continue;
      }

      const highlighted =
        highlightSet.has(text.toLowerCase()) ||
        hashUint(slotIndex, 17, settings.seed) < settings.highlight.coverage / 100;

      words.push({
        angle,
        fontWeight: weight,
        highlighted,
        opacity: opacityForInk(inkValue, settings.ink) * maskAlpha * typography.opacity,
        text,
        width,
        x: start.x,
        y: start.y,
      });

      cursor += width + wordGap;
    }
  }

  return words;
}

/**
 * Jobard-Lefer style evenly-spaced streamline tracing: seeds march across a
 * jittered grid, lines grow both directions with RK2 steps, and an occupancy
 * grid enforces the separation distance.
 */
export function traceStreamlines(
  canvasWidth: number,
  canvasHeight: number,
  field: VectorField,
  separation: number,
  seed: number,
): Point[][] {
  const cellSize = Math.max(4, separation);
  const columns = Math.max(1, Math.ceil(canvasWidth / cellSize));
  const rows = Math.max(1, Math.ceil(canvasHeight / cellSize));
  const occupancy: Point[][] = Array.from({ length: columns * rows }, () => []);

  const margin = separation;
  const stepSize = Math.max(2, separation * 0.3);
  const maxSteps = Math.ceil(((canvasWidth + canvasHeight) * 2) / stepSize);

  const cellIndex = (x: number, y: number): number => {
    const cx = Math.min(columns - 1, Math.max(0, Math.floor(x / cellSize)));
    const cy = Math.min(rows - 1, Math.max(0, Math.floor(y / cellSize)));
    return cy * columns + cx;
  };

  const tooClose = (x: number, y: number, minDistance: number): boolean => {
    const cx = Math.floor(x / cellSize);
    const cy = Math.floor(y / cellSize);
    const minSq = minDistance * minDistance;

    for (let dy = -1; dy <= 1; dy += 1) {
      for (let dx = -1; dx <= 1; dx += 1) {
        const nx = cx + dx;
        const ny = cy + dy;
        if (nx < 0 || ny < 0 || nx >= columns || ny >= rows) {
          continue;
        }
        for (const point of occupancy[ny * columns + nx]!) {
          const distX = point.x - x;
          const distY = point.y - y;
          if (distX * distX + distY * distY < minSq) {
            return true;
          }
        }
      }
    }
    return false;
  };

  const inBounds = (x: number, y: number): boolean =>
    x >= -margin && y >= -margin && x <= canvasWidth + margin && y <= canvasHeight + margin;

  const growDirection = (startX: number, startY: number, sign: 1 | -1): Point[] => {
    const points: Point[] = [];
    let x = startX;
    let y = startY;

    for (let step = 0; step < maxSteps; step += 1) {
      const sampleA = field.sample(x, y);
      const midX = x + sign * Math.cos(sampleA.angle) * stepSize * 0.5;
      const midY = y + sign * Math.sin(sampleA.angle) * stepSize * 0.5;
      const sampleB = field.sample(midX, midY);
      const nextX = x + sign * Math.cos(sampleB.angle) * stepSize;
      const nextY = y + sign * Math.sin(sampleB.angle) * stepSize;

      if (!inBounds(nextX, nextY) || tooClose(nextX, nextY, separation * 0.55)) {
        break;
      }

      points.push({ x: nextX, y: nextY });
      x = nextX;
      y = nextY;
    }

    return points;
  };

  const streamlines: Point[][] = [];
  const seedStep = separation;

  for (let gy = 0; gy * seedStep < canvasHeight; gy += 1) {
    for (let gx = 0; gx * seedStep < canvasWidth; gx += 1) {
      const jx = hashUint(gx, gy, seed + 5) * seedStep;
      const jy = hashUint(gx, gy, seed + 9) * seedStep;
      const seedX = gx * seedStep + jx;
      const seedY = gy * seedStep + jy;

      if (
        seedX < 0 ||
        seedY < 0 ||
        seedX > canvasWidth ||
        seedY > canvasHeight ||
        tooClose(seedX, seedY, separation * 0.9)
      ) {
        continue;
      }

      const backward = growDirection(seedX, seedY, -1).reverse();
      const forward = growDirection(seedX, seedY, 1);
      const line = [...backward, { x: seedX, y: seedY }, ...forward];

      if (line.length < 4) {
        continue;
      }

      for (const point of line) {
        if (point.x >= 0 && point.y >= 0 && point.x < canvasWidth && point.y < canvasHeight) {
          occupancy[cellIndex(point.x, point.y)]!.push(point);
        }
      }

      streamlines.push(line);
    }
  }

  return streamlines;
}

function cumulativeLengths(line: readonly Point[]): number[] {
  const lengths = new Array<number>(line.length);
  lengths[0] = 0;
  for (let index = 1; index < line.length; index += 1) {
    const dx = line[index]!.x - line[index - 1]!.x;
    const dy = line[index]!.y - line[index - 1]!.y;
    lengths[index] = lengths[index - 1]! + Math.hypot(dx, dy);
  }
  return lengths;
}

function pointAt(line: readonly Point[], lengths: readonly number[], distance: number): Point {
  if (distance <= 0) {
    return line[0]!;
  }
  const total = lengths[lengths.length - 1]!;
  if (distance >= total) {
    return line[line.length - 1]!;
  }

  let low = 0;
  let high = lengths.length - 1;
  while (low + 1 < high) {
    const mid = (low + high) >> 1;
    if (lengths[mid]! <= distance) {
      low = mid;
    } else {
      high = mid;
    }
  }

  const segment = lengths[high]! - lengths[low]!;
  const t = segment > 0 ? (distance - lengths[low]!) / segment : 0;
  return {
    x: line[low]!.x + (line[high]!.x - line[low]!.x) * t,
    y: line[low]!.y + (line[high]!.y - line[low]!.y) * t,
  };
}

function chordIsStraightEnough(
  line: readonly Point[],
  lengths: readonly number[],
  start: number,
  width: number,
  chordAngle: number,
): boolean {
  const probes = 4;
  for (let probe = 1; probe < probes; probe += 1) {
    const a = pointAt(line, lengths, start + (width * (probe - 1)) / probes);
    const b = pointAt(line, lengths, start + (width * probe) / probes);
    const angle = Math.atan2(b.y - a.y, b.x - a.x);
    const deviation = Math.abs(normalizeAngle(angle - chordAngle));
    if (deviation > MAX_CHORD_DEVIATION) {
      return false;
    }
  }
  return true;
}

function normalizeAngle(angle: number): number {
  let value = angle;
  while (value > Math.PI) {
    value -= Math.PI * 2;
  }
  while (value < -Math.PI) {
    value += Math.PI * 2;
  }
  return value;
}
