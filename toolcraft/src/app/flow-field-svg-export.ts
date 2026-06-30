/**
 * Vector-native SVG export for the flow field. Shares glyph instances with the
 * Canvas 2D preview so export matches what the user sees.
 */

import type { FlowFieldSettings, FlowGlyph, FlowMarkerStyle } from "./flow-field-math";
import type { FlowMarkerColor } from "./flow-field-renderer";

export type BuildFlowFieldSvgOptions = {
  backgroundHex: string;
  color: FlowMarkerColor;
  glyphs: readonly FlowGlyph[];
  height: number;
  includeBackground: boolean;
  settings: FlowFieldSettings;
  width: number;
};

function escapeXml(value: string): string {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;");
}

function markerSvgElements(
  style: FlowMarkerStyle,
  length: number,
  thickness: number,
  fill: string,
): string {
  const half = length / 2;
  const t = thickness / 2;

  switch (style) {
    case "line": {
      return `<line x1="${-half}" y1="0" x2="${half}" y2="0" stroke="${fill}" stroke-width="${thickness}" stroke-linecap="round"/>`;
    }
    case "arrow": {
      const headWidth = Math.max(thickness * 1.5, length * 0.18);
      const headBase = half - headWidth * 1.4;
      return [
        `<line x1="${-half}" y1="0" x2="${headBase}" y2="0" stroke="${fill}" stroke-width="${thickness}" stroke-linecap="round"/>`,
        `<polygon points="${half},0 ${headBase},${headWidth} ${headBase},${-headWidth}" fill="${fill}"/>`,
      ].join("");
    }
    case "dart": {
      return `<polygon points="${half},0 ${-half},${t} ${-half * 0.55},0 ${-half},${-t}" fill="${fill}"/>`;
    }
    case "wedge":
    default: {
      return `<polygon points="${half},0 ${-half},${t} ${-half},${-t}" fill="${fill}"/>`;
    }
  }
}

function glyphToSvg(
  glyph: FlowGlyph,
  settings: FlowFieldSettings,
  fill: string,
): string {
  const length = settings.markerLength * glyph.scale;
  const angleDeg = (glyph.angle * 180) / Math.PI;
  const inner = markerSvgElements(settings.markerStyle, length, settings.markerThickness, fill);
  return `<g transform="translate(${glyph.x.toFixed(3)} ${glyph.y.toFixed(3)}) rotate(${angleDeg.toFixed(4)})">${inner}</g>`;
}

export function buildFlowFieldSvg({
  backgroundHex,
  color,
  glyphs,
  height,
  includeBackground,
  settings,
  width,
}: BuildFlowFieldSvgOptions): string {
  const { b, g, r } = (() => {
    const value = backgroundHex.replace("#", "");
    return {
      b: Number.parseInt(value.slice(4, 6), 16),
      g: Number.parseInt(value.slice(2, 4), 16),
      r: Number.parseInt(value.slice(0, 2), 16),
    };
  })();
  const markerRgb = (() => {
    const value = color.hex.replace("#", "");
    return {
      b: Number.parseInt(value.slice(4, 6), 16),
      g: Number.parseInt(value.slice(2, 4), 16),
      r: Number.parseInt(value.slice(0, 2), 16),
    };
  })();
  const markerFill = `rgba(${markerRgb.r},${markerRgb.g},${markerRgb.b},${color.opacity / 100})`;
  const parts: string[] = [
    `<?xml version="1.0" encoding="UTF-8"?>`,
    `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}">`,
  ];

  if (includeBackground) {
    parts.push(
      `<rect width="${width}" height="${height}" fill="${escapeXml(backgroundHex)}" />`,
    );
    void r;
    void g;
    void b;
  }

  const markerGroup = glyphs.map((glyph) => glyphToSvg(glyph, settings, markerFill)).join("");
  parts.push(`<g data-flow-markers="">${markerGroup}</g>`);
  parts.push("</svg>");
  return parts.join("");
}
