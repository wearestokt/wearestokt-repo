import { applySliderValueLabelUnit } from "../slider/slider-value";

const rangeSeparatorPattern = /(\d)\s*[-‐‑‒–—−]\s*(?=\d)/g;

export function formatRangeSliderValue(
  value: readonly number[],
  unit?: string,
): string {
  const formatValue = (item: number): string =>
    applySliderValueLabelUnit(String(Math.round(item)), unit);

  if (value.length >= 2 && value[0] === value[1]) {
    return formatValue(value[0] ?? 0);
  }

  return value.map(formatValue).join(" – ");
}

export function snapRangeSliderValue(
  value: number,
  {
    max,
    min,
    step,
  }: {
    max: number;
    min: number;
    step: number;
  },
): number {
  const clampedValue = Math.min(max, Math.max(min, value));
  const steppedValue = Math.round((clampedValue - min) / step) * step + min;

  return Number(steppedValue.toFixed(4));
}

export function parseRangeSliderDraft(
  draftValue: string,
  {
    max,
    min,
    step,
  }: {
    max: number;
    min: number;
    step: number;
  },
): [number, number] | null {
  const normalizedDraftValue = draftValue.replace(rangeSeparatorPattern, "$1 ");
  const values = Array.from(
    normalizedDraftValue.matchAll(/-?\d+(?:[.,]\d+)?/g),
    ([match]) => Number(match.replace(",", ".")),
  ).filter(Number.isFinite);

  if (values.length === 0) {
    return null;
  }

  const [first = min, second = first] = values;
  const sortedValues = [
    snapRangeSliderValue(first, { max, min, step }),
    snapRangeSliderValue(second, { max, min, step }),
  ].sort((left, right) => left - right) as [number, number];

  return sortedValues;
}
