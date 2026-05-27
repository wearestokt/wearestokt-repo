/**
 * InkDrawCanvas.tsx
 *
 * Main Framer code component. Drop this onto your canvas and resize freely.
 * Pair with InkDrawReset.tsx and InkDrawSend.tsx buttons placed anywhere.
 *
 * EmailJS setup → see README.md
 */

import React, { useRef, useEffect, useState, useCallback } from "react"
import { addPropertyControls, ControlType } from "framer"
import {
    registerReset,
    registerSend,
    setState as setStoreState,
    setFormData,
    getFormData,
    subscribe,
    getState,
} from "./InkDrawStore"

// ─── Types ────────────────────────────────────────────────────────────────────

/** A single point in a stroke. Coordinates are normalized (0–1). */
type Point = {
    x: number // 0–1 relative to canvas width
    y: number // 0–1 relative to canvas height
    w: number // stroke width at this point (px, not normalized)
}

type Stroke = Point[]

// ─── Ink drawing helpers ──────────────────────────────────────────────────────

const MIN_WIDTH = 0.5
const MAX_VELOCITY = 1200 // px/s — above this the stroke is at minimum width

function velocityToWidth(velocityPxPerSec: number, baseWidth: number): number {
    // Fast movement → thinner line (mimics real ink pen behaviour)
    const ratio = Math.min(velocityPxPerSec / MAX_VELOCITY, 1)
    const min = MIN_WIDTH
    const max = baseWidth * 2.2
    return max - (max - min) * ratio
}

function drawStrokes(
    ctx: CanvasRenderingContext2D,
    strokes: Stroke[],
    canvasW: number,
    canvasH: number,
    color: string
) {
    ctx.lineCap = "round"
    ctx.lineJoin = "round"
    ctx.strokeStyle = color

    for (const stroke of strokes) {
        if (stroke.length < 2) continue

        for (let i = 1; i < stroke.length; i++) {
            const prev = stroke[i - 1]
            const curr = stroke[i]

            ctx.beginPath()
            ctx.lineWidth = (prev.w + curr.w) / 2
            ctx.moveTo(prev.x * canvasW, prev.y * canvasH)

            if (i < stroke.length - 1) {
                const next = stroke[i + 1]
                // Quadratic bezier for smooth curves
                const midX = ((curr.x + next.x) / 2) * canvasW
                const midY = ((curr.y + next.y) / 2) * canvasH
                ctx.quadraticCurveTo(
                    curr.x * canvasW,
                    curr.y * canvasH,
                    midX,
                    midY
                )
            } else {
                ctx.lineTo(curr.x * canvasW, curr.y * canvasH)
            }
            ctx.stroke()
        }
    }
}

function redraw(
    canvas: HTMLCanvasElement,
    strokes: Stroke[],
    color: string,
    bgColor: string
) {
    const ctx = canvas.getContext("2d")
    if (!ctx) return
    const { width, height } = canvas
    ctx.clearRect(0, 0, width, height)
    ctx.fillStyle = bgColor
    ctx.fillRect(0, 0, width, height)
    drawStrokes(ctx, strokes, width, height, color)
}

/** Scale canvas down for export to avoid 413 Payload Too Large */
function getCompressedDataUrl(
    canvas: HTMLCanvasElement,
    maxSize: number,
    quality: number,
    bgColor: string
): string {
    const w = canvas.width
    const h = canvas.height
    const scale = Math.min(1, maxSize / Math.max(w, h))
    const outW = Math.round(w * scale)
    const outH = Math.round(h * scale)

    const off = document.createElement("canvas")
    off.width = outW
    off.height = outH
    const ctx = off.getContext("2d")
    if (!ctx) return canvas.toDataURL("image/png")

    // Fill before draw — JPEG has no transparency (black otherwise)
    ctx.fillStyle = bgColor
    ctx.fillRect(0, 0, outW, outH)
    ctx.drawImage(canvas, 0, 0, w, h, 0, 0, outW, outH)
    return off.toDataURL("image/jpeg", quality)
}

