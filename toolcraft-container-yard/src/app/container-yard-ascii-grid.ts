/**
 * ASCII mode grid defaults and sync when App mode switches to ASCII.
 */

import * as React from "react";

import { useToolcraft } from "@/toolcraft/runtime/react";

export const ASCII_GRID_DEFAULT_TARGETS = {
  "yard.columnGap": 3,
  "yard.lengthMix": 0,
  "yard.randomGaps": 0,
  "yard.rotation": 0,
  "yard.rowGap": 3,
  "yard.stagger": 0,
} as const;

export function AsciiGridDefaultsSync(): null {
  const { dispatch, state } = useToolcraft();
  const previousLayoutType = React.useRef<string | undefined>(undefined);

  React.useEffect(() => {
    const layoutType = state.values["yard.layoutType"];
    const enteredAscii = layoutType === "dither" && previousLayoutType.current !== "dither";

    if (enteredAscii) {
      for (const [target, value] of Object.entries(ASCII_GRID_DEFAULT_TARGETS)) {
        dispatch({
          target,
          type: "controls.setValue",
          value,
        });
      }
    }

    previousLayoutType.current = typeof layoutType === "string" ? layoutType : undefined;
  }, [dispatch, state.values["yard.layoutType"]]);

  return null;
}
