"use client";

import * as React from "react";

import { useToolcraft } from "@/toolcraft/runtime/react";

import { paletteBackgroundForSettings, type PalettePresetId } from "./flow-palette";
import { getFieldPresetPatch, type TexturePreset } from "./flow-vector-field";

function asTexturePreset(value: unknown): TexturePreset {
  if (value === "off" || value === "calm" || value === "ripple" || value === "storm") {
    return value;
  }
  return "calm";
}

export function TexturePresetSync(): null {
  const { dispatch, state } = useToolcraft();
  const preset = asTexturePreset(state.values["flow.texturePreset"]);
  const previousPreset = React.useRef<TexturePreset | null>(null);

  React.useEffect(() => {
    if (previousPreset.current === preset) {
      return;
    }
    previousPreset.current = preset;

    const patch = getFieldPresetPatch(preset);
    dispatch({
      target: "flow.frequency",
      type: "controls.setValue",
      value: patch.frequency,
    });
    dispatch({
      target: "flow.swirl",
      type: "controls.setValue",
      value: patch.swirl,
    });
    dispatch({
      target: "flow.turbulence",
      type: "controls.setValue",
      value: patch.turbulence,
    });
    if (typeof patch.streamsDensity === "number") {
      dispatch({
        target: "streams.density",
        type: "controls.setValue",
        value: patch.streamsDensity,
      });
    }
    if (typeof patch.spacingMode === "string") {
      dispatch({
        target: "streams.spacingMode",
        type: "controls.setValue",
        value: patch.spacingMode,
      });
    }
    if (typeof patch.spacingGap === "number") {
      dispatch({
        target: "streams.gap",
        type: "controls.setValue",
        value: patch.spacingGap,
      });
    }
    if (typeof patch.streamsMargin === "number") {
      dispatch({
        target: "streams.margin",
        type: "controls.setValue",
        value: patch.streamsMargin,
      });
    }
    if (typeof patch.sizeVariety === "number") {
      dispatch({
        target: "stroke.sizeVariety",
        type: "controls.setValue",
        value: patch.sizeVariety,
      });
    }
  }, [dispatch, preset]);

  return null;
}

function asPalettePreset(value: unknown): PalettePresetId {
  const allowed: PalettePresetId[] = [
    "ocean",
    "ember",
    "newsprint",
    "golden-hour",
    "neon",
    "monochrome",
    "ink",
    "pastel",
    "twilight",
    "custom",
  ];
  if (typeof value === "string" && (allowed as string[]).includes(value)) {
    return value as PalettePresetId;
  }
  return "ocean";
}

export function PalettePresetSync(): null {
  const { dispatch, state } = useToolcraft();
  const paletteId = asPalettePreset(state.values["color.palette"]);
  const previousPalette = React.useRef<PalettePresetId | null>(null);

  React.useEffect(() => {
    if (previousPalette.current === paletteId) {
      return;
    }
    previousPalette.current = paletteId;

    if (paletteId === "custom") {
      return;
    }

    const background = paletteBackgroundForSettings({
      assignmentMode: "weighted",
      customSlots: [],
      opacity: 100,
      presetId: paletteId,
    });
    dispatch({
      target: "appearance.background",
      type: "controls.setValue",
      value: { hex: background },
    });
  }, [dispatch, paletteId]);

  return null;
}