// ─── Component ────────────────────────────────────────────────────────────────

interface Props {
    penColor: string
    penWidth: number
    cursorDotSize: number
    exportMaxSize: number
    exportQuality: number
    exportBackground: string
    canvasBackground: string
    canvasBorderRadius: number
    successMessage: string
    emailjsServiceId: string
    emailjsTemplateId: string
    emailjsPublicKey: string
    overlayFontSize: number
    overlayTextColor: string
    overlayFont?: { fontFamily?: string; fontWeight?: number | string }
}

export default function InkDrawCanvas({
    penColor = "#1a1a1a",
    penWidth = 2,
    cursorDotSize = 4,
    exportMaxSize = 800,
    exportQuality = 0.85,
    exportBackground = "#ffffff",
    canvasBackground = "#faf8f5",
    canvasBorderRadius = 8,
    successMessage = "Thank you — your message has been sent.",
    emailjsServiceId = "",
    emailjsTemplateId = "",
    emailjsPublicKey = "",
    overlayFontSize = 14,
    overlayTextColor = "#1a1a1a",
    overlayFont,
}: Props) {
    const canvasRef = useRef<HTMLCanvasElement>(null)
    const wrapperRef = useRef<HTMLDivElement>(null)
    const strokesRef = useRef<Stroke[]>([])
    const currentStrokeRef = useRef<Stroke>([])
    const isDrawingRef = useRef(false)
    const lastPointRef = useRef<{ x: number; y: number; t: number } | null>(
        null
    )

    const [storeState, setLocalState] = useState(getState())
    const [cursorPos, setCursorPos] = useState<{ x: number; y: number } | null>(
        null
    )

    // Sync with shared store
    useEffect(() => {
        return subscribe(() => setLocalState({ ...getState() }))
    }, [])

    // ── Canvas sizing (device pixel ratio aware) ──────────────────────────────

    const resizeCanvas = useCallback(() => {
        const canvas = canvasRef.current
        const wrapper = wrapperRef.current
        if (!canvas || !wrapper) return

        const dpr = window.devicePixelRatio || 1
        const rect = wrapper.getBoundingClientRect()

        canvas.style.width = rect.width + "px"
        canvas.style.height = rect.height + "px"
        canvas.width = Math.round(rect.width * dpr)
        canvas.height = Math.round(rect.height * dpr)

        const ctx = canvas.getContext("2d")
        if (ctx) ctx.scale(dpr, dpr)

        redraw(canvas, strokesRef.current, penColor, canvasBackground)
    }, [penColor, canvasBackground])

    useEffect(() => {
        const observer = new ResizeObserver(resizeCanvas)
        if (wrapperRef.current) observer.observe(wrapperRef.current)
        resizeCanvas()
        return () => observer.disconnect()
    }, [resizeCanvas])

    // Redraw when pen props change
    useEffect(() => {
        const canvas = canvasRef.current
        if (canvas) redraw(canvas, strokesRef.current, penColor, canvasBackground)
    }, [penColor, canvasBackground])

    // ── Pointer event helpers ─────────────────────────────────────────────────

    const getCanvasPoint = useCallback(
        (e: React.PointerEvent<HTMLCanvasElement>) => {
            const canvas = canvasRef.current
            if (!canvas) return null
            const rect = canvas.getBoundingClientRect()
            return {
                x: (e.clientX - rect.left) / rect.width,
                y: (e.clientY - rect.top) / rect.height,
                t: performance.now(),
            }
        },
        []
    )

    const updateCursorPos = useCallback(
        (e: React.PointerEvent<HTMLCanvasElement>) => {
            const wrapper = wrapperRef.current
            if (!wrapper) return
            const rect = wrapper.getBoundingClientRect()
            setCursorPos({
                x: e.clientX - rect.left,
                y: e.clientY - rect.top,
            })
        }
    )

    const onPointerDown = useCallback(
        (e: React.PointerEvent<HTMLCanvasElement>) => {
            if (storeState.isSuccess) return
            e.currentTarget.setPointerCapture(e.pointerId)
            isDrawingRef.current = true
            currentStrokeRef.current = []

            const pt = getCanvasPoint(e)
            if (!pt) return
            lastPointRef.current = pt

            const p: Point = { x: pt.x, y: pt.y, w: penWidth }
            currentStrokeRef.current.push(p)
        },
        [getCanvasPoint, penWidth, storeState.isSuccess]
    )

    const onPointerMove = useCallback(
        (e: React.PointerEvent<HTMLCanvasElement>) => {
            updateCursorPos(e)

            if (!isDrawingRef.current) return

            const pt = getCanvasPoint(e)
            if (!pt || !lastPointRef.current) return

            const canvas = canvasRef.current
            if (!canvas) return
            const { width, height } = canvas.getBoundingClientRect()

            const dx = (pt.x - lastPointRef.current.x) * width
            const dy = (pt.y - lastPointRef.current.y) * height
            const dt = (pt.t - lastPointRef.current.t) / 1000
            const dist = Math.sqrt(dx * dx + dy * dy)
            const velocity = dt > 0 ? dist / dt : 0

            const w = velocityToWidth(velocity, penWidth)
            const point: Point = { x: pt.x, y: pt.y, w }
            currentStrokeRef.current.push(point)
            lastPointRef.current = pt

            // Incremental draw — only render the last segment
            const ctx = canvas.getContext("2d")
            if (ctx) {
                const stroke = currentStrokeRef.current
                const n = stroke.length
                if (n >= 2) {
                    const prev = stroke[n - 2]
                    const curr = stroke[n - 1]
                    ctx.beginPath()
                    ctx.lineCap = "round"
                    ctx.lineJoin = "round"
                    ctx.strokeStyle = penColor
                    ctx.lineWidth = (prev.w + curr.w) / 2
                    ctx.moveTo(prev.x * width, prev.y * height)
                    ctx.lineTo(curr.x * width, curr.y * height)
                    ctx.stroke()
                }
            }
        },
        [getCanvasPoint, penColor, penWidth, updateCursorPos]
    )

    const onPointerLeave = useCallback(
        (e: React.PointerEvent<HTMLCanvasElement>) => {
            setCursorPos(null)
            if (isDrawingRef.current) {
                isDrawingRef.current = false
                lastPointRef.current = null
                if (currentStrokeRef.current.length > 0) {
                    strokesRef.current = [
                        ...strokesRef.current,
                        currentStrokeRef.current,
                    ]
                }
                currentStrokeRef.current = []
            }
        },
        []
    )

    const onPointerUp = useCallback(() => {
        if (!isDrawingRef.current) return
        isDrawingRef.current = false
        lastPointRef.current = null

        if (currentStrokeRef.current.length > 0) {
            strokesRef.current = [
                ...strokesRef.current,
                currentStrokeRef.current,
            ]
        }
        currentStrokeRef.current = []
    }, [])

    // ── Reset action ──────────────────────────────────────────────────────────

    const reset = useCallback(() => {
        strokesRef.current = []
        currentStrokeRef.current = []
        setFormData({ message: "", name: "", email: "" })
        setStoreState({
            isLoading: false,
            isSuccess: false,
            isError: false,
            errorMessage: "",
        })
        const canvas = canvasRef.current
        if (canvas) redraw(canvas, [], penColor, canvasBackground)
    }, [penColor, canvasBackground])

    // ── Send action ───────────────────────────────────────────────────────────

    const send = useCallback(async () => {
        if (storeState.isLoading) return

        const canvas = canvasRef.current
        if (!canvas) return

        const { message, name, email } = getFormData()

        // Validate required fields
        const trimmedName = name.trim()
        const trimmedEmail = email.trim()
        const trimmedMessage = message.trim()

        if (!trimmedName) {
            setStoreState({
                isError: true,
                errorMessage: "Please enter your name.",
            })
            return
        }
        if (!trimmedEmail) {
            setStoreState({
                isError: true,
                errorMessage: "Please enter your email address.",
            })
            return
        }
        if (!trimmedMessage) {
            setStoreState({
                isError: true,
                errorMessage: "Please enter a message.",
            })
            return
        }

        // Basic email format check (local@domain.tld)
        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
        if (!emailRegex.test(trimmedEmail)) {
            setStoreState({
                isError: true,
                errorMessage: "Please enter a valid email address.",
            })
            return
        }

        const imageData = getCompressedDataUrl(
            canvas,
            exportMaxSize,
            exportQuality,
            exportBackground
        )

        setStoreState({ isLoading: true, isError: false, errorMessage: "" })

        try {
            const response = await fetch(
                "https://api.emailjs.com/api/v1.0/email/send",
                {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({
                        service_id: emailjsServiceId,
                        template_id: emailjsTemplateId,
                        user_id: emailjsPublicKey,
                        template_params: {
                            from_name: trimmedName,
                            from_email: trimmedEmail,
                            message: trimmedMessage,
                            drawing: imageData,
                        },
                    }),
                }
            )

            if (!response.ok) throw new Error(`EmailJS error: ${response.status}`)

            setStoreState({ isLoading: false, isSuccess: true })

            // Clear form, strokes, and drawing — success message shows in canvas area
            setFormData({ message: "", name: "", email: "" })
            strokesRef.current = []
            redraw(canvas, [], penColor, canvasBackground)
        } catch (err: any) {
            setStoreState({
                isLoading: false,
                isError: true,
                errorMessage: err?.message ?? "Something went wrong.",
            })
        }
    }, [
        storeState.isLoading,
        emailjsServiceId,
        emailjsTemplateId,
        emailjsPublicKey,
        exportMaxSize,
        exportQuality,
        exportBackground,
        penColor,
        canvasBackground,
    ])

    // Register with store so external buttons can call these
    useEffect(() => {
        registerReset(reset)
    }, [reset])

    useEffect(() => {
        registerSend(send)
    }, [send])

    // ── Render ────────────────────────────────────────────────────────────────

    return (
        <div
            style={{
                width: "100%",
                height: "100%",
                display: "flex",
                flexDirection: "column",
                fontFamily:
                    '-apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif',
                boxSizing: "border-box",
            }}
        >
            {/* ── Drawing area ── */}
            <div
                ref={wrapperRef}
                style={{
                    flex: 1,
                    position: "relative",
                    borderRadius: canvasBorderRadius,
                    overflow: "hidden",
                    background: canvasBackground,
                    minHeight: 80,
                }}
            >
                <canvas
                    ref={canvasRef}
                    onPointerDown={onPointerDown}
                    onPointerMove={onPointerMove}
                    onPointerUp={onPointerUp}
                    onPointerLeave={onPointerLeave}
                    style={{
                        display: "block",
                        width: "100%",
                        height: "100%",
                        touchAction: "none",
                        cursor: storeState.isSuccess ? "default" : "none",
                    }}
                />

                {/* Cursor dot — sized to match pen, centered on tip */}
                {!storeState.isSuccess &&
                    cursorPos != null && (
                        <div
                            style={{
                                position: "absolute",
                                left: cursorPos.x,
                                top: cursorPos.y,
                                width: cursorDotSize,
                                height: cursorDotSize,
                                transform: "translate(-50%, -50%)",
                                borderRadius: "50%",
                                background: penColor,
                                pointerEvents: "none",
                            }}
                        />
                    )}

                {/* Success overlay — rendered inside the drawing area */}
                {storeState.isSuccess && (
                    <div
                        style={{
                            position: "absolute",
                            inset: 0,
                            display: "flex",
                            alignItems: "center",
                            justifyContent: "center",
                            background: canvasBackground,
                            borderRadius: canvasBorderRadius,
                            padding: "24px 32px",
                        }}
                    >
                        <p
                            style={{
                                margin: 0,
                                fontFamily: overlayFont?.fontFamily ?? '-apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif',
                                fontWeight: overlayFont?.fontWeight ?? 400,
                                fontSize: overlayFontSize,
                                color: overlayTextColor,
                                textAlign: "center",
                                lineHeight: 1.6,
                                fontStyle: "italic",
                                opacity: 1,
                                maxWidth: 320,
                            }}
                        >
                            {successMessage}
                        </p>
                    </div>
                )}

                {/* Loading overlay */}
                {storeState.isLoading && (
                    <div
                        style={{
                            position: "absolute",
                            inset: 0,
                            display: "flex",
                            alignItems: "center",
                            justifyContent: "center",
                            background: canvasBackground + "cc",
                        }}
                    >
                        <span
                            style={{
                                fontSize: 12,
                                fontFamily: overlayFont?.fontFamily ?? '-apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif',
                                fontWeight: overlayFont?.fontWeight ?? 400,
                                color: overlayTextColor,
                                opacity: 0.5,
                            }}
                        >
                            Sending…
                        </span>
                    </div>
                )}
            </div>
        </div>
    )
}

