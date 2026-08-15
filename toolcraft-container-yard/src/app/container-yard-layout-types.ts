/**
 * Shared layout slot types for rectangular and radial container placement.
 */

export type ContainerOrientation = "vertical" | "horizontal";
export type ContainerLayout = "rows" | "columns";
export type ContainerLayoutType = "rectangular" | "radial" | "dither";
export type ContainerRadialAlign = "tangent" | "radial";
export type ContainerColorMode =
  | "random"
  | "wave"
  | "zones"
  | "stripes"
  | "checker"
  | "quadrants"
  | "rings"
  | "clusters"
  | "chevron";
export type ContainerWaveAxis = "row" | "column" | "radial";
export type ContainerZoneAxis = "horizontal" | "vertical";
export type ContainerStripeOrientation = "horizontal" | "vertical" | "diagonal";
export type ContainerDitherAlgorithm = "blocks" | "palette" | "halftone" | "mono";
export type ContainerMatteMode = "alpha" | "auto" | "both";
export type ContainerMatteStyle = "off" | ContainerMatteMode;

export type ContainerYardSettings = {
  colorCount: number;
  colorMode: ContainerColorMode;
  colorPatternStep: number;
  colors: readonly string[];
  columnGap: number;
  containInCanvas: boolean;
  containerWidth: number;
  ditherAlgorithm: ContainerDitherAlgorithm;
  ditherBias: number;
  ditherContrast: number;
  ditherEnabled: boolean;
  ditherInvert: boolean;
  ditherStrength: number;
  globalScale: number;
  layout: ContainerLayout;
  layoutType: ContainerLayoutType;
  lengthLong: number;
  lengthMix: number;
  lengthShort: number;
  matteMinCoverage: number;
  matteInvert: boolean;
  matteStyle: ContainerMatteStyle;
  offsetX: number;
  offsetY: number;
  orientation: ContainerOrientation;
  radialAlign: ContainerRadialAlign;
  randomGaps: number;
  rotation: number;
  rowGap: number;
  seed: number;
  shadowEnabled: boolean;
  shadowOffsetX: number;
  shadowOffsetY: number;
  shadowOpacity: number;
  stagger: number;
  stripeColorSlot: number;
  stripeOrientation: ContainerStripeOrientation;
  stripeRepeat: number;
  stripeWidth: number;
  waveAxis: ContainerWaveAxis;
  waveCycles: number;
  zone1Slot: number;
  zone2Slot: number;
  zone3Slot: number;
  zone4Slot: number;
  zoneAxis: ContainerZoneAxis;
  zoneCount: number;
};

export type ContainerLayoutSlot = {
  centerX: number;
  centerY: number;
  col: number;
  height: number;
  rotation: number;
  row: number;
  width: number;
  x: number;
  y: number;
};

export type ContainerRect = {
  color: string;
  height: number;
  rotation: number;
  width: number;
  x: number;
  y: number;
};

export type ContainerCanvasBounds = {
  height: number;
  width: number;
};

export type ContainerYardOutput = {
  bounds: ContainerCanvasBounds;
  containers: ContainerRect[];
};

export type BuildContainerYardOptions = {
  imageData?: import("./container-yard-image-sample").PreparedSourceImage | null;
  layoutScaleX?: number;
  layoutScaleY?: number;
  matteMask?: import("./container-yard-source-matte").PreparedSourceMatte | null;
  sampleImageColors?: boolean;
};
