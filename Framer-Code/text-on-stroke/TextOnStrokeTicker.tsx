/**
 * Text on Stroke Ticker — repeating text along a pasted SVG path `d`, with native
 * Framer font controls, placement, stroke band color/width, auto ticker, and scroll motion.
 */
import {
    useCallback,
    useEffect,
    useLayoutEffect,
    useId,
    useMemo,
    useRef,
    useState,
    startTransition,
    type CSSProperties,
} from "react"
import {
    addPropertyControls,
    ControlType,
    RenderTarget,
    useIsStaticRenderer,
} from "framer"
import {
    useInView,
    useScroll,
    useTransform,
    useMotionValueEvent,
    motion,
} from "framer-motion"

type AnimationMode = "auto" | "scrollPage" | "scrollSection" | "scrollElement"
type PathFit = "contain" | "cover" | "stretch"
type ScrollOffsetPreset = "enter" | "center" | "exit" | "full"
type TickerDirection = "forward" | "reverse"
type TextPlacement = "above" | "center" | "below"

type FontControlValue =
    | string
    | {
          fontFamily?: string
          family?: string
          font?: string
          fontSize?: string | number
          fontWeight?: string | number
          fontStyle?: string
          lineHeight?: string | number
          letterSpacing?: string | number
          color?: string
          textAlign?: string
          variant?: string
      }

const DEFAULT_PATH_D =
    "M 20 80 Q 120 10 220 80 T 420 80 T 620 80 T 820 80"

const SCROLL_OFFSET_MAP: Record<ScrollOffsetPreset, [string, string]> = {
    enter: ["start end", "end start"],
    center: ["start center", "end center"],
    exit: ["start start", "end end"],
    full: ["start start", "end end"],
}

const VARIANT_WEIGHT: Record<string, { fontWeight: number; fontStyle: string }> =
    {
        Regular: { fontWeight: 400, fontStyle: "normal" },
        Thin: { fontWeight: 100, fontStyle: "normal" },
        "Extra Light": { fontWeight: 200, fontStyle: "normal" },
        Light: { fontWeight: 300, fontStyle: "normal" },
        Medium: { fontWeight: 500, fontStyle: "normal" },
        Semibold: { fontWeight: 600, fontStyle: "normal" },
        Bold: { fontWeight: 700, fontStyle: "normal" },
        "Extra Bold": { fontWeight: 800, fontStyle: "normal" },
        Black: { fontWeight: 900, fontStyle: "normal" },
        Italic: { fontWeight: 400, fontStyle: "italic" },
        "Bold Italic": { fontWeight: 700, fontStyle: "italic" },
    }

export interface TextOnStrokeTickerProps {
    pathD?: string
    showStroke?: boolean
    strokeColor?: string
    strokeWidth?: number
    textPlacement?: TextPlacement
    text?: string
    textStyle?: FontControlValue
    repeatGap?: number
    separator?: string
    padding?: string
    pathFit?: PathFit
    animationMode?: AnimationMode
    durationSec?: number
    direction?: TickerDirection
    play?: boolean
    scrollOffsetPreset?: ScrollOffsetPreset
    scrollMultiplier?: number
    scrollSelector?: string
    style?: CSSProperties
}

function fontFamilyFromControl(
    value: FontControlValue | undefined,
    fallback: string
): string {
    if (typeof value === "string" && value.trim().length > 0) return value
    if (value && typeof value === "object") {
        const candidate = value.fontFamily || value.family || value.font
        if (typeof candidate === "string" && candidate.trim().length > 0)
            return candidate
    }
    return fallback
}

function typographyFromControl(
    value: FontControlValue | undefined,
    fallbackFamily: string
): CSSProperties {
    const family = fontFamilyFromControl(value, fallbackFamily)
    if (!value || typeof value !== "object") return { fontFamily: family }

    const variant =
        typeof value.variant === "string" ? VARIANT_WEIGHT[value.variant] : undefined

    return {
        fontFamily: family,
        ...(value.fontSize !== undefined ? { fontSize: value.fontSize } : {}),
        ...(value.fontWeight !== undefined
            ? { fontWeight: value.fontWeight }
            : variant
              ? { fontWeight: variant.fontWeight }
              : {}),
        ...(value.fontStyle !== undefined
            ? { fontStyle: value.fontStyle }
            : variant
              ? { fontStyle: variant.fontStyle }
              : {}),
        ...(value.lineHeight !== undefined ? { lineHeight: value.lineHeight } : {}),
        ...(value.letterSpacing !== undefined
            ? { letterSpacing: value.letterSpacing }
            : {}),
        ...(value.color !== undefined ? { color: value.color } : {}),
    }
}

