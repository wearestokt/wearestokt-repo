"use client";

import * as React from "react";

import type { ToolcraftState } from "@/toolcraft/runtime";
import { useToolcraft } from "@/toolcraft/runtime/react";

import {
  buildPathSplinePathD,
  createPathId,
  defaultFlowPathsState,
  type FlowPathPoint,
  type FlowPathsState,
} from "./flow-path-math";

function asPathsState(value: unknown): FlowPathsState {
  if (!value || typeof value !== "object") {
    return { ...defaultFlowPathsState };
  }
  const raw = value as Partial<FlowPathsState>;
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
): FlowPathPoint {
  const rect = event.currentTarget.getBoundingClientRect();
  return {
    x: ((event.clientX - rect.left) / rect.width) * width,
    y: ((event.clientY - rect.top) / rect.height) * height,
  };
}

export function readFlowPathsState(state: ToolcraftState): FlowPathsState {
  return asPathsState(state.values["paths.data"]);
}

type FlowPathOverlayProps = {
  canvasHeight: number;
  canvasWidth: number;
};

export function FlowPathOverlay({
  canvasHeight,
  canvasWidth,
}: FlowPathOverlayProps): React.JSX.Element | null {
  const { dispatch, state } = useToolcraft();
  const editMode = state.values["paths.editMode"] === true;
  const pathsState = readFlowPathsState(state);
  const smoothness = 72;
  const dragRef = React.useRef<{
    pathId: string;
    pointIndex: number;
    historyGroup: string;
  } | null>(null);

  const commitPaths = React.useCallback(
    (next: FlowPathsState, history: "merge" | "record" = "record") => {
      dispatch({
        history,
        historyGroup: history === "merge" ? "paths.data.drag" : undefined,
        target: "paths.data",
        type: "controls.setValue",
        value: next,
      });
    },
    [dispatch],
  );

  const updatePathPoint = (
    pathId: string,
    pointIndex: number,
    point: FlowPathPoint,
    mergeHistory: boolean,
  ) => {
    const nextPaths = pathsState.paths.map((path) => {
      if (path.id !== pathId) {
        return path;
      }
      const nextPoints = path.points.map((existing, index) =>
        index === pointIndex ? point : existing,
      );
      return { ...path, points: nextPoints };
    });
    commitPaths({ activePathId: pathId, paths: nextPaths }, mergeHistory ? "merge" : "record");
  };

  const appendPoint = (point: FlowPathPoint) => {
    let activeId = pathsState.activePathId;
    let paths = pathsState.paths;

    if (!activeId || !paths.some((path) => path.id === activeId)) {
      activeId = createPathId();
      paths = [...paths, { id: activeId, points: [] }];
    }

    const nextPaths = paths.map((path) =>
      path.id === activeId ? { ...path, points: [...path.points, point] } : path,
    );
    commitPaths({ activePathId: activeId, paths: nextPaths });
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
    dragRef.current = { pathId, pointIndex, historyGroup: "paths.data.drag" };
    commitPaths({ activePathId: pathId, paths: pathsState.paths });
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

  if (!editMode) {
    return null;
  }

  const activePath = pathsState.paths.find((path) => path.id === pathsState.activePathId);
  const activePointCount = activePath?.points.length ?? 0;
  const showAddPointsHint = editMode && activePointCount < 2;

  return (
    <>
      <div
        className="pointer-events-none absolute inset-0 z-10 flex flex-col items-start gap-2 p-3"
        data-toolcraft-path-edit-chrome=""
      >
        <span className="rounded-full bg-black/55 px-2.5 py-1 text-xs font-medium text-white backdrop-blur-sm">
          Editing paths
        </span>
        {showAddPointsHint ? (
          <span className="rounded-md bg-black/45 px-2 py-1 text-xs text-white/90 backdrop-blur-sm">
            Click to add points along your flow
          </span>
        ) : null}
      </div>
      <svg
        aria-hidden
        className="absolute inset-0 size-full"
        data-toolcraft-path-overlay=""
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerUp}
        style={{ cursor: "crosshair", pointerEvents: "auto" }}
        viewBox={`0 0 ${canvasWidth} ${canvasHeight}`}
      >
        <rect
          fill="transparent"
          height={canvasHeight}
          onPointerDown={handleBackgroundPointerDown}
          style={{ cursor: "crosshair" }}
          width={canvasWidth}
          x={0}
          y={0}
        />
        {pathsState.paths.map((path) => {
          const isActive = path.id === pathsState.activePathId;
          const pathD = buildPathSplinePathD(path.points, smoothness);
          if (!pathD) {
            return null;
          }
          return (
            <g key={path.id}>
              <path
                d={pathD}
                fill="none"
                pointerEvents="stroke"
                stroke={isActive ? "rgba(255,255,255,0.85)" : "rgba(255,255,255,0.45)"}
                strokeDasharray={isActive ? undefined : "6 4"}
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={isActive ? 2 : 1.5}
                onPointerDown={(event) => {
                  event.stopPropagation();
                  commitPaths({ activePathId: path.id, paths: pathsState.paths });
                }}
              />
              {path.points.map((point, index) => (
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
              ))}
            </g>
          );
        })}
      </svg>
    </>
  );
}

export const FlowGuideOverlay = FlowPathOverlay;

export function addPath(state: ToolcraftState): FlowPathsState {
  const current = readFlowPathsState(state);
  const id = createPathId();
  return {
    activePathId: id,
    paths: [...current.paths, { id, points: [] }],
  };
}

export function deleteActivePath(state: ToolcraftState): FlowPathsState {
  const current = readFlowPathsState(state);
  if (!current.activePathId) {
    return current;
  }
  const paths = current.paths.filter((path) => path.id !== current.activePathId);
  return {
    activePathId: paths[0]?.id ?? null,
    paths,
  };
}

export const addGuidePath = addPath;
export const deleteActiveGuidePath = deleteActivePath;
