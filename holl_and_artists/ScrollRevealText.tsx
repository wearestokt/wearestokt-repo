/**
 * ScrollRevealText — Framer Code Component
 *
 * Scroll-linked text reveal: ghost text stays visible; reveal text fills in
 * word-by-word as you scroll through a linked Framer Scroll Section (or this
 * component when no section is connected). GSAP loads from CDN — no npm setup.
 *
 * Setup:
 * 1. Assets → Code → + → Code Component → paste this file
 * 2. On a page layer, enable Scroll → add a Scroll Section name
 * 3. Select this component → connect that Scroll Section in the panel
 */

import {
    useCallback,
    useEffect,
    useMemo,
    useRef,
    type CSSProperties,
    type ReactNode,
} from "react"
import { addPropertyControls, ControlType } from "framer"

const GSAP_VERSION = "3.12.7"
const GSAP_BASE = `https://cdn.jsdelivr.net/npm/gsap@${GSAP_VERSION}/dist`

/** Native Framer scroll-section picker when available; otherwise frame link. */
const ScrollSectionControlType =
    (ControlType as Record<string, typeof ControlType.ComponentInstance>)
        .ScrollSectionRef ??
    (ControlType as Record<string, typeof ControlType.ComponentInstance>)
        .ScrollSection ??
    ControlType.ComponentInstance

type ScrollTriggerVars = Record<string, unknown>

type FontControlValue =
    | string
    | {
          fontFamily?: string
          family?: string
          font?: string
          fontSize?: number | string
          fontWeight?: number | string
          fontStyle?: string
          lineHeight?: number | string
          letterSpacing?: number | string
          color?: string
          textAlign?: string
          [key: string]: unknown
      }

type GsapTimeline = {
    fromTo: (
        targets: Element | NodeListOf<Element> | string,
        from: Record<string, unknown>,
        to: Record<string, unknown>
    ) => GsapTimeline
}

type GsapRuntime = {
    gsap: {
        set: (target: Element | NodeListOf<Element>, vars: Record<string, unknown>) => void
        fromTo: (
            target: Element,
            from: Record<string, unknown>,
            to: Record<string, unknown>
        ) => void
        timeline: (vars?: Record<string, unknown>) => GsapTimeline
        context: (
            fn: () => void,
            scope?: Element | null
        ) => { revert: () => void }
        registerPlugin: (...plugins: unknown[]) => void
    }
    ScrollTrigger: {
        refresh: () => void
    }
}

type GsapWindow = Window & {
    gsap?: GsapRuntime["gsap"]
    ScrollTrigger?: GsapRuntime["ScrollTrigger"]
}

let gsapLoadPromise: Promise<GsapRuntime> | null = null

function loadScript(src: string): Promise<void> {
    return new Promise((resolve, reject) => {
        const existing = document.querySelector(
            `script[src="${src}"]`
        ) as HTMLScriptElement | null

        if (existing) {
            if (existing.dataset.loaded === "true") {
                resolve()
                return
            }
            existing.addEventListener("load", () => resolve(), { once: true })
            existing.addEventListener("error", () => reject(), { once: true })
            return
        }

        const script = document.createElement("script")
        script.src = src
        script.async = true
        script.onload = () => {
            script.dataset.loaded = "true"
            resolve()
        }
        script.onerror = () => reject(new Error(`Failed to load ${src}`))
        document.head.appendChild(script)
    })
}

function loadGsap(): Promise<GsapRuntime> {
    const w = window as GsapWindow

    if (w.gsap && w.ScrollTrigger) {
        w.gsap.registerPlugin(w.ScrollTrigger)
        return Promise.resolve({
            gsap: w.gsap,
            ScrollTrigger: w.ScrollTrigger,
        })
    }

    if (!gsapLoadPromise) {
        gsapLoadPromise = (async () => {
            await loadScript(`${GSAP_BASE}/gsap.min.js`)
            await loadScript(`${GSAP_BASE}/ScrollTrigger.min.js`)

            if (!w.gsap || !w.ScrollTrigger) {
                throw new Error("GSAP or ScrollTrigger did not attach to window")
            }

            w.gsap.registerPlugin(w.ScrollTrigger)
            return { gsap: w.gsap, ScrollTrigger: w.ScrollTrigger }
        })().catch((err) => {
            gsapLoadPromise = null
            throw err
        })
    }

    return gsapLoadPromise
}

