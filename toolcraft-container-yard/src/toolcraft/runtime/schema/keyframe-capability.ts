import { isToolcraftRuntimeOwnedTarget } from "./runtime-targets";
import type { ToolcraftControlSchema } from "./types";

export type ToolcraftControlKeyframeCapabilityReason =
  | "control-type"
  | "runtime-owned-target";

export type ToolcraftControlKeyframeCapability =
  | {
      capable: true;
      reason: "control-type";
    }
  | {
      capable: false;
      reason: ToolcraftControlKeyframeCapabilityReason;
    };

const keyframeCapableControlTypes = new Set([
  "anchorGrid",
  "channelMixer",
  "color",
  "curves",
  "gradient",
  "rangeInput",
  "rangeSlider",
  "slider",
  "vector",
]);

/** Discrete yard look/layout controls may keyframe with hold interpolation. */
const yardDiscreteKeyframeControlTypes = new Set(["select", "segmented", "switch"]);

const yardKeyframeExcludedTargets = new Set(["yard.layoutType"]);

export function getToolcraftControlKeyframeCapability(
  control: ToolcraftControlSchema,
): ToolcraftControlKeyframeCapability {
  if (isToolcraftRuntimeOwnedTarget(control.target)) {
    return {
      capable: false,
      reason: "runtime-owned-target",
    };
  }

  if (keyframeCapableControlTypes.has(control.type)) {
    return {
      capable: true,
      reason: "control-type",
    };
  }

  if (
    yardDiscreteKeyframeControlTypes.has(control.type) &&
    control.target.startsWith("yard.") &&
    !yardKeyframeExcludedTargets.has(control.target)
  ) {
    return {
      capable: true,
      reason: "control-type",
    };
  }

  return {
    capable: false,
    reason: "control-type",
  };
}
