"use client";

import * as React from "react";

import { useToolcraft } from "@/toolcraft/runtime/react";

import type { ShufflePatch } from "./flow-shuffle";

let pendingShuffleTail: Pick<
  ShufflePatch,
  "streams.spacingMode" | "stroke.sizeVariety"
> | null = null;

export function queueShuffleTailPatch(
  patch: Pick<ShufflePatch, "streams.spacingMode" | "stroke.sizeVariety">,
): void {
  pendingShuffleTail = patch;
}

export function FlowShuffleTailSync(): null {
  const { dispatch, state } = useToolcraft();
  const seed = state.values["flow.seed"];

  React.useEffect(() => {
    if (!pendingShuffleTail) {
      return;
    }

    const tail = pendingShuffleTail;
    pendingShuffleTail = null;

    const timer = window.setTimeout(() => {
      dispatch({
        target: "streams.spacingMode",
        type: "controls.setValue",
        value: tail["streams.spacingMode"],
      });
      dispatch({
        target: "stroke.sizeVariety",
        type: "controls.setValue",
        value: tail["stroke.sizeVariety"],
      });
    }, 500);

    return () => {
      window.clearTimeout(timer);
    };
  }, [dispatch, seed]);

  return null;
}