function fontFamilyFromControl(
    value: FontControlValue | undefined,
    fallback: string
): string {
    if (typeof value === "string" && value.trim().length > 0) return value
    if (value && typeof value === "object") {
        const candidate = value.fontFamily || value.family || value.font
        if (typeof candidate === "string" && candidate.trim().length > 0) {
            return candidate
        }
    }
    return fallback
}

const layerTextStyle: CSSProperties = {
    margin: 0,
    padding: 0,
    width: "100%",
    boxSizing: "border-box",
    whiteSpace: "pre-wrap",
    overflowWrap: "break-word",
    wordBreak: "break-word",
    hyphens: "none",
}

function typographyFromFont(
    font: FontControlValue | undefined,
    textAlign: CSSProperties["textAlign"]
): CSSProperties {
    const family = fontFamilyFromControl(font, "Inter, system-ui, sans-serif")
    const base: CSSProperties = {
        ...layerTextStyle,
        fontFamily: family,
        textAlign,
    }

    if (!font || typeof font !== "object") return base

    return {
        ...base,
        ...(font.fontSize !== undefined ? { fontSize: font.fontSize } : {}),
        ...(font.fontWeight !== undefined
            ? { fontWeight: font.fontWeight as CSSProperties["fontWeight"] }
            : {}),
        ...(font.fontStyle !== undefined
            ? { fontStyle: font.fontStyle as CSSProperties["fontStyle"] }
            : {}),
        ...(font.lineHeight !== undefined
            ? { lineHeight: font.lineHeight as CSSProperties["lineHeight"] }
            : {}),
        ...(font.letterSpacing !== undefined
            ? {
                  letterSpacing:
                      font.letterSpacing as CSSProperties["letterSpacing"],
              }
            : {}),
    }
}

/** Resolve a Framer Scroll Section (name string) or linked frame to a DOM element. */
function findScrollSectionByName(name: string): HTMLElement | null {
    const trimmed = name.trim()
    if (!trimmed) return null

    const byId = document.getElementById(trimmed)
    if (byId) return byId

    const byFramerName = document.querySelector(
        `[data-framer-name="${CSS.escape(trimmed)}"]`
    )
    if (byFramerName instanceof HTMLElement) return byFramerName

    const hashTarget = document.querySelector(
        `[id="${CSS.escape(trimmed)}"], [name="${CSS.escape(trimmed)}"]`
    )
    if (hashTarget instanceof HTMLElement) return hashTarget

    const sectionNodes = document.querySelectorAll(
        "[data-framer-scroll-section], [data-framer-scroll-section-target]"
    )
    for (const node of sectionNodes) {
        if (!(node instanceof HTMLElement)) continue
        const label =
            node.getAttribute("data-framer-name") ||
            node.getAttribute("aria-label") ||
            node.id
        if (label === trimmed) return node
    }

    return null
}

function isScrollSectionRef(
    value: unknown
): value is { current: Element | null | undefined } {
    return (
        value !== null &&
        typeof value === "object" &&
        "current" in value &&
        !("$$typeof" in value)
    )
}

function layerIdFromSectionNode(section: ReactNode): string | null {
    if (!section || typeof section !== "object" || !("props" in section)) {
        return null
    }
    const props = (section as { props?: Record<string, unknown> }).props
    if (!props) return null

    for (const key of [
        "id",
        "layoutId",
        "name",
        "scrollSectionName",
        "__framerLayerId",
        "data-framer-name",
    ]) {
        const value = props[key]
        if (typeof value === "string" && value.trim()) return value.trim()
    }
    return null
}

/** Framer ScrollSectionRef, section name, or linked frame — never render directly. */
function resolveScrollTriggerElement(
    scrollSection: unknown,
    fallback: HTMLElement | null
): HTMLElement | null {
    if (!scrollSection) return fallback

    if (typeof scrollSection === "string") {
        return findScrollSectionByName(scrollSection) ?? fallback
    }

    if (isScrollSectionRef(scrollSection)) {
        const el = scrollSection.current
        if (el instanceof HTMLElement) return el
        // Framer hydrates `.current` after mount — don't use fallback yet
        return null
    }

    if (typeof scrollSection === "object" && "props" in scrollSection) {
        const layerId = layerIdFromSectionNode(scrollSection as ReactNode)
        if (layerId) {
            const byId = document.getElementById(layerId)
            if (byId) return byId

            const byName = document.querySelector(
                `[data-framer-name="${CSS.escape(layerId)}"]`
            )
            if (byName instanceof HTMLElement) return byName
        }
    }

    return fallback
}

