"use client";

import * as React from "react";

import type { ToolcraftState } from "@/toolcraft/runtime";
import { useToolcraft } from "@/toolcraft/runtime/react";

import {
  buildGuideSplinePathD,
  createGuidePathId,
  defaultFlowGuidesState,
  type FlowGuidePoint,
  type FlowGuidesState,
} from "./flow-guide-math";

function asGuidesState(value: unknown): FlowGuidesState {
  if (!value || typeof value !== "object") {
    return { ...defaultFlowGuidesState };
  }
  const raw = value as Partial<FlowGuidesState>;
  const paths = Array.isArray(raw.paths)
    ? raw.paths
        .filter((path) => path && typeof path === "object" && typeof path.id === "string")
        .map((path) => ({
          id: path.id,
          points: Array.isArray(path.points)
            ? path.points
                .filter(
                  (point) =>
                    point &&
                    typeof point === "object" &&
                    typeof point.x === "number" &&
                    typeof point.y === "number",
                )
                .map((point) => ({ x: point.x, y: point.y }))
            : [],
        }))
    : [];
  const activePathId =
    typeof raw.activePathId === "string" && paths.some((path) => path.id === raw.activePathId)
      ? raw.activePathId
      : paths[0]?.id ?? null;
  return { activePathId, paths };
}

function pointerToCanvasPoint(
  event: React.PointerEvent<SVGElement>,
  width: number,
  height: number,
): FlowGuidePoint {
  const rect = event.currentTarget.getBoundingClientRect();
  return {
    x: ((event.clientX - rect.left) / rect.width) * width,
    y: ((event.clientY - rect.top) / rect.height) * height,
  };
}

export function readFlowGuidesState(state: ToolcraftState): FlowGuidesState {
  return asGuidesState(state.values["guides.paths"]);
}

type FlowGuideOverlayProps = {
  canvasHeight: number;
  canvasWidth: number;
};