function extractPathD(raw: string | undefined): string {
    if (!raw) return ""
    const trimmed = raw.trim()
    if (!trimmed) return ""

    const dAttr = trimmed.match(/\bd\s*=\s*["']([^"']+)["']/i)
    if (dAttr?.[1]) return dAttr[1].trim()

    if (/^[Mm]/.test(trimmed)) return trimmed

    return trimmed
}

function parseFontSizePx(value: FontControlValue | undefined): number {
    if (!value || typeof value !== "object" || value.fontSize === undefined) {
        return 18
    }
    const raw = value.fontSize
    if (typeof raw === "number" && Number.isFinite(raw)) return raw
    if (typeof raw === "string") {
        const n = parseFloat(raw)
        if (Number.isFinite(n)) return n
    }
    return 18
}

/** Perpendicular offset for text relative to the path (Up / Centered / Below). */
function dyForPlacement(
    placement: TextPlacement,
    fontSizePx: number,
    strokeWidthPx: number
): number {
    const band = Math.max(strokeWidthPx, 1)
    const textHalf = fontSizePx * 0.45
    switch (placement) {
        case "above":
            return -(textHalf + band * 0.35)
        case "below":
            return textHalf + band * 0.35
        case "center":
        default:
            return 0
    }
}

function buildSegment(
    text: string,
    separator: string,
    repeatGap: number
): string {
    const gap =
        repeatGap > 0
            ? " ".repeat(Math.min(32, Math.max(1, Math.round(repeatGap / 4))))
            : ""
    const sep = separator ?? " · "
    return `${text}${gap}${sep}`
}

function buildRepeatedText(
    segment: string,
    minLength: number,
    maxRepeats: number
): string {
    if (!segment) return ""
    let out = segment
    let count = 1
    while (out.length < minLength && count < maxRepeats) {
        out += segment
        count += 1
    }
    return out + out
}

function findScrollSection(el: HTMLElement | null): HTMLElement | null {
    if (!el || typeof document === "undefined") return null
    let node: HTMLElement | null = el.parentElement
    while (node && node !== document.body) {
        const tag = node.tagName.toLowerCase()
        const framerName =
            node.getAttribute("data-framer-name")?.toLowerCase() ?? ""
        const isFramerSection =
            framerName.includes("section") ||
            (node.getAttribute("data-framer-component-type") === "Frame" &&
                node.parentElement === document.body)
        if (isFramerSection || tag === "section") return node
        node = node.parentElement
    }
    return el.parentElement
}

function findScrollContainer(
    el: HTMLElement | null,
    selector?: string
): HTMLElement | null {
    if (!el || typeof document === "undefined") return null

    const sel = selector?.trim()
    if (sel) {
        const found = document.querySelector(sel)
        if (found instanceof HTMLElement) return found
    }

    let node: HTMLElement | null = el.parentElement
    while (node && node !== document.body) {
        const style = window.getComputedStyle(node)
        const oy = style.overflowY
        const scrollable =
            (oy === "auto" || oy === "scroll" || oy === "overlay") &&
            node.scrollHeight > node.clientHeight + 1
        if (scrollable) return node
        node = node.parentElement
    }
    return null
}

interface PathMetrics {
    length: number
    viewBox: string
}

function measurePath(
    pathEl: SVGPathElement | null,
    _fit: PathFit,
    pad: number
): PathMetrics | null {
    if (!pathEl) return null
    try {
        const length = pathEl.getTotalLength()
        if (!Number.isFinite(length) || length <= 0) return null

        const box = pathEl.getBBox()
        const w = Math.max(box.width, 1)
        const h = Math.max(box.height, 1)
        const p = Math.max(0, pad)

        const vx = box.x - p
        const vy = box.y - p
        const vw = w + p * 2
        const vh = h + p * 2

        return {
            length,
            viewBox: `${vx} ${vy} ${vw} ${vh}`,
        }
    } catch {
        return null
    }
}

function offsetAlongPath(
    progressPx: number,
    pathLength: number,
    direction: TickerDirection
): number {
    if (pathLength <= 0) return 0
    const wrapped = ((progressPx % pathLength) + pathLength) % pathLength
    return direction === "reverse" ? pathLength - wrapped : wrapped
}

/**
 * @framerIntrinsicWidth 400
 * @framerIntrinsicHeight 120
 * @framerSupportedLayoutWidth any-prefer-fixed
 * @framerSupportedLayoutHeight any-prefer-fixed
 */
