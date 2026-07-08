/**
 * Shared variable-width stroke geometry for Canvas 2D and SVG export.
 */

import type { FlowStroke, FlowTaper } from "./flow-streamline-math";

export type StrokeStyleOptions = {
  dashGap?: number;
  dashLength?: number;
  headSize?: number;
  taper?: FlowTaper;
  widthBySpeed?: number;
};

export type StrokeRibbon = {
  left: { x: number; y: number }[];
  right: { x: number; y: number }[];
};

function taperFactor(t: number, taper: FlowTaper): number {
  switch (taper) {
    case "head":
      return t;
    case "tail":
      return 1 - t;
    case "both":
      return Math.sin(t * Math.PI);
    case "none":
    default:
      return 1;
  }
}

function widthAtPoint(
  stroke: FlowStroke,
  index: number,
  baseWidth: number,
  taper: FlowTaper,
  widthBySpeed: number,
): number {
  const t = stroke.arcT[index] ?? index / Math.max(1, stroke.points.length - 1);
  const speed = stroke.pointSpeeds[index] ?? 0.5;
  const taperMul = taperFactor(t, taper);
  const speedMul = 1 + (widthBySpeed / 100) * (speed - 0.5) * 1.6;
  return Math.max(0.35, baseWidth * taperMul * speedMul);
}

export function buildStrokeRibbon(
  stroke: FlowStroke,
  options: StrokeStyleOptions = {},
): StrokeRibbon {
  const taper = options.taper ?? "none";
  const widthBySpeed = options.widthBySpeed ?? 0;
  const points = stroke.points;
  const left: { x: number; y: number }[] = [];
  const right: { x: number; y: number }[] = [];

  for (let i = 0; i < points.length; i += 1) {
    const current = points[i]!;
    const prev = points[Math.max(0, i - 1)]!;
    const next = points[Math.min(points.length - 1, i + 1)]!;
    const dx = next.x - prev.x;
    const dy = next.y - prev.y;
    const len = Math.hypot(dx, dy) || 1;
    const nx = -dy / len;
    const ny = dx / len;
    const half = widthAtPoint(stroke, i, stroke.thickness, taper, widthBySpeed) * 0.5;
    left.push({ x: current.x + nx * half, y: current.y + ny * half });
    right.push({ x: current.x - nx * half, y: current.y - ny * half });
  }

  return { left, right };
}

export function ribbonToPolygon(ribbon: StrokeRibbon): { x: number; y: number }[] {
  return [...ribbon.left, ...ribbon.right.reverse()];
}

export function polygonToSvgPath(points: readonly { x: number; y: number }[]): string {
  if (points.length === 0) {
    return "";
  }
  const [first, ...rest] = points;
  return `M ${first!.x.toFixed(2)} ${first!.y.toFixed(2)} ${rest.map((point) => `L ${point.x.toFixed(2)} ${point.y.toFixed(2)}`).join(" ")} Z`;
}

export function polylineToSvg(points: readonly { x: number; y: number }[]): string {
  return points.map((point) => `${point.x.toFixed(2)},${point.y.toFixed(2)}`).join(" ");
}

export type DashSegment = {
  points: { x: number; y: number }[];
};

export function splitStrokeIntoDashes(
  stroke: FlowStroke,
  dashLength = 18,
  dashGap = 10,
): DashSegment[] {
  if (stroke.points.length < 2) {
    return [];
  }
  const segments: DashSegment[] = [];
  let current: { x: number; y: number }[] = [];
  let dashRemaining = dashLength;
  let inDash = true;

  for (let i = 1; i < stroke.points.length; i += 1) {
    const a = stroke.points[i - 1]!;
    const b = stroke.points[i]!;
    let segLen = Math.hypot(b.x - a.x, b.y - a.y);
    let ax = a.x;
    let ay = a.y;
    const bx = b.x;
    const by = b.y;
    const ux = (bx - ax) / Math.max(segLen, 0.0001);
    const uy = (by - ay) / Math.max(segLen, 0.0001);

    while (segLen > 0.001) {
      const budget = inDash ? dashRemaining : dashGap;
      const step = Math.min(segLen, budget);
      const nx = ax + ux * step;
      const ny = ay + uy * step;
      if (inDash) {
        if (current.length === 0) {
          current.push({ x: ax, y: ay });
        }
        current.push({ x: nx, y: ny });
      }
      ax = nx;
      ay = ny;
      segLen -= step;
      dashRemaining -= step;
      if (dashRemaining <= 0.001) {
        if (inDash && current.length >= 2) {
          segments.push({ points: current });
        }
        current = [];
        inDash = !inDash;
        dashRemaining = inDash ? dashLength : dashGap;
      }
    }
  }

  if (inDash && current.length >= 2) {
    segments.push({ points: current });
  }

  return segments;
}