type TextToken = { type: "word" | "space"; value: string }

function tokenizeText(text: string): TextToken[] {
    const tokens: TextToken[] = []
    for (const part of text.split(/(\s+)/)) {
        if (!part) continue
        tokens.push({
            type: /^\s+$/.test(part) ? "space" : "word",
            value: part,
        })
    }
    return tokens
}

/** Identical markup on ghost + reveal so line breaks always match. */
function renderTextTokens(
    tokens: TextToken[],
    options?: { revealWords?: boolean }
) {
    return tokens.map((token, index) => {
        if (token.type === "space") {
            return <span key={`s-${index}`}>{token.value}</span>
        }
        if (options?.revealWords) {
            return (
                <span
                    key={`w-${index}`}
                    data-reveal-word
                    style={{ opacity: 0 }}
                >
                    {token.value}
                </span>
            )
        }
        return <span key={`w-${index}`}>{token.value}</span>
    })
}

type EnterViewport = "top" | "center" | "bottom"

/** Scroll range spans the linked section height (enter → leave viewport). */
function scrollRangeForSection(enterAt: EnterViewport): {
    start: string
    end: string
} {
    // Element top at viewport bottom / center / top (Framer-style enter)
    const startByEnter: Record<EnterViewport, string> = {
        top: "top bottom",
        center: "top center",
        bottom: "top top",
    }
    return {
        start: startByEnter[enterAt],
        end: "bottom top",
    }
}

type ScrollRevealTextProps = {
    text?: string
    font?: FontControlValue
    ghostColor?: string
    revealColor?: string
    textAlign?: "left" | "center" | "right"
    scrub?: boolean
    /** When the linked section enters the viewport (like Framer scroll transform). */
    enterAt?: EnterViewport
    /** Framer ScrollSectionRef (`{ current }`), section name, or linked frame */
    scrollSection?: unknown
    style?: CSSProperties
}

/**
 * @framerDisableUnlink
 * @framerSupportedLayoutWidth any
 * @framerSupportedLayoutHeight auto
 * @framerIntrinsicWidth 600
 * @framerIntrinsicHeight 120
 */