export default function TextOnStrokeTicker(props: TextOnStrokeTickerProps) {
    const {
        pathD: pathDRaw = DEFAULT_PATH_D,
        showStroke = true,
        strokeColor = "#000000",
        strokeWidth = 12,
        textPlacement = "center",
        text = "Your text here",
        textStyle,
        repeatGap = 24,
        separator = " · ",
        padding = "8px",
        pathFit = "contain",
        animationMode = "auto",
        durationSec = 20,
        direction = "forward",
        play = true,
        scrollOffsetPreset = "enter",
        scrollMultiplier = 1,
        scrollSelector = "",
        style,
    } = props

    const pathD = useMemo(() => extractPathD(pathDRaw), [pathDRaw])
    const reactId = useId()
    const pathId = `tos-path-${reactId.replace(/:/g, "")}`
    const rootRef = useRef<HTMLDivElement>(null)
    const pathRef = useRef<SVGPathElement>(null)
    const isStatic = useIsStaticRenderer()
    const isCanvas =
        typeof RenderTarget !== "undefined" &&
        RenderTarget.current() === RenderTarget.canvas

    const [metrics, setMetrics] = useState<PathMetrics | null>(null)
    const [autoOffset, setAutoOffset] = useState(0)
    const [reducedMotion, setReducedMotion] = useState(false)

    const inView = useInView(rootRef, { amount: 0.1, once: false })

    const scrollTargetRef = useRef<HTMLElement | null>(null)
    const scrollContainerRef = useRef<HTMLElement | null>(null)
    const [scrollTargetsReady, setScrollTargetsReady] = useState(0)
    const [scrollOffsetPx, setScrollOffsetPx] = useState(0)

    useEffect(() => {
        if (typeof window === "undefined") return
        const mq = window.matchMedia("(prefers-reduced-motion: reduce)")
        const update = () =>
            startTransition(() => setReducedMotion(mq.matches))
        update()
        mq.addEventListener("change", update)
        return () => mq.removeEventListener("change", update)
    }, [])

    const remeasure = useCallback(() => {
        const pad =
            typeof padding === "string"
                ? parseFloat(padding) || 8
                : 8
        const next = measurePath(pathRef.current, pathFit, pad)
        if (next) {
            startTransition(() => setMetrics(next))
        }
    }, [pathFit, padding, pathD])

    useEffect(() => {
        remeasure()
    }, [remeasure, pathD])

    useEffect(() => {
        const el = rootRef.current
        if (!el || typeof ResizeObserver === "undefined") return
        const ro = new ResizeObserver(() => remeasure())
        ro.observe(el)
        return () => ro.disconnect()
    }, [remeasure])

    useLayoutEffect(() => {
        const root = rootRef.current
        if (!root) return
        scrollTargetRef.current =
            animationMode === "scrollSection" ? findScrollSection(root) : root
        scrollContainerRef.current =
            animationMode === "scrollElement"
                ? findScrollContainer(root, scrollSelector)
                : null
        startTransition(() => setScrollTargetsReady((n) => n + 1))
    }, [animationMode, scrollSelector])

    const scrollOffsets = SCROLL_OFFSET_MAP[scrollOffsetPreset ?? "enter"]

    const pageScroll = useScroll({
        offset: scrollOffsets,
        layoutEffect: false,
    })

    void scrollTargetsReady

    const sectionScroll = useScroll({
        target: scrollTargetRef,
        offset: scrollOffsets,
        layoutEffect: false,
    })

    const elementScroll = useScroll({
        target: scrollTargetRef,
        container: scrollContainerRef,
        offset: scrollOffsets,
        layoutEffect: false,
    })

    const isScrollMode =
        animationMode === "scrollPage" ||
        animationMode === "scrollSection" ||
        animationMode === "scrollElement"

    const activeScrollProgress =
        animationMode === "scrollPage"
            ? pageScroll.scrollYProgress
            : animationMode === "scrollSection"
              ? sectionScroll.scrollYProgress
              : animationMode === "scrollElement"
                ? elementScroll.scrollYProgress
                : null

    const scrollOffsetMotion = useTransform(
        activeScrollProgress ?? pageScroll.scrollYProgress,
        (p) => {
            const len = metrics?.length ?? 1
            const mult = Math.max(0.1, scrollMultiplier ?? 1)
            const prog = (p ?? 0) * mult
            const wrapped = ((prog % 1) + 1) % 1
            const base = wrapped * len
            return direction === "reverse" ? len - base : base
        }
    )

    useMotionValueEvent(scrollOffsetMotion, "change", (v) => {
        if (!isScrollMode || isStatic || reducedMotion) return
        startTransition(() => setScrollOffsetPx(v))
    })

    const pathLength = metrics?.length ?? 0
    const segment = useMemo(
        () => buildSegment(text, separator, repeatGap),
        [text, separator, repeatGap]
    )
    const repeatedText = useMemo(
        () => buildRepeatedText(segment, Math.max(pathLength * 2, 80), 120),
        [segment, pathLength]
    )

    const textSvgStyle = useMemo(
        () => typographyFromControl(textStyle, "Inter, system-ui, sans-serif"),
        [textStyle]
    )

    const fillColor =
        (textStyle &&
            typeof textStyle === "object" &&
            textStyle.color) ||
        "#000000"

    const fontSizePx = useMemo(
        () => parseFontSizePx(textStyle),
        [textStyle]
    )

    const textPathDy = useMemo(
        () => dyForPlacement(textPlacement, fontSizePx, strokeWidth),
        [textPlacement, fontSizePx, strokeWidth]
    )

    useEffect(() => {
        if (
            animationMode !== "auto" ||
            !play ||
            isStatic ||
            reducedMotion ||
            !inView ||
            pathLength <= 0
        ) {
            return
        }

        let raf = 0
        let last = performance.now()
        const duration = Math.max(1, durationSec)
        const speed = pathLength / duration

        const tick = (now: number) => {
            const dt = (now - last) / 1000
            last = now
            const delta = speed * dt * (direction === "reverse" ? -1 : 1)
            startTransition(() => {
                setAutoOffset((prev) => {
                    let next = prev + delta
                    if (pathLength > 0) {
                        next = ((next % pathLength) + pathLength) % pathLength
                    }
                    return next
                })
            })
            raf = requestAnimationFrame(tick)
        }

        raf = requestAnimationFrame(tick)
        return () => cancelAnimationFrame(raf)
    }, [
        animationMode,
        play,
        isStatic,
        reducedMotion,
        inView,
        pathLength,
        durationSec,
        direction,
    ])

    const staticOffset = pathLength > 0 ? pathLength * 0.25 : 0

    const startOffsetPx = useMemo(() => {
        if (isStatic || reducedMotion) return staticOffset
        if (isScrollMode) return scrollOffsetPx
        if (!play) return staticOffset
        if (animationMode === "auto" && pathLength > 0) {
            return offsetAlongPath(autoOffset, pathLength, direction)
        }
        return staticOffset
    }, [
        isStatic,
        reducedMotion,
        play,
        isScrollMode,
        scrollOffsetPx,
        animationMode,
        pathLength,
        direction,
        autoOffset,
        staticOffset,
    ])

    const showPlaceholder = !pathD.trim()

    const svgPreserve =
        pathFit === "stretch"
            ? "none"
            : pathFit === "cover"
              ? "xMidYMid slice"
              : "xMidYMid meet"

    return (
        <motion.div
            ref={rootRef}
            style={{
                position: "relative",
                width: "100%",
                height: "100%",
                boxSizing: "border-box",
                background: showStroke ? strokeColor : "transparent",
                padding,
                overflow: "hidden",
                ...style,
            }}
        >
            {showPlaceholder && isCanvas ? (
                <motion.div
                    style={{
                        position: "absolute",
                        inset: 0,
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                        padding: 16,
                        textAlign: "center",
                        fontSize: 13,
                        lineHeight: 1.4,
                        color: "rgba(255,255,255,0.65)",
                        fontFamily: "Inter, system-ui, sans-serif",
                        pointerEvents: "none",
                        zIndex: 2,
                    }}
                >
                    Paste SVG path d from your vector (Copy as SVG in Framer)
                </motion.div>
            ) : null}

            <svg
                width="100%"
                height="100%"
                viewBox={metrics?.viewBox ?? "0 0 400 120"}
                preserveAspectRatio={svgPreserve}
                style={{ display: "block", overflow: "visible" }}
                aria-hidden={showPlaceholder}
            >
                <defs>
                    <path
                        id={pathId}
                        ref={pathRef}
                        d={pathD || DEFAULT_PATH_D}
                        fill="none"
                    />
                </defs>

                {showStroke ? (
                    <use
                        href={`#${pathId}`}
                        stroke={strokeColor}
                        strokeWidth={strokeWidth}
                        fill="none"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                    />
                ) : null}

                <text
                    dominantBaseline="middle"
                    style={{
                        ...textSvgStyle,
                        fill: fillColor,
                    }}
                >
                    <textPath
                        href={`#${pathId}`}
                        startOffset={startOffsetPx}
                        dy={textPathDy}
                        method="align"
                        spacing="auto"
                    >
                        {repeatedText}
                    </textPath>
                </text>
            </svg>
        </motion.div>
    )
}