export function drawRibbonOnCanvas(
  context: CanvasRenderingContext2D,
  ribbon: StrokeRibbon,
): void {
  const polygon = ribbonToPolygon(ribbon);
  if (polygon.length < 3) {
    return;
  }
  context.beginPath();
  context.moveTo(polygon[0]!.x, polygon[0]!.y);
  for (let i = 1; i < polygon.length; i += 1) {
    context.lineTo(polygon[i]!.x, polygon[i]!.y);
  }
  context.closePath();
  context.fill();
}

export function drawStrokeCenterline(
  context: CanvasRenderingContext2D,
  points: readonly { x: number; y: number }[],
): void {
  if (points.length < 2) {
    return;
  }
  context.beginPath();
  context.moveTo(points[0]!.x, points[0]!.y);
  for (let i = 1; i < points.length; i += 1) {
    context.lineTo(points[i]!.x, points[i]!.y);
  }
  context.stroke();
}

export function drawHatchFill(
  context: CanvasRenderingContext2D,
  ribbon: StrokeRibbon,
  lineCount = 5,
): void {
  const polygon = ribbonToPolygon(ribbon);
  if (polygon.length < 3) {
    return;
  }
  context.save();
  context.beginPath();
  context.moveTo(polygon[0]!.x, polygon[0]!.y);
  for (let i = 1; i < polygon.length; i += 1) {
    context.lineTo(polygon[i]!.x, polygon[i]!.y);
  }
  context.closePath();
  context.clip();

  const xs = ribbon.left.map((point) => point.x);
  const ys = ribbon.left.map((point) => point.y);
  const minX = Math.min(...xs, ...ribbon.right.map((point) => point.x));
  const maxX = Math.max(...xs, ...ribbon.right.map((point) => point.x));
  const minY = Math.min(...ys, ...ribbon.right.map((point) => point.y));
  const maxY = Math.max(...ys, ...ribbon.right.map((point) => point.y));
  const span = Math.max(maxX - minX, maxY - minY, 1);
  const spacing = span / Math.max(2, lineCount);

  context.lineWidth = Math.max(0.5, span * 0.02);
  context.beginPath();
  for (let i = -lineCount; i <= lineCount; i += 1) {
    const offset = i * spacing;
    context.moveTo(minX + offset, minY);
    context.lineTo(maxX + offset, maxY);
  }
  context.stroke();
  context.restore();
}

export function drawRectangleStroke(
  context: CanvasRenderingContext2D,
  stroke: FlowStroke,
  baseWidth: number,
): void {
  if (stroke.points.length < 2) {
    return;
  }
  context.lineCap = "butt";
  context.lineJoin = "miter";
  context.lineWidth = baseWidth;
  drawStrokeCenterline(context, stroke.points);
}

export function drawArrowHead(
  context: CanvasRenderingContext2D,
  tip: { x: number; y: number },
  from: { x: number; y: number },
  thickness: number,
  headSize = 1,
): void {
  const angle = Math.atan2(tip.y - from.y, tip.x - from.x);
  const headLen = Math.max(thickness * 3.5 * headSize, 8 * headSize);
  const headWidth = Math.max(thickness * 2.2 * headSize, 5 * headSize);
  const baseX = tip.x - Math.cos(angle) * headLen;
  const baseY = tip.y - Math.sin(angle) * headLen;
  const nx = -Math.sin(angle);
  const ny = Math.cos(angle);
  context.beginPath();
  context.moveTo(tip.x, tip.y);
  context.lineTo(baseX + nx * headWidth, baseY + ny * headWidth);
  context.lineTo(baseX - nx * headWidth, baseY - ny * headWidth);
  context.closePath();
  context.fill();
}
