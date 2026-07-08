/**
 * Vector-native SVG export for traced streamlines with palette colors and variable width.
 */

import {
  colorForStroke,
  colorForStrokePoint,
  strokeGradientStops,
  type FlowColorSettings,
} from "./flow-color-ramp";
import type { FlowMarkerColor } from "./flow-field-renderer";
import {
  buildStrokeRibbon,
  polygonToSvgPath,
  polylineToSvg,
  ribbonToPolygon,
  splitStrokeIntoDashes,
  type StrokeStyleOptions,
} from "./flow-stroke-geometry";
import type { StrokeSettings } from "./flow-field-renderer";
import type { FlowOutput, FlowStroke } from "./flow-streamline-math";

export type BuildFlowFieldSvgOptions = {
  backgroundHex: string;
  colorSettings: FlowColorSettings;
  height: number;
  includeBackground: boolean;
  output: FlowOutput;
  strokeSettings: StrokeSettings;
  width: number;
};

function escapeXml(value: string): string {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;");
}

function strokeToSvg(
  stroke: FlowStroke,
  colorSettings: FlowColorSettings,
  strokeSettings: StrokeSettings,
  canvasHeight: number,
): string {
  const options: StrokeStyleOptions = {
    headSize: strokeSettings.headSize,
    taper: strokeSettings.taper,
    widthBySpeed: strokeSettings.widthBySpeed,
  };
  const style = strokeSettings.style;
  const useRibbon =
    style !== "rectangle" &&
    (options.taper !== "none" || (options.widthBySpeed ?? 0) > 0);
  const segments =
    style === "dash"
      ? splitStrokeIntoDashes(stroke).map((segment) => ({ ...stroke, points: segment.points }))
      : [stroke];

  return segments
    .map((segment) => {
      const fill =
        colorSettings.assignmentMode === "speed" || colorSettings.assignmentMode === "vertical"
          ? colorForStrokePoint(
              colorSettings,
              segment,
              Math.floor(segment.points.length / 2),
              canvasHeight,
            )
          : colorForStroke(segment, colorSettings);

      let body = "";
      if (style === "rectangle") {
        body = `<polyline points="${polylineToSvg(segment.points)}" fill="none" stroke="${escapeXml(fill)}" stroke-width="${segment.thickness}" stroke-linecap="butt" stroke-linejoin="miter"/>`;
      } else if (useRibbon || style === "hatch") {
        const ribbon = buildStrokeRibbon(
          { ...segment, thickness: segment.thickness },
          style === "hatch" ? { ...options, taper: "none" } : options,
        );
        const polygon = ribbonToPolygon(ribbon);
        body = `<path d="${polygonToSvgPath(polygon)}" fill="${escapeXml(fill)}"/>`;
      } else {
        body = `<polyline points="${polylineToSvg(segment.points)}" fill="none" stroke="${escapeXml(fill)}" stroke-width="${segment.thickness}" stroke-linecap="round" stroke-linejoin="round"/>`;
      }

      if (style === "arrow" && segment.points.length >= 2) {
        const tip = segment.points[segment.points.length - 1]!;
        const from = segment.points[segment.points.length - 2]!;
        const angle = Math.atan2(tip.y - from.y, tip.x - from.x);
        const headLen = Math.max(segment.thickness * 3.5 * strokeSettings.headSize, 8);
        const headWidth = Math.max(segment.thickness * 2.2 * strokeSettings.headSize, 5);
        const baseX = tip.x - Math.cos(angle) * headLen;
        const baseY = tip.y - Math.sin(angle) * headLen;
        const nx = -Math.sin(angle);
        const ny = Math.cos(angle);
        body += `<polygon points="${tip.x.toFixed(2)},${tip.y.toFixed(2)} ${(baseX + nx * headWidth).toFixed(2)},${(baseY + ny * headWidth).toFixed(2)} ${(baseX - nx * headWidth).toFixed(2)},${(baseY - ny * headWidth).toFixed(2)}" fill="${escapeXml(fill)}"/>`;
      }

      if (
        (colorSettings.assignmentMode === "speed" || colorSettings.assignmentMode === "vertical") &&
        segment.points.length >= 2
      ) {
        const stops = strokeGradientStops(colorSettings, segment, canvasHeight);
        const [first] = segment.points;
        const last = segment.points[segment.points.length - 1]!;
        const gradientId = `grad-${Math.random().toString(36).slice(2, 8)}`;
        const gradient = `<linearGradient id="${gradientId}" x1="${first!.x}" y1="${first!.y}" x2="${last.x}" y2="${last.y}">${stops
          .map((stop) => `<stop offset="${(stop.offset * 100).toFixed(1)}%" stop-color="${escapeXml(stop.color)}"/>`)
          .join("")}</linearGradient>`;
        return `${gradient}${body.replace(escapeXml(fill), `url(#${gradientId})`)}`;
      }

      return body;
    })
    .join("");
}

export function buildFlowFieldSvg({
  backgroundHex,
  colorSettings,
  height,
  includeBackground,
  output,
  strokeSettings,
  width,
}: BuildFlowFieldSvgOptions): string {
  const parts: string[] = [
    `<?xml version="1.0" encoding="UTF-8"?>`,
    `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}">`,
  ];

  if (includeBackground) {
    parts.push(`<rect width="${width}" height="${height}" fill="${escapeXml(backgroundHex)}" />`);
  }

  const strokeGroup = output.strokes
    .map((stroke) => strokeToSvg(stroke, colorSettings, strokeSettings, height))
    .join("");
  parts.push(`<g data-flow-strokes="">${strokeGroup}</g>`);
  parts.push("</svg>");
  return parts.join("");
}

export type { FlowMarkerColor };
