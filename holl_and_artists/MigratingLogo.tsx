/**
 * MigratingLogo — Framer Code Component
 *
 * Scroll-driven logo: Wordmark centered → migrates to top-left at smaller size.
 * One ScrollTrigger drives position, scale, and variant together.
 * Position migrates over the full scroll (0–snapAt) with a center anchor
 * (xPercent −50) so the wordmark moves up-left without drifting right.
 *
 * Variant timeline (same scroll progress):
 *   0 – switchAt     scale shrinks slowly (wordmarkScaleShare of total)
 *   switchAt – snapAt scale continues scaleStart → scaleEnd
 *   switchAt         Wordmark → Logo-big (Framer variant transition)
 *   ≥ snapAt         Logo-small + scale 1 (instant, native resolution)
 *
 * Setup:
 * 1. Assets → Code → + → Code Component → paste this file
 * 2. Add MigratingLogo to the hero; connect your 3-variant logo in Logo
 * 3. On a page layer, enable Scroll → add a Scroll Section name
 * 4. Select MigratingLogo → connect the OTHER stack in Scroll Section (picker).
 *    The logo component does NOT need to live inside that stack — only the link
 *    in the property panel matters. That stack must have Scroll enabled on it.
 * 5. Remove old overrides (withLogoTrigger / withMigratingLogo / withLogoVariant)
 * 6. Layer size Fit or Fill both work. Test in Preview (not the static canvas).
 *
 * Breakpoints: Framer mounts one copy per breakpoint. Each copy needs its own
 * ScrollTrigger id (handled automatically). Only the visible copy animates.
 * On the phone breakpoint, set Layout → Mobile (Mobile zoom multiplies Scale
 * start only — hero size). scaleEnd and Logo-small snap are unaffected.
 * The static canvas applies that hero scale so mobile matches Preview at scroll 0.
 * Preview/published runtime portals the logo into a shared body root (z-index floor)
 * so sections cannot cover it. Hidden breakpoint copies stay out of the portal.
 * Touch browsers use visualViewport + normalizeScroll so address-bar hide/show
 * does not desync the logo (same idea as mobile Chrome).
 * insetLeft, insetTop, etc. can also differ per breakpoint copy.
 *
 * Sizing: Logo-small native size ≈ Logo-big × scaleEnd (default 0.15) for an
 * invisible snap at snapAt.
 *
 * @framerDisableUnlink
 */

import {
    cloneElement,
    Fragment,
    isValidElement,
    useCallback,
    useId,
    useLayoutEffect,
    useRef,
    useState,
    type ComponentType,
    type CSSProperties,
    type ReactNode,
} from "react"
import { createPortal } from "react-dom"
import {
    addPropertyControls,
    ControlType,
    // @ts-expect-error RenderTarget is provided by Framer at runtime
    RenderTarget,
} from "framer"
// Framer's router-aware Link resolves internal page links (raw <a href> 404s
// in preview for picker-selected pages). Not in public typings — detect it.
import * as FramerLib from "framer"

const FramerLink = (FramerLib as Record<string, unknown>).Link as
    | ComponentType<{
          href?: unknown
          smoothScroll?: boolean
          children?: ReactNode
      }>
    | undefined

const GSAP_VERSION = "3.12.7"
const GSAP_BASE = `https://cdn.jsdelivr.net/npm/gsap@${GSAP_VERSION}/dist`

const ScrollSectionControlType =
    (ControlType as Record<string, typeof ControlType.ComponentInstance>)
        .ScrollSectionRef ??
    (ControlType as Record<string, typeof ControlType.ComponentInstance>)
        .ScrollSection ??
    ControlType.ComponentInstance

type GsapRuntime = {
    gsap: {
        set: (target: Element, vars: Record<string, unknown>) => void
        fromTo: (
            target: Element,
            from: Record<string, unknown>,
            to: Record<string, unknown>
        ) => unknown
        utils: {
            interpolate: (start: number, end: number, progress: number) => number
        }
        context: (
            fn: () => void,
            scope?: Element | null
        ) => { revert: () => void }
        registerPlugin: (...plugins: unknown[]) => void
    }
    ScrollTrigger: {
        refresh: () => void
        config: (vars: Record<string, unknown>) => void
        normalizeScroll?: (enable: boolean) => unknown
        isTouch?: number
        create: (vars: Record<string, unknown>) => {
            kill: () => void
            progress: number
            start: number
            end: number
        }
        getById: (id: string) =>
            | {
                  kill: () => void
                  progress: number
                  start: number
                  end: number
              }
            | undefined
    }
}

type GsapWindow = Window & {
    gsap?: GsapRuntime["gsap"]
    ScrollTrigger?: GsapRuntime["ScrollTrigger"]
}

let gsapLoadPromise: Promise<GsapRuntime> | null = null

/** Shared across breakpoint copies so a remount at 100% scroll keeps Logo-small. */
let sharedScrollProgress = 0

/** Last GSAP transform — lets the incoming breakpoint copy paint before async setup. */
let sharedLastPaint: Record<string, unknown> | null = null

function debounce<T extends (...args: never[]) => void>(fn: T, ms: number) {
    let timer: ReturnType<typeof setTimeout> | null = null
    return (...args: Parameters<T>) => {
        if (timer) clearTimeout(timer)
        timer = setTimeout(() => fn(...args), ms)
    }
}

function isCoarsePointer(): boolean {
    if (typeof window === "undefined") return false
    return window.matchMedia("(pointer: coarse)").matches
}

function configureTouchScrollTrigger(ST: GsapRuntime["ScrollTrigger"]) {
    if (!isCoarsePointer()) return
    ST.config({
        ignoreMobileResize: true,
        autoRefreshEvents: "visibilitychange,DOMContentLoaded,load",
    })
    // Touch only (incl. iOS Safari) — keeps scroll on the JS thread so the
    // address bar hide/show does not desync ScrollTrigger from finger scroll.
    ST.normalizeScroll?.(true)
}

/** Desktop Safari: layout viewport. Touch: visualViewport (address bar). */
function shouldUseLayoutViewport(): boolean {
    return isWebKitSafari() && !isCoarsePointer()
}

/** Layout viewport metrics — visualViewport avoids jumps when mobile browser UI hides. */
function viewportMetrics() {
    const vv = typeof window !== "undefined" ? window.visualViewport : null
    if (!vv || shouldUseLayoutViewport()) {
        return {
            width: window.innerWidth,
            height: window.innerHeight,
            offsetTop: 0,
            offsetLeft: 0,
        }
    }
    // Use visual size only — offsetTop/Left flutter 1–2px per scroll tick on
    // iOS/Android and fight ScrollTrigger onUpdate (visible shake).
    return {
        width: vv.width,
        height: vv.height,
        offsetTop: 0,
        offsetLeft: 0,
    }
}