export default function ScrollRevealText(props: ScrollRevealTextProps) {
    const {
        text = "Your text here",
        font,
        ghostColor = "rgba(0, 0, 0, 0.2)",
        revealColor = "#000000",
        textAlign = "left",
        scrub = true,
        enterAt = "top",
        scrollSection,
        style,
    } = props

    const containerRef = useRef<HTMLDivElement>(null)
    const revealRef = useRef<HTMLParagraphElement>(null)

    const tokens = useMemo(() => tokenizeText(text), [text])
    const scrollRange = useMemo(
        () => scrollRangeForSection(enterAt),
        [enterAt]
    )

    const resolveTrigger = useCallback(() => {
        const container = containerRef.current
        if (!container) return null
        return resolveScrollTriggerElement(scrollSection, container)
    }, [scrollSection])

    useEffect(() => {
        const reveal = revealRef.current
        if (!reveal) return

        let cancelled = false
        let ctx: { revert: () => void } | null = null
        let removeResize: (() => void) | null = null
        let resizeObserver: ResizeObserver | null = null
        let retryTimer: ReturnType<typeof setTimeout> | null = null

        const showAllWords = () => {
            reveal
                .querySelectorAll("[data-reveal-word]")
                .forEach((el) => {
                    ;(el as HTMLElement).style.opacity = "1"
                })
        }

        const setup = async (trigger: HTMLElement) => {
            const words = reveal.querySelectorAll("[data-reveal-word]")
            if (!words.length) return

            const reducedMotion = window.matchMedia(
                "(prefers-reduced-motion: reduce)"
            ).matches

            if (reducedMotion) {
                showAllWords()
                return
            }

            let runtime: GsapRuntime
            try {
                runtime = await loadGsap()
            } catch {
                showAllWords()
                return
            }

            if (cancelled) return

            ctx?.revert()
            removeResize?.()
            resizeObserver?.disconnect()

            const { gsap, ScrollTrigger } = runtime

            gsap.set(words, { opacity: 0 })

            const scrollTriggerConfig: ScrollTriggerVars = {
                trigger,
                start: scrollRange.start,
                end: scrollRange.end,
                invalidateOnRefresh: true,
                markers: false,
            }

            if (scrub) {
                scrollTriggerConfig.scrub = true
            } else {
                scrollTriggerConfig.toggleActions = "play reverse play reverse"
            }

            ctx = gsap.context(() => {
                const tl = gsap.timeline({
                    scrollTrigger: scrollTriggerConfig,
                })
                tl.fromTo(
                    words,
                    { opacity: 0 },
                    {
                        opacity: 1,
                        duration: 1,
                        stagger: { each: 1 },
                        ease: "none",
                    }
                )
            }, containerRef.current)

            const onResize = () => ScrollTrigger.refresh()
            window.addEventListener("resize", onResize)
            removeResize = () => window.removeEventListener("resize", onResize)

            if (typeof ResizeObserver !== "undefined") {
                resizeObserver = new ResizeObserver(onResize)
                resizeObserver.observe(trigger)
                const container = containerRef.current
                if (container) resizeObserver.observe(container)
            }

            ScrollTrigger.refresh()
        }

        let attempts = 0
        const maxAttempts = 50

        const run = () => {
            const trigger = resolveTrigger()
            if (trigger) {
                setup(trigger)
                return
            }

            const waitingForRef =
                scrollSection && isScrollSectionRef(scrollSection)
            const waitingForName =
                typeof scrollSection === "string" && scrollSection.trim()

            if (
                (waitingForRef || waitingForName) &&
                attempts < maxAttempts
            ) {
                attempts += 1
                retryTimer = setTimeout(run, 120)
                return
            }

            const container = containerRef.current
            if (container) setup(container)
        }

        run()

        return () => {
            cancelled = true
            if (retryTimer) clearTimeout(retryTimer)
            removeResize?.()
            resizeObserver?.disconnect()
            ctx?.revert()
        }
    }, [text, scrollRange, scrub, scrollSection, resolveTrigger])

    const textStyle = typographyFromFont(font, textAlign)

    return (
        <div
            ref={containerRef}
            style={{
                position: "relative",
                width: "100%",
                ...style,
            }}
        >
            <div
                style={{
                    display: "grid",
                    width: "100%",
                    gridTemplateColumns: "1fr",
                }}
            >
                <p
                    aria-hidden
                    style={{
                        ...textStyle,
                        gridArea: "1 / 1",
                        color: ghostColor,
                    }}
                >
                    {renderTextTokens(tokens)}
                </p>
                <p
                    ref={revealRef}
                    aria-hidden
                    style={{
                        ...textStyle,
                        gridArea: "1 / 1",
                        color: revealColor,
                    }}
                >
                    {renderTextTokens(tokens, { revealWords: true })}
                </p>
            </div>
        </div>
    )
}

ScrollRevealText.displayName = "Scroll Reveal Text"

addPropertyControls(ScrollRevealText, {
    scrollSection: {
        type: ScrollSectionControlType,
        title: "Scroll Section",
        description:
            "Connect a layer with Scroll Section enabled (Page → layer → Scroll). Reveal progress follows that section on the page.",
    },
    text: {
        type: ControlType.String,
        title: "Text",
        defaultValue: "Your text here",
        displayTextArea: true,
    },
    font: {
        type: ControlType.Font,
        title: "Font",
        controls: "extended",
        defaultValue: {
            fontFamily: "Inter",
            fontSize: 64,
            fontWeight: 700,
            lineHeight: "1.1em",
        },
    },
    ghostColor: {
        type: ControlType.Color,
        title: "Ghost",
        defaultValue: "rgba(0, 0, 0, 0.2)",
    },
    revealColor: {
        type: ControlType.Color,
        title: "Reveal",
        defaultValue: "#000000",
    },
    textAlign: {
        type: ControlType.Enum,
        title: "Align",
        options: ["left", "center", "right"],
        optionTitles: ["Left", "Center", "Right"],
        defaultValue: "left",
    },
    enterAt: {
        type: ControlType.Enum,
        title: "Enter",
        options: ["top", "center", "bottom"],
        optionTitles: ["Top", "Center", "Bottom"],
        defaultValue: "top",
        displaySegmentedControl: true,
        description:
            "When the scroll section enters the viewport. Reveal runs until the section leaves (full section height).",
    },
    scrub: {
        type: ControlType.Boolean,
        title: "Scrub",
        defaultValue: true,
        enabledTitle: "Linked",
        disabledTitle: "Trigger",
    },
})
