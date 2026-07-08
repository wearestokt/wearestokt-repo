"use client";

import * as React from "react";

import { useToolcraft } from "@/toolcraft/runtime/react";

import { createPathId } from "./flow-path-math";

declare global {
  interface Window {
    __toolcraftSeedFlowPath?: () => void;
  }
}

const horizontalSeedPoints = [
  { x: 230, y: 540 },
  { x: 960, y: 540 },
  { x: 1690, y: 540 },
] as const;

export function FlowPathDevSeedApi(): null {
  const { dispatch } = useToolcraft();

  React.useEffect(() => {
    if (!import.meta.env.DEV) {
      return;
    }

    window.__toolcraftSeedFlowPath = () => {
      const id = createPathId();
      dispatch({
        target: "paths.data",
        type: "controls.setValue",
        value: {
          activePathId: id,
          paths: [{ id, points: horizontalSeedPoints.map((point) => ({ ...point })) }],
        },
      });
    };

    return () => {
      delete window.__toolcraftSeedFlowPath;
    };
  }, [dispatch]);

  return null;
}
