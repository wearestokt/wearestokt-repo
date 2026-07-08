/**
 * Vector-native SVG export for container-yard rectangles.
 */

import type {
  ContainerRect,
  ContainerYardOutput,
  ContainerYardSettings,
} from "./container-yard-math";

export type BuildContainerYardSvgOptions = {
  backgroundHex: string;
  height: number;
  includeBackground: boolean;
  output: ContainerYardOutput;
  settings: ContainerYardSettings;
  width: number;
};

function escapeXml(value: string): string {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;");
}

function rectToSvg(
  rect: ContainerRect,
  options?: {
    fill?: string;
    shadow?: boolean;
    shadowOffsetX?: number;
    shadowOffsetY?: number;
    shadowOpacity?: number;
  },
): string {
  const cx = rect.x + rect.width / 2;
  const cy = rect.y + rect.height / 2;
  const fill = escapeXml(options?.fill ?? rect.color);
  const transform = `translate(${cx.toFixed(2)} ${cy.toFixed(2)}) rotate(${rect.rotation.toFixed(4)})`;
  const halfW = rect.width / 2;
  const halfH = rect.height / 2;
  let parts = "";

  if (options?.shadow) {
    const shadowFill = `rgba(0,0,0,${((options.shadowOpacity ?? 40) / 100).toFixed(3)})`;
    const sx = options.shadowOffsetX ?? 4;
    const sy = options.shadowOffsetY ?? 4;
    parts += `<rect x="${(-halfW + sx).toFixed(2)}" y="${(-halfH + sy).toFixed(2)}" width="${rect.width.toFixed(2)}" height="${rect.height.toFixed(2)}" fill="${shadowFill}" transform="${transform}"/>`;
  }

  parts += `<rect x="${(-halfW).toFixed(2)}" y="${(-halfH).toFixed(2)}" width="${rect.width.toFixed(2)}" height="${rect.height.toFixed(2)}" fill="${fill}" transform="${transform}"/>`;
  return parts;
}

export function buildContainerYardSvg({
  backgroundHex,
  height,
  includeBackground,
  output,
  settings,
  width,
}: BuildContainerYardSvgOptions): string {
  const parts: string[] = [
    `<?xml version="1.0" encoding="UTF-8"?>`,
    `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}">`,
  ];

  if (!settings.containInCanvas) {
    parts.push(
      `<defs><clipPath id="container-yard-clip"><rect width="${width}" height="${height}"/></clipPath></defs>`,
    );
  }

  if (includeBackground) {
    parts.push(
      `<rect width="${width}" height="${height}" fill="${escapeXml(backgroundHex)}" />`,
    );
  }

  const containerMarkup = output.containers
    .map((rect) => {
      const shadow = settings.shadowEnabled
        ? rectToSvg(rect, {
            shadow: true,
            shadowOffsetX: settings.shadowOffsetX,
            shadowOffsetY: settings.shadowOffsetY,
            shadowOpacity: settings.shadowOpacity,
          })
        : "";
      return shadow + rectToSvg(rect);
    })
    .join("");

  if (settings.containInCanvas) {
    parts.push(containerMarkup);
  } else {
    parts.push(`<g clip-path="url(#container-yard-clip)">${containerMarkup}</g>`);
  }

  parts.push("</svg>");
  return parts.join("");
}