// ─── Framer Property Controls ─────────────────────────────────────────────────

addPropertyControls(InkDrawCanvas, {
    // Drawing
    penColor: {
        type: ControlType.Color,
        defaultValue: "#1a1a1a",
        title: "Pen Color",
    },
    penWidth: {
        type: ControlType.Number,
        defaultValue: 2,
        min: 0.5,
        max: 8,
        step: 0.5,
        title: "Pen Width",
    },
    cursorDotSize: {
        type: ControlType.Number,
        defaultValue: 4,
        min: 1,
        max: 24,
        step: 1,
        title: "Cursor Dot Size",
    },
    exportMaxSize: {
        type: ControlType.Number,
        defaultValue: 800,
        min: 400,
        max: 1600,
        step: 100,
        title: "Export Max Size",
    },
    exportQuality: {
        type: ControlType.Number,
        defaultValue: 0.85,
        min: 0.5,
        max: 1,
        step: 0.05,
        title: "Export Quality",
    },
    exportBackground: {
        type: ControlType.Color,
        defaultValue: "#ffffff",
        title: "Export Background",
    },
    canvasBackground: {
        type: ControlType.Color,
        defaultValue: "#faf8f5",
        title: "Canvas Background",
    },
    canvasBorderRadius: {
        type: ControlType.Number,
        defaultValue: 8,
        min: 0,
        max: 40,
        title: "Corner Radius",
    },

    // Success overlay
    successMessage: {
        type: ControlType.String,
        defaultValue: "Thank you — your message has been sent.",
        title: "Success Message",
    },
    overlayFontSize: {
        type: ControlType.Number,
        defaultValue: 14,
        min: 10,
        max: 24,
        title: "Overlay Font Size",
    },
    overlayTextColor: {
        type: ControlType.Color,
        defaultValue: "#1a1a1a",
        title: "Overlay Text Color",
    },
    overlayFont: {
        type: ControlType.Font,
        title: "Success Message Font",
    },

    // EmailJS config
    emailjsServiceId: {
        type: ControlType.String,
        defaultValue: "",
        title: "EmailJS Service ID",
    },
    emailjsTemplateId: {
        type: ControlType.String,
        defaultValue: "",
        title: "EmailJS Template ID",
    },
    emailjsPublicKey: {
        type: ControlType.String,
        defaultValue: "",
        title: "EmailJS Public Key",
    },
})