TextOnStrokeTicker.displayName = "Text on Stroke Ticker"

addPropertyControls(TextOnStrokeTicker, {
    pathD: {
        title: "Path data",
        type: ControlType.String,
        displayTextArea: true,
        defaultValue: DEFAULT_PATH_D,
        description:
            "Paste the d attribute from Copy as SVG, or a full <path> / SVG snippet.",
    },
    showStroke: {
        title: "Show stroke",
        type: ControlType.Boolean,
        defaultValue: true,
        enabledTitle: "Show",
        disabledTitle: "Hide",
    },
    strokeColor: {
        title: "Stroke color",
        type: ControlType.Color,
        defaultValue: "#000000",
        description:
            "Colors the stroke band and the component background behind the path.",
    },
    strokeWidth: {
        title: "Stroke width",
        type: ControlType.Number,
        defaultValue: 12,
        min: 1,
        max: 64,
        step: 1,
        unit: "px",
        hidden: (p) => !p.showStroke,
    },
    textPlacement: {
        title: "Placement",
        type: ControlType.Enum,
        options: ["above", "center", "below"],
        optionTitles: ["Up", "Centered", "Below"],
        defaultValue: "center",
        displaySegmentedControl: true,
    },
    text: {
        title: "Text",
        type: ControlType.String,
        defaultValue: "Your text here",
    },
    textStyle: {
        title: "Text style",
        type: ControlType.Font,
        controls: "extended",
        defaultFontType: "sans-serif",
        defaultValue: {
            fontSize: 18,
            variant: "Bold",
            letterSpacing: "0.02em",
            lineHeight: "1em",
        },
    },
    repeatGap: {
        title: "Repeat gap",
        type: ControlType.Number,
        defaultValue: 24,
        min: 0,
        max: 200,
        step: 1,
        unit: "px",
    },
    separator: {
        title: "Separator",
        type: ControlType.String,
        defaultValue: " · ",
    },
    padding: {
        title: "Padding",
        type: ControlType.Padding,
        defaultValue: "8px",
    },
    pathFit: {
        title: "Path fit",
        type: ControlType.Enum,
        options: ["contain", "cover", "stretch"],
        optionTitles: ["Contain", "Cover", "Stretch"],
        defaultValue: "contain",
        displaySegmentedControl: true,
    },
    animationMode: {
        title: "Motion",
        type: ControlType.Enum,
        options: ["auto", "scrollPage", "scrollSection", "scrollElement"],
        optionTitles: ["Auto", "Scroll page", "Scroll section", "Scroll element"],
        defaultValue: "auto",
    },
    durationSec: {
        title: "Loop duration",
        type: ControlType.Number,
        defaultValue: 20,
        min: 1,
        max: 120,
        step: 0.5,
        unit: "s",
        hidden: (p) => p.animationMode !== "auto",
    },
    direction: {
        title: "Direction",
        type: ControlType.Enum,
        options: ["forward", "reverse"],
        optionTitles: ["Forward", "Reverse"],
        defaultValue: "forward",
        displaySegmentedControl: true,
        description:
            "Motion along the path (auto ticker and scroll-linked modes).",
    },
    play: {
        title: "Play",
        type: ControlType.Boolean,
        defaultValue: true,
        enabledTitle: "Play",
        disabledTitle: "Pause",
        hidden: (p) => p.animationMode !== "auto",
    },
    scrollOffsetPreset: {
        title: "Scroll range",
        type: ControlType.Enum,
        options: ["enter", "center", "exit", "full"],
        optionTitles: ["Enter", "Center", "Exit", "Full"],
        defaultValue: "enter",
        hidden: (p) => p.animationMode === "auto",
    },
    scrollMultiplier: {
        title: "Scroll multiplier",
        type: ControlType.Number,
        defaultValue: 1,
        min: 0.1,
        max: 5,
        step: 0.1,
        hidden: (p) => p.animationMode === "auto",
    },
    scrollSelector: {
        title: "Scroll selector",
        type: ControlType.String,
        defaultValue: "",
        placeholder: "#my-scroll-area",
        description:
            "Optional CSS selector for scroll-element mode. Otherwise walks up to the nearest scrollable parent.",
        hidden: (p) => p.animationMode !== "scrollElement",
    },
})