function snapTransformVars(
    vars: Record<string, unknown>
): Record<string, unknown> {
    const out = { ...vars }
    if (typeof out.x === "number") out.x = Math.round(out.x)
    if (typeof out.y === "number") out.y = Math.round(out.y)
    if (typeof out.scale === "number") {
        out.scale = Math.round(out.scale * 1000) / 1000
    }
    return out
}

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
        configureTouchScrollTrigger(w.ScrollTrigger)
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
            configureTouchScrollTrigger(w.ScrollTrigger)
            return { gsap: w.gsap, ScrollTrigger: w.ScrollTrigger }
        })().catch((err) => {
            gsapLoadPromise = null
            throw err
        })
    }

    return gsapLoadPromise
}

function findScrollSectionByName(name: string): HTMLElement | null {
    const trimmed = name.trim()
    if (!trimmed) return null

    const byId = document.getElementById(trimmed)
    if (byId) return byId

    const byFramerName = document.querySelector(
        `[data-framer-name="${CSS.escape(trimmed)}"]`
    )
    if (byFramerName instanceof HTMLElement) return byFramerName

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

function findScrollSectionByLayerId(layerId: string): HTMLElement | null {
    const trimmed = layerId.trim()
    if (!trimmed) return null

    const selectors = [
        `#${CSS.escape(trimmed)}`,
        `[id="${CSS.escape(trimmed)}"]`,
        `[data-framer-name="${CSS.escape(trimmed)}"]`,
        `[data-framer-component-id="${CSS.escape(trimmed)}"]`,
    ]

    for (const selector of selectors) {
        const match = document.querySelector(selector)
        if (match instanceof HTMLElement) return match
    }

    return findScrollSectionByName(trimmed)
}

function findFirstScrollSection(): HTMLElement | null {
    const selectors = [
        "[data-framer-scroll-section]",
        "[data-framer-scroll-section-target]",
        "main section[id]",
        "section[id]",
    ]
    for (const selector of selectors) {
        const node = document.querySelector(selector)
        if (node instanceof HTMLElement) return node
    }
    return null
}

function namesFromSectionNode(section: ReactNode): string[] {
    if (!section || typeof section !== "object" || !("props" in section)) {
        return []
    }
    const props = (section as { props?: Record<string, unknown> }).props
    if (!props) return []

    const names: string[] = []
    for (const key of [
        "scrollSectionName",
        "name",
        "id",
        "layoutId",
        "__framerLayerId",
        "data-framer-name",
    ]) {
        const value = props[key]
        if (typeof value === "string" && value.trim()) {
            names.push(value.trim())
        }
    }
    return names
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

/** Prefer the scroll-section node on a linked stack (may differ from stack root). */
function resolveScrollSectionRoot(el: HTMLElement): HTMLElement {
    if (
        el.matches(
            "[data-framer-scroll-section], [data-framer-scroll-section-target]"
        )
    ) {
        return el
    }

    const inner = el.querySelector(
        "[data-framer-scroll-section], [data-framer-scroll-section-target]"
    )
    if (inner instanceof HTMLElement) return inner

    return el
}

function resolveScrollTriggerElement(
    scrollSection: unknown,
    fallback: HTMLElement | null
): HTMLElement | null {
    if (!scrollSection) return fallback

    let resolved: HTMLElement | null = null

    if (typeof scrollSection === "string") {
        resolved = findScrollSectionByName(scrollSection)
    } else if (isScrollSectionRef(scrollSection)) {
        const el = scrollSection.current
        if (el instanceof HTMLElement) resolved = el
    } else if (typeof scrollSection === "object" && "props" in scrollSection) {
        for (const name of namesFromSectionNode(scrollSection as ReactNode)) {
            const byName = findScrollSectionByLayerId(name)
            if (byName) {
                resolved = byName
                break
            }
        }
    }

    if (resolved) return resolveScrollSectionRoot(resolved)

    // Never fall back to the fixed logo wrapper when a section is linked —
    // a position:fixed element as trigger never advances scroll progress.
    return null
}

function variantForProgress(
    p: number,
    wordmark: string,
    big: string,
    small: string,
    switchAt: number,
    snapAt: number
): string {
    if (p >= snapAt) return small
    if (p >= switchAt) return big
    return wordmark
}

function scaleForProgress(
    p: number,
    scaleStart: number,
    scaleEnd: number,
    snapAt: number,
    switchAt: number,
    wordmarkScaleShare: number,
    interpolate: (a: number, b: number, t: number) => number
): number {
    if (p >= snapAt) return 1

    // Only a fraction of scaleStart→scaleEnd happens during the wordmark phase;
    // the rest runs during Logo-big so the hero stays larger longer.
    const share = Math.max(0, Math.min(1, wordmarkScaleShare))
    const scaleTAtSwitch = (switchAt / snapAt) * share

    let scaleT: number
    if (p <= switchAt) {
        scaleT = switchAt > 0 ? (p / switchAt) * scaleTAtSwitch : 0
    } else {
        const tail = 1 - scaleTAtSwitch
        scaleT =
            scaleTAtSwitch +
            ((p - switchAt) / (snapAt - switchAt)) * tail
    }

    return interpolate(scaleStart, scaleEnd, Math.min(scaleT, 1))
}

function positionForProgress(
    p: number,
    snapAt: number,
    centerX: number,
    centerY: number,
    cornerX: number,
    insetTop: number,
    halfW: number,
    halfH: number,
    interpolate: (a: number, b: number, t: number) => number
): {
    x: number
    y: number
    xPercent: number
    yPercent: number
} {
    if (p >= snapAt) {
        return { x: cornerX, y: insetTop, xPercent: 0, yPercent: 0 }
    }

    const migrateT = snapAt > 0 ? Math.min(p / snapAt, 1) : 0
    // Center anchor throughout — lerping xPercent toward 0 early made the
    // wordmark drift toward the top-right before heading left.
    return {
        x: interpolate(centerX, cornerX + halfW, migrateT),
        y: interpolate(centerY, insetTop + halfH, migrateT),
        xPercent: -50,
        yPercent: -50,
    }
}

function transformOriginForProgress(
    p: number,
    switchAt: number,
    snapAt: number
): string {
    // Keep center origin while the wordmark is centered and during corner
    // migration — flipping to top left at switchAt caused a visible jump.
    if (p < snapAt) return "50% 50%"
    return "top left"
}

/** Nearest scrollable ancestor (Framer sometimes scrolls a wrapper, not window). */
function getScrollParent(el: HTMLElement): Element | undefined {
    let parent = el.parentElement
    while (parent) {
        const { overflowY, overflow } = getComputedStyle(parent)
        const scrollable =
            /auto|scroll|overlay/.test(overflowY) ||
            /auto|scroll|overlay/.test(overflow)
        if (scrollable && parent.scrollHeight > parent.clientHeight) {
            return parent
        }
        parent = parent.parentElement
    }
    return undefined
}

function describeElement(el: Element): string {
    const name = el.getAttribute("data-framer-name") || ""
    return `<${el.tagName.toLowerCase()}${el.id ? `#${el.id}` : ""}${
        name ? ` "${name}"` : ""
    }>`
}

function describeScrollSectionProp(value: unknown): string {
    if (value === null || value === undefined) return "EMPTY (not linked!)"
    if (typeof value === "string") return `string "${value}"`
    if (isScrollSectionRef(value)) {
        const el = (value as { current: Element | null }).current
        return `ref → ${el ? describeElement(el) : "current is null"}`
    }
    if (typeof value === "object" && "props" in value) {
        const names = namesFromSectionNode(value as ReactNode)
        return `element, names: [${names.join(", ") || "none found"}]`
    }
    return `unknown (${typeof value})`
}

type DebugOverlay = {
    root: HTMLElement
    log: HTMLElement
    progress: HTMLElement
    scroll: HTMLElement
}

function createDebugOverlay(): DebugOverlay {
    const root = document.createElement("div")
    root.style.cssText =
        "position:fixed;right:8px;bottom:8px;z-index:99999;max-width:46vw;" +
        "max-height:45vh;overflow:auto;margin:0;padding:10px 12px;" +
        "background:rgba(0,0,0,0.85);color:#7CFC9A;font:10px/1.6 monospace;" +
        "border-radius:8px;pointer-events:none;white-space:pre-wrap;"
    const log = document.createElement("div")
    log.textContent = "[MigratingLogo debug]"
    const progress = document.createElement("div")
    progress.style.color = "#FFD866"
    const scroll = document.createElement("div")
    scroll.style.color = "#66D9EF"
    scroll.textContent = "scrolling: (none yet — scroll the page)"
    root.append(log, progress, scroll)
    document.body.appendChild(root)
    return { root, log, progress, scroll }
}

function renderLogo(logo: ReactNode, variant: string): ReactNode {
    if (!logo) return null
    // ComponentInstance props sometimes arrive as a single-element array.
    if (Array.isArray(logo)) {
        return logo.map((child, i) => {
            const cloned = renderLogo(child, variant)
            return isValidElement(cloned) && cloned.key == null
                ? cloneElement(cloned, { key: i })
                : cloned
        })
    }
    if (isValidElement(logo)) {
        // Fragments swallow unknown props — clone into their children.
        if (logo.type === Fragment) {
            const kids = (logo.props as { children?: ReactNode }).children
            return renderLogo(kids, variant)
        }

        const props = (logo.props ?? {}) as Record<string, unknown>
        const isHost = typeof logo.type === "string"
        const next: Record<string, unknown> = isHost ? {} : { variant }

        // Framer wraps connected instances in sizing/link containers —
        // descend through children until the component that owns variant.
        // Children can be a render-prop function (e.g. wrappers with links):
        // wrap it so the rendered output gets the variant injected too.
        const kids = props.children
        if (typeof kids === "function") {
            const fn = kids as (...args: unknown[]) => ReactNode
            next.children = (...args: unknown[]) =>
                renderLogo(fn(...args), variant)
        } else if (kids !== undefined && !("variant" in props)) {
            next.children = renderLogo(kids as ReactNode, variant)
        }

        return cloneElement(logo, next)
    }
    return logo
}

function describeLogoProp(logo: ReactNode): string {
    if (logo === null || logo === undefined) return "EMPTY"
    if (Array.isArray(logo)) {
        return `array(${logo.length}) → ${describeLogoProp(logo[0])}`
    }
    if (isValidElement(logo)) {
        if (logo.type === Fragment) {
            return `Fragment → ${describeLogoProp(
                (logo.props as { children?: ReactNode }).children
            )}`
        }
        const t = logo.type as {
            displayName?: string
            name?: string
        }
        const name =
            typeof logo.type === "string"
                ? logo.type
                : t.displayName || t.name || "anonymous"
        const props = (logo.props ?? {}) as Record<string, unknown>
        const keys = Object.keys(props).join(", ")
        const existingVariant = props.variant
        const self =
            `<${name}> props: [${keys}]` +
            (existingVariant !== undefined
                ? ` existing variant=${JSON.stringify(existingVariant)}`
                : " (no variant prop)")
        // Show the chain down through sizing wrappers.
        if (typeof props.children === "function") {
            return `${self} → function children (render prop — wrapping)`
        }
        if (props.children !== undefined && existingVariant === undefined) {
            return `${self} → ${describeLogoProp(props.children as ReactNode)}`
        }
        return self
    }
    return typeof logo
}

export type MigratingLogoProps = {
    logo?: ReactNode
    scrollSection?: unknown
    variantWordmark?: string
    variantBig?: string
    variantSmall?: string
    maxWidth?: number
    insetLeft?: number
    insetTop?: number
    scaleStart?: number
    scaleEnd?: number
    wordmarkScaleShare?: number
    switchAt?: number
    snapAt?: number
    smallOffsetX?: number
    layoutMode?: "desktop" | "mobile"
    mobileZoom?: number
    link?: unknown
    smoothScroll?: boolean
    scrollStart?: string
    scrollEnd?: string
    markers?: boolean
    layerZIndex?: number
    style?: CSSProperties
}

/** High enough for Framer sections; avoids Safari bugs with near-max z-index. */
const RUNTIME_LAYER_Z_FLOOR = 999999

let sharedPortalRoot: HTMLDivElement | null = null

function isWebKitSafari(): boolean {
    if (typeof navigator === "undefined") return false
    const ua = navigator.userAgent
    return /Safari/i.test(ua) && !/Chrome|Chromium|CriOS|FxiOS|EdgiOS/i.test(ua)
}

function getSharedPortalRoot(stackZIndex: number): HTMLDivElement {
    if (!sharedPortalRoot) {
        sharedPortalRoot = document.createElement("div")
        sharedPortalRoot.setAttribute("data-migrating-logo-portal", "")
        Object.assign(sharedPortalRoot.style, {
            position: "fixed",
            top: "0",
            left: "0",
            width: "0",
            height: "0",
            overflow: "visible",
            pointerEvents: "none",
            margin: "0",
            padding: "0",
            border: "0",
        })
        document.body.appendChild(sharedPortalRoot)
    }
    sharedPortalRoot.style.zIndex = String(stackZIndex)
    return sharedPortalRoot
}

function fixedLayerGsap(zIndex: number): Record<string, unknown> {
    return {
        position: "fixed",
        top: 0,
        left: 0,
        zIndex,
        force3D: true,
    }
}

function fixedLayerReactStyle(zIndex: number): CSSProperties {
    return {
        position: "fixed",
        top: 0,
        left: 0,
        zIndex,
        transform: "translateZ(0)",
    }
}

function isElementVisible(el: HTMLElement): boolean {
    if (typeof el.checkVisibility === "function") {
        return el.checkVisibility({
            checkOpacity: true,
            checkVisibilityCSS: true,
        })
    }
    return getComputedStyle(el).display !== "none"
}

/**
 * @framerSupportedLayoutWidth any
 * @framerSupportedLayoutHeight auto
 * @framerIntrinsicWidth auto
 * @framerIntrinsicHeight auto
 */
export default function MigratingLogo(props: MigratingLogoProps) {
    const {
        logo,
        scrollSection,
        variantWordmark = "Wordmark",
        variantBig = "Logo-big",
        variantSmall = "Logo-small",
        maxWidth = 1728,
        insetLeft = 16,
        insetTop = 24,
        scaleStart = 1,
        scaleEnd = 0.15,
        wordmarkScaleShare = 0.2,
        switchAt = 0.5,
        snapAt = 0.99,
        smallOffsetX = 0,
        layoutMode = "desktop",
        mobileZoom = 0.5,
        link,
        smoothScroll = false,
        scrollStart = "top bottom",
        scrollEnd = "bottom top",
        markers = false,
        layerZIndex = 100,
        style,
    } = props

    const isCanvas =
        typeof RenderTarget !== "undefined" &&
        RenderTarget.current() === RenderTarget.canvas

    const isPreview =
        typeof RenderTarget !== "undefined" &&
        RenderTarget.current() === RenderTarget.preview

    const isRuntime = !isCanvas || isPreview
    const portalToBody = isRuntime
    const portalStackZIndex = isRuntime
        ? Math.max(layerZIndex, RUNTIME_LAYER_Z_FLOOR)
        : layerZIndex
    const logoLayerZIndex = isRuntime ? 1 : layerZIndex

    const scrollTriggerId = `migrating-logo-${useId().replace(/:/g, "")}`
    const wrapperRef = useRef<HTMLDivElement>(null)
    const baseSizeRef = useRef({ w: 0, h: 0 })
    const variantRef = useRef(variantWordmark)
    const effectiveScaleStart =
        layoutMode === "mobile" ? scaleStart * mobileZoom : scaleStart
    const hostRef = useRef<HTMLDivElement>(null)
    const [layerVisible, setLayerVisible] = useState(true)
    const [variant, setVariant] = useState(() =>
        variantForProgress(
            sharedScrollProgress,
            variantWordmark,
            variantBig,
            variantSmall,
            switchAt,
            snapAt
        )
    )
    const [bootstrapped, setBootstrapped] = useState(
        () => sharedScrollProgress <= 0
    )
    const setBootstrappedRef = useRef(setBootstrapped)
    setBootstrappedRef.current = setBootstrapped
    const gsapRef = useRef<GsapRuntime["gsap"] | null>(null)
    const progressRef = useRef(sharedScrollProgress)
    const applyFrameRef = useRef<((progress: number) => void) | null>(null)
    const resizeLockUntilRef = useRef(0)
    const lastPaintRef = useRef<Record<string, unknown> | null>(null)

    const layout = useCallback(
        () => ({
            centerX: () => {
                const vv = viewportMetrics()
                return vv.offsetLeft + vv.width / 2
            },
            centerY: () => {
                const vv = viewportMetrics()
                return vv.offsetTop + vv.height / 2
            },
            cornerX: () => {
                const vv = viewportMetrics()
                const margin = Math.max((vv.width - maxWidth) / 2, 0)
                return vv.offsetLeft + margin + insetLeft
            },
            cornerY: () => viewportMetrics().offsetTop + insetTop,
        }),
        [maxWidth, insetLeft, insetTop]
    )

    const hasScrollSection = Boolean(scrollSection)

    useLayoutEffect(() => {
        if (!portalToBody || (isCanvas && !isPreview)) return

        const syncLayerVisibility = () => {
            const host = hostRef.current
            if (!host) return
            setLayerVisible(isElementVisible(host))
        }

        syncLayerVisibility()
        const host = hostRef.current
        if (!host) return

        const ro = new ResizeObserver(syncLayerVisibility)
        ro.observe(host)
        window.addEventListener("resize", syncLayerVisibility)
        return () => {
            ro.disconnect()
            window.removeEventListener("resize", syncLayerVisibility)
        }
    }, [portalToBody, isCanvas, isPreview])

    const resolveTrigger = useCallback(() => {
        const wrapper = wrapperRef.current
        if (!wrapper) return null
        return resolveScrollTriggerElement(
            scrollSection,
            hasScrollSection ? null : wrapper
        )
    }, [scrollSection, hasScrollSection])

    // Synchronous snap paint when Framer swaps breakpoint copies at full scroll.
    useLayoutEffect(() => {
        if (isCanvas && !isPreview) return

        const wrapper = wrapperRef.current
        if (!wrapper) return

        const progress = sharedScrollProgress
        progressRef.current = progress

        if (progress <= 0) {
            setBootstrapped(true)
            return
        }

        const w = window as GsapWindow
        const gsap = w.gsap
        if (!gsap) return

        gsapRef.current = gsap
        baseSizeRef.current.w = wrapper.offsetWidth
        baseSizeRef.current.h = wrapper.offsetHeight

        const baseStyle = fixedLayerGsap(logoLayerZIndex)

        if (baseSizeRef.current.w === 0 && sharedLastPaint) {
            gsap.set(wrapper, { ...baseStyle, ...sharedLastPaint })
            lastPaintRef.current = sharedLastPaint
            setBootstrapped(true)
            return
        }

        const { centerX, centerY, cornerX, cornerY } = layout()
        const scale = scaleForProgress(
            progress,
            effectiveScaleStart,
            scaleEnd,
            snapAt,
            switchAt,
            wordmarkScaleShare,
            gsap.utils.interpolate
        )
        const halfW = (baseSizeRef.current.w * scale) / 2
        const halfH = (baseSizeRef.current.h * scale) / 2
        const pos = positionForProgress(
            progress,
            snapAt,
            centerX(),
            centerY(),
            cornerX(),
            cornerY(),
            halfW,
            halfH,
            gsap.utils.interpolate
        )
        const origin = transformOriginForProgress(progress, switchAt, snapAt)
        const vars = { ...pos, scale, transformOrigin: origin }
        gsap.set(wrapper, { ...baseStyle, ...vars })
        sharedLastPaint = { ...vars }
        lastPaintRef.current = sharedLastPaint
        setBootstrapped(true)
    }, [
        isCanvas,
        isPreview,
        snapAt,
        switchAt,
        layout,
        effectiveScaleStart,
        scaleEnd,
        wordmarkScaleShare,
        logoLayerZIndex,
    ])

    useLayoutEffect(() => {
        // GSAP runs in Preview and on the published site — not on the static canvas.
        if (isCanvas && !isPreview) return

        const wrapper = wrapperRef.current
        if (!wrapper) return
        if (portalToBody && !hostRef.current) return

        let cancelled = false
        let ctx: { revert: () => void } | null = null
        let removeResize: (() => void) | null = null
        let removeViewport: (() => void) | null = null
        let removeScrollProbe: (() => void) | null = null
        let sizeObserver: ResizeObserver | null = null
        let retryTimer: ReturnType<typeof setTimeout> | null = null
        let mutationObserver: MutationObserver | null = null
        let activeTrigger: HTMLElement | null = null
        // Captured from the ST's own callbacks — registry lookups (getById)
        // are unreliable when the page has its own gsap bundle.
        let stRef: {
            kill: () => void
            progress: number
            start: number
            end: number
        } | null = null
        let tearingDown = false

        // Keep React variant in sync before async GSAP setup (resize / breakpoint).
        progressRef.current = sharedScrollProgress
        const syncedVariant = variantForProgress(
            progressRef.current,
            variantWordmark,
            variantBig,
            variantSmall,
            switchAt,
            snapAt
        )
        if (variantRef.current !== syncedVariant) {
            variantRef.current = syncedVariant
            setVariant(syncedVariant)
        }

        const overlay = markers ? createDebugOverlay() : null
        const report = (msg: string) => {
            if (markers) console.log("[MigratingLogo]", msg)
            if (overlay) overlay.log.textContent += `\n${msg}`
        }
        const reportProgress = (self: {
            progress: number
            start: number
            end: number
        }) => {
            if (!overlay) return
            overlay.progress.textContent =
                `progress: ${self.progress.toFixed(3)} | ` +
                `scroll: ${Math.round(window.scrollY)}px | ` +
                `range: ${Math.round(self.start)}–${Math.round(self.end)}px | ` +
                `variant: ${variantRef.current}`
        }

        report(`render target: ${RenderTarget.current()}`)
        report(`scroll section prop: ${describeScrollSectionProp(scrollSection)}`)
        report(`logo prop: ${describeLogoProp(logo)}`)

        const isVisible = () => {
            const anchor = portalToBody
                ? hostRef.current
                : wrapperRef.current
            if (!anchor) return false
            return isElementVisible(anchor)
        }

        const killMigration = () => {
            const w = window as GsapWindow
            w.ScrollTrigger?.getById(scrollTriggerId)?.kill()
        }

        const stopScrollTrigger = () => {
            tearingDown = true
            applyFrameRef.current = null
            stRef?.kill()
            stRef = null
            killMigration()
        }

        const teardown = (options?: { revert?: boolean }) => {
            stopScrollTrigger()
            removeResize?.()
            removeResize = null
            removeViewport?.()
            removeViewport = null
            removeScrollProbe?.()
            removeScrollProbe = null
            sizeObserver?.disconnect()
            sizeObserver = null
            if (options?.revert !== false) {
                ctx?.revert()
            }
            ctx = null
            activeTrigger = null
        }

        let setupToken = 0
        let lastOrigin = ""

        const measureBaseSize = () => {
            baseSizeRef.current.w = wrapper.offsetWidth
            baseSizeRef.current.h = wrapper.offsetHeight
        }

        const shouldHoldSnap = (incoming: number) => {
            // Only during resize / breakpoint swap — never block reverse scroll.
            return (
                performance.now() < resizeLockUntilRef.current &&
                incoming < progressRef.current - 0.001
            )
        }

        const paintFrame = (progress: number) => {
            const gsap = gsapRef.current
            if (!gsap || tearingDown || !isVisible()) return

            if (shouldHoldSnap(progress)) {
                progress = progressRef.current
            }

            sharedScrollProgress = progress
            progressRef.current = progress
            const { centerX, centerY, cornerX, cornerY } = layout()
            const nextVariant = variantForProgress(
                progress,
                variantWordmark,
                variantBig,
                variantSmall,
                switchAt,
                snapAt
            )
            const scale = scaleForProgress(
                progress,
                effectiveScaleStart,
                scaleEnd,
                snapAt,
                switchAt,
                wordmarkScaleShare,
                gsap.utils.interpolate
            )
            const { w: baseW, h: baseH } = baseSizeRef.current
            const halfW = (baseW * scale) / 2
            const halfH = (baseH * scale) / 2
            const pos = positionForProgress(
                progress,
                snapAt,
                centerX(),
                centerY(),
                cornerX(),
                cornerY(),
                halfW,
                halfH,
                gsap.utils.interpolate
            )
            const origin = transformOriginForProgress(
                progress,
                switchAt,
                snapAt
            )

            if (nextVariant !== variantRef.current) {
                report(`variant → "${nextVariant}" @ ${progress.toFixed(2)}`)
                variantRef.current = nextVariant
                if (origin !== lastOrigin) {
                    gsap.set(wrapper, { transformOrigin: origin })
                    lastOrigin = origin
                }
                const snapped = snapTransformVars(pos)
                gsap.set(wrapper, {
                    ...fixedLayerGsap(logoLayerZIndex),
                    ...snapped,
                })
                lastPaintRef.current = { ...snapped, transformOrigin: origin }
                sharedLastPaint = lastPaintRef.current
                setVariant(nextVariant)
                setBootstrappedRef.current(true)
                return
            }

            const vars: Record<string, unknown> = snapTransformVars({
                ...pos,
                scale,
            })
            if (origin !== lastOrigin) {
                vars.transformOrigin = origin
                lastOrigin = origin
            }
            const prev = lastPaintRef.current
            if (
                prev &&
                prev.x === vars.x &&
                prev.y === vars.y &&
                prev.scale === vars.scale &&
                prev.xPercent === vars.xPercent &&
                prev.yPercent === vars.yPercent &&
                prev.transformOrigin === vars.transformOrigin
            ) {
                return
            }
            gsap.set(wrapper, vars)
            lastPaintRef.current = { ...vars }
            sharedLastPaint = lastPaintRef.current
            setBootstrappedRef.current(true)
        }

        const adoptProgress = (p: number) => {
            paintFrame(p)
        }

        const refreshAndApply = () => {
            paintFrame(progressRef.current)
            const w = window as GsapWindow
            w.ScrollTrigger?.refresh()
            if (stRef) adoptProgress(stRef.progress)
        }

        const scheduleRefresh = debounce(
            refreshAndApply,
            isCoarsePointer() ? 200 : 80
        )

        const paintNow = () => {
            measureBaseSize()
            paintFrame(progressRef.current)
        }

        applyFrameRef.current = paintFrame
        measureBaseSize()
        if (gsapRef.current) {
            gsapRef.current.set(wrapper, {
                ...fixedLayerGsap(logoLayerZIndex),
                transformOrigin: "50% 50%",
            })
            paintFrame(progressRef.current)
        }

        const setup = async (trigger: HTMLElement) => {
            if (!isVisible()) return
            if (hasScrollSection && trigger === wrapper) return
            if (activeTrigger === trigger) return

            tearingDown = false

            // Claim synchronously so concurrent calls (retry loop +
            // MutationObserver) can't double-create and kill each other's ST.
            activeTrigger = trigger
            const token = ++setupToken

            report(`trigger resolved: ${describeElement(trigger)}`)

            let runtime: GsapRuntime
            try {
                runtime = await loadGsap()
                report("gsap loaded OK")
            } catch (err) {
                report(`GSAP FAILED TO LOAD: ${String(err)}`)
                if (activeTrigger === trigger) activeTrigger = null
                return
            }

            if (cancelled || token !== setupToken) return

            ctx?.revert()
            removeResize?.()
            killMigration()

            const { gsap } = runtime
            gsapRef.current = gsap
            const touchDevice = isCoarsePointer()
            measureBaseSize()

            sizeObserver?.disconnect()
            sizeObserver = new ResizeObserver(() => {
                measureBaseSize()
                if (!isCoarsePointer()) {
                    paintNow()
                    scheduleRefresh()
                }
            })
            sizeObserver.observe(wrapper)

            gsap.set(wrapper, {
                ...fixedLayerGsap(logoLayerZIndex),
                transformOrigin: "50% 50%",
            })

            type STSelf = {
                kill: () => void
                progress: number
                start: number
                end: number
            }

            // Touch browsers scroll the page (window), not a Framer wrapper.
            // Binding to getScrollParent() causes progress to drift from finger scroll.
            let currentScroller: Element | undefined = touchDevice
                ? undefined
                : getScrollParent(trigger)

            const build = () => {
                ctx?.revert()
                stRef = null
                report(
                    `building (scroller: ${
                        currentScroller
                            ? describeElement(currentScroller)
                            : "window"
                    })`
                )

                ctx = gsap.context(() => {
                    const { ScrollTrigger: ST } = runtime
                    const st = ST.create({
                        id: scrollTriggerId,
                        trigger,
                        start: scrollStart,
                        end: scrollEnd,
                        scrub: true,
                        invalidateOnRefresh: !touchDevice,
                        markers,
                        ...(touchDevice ? { fastScrollEnd: true } : {}),
                        ...(currentScroller
                            ? { scroller: currentScroller }
                            : {}),
                        onUpdate: (self: STSelf) => {
                            stRef = self
                            resizeLockUntilRef.current = 0
                            adoptProgress(self.progress)
                            reportProgress(self)
                        },
                        onRefresh: (self: STSelf) => {
                            stRef = self
                            adoptProgress(self.progress)
                            reportProgress(self)
                        },
                    })
                    stRef = st as STSelf
                    paintFrame(st.progress)
                }, wrapper)
            }

            build()

            // Desktop only: detect a non-window scroller. On touch, rebinding
            // mid-scroll rebuilds ScrollTrigger and causes chunky animation.
            if (!touchDevice) {
                const onAnyScroll = (event: Event) => {
                    const raw = event.target
                    const el =
                        raw instanceof Element &&
                        raw !== document.documentElement &&
                        raw !== document.body
                            ? raw
                            : null

                    if (overlay) {
                        overlay.scroll.textContent = el
                            ? `scrolling: ${describeElement(el)} ` +
                              `(top: ${Math.round(el.scrollTop)}px)`
                            : `scrolling: window (y: ${Math.round(window.scrollY)}px)`
                    }

                    if (el && el.contains(trigger) && el !== currentScroller) {
                        report(`rebinding scroller → ${describeElement(el)}`)
                        currentScroller = el
                        build()
                        scheduleRefresh()
                    }
                }
                document.addEventListener("scroll", onAnyScroll, {
                    capture: true,
                    passive: true,
                })
                removeScrollProbe?.()
                removeScrollProbe = () =>
                    document.removeEventListener("scroll", onAnyScroll, {
                        capture: true,
                    })
            }

            // Status check via callback-captured instance, not getById.
            setTimeout(() => {
                if (cancelled) return
                if (stRef) {
                    report(
                        `ScrollTrigger live — range ${Math.round(stRef.start)}–` +
                            `${Math.round(stRef.end)}px. Scroll to test.`
                    )
                } else {
                    report(
                        "ScrollTrigger never fired onRefresh — not created. " +
                            "Likely a second gsap on the page intercepted it."
                    )
                }
            }, 600)

            scheduleRefresh()
        }

        let attempts = 0
        const maxAttempts = 80
        // Wait this long for the linked section (ScrollSectionRef.current is
        // often null on mount) before settling for the first section found.
        const fallbackAfter = 40

        const run = () => {
            if (cancelled) return

            if (!isVisible()) {
                if (activeTrigger) teardown({ revert: false })
                return
            }

            tearingDown = false

            const exact = resolveTrigger()
            if (exact && exact !== wrapper) {
                setup(exact)
                return
            }

            if (!hasScrollSection) {
                if (wrapperRef.current) setup(wrapperRef.current)
                return
            }

            if (attempts === fallbackAfter) {
                const fallback = findFirstScrollSection()
                if (fallback) {
                    report(
                        "linked section still unresolved — falling back to " +
                            "first scroll section on page"
                    )
                    setup(fallback)
                    // Keep polling: upgrade to the linked section if its ref
                    // populates later.
                }
            }

            if (attempts < maxAttempts) {
                attempts += 1
                retryTimer = setTimeout(run, 120)
                return
            }

            if (!activeTrigger) {
                report(
                    "GAVE UP: scroll section never resolved to a DOM element " +
                        `after ${maxAttempts} attempts. ` +
                        "Check the Scroll Section link in the property panel."
                )
            }
        }

        run()

        mutationObserver = new MutationObserver(() => {
            if (cancelled || !hasScrollSection || !isVisible()) return
            const exact = resolveTrigger()
            if (exact && exact !== wrapper) {
                setup(exact)
            }
        })
        mutationObserver.observe(document.body, {
            childList: true,
            subtree: true,
        })

        document.fonts?.ready?.then(() => {
            if (!cancelled) scheduleRefresh()
        })

        window.addEventListener("load", scheduleRefresh, { once: true })

        const lockResizeAndRepaint = () => {
            resizeLockUntilRef.current = performance.now() + 450
            paintNow()
            const last = lastPaintRef.current
            if (last && gsapRef.current) {
                gsapRef.current.set(wrapper, last)
            }
        }

        const onWindowResize = () => {
            if (cancelled) return
            if (!isVisible()) {
                if (activeTrigger) {
                    report("breakpoint hidden — tearing down")
                    teardown({ revert: false })
                }
                return
            }
            if (!activeTrigger) {
                attempts = 0
                run()
            }
            lockResizeAndRepaint()
            // Address-bar resizes fire window.resize on touch — repaint only,
            // skip ScrollTrigger.refresh (ignoreMobileResize + manual guard).
            if (!isCoarsePointer()) {
                scheduleRefresh()
            }
        }
        window.addEventListener("resize", onWindowResize, true)

        const onVisualViewportResize = debounce(() => {
            if (cancelled || !isVisible()) return
            resizeLockUntilRef.current = performance.now() + 450
            paintFrame(progressRef.current)
        }, 100)

        const vv = window.visualViewport
        if (vv && isCoarsePointer()) {
            vv.addEventListener("resize", onVisualViewportResize)
            removeViewport = () => {
                vv.removeEventListener("resize", onVisualViewportResize)
            }
        }

        return () => {
            cancelled = true
            if (retryTimer) clearTimeout(retryTimer)
            overlay?.root.remove()
            mutationObserver?.disconnect()
            window.removeEventListener("resize", onWindowResize, true)
            removeViewport?.()
            teardown()
        }
    }, [
        isCanvas,
        isPreview,
        hasScrollSection,
        scrollSection,
        resolveTrigger,
        layout,
        scrollTriggerId,
        variantWordmark,
        variantBig,
        variantSmall,
        maxWidth,
        insetLeft,
        insetTop,
        scaleStart,
        scaleEnd,
        effectiveScaleStart,
        wordmarkScaleShare,
        switchAt,
        snapAt,
        scrollStart,
        scrollEnd,
        markers,
        logo,
        logoLayerZIndex,
        portalToBody,
    ])

    // Reapply last corner transform in capture phase before ST can regress it.
    useLayoutEffect(() => {
        const reapplySnap = () => {
            if (progressRef.current < snapAt) return
            const gsap = gsapRef.current
            const wrapper = wrapperRef.current
            const last = lastPaintRef.current
            if (!gsap || !wrapper || !last) return
            resizeLockUntilRef.current = performance.now() + 450
            gsap.set(wrapper, {
                ...fixedLayerGsap(logoLayerZIndex),
                ...last,
            })
        }
        window.addEventListener("resize", reapplySnap, true)
        const vv = window.visualViewport
        const onVvResize = () => {
            if (isCoarsePointer()) return
            reapplySnap()
        }
        vv?.addEventListener("resize", onVvResize)
        return () => {
            window.removeEventListener("resize", reapplySnap, true)
            vv?.removeEventListener("resize", onVvResize)
        }
    }, [snapAt, logoLayerZIndex])

    // Apply scale + position before paint so variant swap doesn't flash.
    useLayoutEffect(() => {
        const gsap = gsapRef.current
        const wrapper = wrapperRef.current
        if (!gsap || !wrapper) return
        if (performance.now() < resizeLockUntilRef.current) return
        const { centerX, centerY, cornerX, cornerY } = layout()
        const progress = progressRef.current
        const scale = scaleForProgress(
            progress,
            effectiveScaleStart,
            scaleEnd,
            snapAt,
            switchAt,
            wordmarkScaleShare,
            gsap.utils.interpolate
        )
        baseSizeRef.current.w = wrapper.offsetWidth
        baseSizeRef.current.h = wrapper.offsetHeight
        const { w: baseW, h: baseH } = baseSizeRef.current
        const halfW = (baseW * scale) / 2
        const halfH = (baseH * scale) / 2
        gsap.set(wrapper, {
            ...fixedLayerGsap(logoLayerZIndex),
            ...positionForProgress(
                progress,
                snapAt,
                centerX(),
                centerY(),
                cornerX(),
                cornerY(),
                halfW,
                halfH,
                gsap.utils.interpolate
            ),
            scale,
            transformOrigin: transformOriginForProgress(
                progress,
                switchAt,
                snapAt
            ),
        })
        const painted = {
            ...positionForProgress(
                progress,
                snapAt,
                centerX(),
                centerY(),
                cornerX(),
                cornerY(),
                halfW,
                halfH,
                gsap.utils.interpolate
            ),
            scale,
            transformOrigin: transformOriginForProgress(
                progress,
                switchAt,
                snapAt
            ),
        }
        lastPaintRef.current = painted
        sharedLastPaint = painted
        setBootstrappedRef.current(true)
    }, [
        variant,
        layout,
        insetTop,
        effectiveScaleStart,
        scaleEnd,
        snapAt,
        switchAt,
        wordmarkScaleShare,
    ])

    const placeholderStyle: CSSProperties = {
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        minHeight: 120,
        border: "1px dashed rgba(0, 0, 0, 0.2)",
        color: "rgba(0, 0, 0, 0.45)",
        fontSize: 12,
        fontFamily: "Inter, system-ui, sans-serif",
        textAlign: "center",
        padding: 16,
        lineHeight: 1.5,
    }

    const content = logo ? (
        renderLogo(logo, isCanvas && !isPreview ? variantWordmark : variant)
    ) : (
        <div style={placeholderStyle}>Connect your logo component</div>
    )

    const contentStyle: CSSProperties = {
        width: "max-content",
        height: "max-content",
        display: "inline-block",
    }

    const linkedContent = link ? (
        FramerLink ? (
            <FramerLink href={link} smoothScroll={smoothScroll}>
                <a
                    aria-label="Home"
                    style={{
                        display: "inline-block",
                        width: "max-content",
                        height: "max-content",
                        textDecoration: "none",
                        color: "inherit",
                        cursor: "pointer",
                    }}
                >
                    {content}
                </a>
            </FramerLink>
        ) : (
            <a
                href={typeof link === "string" ? link : undefined}
                aria-label="Home"
                style={{
                    display: "inline-block",
                    width: "max-content",
                    height: "max-content",
                    textDecoration: "none",
                    color: "inherit",
                    cursor: "pointer",
                }}
            >
                {content}
            </a>
        )
    ) : (
        content
    )

    if (isCanvas && !isPreview) {
        const canvasHeroScale = effectiveScaleStart
        return (
            <div
                style={{
                    width: "max-content",
                    height: "max-content",
                    ...style,
                    ...(canvasHeroScale !== 1
                        ? {
                              transform: `scale(${canvasHeroScale})`,
                              transformOrigin: "50% 50%",
                          }
                        : {}),
                }}
            >
                <div style={contentStyle}>{linkedContent}</div>
            </div>
        )
    }

    const hideUntilPaint =
        isRuntime && sharedScrollProgress > 0 && !bootstrapped

    // Inline corner only before GSAP bootstraps (breakpoint swap). After that
    // GSAP owns the transform — keeping this on would block reverse scroll.
    const pinnedCornerStyle: CSSProperties =
        isRuntime && !bootstrapped && sharedScrollProgress >= snapAt
            ? (() => {
                  const { cornerX, cornerY } = layout()
                  return {
                      ...fixedLayerReactStyle(logoLayerZIndex),
                      transform: `translate3d(${cornerX()}px, ${cornerY()}px, 0) scale(1)`,
                      transformOrigin: "top left",
                  }
              })()
            : {}

    const runtimeLayer = (
        <div
            ref={wrapperRef}
            style={{
                ...style,
                ...(isRuntime
                    ? {
                          ...fixedLayerReactStyle(logoLayerZIndex),
                          pointerEvents: "auto",
                      }
                    : {}),
                width: "max-content",
                height: "max-content",
                display: !hideUntilPaint ? "inline-block" : "none",
                flexShrink: 0,
                ...pinnedCornerStyle,
                marginLeft: variant === variantSmall ? smallOffsetX : 0,
                willChange: "transform",
                touchAction: "pan-y",
            }}
        >
            <div style={contentStyle}>{linkedContent}</div>
        </div>
    )

    if (!portalToBody) return runtimeLayer

    const hostAnchor = (
        <div
            ref={hostRef}
            style={{
                position: "absolute",
                width: 0,
                height: 0,
                overflow: "hidden",
                pointerEvents: "none",
            }}
            aria-hidden
        />
    )

    if (!layerVisible) return hostAnchor

    return (
        <>
            {hostAnchor}
            {typeof document !== "undefined"
                ? createPortal(
                      runtimeLayer,
                      getSharedPortalRoot(portalStackZIndex)
                  )
                : runtimeLayer}
        </>
    )
}

MigratingLogo.displayName = "Migrating Logo"

addPropertyControls(MigratingLogo, {
    logo: {
        type: ControlType.ComponentInstance,
        title: "Logo",
        description:
            "Connect your 3-variant logo component (Wordmark, Logo-big, Logo-small).",
    },
    link: {
        type: ControlType.Link,
        title: "Link",
        description: "Where the logo links to (e.g. the home page).",
    },
    smoothScroll: {
        type: ControlType.Boolean,
        title: "Scroll",
        defaultValue: false,
        enabledTitle: "Smooth",
        disabledTitle: "Instant",
        description:
            "Only affects tapping the logo link (in-page anchor). Does not change finger scrolling or this migration animation.",
        hidden: (props: MigratingLogoProps) => !props.link,
    },
    layoutMode: {
        type: ControlType.Enum,
        title: "Layout",
        options: ["desktop", "mobile"],
        optionTitles: ["Desktop", "Mobile"],
        defaultValue: "desktop",
        description:
            "Set Mobile on the phone breakpoint copy. Desktop copies stay Desktop.",
    },
    mobileZoom: {
        type: ControlType.Number,
        title: "Mobile zoom",
        defaultValue: 0.5,
        min: 0.1,
        max: 1,
        step: 0.05,
        description:
            "Scales hero only on mobile (multiplies Scale start). Shown on the canvas when Layout is Mobile. Does not affect corner or Logo-small snap.",
        hidden: (props: MigratingLogoProps) => props.layoutMode !== "mobile",
    },
    scrollSection: {
        type: ScrollSectionControlType,
        title: "Scroll Section",
        description:
            "Link the other stack (Scroll enabled). Migrating Logo can sit anywhere on the page — it does not need to be inside that stack.",
    },
    variantWordmark: {
        type: ControlType.String,
        title: "Wordmark variant",
        defaultValue: "Wordmark",
    },
    variantBig: {
        type: ControlType.String,
        title: "Logo big variant",
        defaultValue: "Logo-big",
    },
    variantSmall: {
        type: ControlType.String,
        title: "Logo small variant",
        defaultValue: "Logo-small",
    },
    maxWidth: {
        type: ControlType.Number,
        title: "Max width",
        defaultValue: 1728,
        min: 320,
        max: 3840,
        step: 1,
        unit: "px",
        description: "Content max-width for corner inset on wide screens.",
    },
    insetLeft: {
        type: ControlType.Number,
        title: "Inset left",
        defaultValue: 16,
        min: 0,
        max: 120,
        step: 1,
        unit: "px",
    },
    insetTop: {
        type: ControlType.Number,
        title: "Inset top",
        defaultValue: 24,
        min: 0,
        max: 120,
        step: 1,
        unit: "px",
    },
    scaleStart: {
        type: ControlType.Number,
        title: "Scale start",
        defaultValue: 1,
        min: 0.05,
        max: 2,
        step: 0.05,
        description: "Wrapper scale at scroll progress 0 (centered hero/wordmark).",
    },
    wordmarkScaleShare: {
        type: ControlType.Number,
        title: "Wordmark scale share",
        defaultValue: 0.2,
        min: 0,
        max: 1,
        step: 0.05,
        description:
            "Fraction of scale shrink during the wordmark phase (lower = slower hero shrink). scaleEnd unchanged.",
    },
    scaleEnd: {
        type: ControlType.Number,
        title: "Scale end",
        defaultValue: 0.15,
        min: 0.05,
        max: 1,
        step: 0.01,
        description:
            "Wrapper scale just before snapAt (corner Logo-big size). Logo-small native ≈ Logo-big × this value.",
    },
    switchAt: {
        type: ControlType.Number,
        title: "Switch at",
        defaultValue: 0.5,
        min: 0,
        max: 1,
        step: 0.01,
        description: "Scroll progress to switch Wordmark → Logo-big.",
    },
    snapAt: {
        type: ControlType.Number,
        title: "Snap at",
        defaultValue: 0.99,
        min: 0.5,
        max: 1,
        step: 0.01,
        description:
            "Scroll progress for instant Logo-small + scale 1 (sharp corner logo).",
    },
    layerZIndex: {
        type: ControlType.Number,
        title: "Layer Z",
        defaultValue: 100,
        min: 1,
        max: 2147483646,
        step: 1,
        description:
            "Minimum stacking order for the portal root. Preview/site auto-uses at least 999999.",
    },
    smallOffsetX: {
        type: ControlType.Number,
        title: "Small offset X",
        defaultValue: 0,
        min: -8,
        max: 8,
        step: 0.5,
        unit: "px",
        description:
            "Horizontal nudge applied to Logo-small after the snap (e.g. -2).",
    },
    scrollStart: {
        type: ControlType.String,
        title: "Scroll start",
        defaultValue: "top bottom",
        description:
            'ScrollTrigger start (default: when linked stack top hits viewport bottom).',
    },
    scrollEnd: {
        type: ControlType.String,
        title: "Scroll end",
        defaultValue: "bottom top",
        description:
            "ScrollTrigger end (default: full linked stack height).",
    },
    markers: {
        type: ControlType.Boolean,
        title: "Markers",
        defaultValue: false,
        enabledTitle: "On",
        disabledTitle: "Off",
        description: "ScrollTrigger debug markers (preview only).",
    },
})
