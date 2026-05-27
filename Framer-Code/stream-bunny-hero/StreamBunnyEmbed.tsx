/**
 * StreamBunnyEmbed — Framer wrapper for the hosted Three.js hero (iframe).
 *
 * 1. Run `npm run build` in this folder and upload `dist/` to Bunny CDN.
 * 2. Set Embed URL to `https://your-zone.b-cdn.net/stream-bunny-hero/embed.html`
 * 3. Optional: Video 1–3 append as v1, v2, v3 query params.
 *
 * Develop the scene in the browser first: `npm run dev` → http://localhost:5174
 */

import React, { useMemo } from "react"
import { addPropertyControls, ControlType } from "framer"

type StreamBunnyEmbedProps = {
    /** Hosted embed.html from `npm run build` (dist/embed.html) */
    embedUrl?: string
    videoUrl1?: string
    videoUrl2?: string
    videoUrl3?: string
    modelUrl?: string
    backgroundColor?: string
    rimColor?: string
    exposure?: number
    /** On = face the camera (C4D export). Off = show the back of the head. */
    faceCamera?: boolean
    /** Rotate model on Y: 90 or -90 typical for C4D export */
    modelYaw?: number
    style?: React.CSSProperties
}

function stripHash(color: string) {
    return color.replace(/^#/, "")
}

function buildEmbedSrc(base: string, props: StreamBunnyEmbedProps): string {
    const url = new URL(base, typeof window !== "undefined" ? window.location.href : "https://example.com")
    if (props.modelUrl?.trim()) url.searchParams.set("model", props.modelUrl.trim())
    if (props.videoUrl1?.trim()) url.searchParams.set("v1", props.videoUrl1.trim())
    if (props.videoUrl2?.trim()) url.searchParams.set("v2", props.videoUrl2.trim())
    if (props.videoUrl3?.trim()) url.searchParams.set("v3", props.videoUrl3.trim())
    if (props.backgroundColor?.trim()) url.searchParams.set("bg", stripHash(props.backgroundColor.trim()))
    if (props.rimColor?.trim()) url.searchParams.set("rim", stripHash(props.rimColor.trim()))
    if (props.exposure != null && props.exposure > 0) url.searchParams.set("exposure", String(props.exposure))
    url.searchParams.set("flip", props.faceCamera !== false ? "1" : "0")
    if (props.modelYaw != null) url.searchParams.set("yaw", String(props.modelYaw))
    return url.toString()
}

/**
 * @framerDisableUnlink
 * @framerSupportedLayoutWidth any-prefer-fixed
 * @framerSupportedLayoutHeight any-prefer-fixed
 * @framerIntrinsicWidth 800
 * @framerIntrinsicHeight 800
 */
export function StreamBunnyEmbed(props: StreamBunnyEmbedProps) {
    const {
        embedUrl = "",
        videoUrl1 = "",
        videoUrl2 = "",
        videoUrl3 = "",
        modelUrl = "",
        backgroundColor = "#000000",
        rimColor = "#FF4A1F",
        exposure = 1.28,
        faceCamera = true,
        modelYaw = 0,
        style,
    } = props

    const src = useMemo(() => {
        const base = embedUrl?.trim()
        if (!base) return ""
        return buildEmbedSrc(base, {
            embedUrl: base,
            videoUrl1,
            videoUrl2,
            videoUrl3,
            modelUrl,
            backgroundColor,
            rimColor,
            exposure,
            faceCamera,
            modelYaw,
        })
    }, [embedUrl, videoUrl1, videoUrl2, videoUrl3, modelUrl, backgroundColor, rimColor, exposure, faceCamera, modelYaw])

    if (!src) {
        return (
            <div
                style={{
                    width: "100%",
                    height: "100%",
                    minHeight: 320,
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    padding: 24,
                    background: backgroundColor,
                    color: "#A3A3A3",
                    fontSize: 14,
                    textAlign: "center",
                    lineHeight: 1.5,
                    ...style,
                }}
            >
                Set Embed URL to your hosted <code style={{ color: "#FF4A1F" }}>embed.html</code> from{" "}
                <code style={{ color: "#FF4A1F" }}>npm run build</code>
            </div>
        )
    }

    return (
        <iframe
            title="Stream Bunny Hero"
            src={src}
            style={{
                width: "100%",
                height: "100%",
                minHeight: 320,
                border: "none",
                display: "block",
                background: backgroundColor,
                ...style,
            }}
            allow="autoplay"
        />
    )
}

StreamBunnyEmbed.defaultProps = {
    embedUrl: "",
    videoUrl1: "",
    videoUrl2: "",
    videoUrl3: "",
    modelUrl: "https://stokt.b-cdn.net/STREAM-BUNNY-3D.glb",
    backgroundColor: "#000000",
    rimColor: "#FF4A1F",
    exposure: 1.28,
    faceCamera: true,
    modelYaw: 90,
}

addPropertyControls(StreamBunnyEmbed, {
    embedUrl: {
        type: ControlType.String,
        title: "Embed URL",
        placeholder: "https://…/embed.html",
    },
    modelUrl: {
        type: ControlType.String,
        title: "Model URL",
        defaultValue: "https://stokt.b-cdn.net/STREAM-BUNNY-3D.glb",
    },
    videoUrl1: {
        type: ControlType.String,
        title: "Video 1",
        placeholder: "https://…/clip.mp4",
    },
    videoUrl2: {
        type: ControlType.String,
        title: "Video 2",
    },
    videoUrl3: {
        type: ControlType.String,
        title: "Video 3",
    },
    backgroundColor: {
        type: ControlType.Color,
        title: "Background",
        defaultValue: "#000000",
    },
    rimColor: {
        type: ControlType.Color,
        title: "Rim Light",
        defaultValue: "#FF4A1F",
    },
    exposure: {
        type: ControlType.Number,
        title: "Exposure",
        min: 0.5,
        max: 2.5,
        step: 0.02,
        defaultValue: 1.28,
    },
    faceCamera: {
        type: ControlType.Boolean,
        title: "Face Camera",
        defaultValue: true,
        enabledTitle: "Front",
        disabledTitle: "Back",
    },
    modelYaw: {
        type: ControlType.Number,
        title: "Model Yaw °",
        min: -180,
        max: 180,
        step: 90,
        defaultValue: 90,
        displayStepper: true,
    },
})
