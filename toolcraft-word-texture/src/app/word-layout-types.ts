export type PlacedWord = {
  /** Rotation in radians around the (x, y) anchor. 0 in grid mode. */
  angle: number;
  fontWeight: number;
  highlighted: boolean;
  /** Final alpha 0..1 (ink fade x mask edge x base opacity). */
  opacity: number;
  text: string;
  /** Measured width in px at fontWeight. */
  width: number;
  /** Left end of the baseline. */
  x: number;
  /** Baseline y. */
  y: number;
};

export type MeasureWord = (text: string, weight: number) => number;

export type InkSettings = {
  /** -100..100 tone curve contrast. */
  contrast: number;
  /** Map ink to opacity (true) or draw placed words at full ink (false). */
  fade: boolean;
  /** Read light-on-dark sources. */
  invert: boolean;
  /** 0..100: how strongly light areas drop words entirely. */
  sparsity: number;
  /** 0..100: how far the tone->weight ramp may travel below the picked weight. */
  weightRange: number;
};

export type ToneZoneSettings = {
  darkWords: string;
  enabled: boolean;
  lightWords: string;
  midWords: string;
  /** Luminance band splits 0..100 (dark below first, light above second). */
  split: [number, number];
};

export type HighlightSettings = {
  /** 0..100 percent of words highlighted at random. */
  coverage: number;
  /** Explicit always-highlighted words. */
  words: string;
};
