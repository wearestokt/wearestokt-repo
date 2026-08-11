/**
 * When a video source is imported, initialize timeline duration once from metadata.
 */

import * as React from "react";

import { useToolcraft } from "@/toolcraft/runtime/react";

import { getSourceImageAsset } from "./container-yard-image-raster";
import {
  isContainerYardVideoAsset,
  readVideoDurationSeconds,
  revokeCachedSourceVideo,
} from "./container-yard-source-frame";

export function AsciiVideoDurationSync(): null {
  const { dispatch, state } = useToolcraft();
  const asset = getSourceImageAsset(state.mediaAssets);
  const assetId = asset?.id;
  const assetDataUrl = asset?.dataUrl;
  const appliedKeyRef = React.useRef<string | null>(null);
  const previousAssetIdRef = React.useRef<string | undefined>(undefined);

  React.useEffect(() => {
    if (previousAssetIdRef.current && previousAssetIdRef.current !== assetId) {
      revokeCachedSourceVideo(previousAssetIdRef.current);
      appliedKeyRef.current = null;
    }
    previousAssetIdRef.current = assetId;
  }, [assetId]);

  React.useEffect(() => {
    let cancelled = false;

    if (!asset || !isContainerYardVideoAsset(asset) || !assetId || !assetDataUrl) {
      return () => {
        cancelled = true;
      };
    }

    const applyKey = `${assetId}:${assetDataUrl}`;
    if (appliedKeyRef.current === applyKey) {
      return () => {
        cancelled = true;
      };
    }

    void readVideoDurationSeconds(asset)
      .then((durationSeconds) => {
        if (cancelled || durationSeconds == null) {
          return;
        }
        appliedKeyRef.current = applyKey;
        const rounded = Math.max(0.1, Math.round(durationSeconds * 100) / 100);
        dispatch({
          durationSeconds: rounded,
          type: "timeline.setDuration",
        });
      })
      .catch((error: unknown) => {
        console.error("Container Yard failed to sync video duration.", error);
      });

    return () => {
      cancelled = true;
    };
  }, [asset, assetDataUrl, assetId, dispatch]);

  return null;
}