export function FlowGuideOverlay({
  canvasHeight,
  canvasWidth,
}: FlowGuideOverlayProps): React.JSX.Element | null {
  const { dispatch, state } = useToolcraft();
  const editMode = state.values["guides.editMode"] === true;
  const guides = readFlowGuidesState(state);
  const dragRef = React.useRef<{
    pathId: string;
    pointIndex: number;
    historyGroup: string;
  } | null>(null);

  const commitGuides = React.useCallback(
    (next: FlowGuidesState, history: "merge" | "record" = "record") => {
      dispatch({
        history,
        historyGroup: history === "merge" ? "guides.paths.drag" : undefined,
        target: "guides.paths",
        type: "controls.setValue",
        value: next,
      });
    },
    [dispatch],
  );

  const updatePathPoint = (
    pathId: string,
    pointIndex: number,
    point: FlowGuidePoint,
    mergeHistory: boolean,
  ) => {
    const nextPaths = guides.paths.map((path) => {
      if (path.id !== pathId) {
        return path;
      }
      const nextPoints = path.points.map((existing, index) =>
        index === pointIndex ? point : existing,
      );
      return { ...path, points: nextPoints };
    });
    commitGuides({ activePathId: pathId, paths: nextPaths }, mergeHistory ? "merge" : "record");
  };

  const appendPoint = (point: FlowGuidePoint) => {
    let activeId = guides.activePathId;
    let paths = guides.paths;

    if (!activeId || !paths.some((path) => path.id === activeId)) {
      activeId = createGuidePathId();
      paths = [...paths, { id: activeId, points: [] }];
    }

    const nextPaths = paths.map((path) =>
      path.id === activeId ? { ...path, points: [...path.points, point] } : path,
    );
    commitGuides({ activePathId: activeId, paths: nextPaths });
  };

  const handleBackgroundPointerDown = (event: React.PointerEvent<SVGRectElement>) => {
    if (!editMode || event.button !== 0) {
      return;
    }
    event.stopPropagation();
    event.preventDefault();
    const target = event.target as SVGElement;
    if (typeof target.setPointerCapture === "function") {
      target.setPointerCapture(event.pointerId);
    }
    appendPoint(pointerToCanvasPoint(event, canvasWidth, canvasHeight));
  };

  const handlePointPointerDown = (
    pathId: string,
    pointIndex: number,
    event: React.PointerEvent<SVGCircleElement>,
  ) => {
    if (!editMode) {
      return;
    }
    event.stopPropagation();
    event.preventDefault();
    event.currentTarget.setPointerCapture(event.pointerId);
    dragRef.current = { pathId, pointIndex, historyGroup: "guides.paths.drag" };
    commitGuides({ activePathId: pathId, paths: guides.paths });
  };

  const handlePointerMove = (event: React.PointerEvent<SVGElement>) => {
    const drag = dragRef.current;
    if (!drag) {
      return;
    }
    event.stopPropagation();
    const point = pointerToCanvasPoint(event, canvasWidth, canvasHeight);
    updatePathPoint(drag.pathId, drag.pointIndex, point, true);
  };

  const handlePointerUp = (event: React.PointerEvent<SVGElement>) => {
    if (!dragRef.current) {
      return;
    }
    event.stopPropagation();
    dragRef.current = null;
  };

  if (!editMode && guides.paths.every((path) => path.points.length === 0)) {
    return null;
  }

  return (
    <svg
      aria-hidden
      className="absolute inset-0 size-full"
      data-toolcraft-guide-overlay=""
      onPointerMove={editMode ? handlePointerMove : undefined}
      onPointerUp={editMode ? handlePointerUp : undefined}
      style={{ pointerEvents: editMode ? "auto" : "none" }}
      viewBox={`0 0 ${canvasWidth} ${canvasHeight}`}
    >
      {editMode ? (
        <rect
          fill="transparent"
          height={canvasHeight}
          onPointerDown={handleBackgroundPointerDown}
          width={canvasWidth}
          x={0}
          y={0}
        />
      ) : null}
      {guides.paths.map((path) => {
        const isActive = path.id === guides.activePathId;
        const pathD = buildGuideSplinePathD(path.points);
        if (!pathD) {
          return null;
        }
        return (
          <g key={path.id}>
            <path
              d={pathD}
              fill="none"
              pointerEvents={editMode ? "stroke" : "none"}
              stroke={isActive ? "rgba(255,255,255,0.85)" : "rgba(255,255,255,0.45)"}
              strokeDasharray={isActive ? undefined : "6 4"}
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={isActive ? 2 : 1.5}
              onPointerDown={
                editMode
                  ? (event) => {
                      event.stopPropagation();
                      commitGuides({ activePathId: path.id, paths: guides.paths });
                    }
                  : undefined
              }
            />
            {editMode
              ? path.points.map((point, index) => (
                  <circle
                    cx={point.x}
                    cy={point.y}
                    fill={isActive ? "#ffffff" : "rgba(255,255,255,0.7)"}
                    key={`${path.id}-${index}`}
                    onPointerDown={(event) => handlePointPointerDown(path.id, index, event)}
                    r={isActive ? 6 : 5}
                    stroke="rgba(0,0,0,0.5)"
                    strokeWidth={1}
                  />
                ))
              : null}
          </g>
        );
      })}
    </svg>
  );
}

export function addGuidePath(state: ToolcraftState): FlowGuidesState {
  const current = readFlowGuidesState(state);
  const id = createGuidePathId();
  return {
    activePathId: id,
    paths: [...current.paths, { id, points: [] }],
  };
}

export function deleteActiveGuidePath(state: ToolcraftState): FlowGuidesState {
  const current = readFlowGuidesState(state);
  if (!current.activePathId) {
    return current;
  }
  const paths = current.paths.filter((path) => path.id !== current.activePathId);
  return {
    activePathId: paths[0]?.id ?? null,
    paths,
  };
}
