/**
 * CMS Magnetic Image Grid — Framer Code Component
 *
 * Wraps a CMS Collection List and applies a cursor-proximity "magnet" scale
 * effect across every item in the grid. Images near the cursor grow large;
 * distant ones shrink. A Cartesian fisheye distortion guarantees images
 * never overlap and gaps stay positive at all times.
 *
 * Setup:
 * 1. Assets → Code → + → Code Component → paste this file
 * 2. Add this component to your project page (set width to Fill)
 * 3. Create a CMS Collection List for your Images collection (filtered by
 *    project reference) and design the item template with a native Image layer
 *    bound to your CMS image field
 * 4. Connect the Collection List to this component's **Collection** outlet
 *    (drag the list into the connector on the component, or use the property
 *    panel dropdown)
 * 5. Tune Max Scale, Min Scale, Radius, and Smoothing in the property panel
 *
 * Notes:
 * - Framer does not allow selecting a CMS collection inside code directly;
 *   connecting a Collection List via the outlet is the supported pattern
 * - Effect is disabled on touch devices and when prefers-reduced-motion is set
 * - On the Framer canvas the connected collection renders normally (no effect)
 *
 * @framerDisableUnlink
 * @framerSupportedLayoutWidth any
 * @framerSupportedLayoutHeight any
 * @framerIntrinsicWidth 800
 * @framerIntrinsicHeight 600
 */

import {
    useEffect,
    useId,
    useMemo,
    useRef,
    type CSSProperties,
    type ReactNode,
} from "react"
import {
    addPropertyControls,
    ControlType,
    // @ts-expect-error RenderTarget is provided by Framer at runtime
    RenderTarget,
} from "framer"

// ─── Types ───────────────────────────────────────────────────────────────────

export interface CMSMagneticImageGridProps {
    collection?: ReactNode
    maxScale?: number
    minScale?: number
    radius?: number
    smoothing?: number
}

type TransformState = {
    dx: number
    dy: number
    scale: number
}

type GridSettings = {
    maxScale: number
    minScale: number
    radius: number
    smoothing: number
}

type BaseRect = {
    cx: number
    cy: number
    width: number
    height: number
}

type GridInstance = {
    id: string
    element: HTMLElement
    baseRect: BaseRect | null
    current: TransformState
    target: TransformState
    settings: GridSettings
}

type GridGroup = {
    container: HTMLElement
    instances: Map<string, GridInstance>
    pointer: { x: number; y: number } | null
    active: boolean
    rafId: number | null
    resizeObserver: ResizeObserver | null
    bounds: { width: number; height: number }
}

// ─── DOM helpers ─────────────────────────────────────────────────────────────

const COLLECTION_ITEM_SELECTORS = [
    "[data-framer-cms-item]",
    "[data-framer-collection-item]",
    "[data-framer-name][data-framer-component-type='CollectionItem']",
    "li",
    "article",
]

const COLLECTION_CONTAINER_SELECTORS = [
    "[data-framer-component-type='CollectionList']",
    "[data-framer-collection-list]",
    "[data-framer-name*='Collection List']",
    "[data-framer-name*='CollectionList']",
]

function countCollectionItems(root: ParentNode): number {
    let total = 0
    for (const selector of COLLECTION_ITEM_SELECTORS) {
        total = Math.max(total, root.querySelectorAll(selector).length)
    }
    return total
}

function findCollectionContainerInRoot(root: HTMLElement): HTMLElement | null {
    for (const selector of COLLECTION_CONTAINER_SELECTORS) {
        const match = root.querySelector(selector)
        if (match instanceof HTMLElement) return match
    }

    if (countCollectionItems(root) > 1) return root

    return null
}

function findAllCollectionItems(container: HTMLElement): HTMLElement[] {
    const items = new Set<HTMLElement>()

    for (const selector of COLLECTION_ITEM_SELECTORS) {
        container.querySelectorAll(selector).forEach(node => {
            if (node instanceof HTMLElement) items.add(node)
        })
    }

    return Array.from(items).filter(el => {
        const rect = el.getBoundingClientRect()
        return rect.width > 0 && rect.height > 0
    })
}

function isTouchDevice(): boolean {
    if (typeof window === "undefined") return false
    return (
        "ontouchstart" in window ||
        navigator.maxTouchPoints > 0 ||
        window.matchMedia("(pointer: coarse)").matches
    )
}

function prefersReducedMotion(): boolean {
    if (typeof window === "undefined") return false
    return window.matchMedia("(prefers-reduced-motion: reduce)").matches
}

// ─── Fisheye math ────────────────────────────────────────────────────────────

const INTEGRATION_STEPS = 64

function magnificationAt(
    t: number,
    focus: number,
    radius: number,
    minScale: number,
    maxScale: number
): number {
    const dist = Math.abs(t - focus)
    const sigma = Math.max(1, radius)
    const falloff = Math.exp(-(dist * dist) / (2 * sigma * sigma))
    return minScale + (maxScale - minScale) * falloff
}

function fisheyeAxis(
    pos: number,
    focus: number,
    minPos: number,
    maxPos: number,
    radius: number,
    minScale: number,
    maxScale: number
): { mappedPos: number; scale: number } {
    const range = maxPos - minPos
    if (range <= 0) return { mappedPos: pos, scale: 1 }

    const step = range / INTEGRATION_STEPS
    let totalIntegral = 0
    let posIntegral = 0

    for (let i = 0; i < INTEGRATION_STEPS; i++) {
        const t = minPos + (i + 0.5) * step
        const m = magnificationAt(t, focus, radius, minScale, maxScale)
        totalIntegral += m * step
        if (t <= pos) posIntegral += m * step
    }

    if (totalIntegral <= 0) return { mappedPos: pos, scale: 1 }

    const mappedPos = minPos + (posIntegral / totalIntegral) * range
    const scale = magnificationAt(pos, focus, radius, minScale, maxScale)

    return { mappedPos, scale }
}

function computeItemTransform(
    baseRect: BaseRect,
    pointer: { x: number; y: number },
    bounds: { width: number; height: number },
    settings: GridSettings
): TransformState {
    const { maxScale, minScale, radius } = settings
    const { cx, cy } = baseRect

    const xResult = fisheyeAxis(
        cx,
        pointer.x,
        0,
        bounds.width,
        radius,
        minScale,
        maxScale
    )
    const yResult = fisheyeAxis(
        cy,
        pointer.y,
        0,
        bounds.height,
        radius,
        minScale,
        maxScale
    )

    const scale = Math.sqrt(xResult.scale * yResult.scale)

    return {
        dx: xResult.mappedPos - cx,
        dy: yResult.mappedPos - cy,
        scale,
    }
}

const IDENTITY_TRANSFORM: TransformState = { dx: 0, dy: 0, scale: 1 }

function applyTransformToElement(
    el: HTMLElement,
    transform: TransformState
): void {
    const { dx, dy, scale } = transform
    if (
        Math.abs(dx) < 0.01 &&
        Math.abs(dy) < 0.01 &&
        Math.abs(scale - 1) < 0.001
    ) {
        el.style.transform = ""
        el.style.transformOrigin = ""
        el.style.willChange = ""
        return
    }
    el.style.transformOrigin = "center center"
    el.style.willChange = "transform"
    el.style.transform = `translate(${dx}px, ${dy}px) scale(${scale})`
}

function lerpTransform(
    current: TransformState,
    target: TransformState,
    factor: number
): TransformState {
    return {
        dx: current.dx + (target.dx - current.dx) * factor,
        dy: current.dy + (target.dy - current.dy) * factor,
        scale: current.scale + (target.scale - current.scale) * factor,
    }
}

function isTransformSettled(
    current: TransformState,
    target: TransformState,
    epsilon = 0.001
): boolean {
    return (
        Math.abs(current.dx - target.dx) < epsilon &&
        Math.abs(current.dy - target.dy) < epsilon &&
        Math.abs(current.scale - target.scale) < epsilon
    )
}

function clamp(value: number, min: number, max: number): number {
    return Math.min(max, Math.max(min, value))
}

// ─── Coordinator singleton ───────────────────────────────────────────────────

const groups = new Map<HTMLElement, GridGroup>()
let globalListenersAttached = false

function getOrCreateGroup(container: HTMLElement): GridGroup {
    let group = groups.get(container)
    if (group) return group

    const bounds = container.getBoundingClientRect()

    group = {
        container,
        instances: new Map(),
        pointer: null,
        active: false,
        rafId: null,
        resizeObserver: null,
        bounds: { width: bounds.width, height: bounds.height },
    }

    groups.set(container, group)
    attachGlobalListeners()
    setupGroupObservers(group)

    return group
}

function setupGroupObservers(group: GridGroup): void {
    if (typeof ResizeObserver === "undefined") return

    group.resizeObserver = new ResizeObserver(() => {
        const rect = group.container.getBoundingClientRect()
        group.bounds = { width: rect.width, height: rect.height }
        remeasureAllInstances(group)
        if (group.active) {
            computeTargets(group)
            requestGroupTick(group)
        }
    })

    group.resizeObserver.observe(group.container)
}

function remeasureAllInstances(group: GridGroup): void {
    const containerRect = group.container.getBoundingClientRect()

    for (const instance of group.instances.values()) {
        instance.baseRect = measureBaseRect(
            instance.element,
            containerRect
        )
    }
}

function measureBaseRect(
    element: HTMLElement,
    containerRect: DOMRect
): BaseRect | null {
    const prev = element.style.transform
    element.style.transform = "none"

    const rect = element.getBoundingClientRect()
    element.style.transform = prev

    if (rect.width <= 0 || rect.height <= 0) return null

    return {
        cx: rect.left - containerRect.left + rect.width / 2,
        cy: rect.top - containerRect.top + rect.height / 2,
        width: rect.width,
        height: rect.height,
    }
}

function attachGlobalListeners(): void {
    if (globalListenersAttached || typeof window === "undefined") return
    globalListenersAttached = true

    window.addEventListener("pointermove", onGlobalPointerMove, {
        passive: true,
    })
    window.addEventListener(
        "pointerleave",
        onGlobalPointerLeave as EventListener
    )
}

function findGroupForPointer(x: number, y: number): GridGroup | null {
    for (const group of groups.values()) {
        const rect = group.container.getBoundingClientRect()
        if (
            x >= rect.left &&
            x <= rect.right &&
            y >= rect.top &&
            y <= rect.bottom
        ) {
            return group
        }
    }
    return null
}

function onGlobalPointerMove(e: PointerEvent): void {
    if (isTouchDevice() || prefersReducedMotion()) return

    const group = findGroupForPointer(e.clientX, e.clientY)

    for (const g of groups.values()) {
        if (g !== group && g.active) {
            g.active = false
            g.pointer = null
            resetGroupTargets(g)
            requestGroupTick(g)
        }
    }

    if (!group) return

    const rect = group.container.getBoundingClientRect()
    group.pointer = {
        x: e.clientX - rect.left,
        y: e.clientY - rect.top,
    }
    group.bounds = { width: rect.width, height: rect.height }
    group.active = true

    computeTargets(group)
    requestGroupTick(group)
}

function onGlobalPointerLeave(): void {
    for (const group of groups.values()) {
        if (!group.active) continue
        group.active = false
        group.pointer = null
        resetGroupTargets(group)
        requestGroupTick(group)
    }
}

function computeTargets(group: GridGroup): void {
    if (!group.pointer) return

    for (const instance of group.instances.values()) {
        if (!instance.baseRect) {
            instance.target = IDENTITY_TRANSFORM
            continue
        }

        instance.target = computeItemTransform(
            instance.baseRect,
            group.pointer,
            group.bounds,
            instance.settings
        )
    }
}

function resetGroupTargets(group: GridGroup): void {
    for (const instance of group.instances.values()) {
        instance.target = IDENTITY_TRANSFORM
    }
}

function requestGroupTick(group: GridGroup): void {
    if (group.rafId != null) return
    group.rafId = requestAnimationFrame(() => tickGroup(group))
}

function tickGroup(group: GridGroup): void {
    group.rafId = null

    let needsAnotherFrame = false
    const smoothing = getGroupSmoothing(group)

    for (const instance of group.instances.values()) {
        const prev = instance.current
        const next = lerpTransform(prev, instance.target, smoothing)
        instance.current = next

        applyTransformToElement(instance.element, next)

        if (!isTransformSettled(next, instance.target)) {
            needsAnotherFrame = true
        }
    }

    if (needsAnotherFrame || group.active) {
        requestGroupTick(group)
    }
}

function getGroupSmoothing(group: GridGroup): number {
    const first = group.instances.values().next().value as
        | GridInstance
        | undefined
    if (!first) return 0.15
    return clamp(first.settings.smoothing, 0.02, 1)
}

function updateGroupSettings(container: HTMLElement, settings: GridSettings): void {
    const group = groups.get(container)
    if (!group) return

    for (const instance of group.instances.values()) {
        instance.settings = settings
    }

    if (group.active && group.pointer) {
        computeTargets(group)
        requestGroupTick(group)
    }
}

function registerInstance(
    container: HTMLElement,
    instance: GridInstance
): () => void {
    const group = getOrCreateGroup(container)
    group.instances.set(instance.id, instance)

    const containerRect = container.getBoundingClientRect()
    group.bounds = { width: containerRect.width, height: containerRect.height }
    instance.baseRect = measureBaseRect(instance.element, containerRect)

    if (group.active && group.pointer) {
        instance.target = instance.baseRect
            ? computeItemTransform(
                  instance.baseRect,
                  group.pointer,
                  group.bounds,
                  instance.settings
              )
            : IDENTITY_TRANSFORM
        requestGroupTick(group)
    }

    return () => {
        const g = groups.get(container)
        if (!g) return

        applyTransformToElement(instance.element, IDENTITY_TRANSFORM)
        g.instances.delete(instance.id)

        if (g.instances.size === 0) {
            g.resizeObserver?.disconnect()
            groups.delete(container)
        }
    }
}

function syncGridInstances(
    container: HTMLElement,
    items: HTMLElement[],
    settings: GridSettings,
    idPrefix: string,
    existingIds: Map<HTMLElement, string>
): () => void {
    const group = groups.get(container)
    const activeIds = new Set<string>()
    const unregisters: Array<() => void> = []

    items.forEach((element, index) => {
        let id = existingIds.get(element)
        if (!id) {
            id = `${idPrefix}-item-${index}`
            existingIds.set(element, id)
        }
        activeIds.add(id)

        if (group?.instances.has(id)) {
            const instance = group.instances.get(id)!
            instance.element = element
            instance.settings = settings
            instance.baseRect = measureBaseRect(
                element,
                container.getBoundingClientRect()
            )
            return
        }

        const instance: GridInstance = {
            id,
            element,
            baseRect: null,
            current: { ...IDENTITY_TRANSFORM },
            target: { ...IDENTITY_TRANSFORM },
            settings,
        }

        unregisters.push(registerInstance(container, instance))
    })

    if (group) {
        for (const [id, instance] of group.instances) {
            if (!activeIds.has(id)) {
                applyTransformToElement(instance.element, IDENTITY_TRANSFORM)
                group.instances.delete(id)
            }
        }

        if (group.instances.size === 0) {
            group.resizeObserver?.disconnect()
            groups.delete(container)
        }
    }

    for (const [element, id] of existingIds) {
        if (!items.includes(element)) existingIds.delete(element)
    }

    return () => {
        unregisters.forEach(fn => fn())
    }
}

// ─── Component ───────────────────────────────────────────────────────────────

/**
 * @framerDisableUnlink
 * @framerSupportedLayoutWidth any
 * @framerSupportedLayoutHeight any
 * @framerIntrinsicWidth 800
 * @framerIntrinsicHeight 600
 */
export default function CMS_MagneticImageGrid(
    props: CMSMagneticImageGridProps
) {
    const {
        collection,
        maxScale = 1.8,
        minScale = 0.55,
        radius = 280,
        smoothing = 0.15,
    } = props

    const rootRef = useRef<HTMLDivElement>(null)
    const containerRef = useRef<HTMLElement | null>(null)
    const itemIdMapRef = useRef<Map<HTMLElement, string>>(new Map())
    const gridId = useId().replace(/:/g, "")
    const effectEnabledRef = useRef(true)

    const isCanvas =
        typeof RenderTarget !== "undefined" &&
        RenderTarget.current() === RenderTarget.canvas

    const hasCollection = Boolean(collection)

    const settings: GridSettings = useMemo(
        () => ({
            maxScale: clamp(maxScale, 1, 3),
            minScale: clamp(minScale, 0.2, 1),
            radius: clamp(radius, 50, 800),
            smoothing: clamp(smoothing, 0.02, 1),
        }),
        [maxScale, minScale, radius, smoothing]
    )

    useEffect(() => {
        if (isCanvas) return
        effectEnabledRef.current = !isTouchDevice() && !prefersReducedMotion()
    }, [isCanvas])

    useEffect(() => {
        if (isCanvas || !effectEnabledRef.current || !hasCollection) return

        const root = rootRef.current
        if (!root) return

        const scanAndSync = () => {
            const container = findCollectionContainerInRoot(root)
            if (!container) return

            containerRef.current = container

            const items = findAllCollectionItems(container)
            if (items.length === 0) return

            syncGridInstances(
                container,
                items,
                settings,
                gridId,
                itemIdMapRef.current
            )
        }

        scanAndSync()

        const mutationObserver = new MutationObserver(() => {
            scanAndSync()
        })

        mutationObserver.observe(root, {
            childList: true,
            subtree: true,
        })

        const resizeObserver = new ResizeObserver(() => {
            scanAndSync()
        })

        resizeObserver.observe(root)

        return () => {
            containerRef.current = null
            mutationObserver.disconnect()
            resizeObserver.disconnect()

            const container = findCollectionContainerInRoot(root)
            if (container) {
                const group = groups.get(container)
                if (group) {
                    for (const instance of group.instances.values()) {
                        applyTransformToElement(
                            instance.element,
                            IDENTITY_TRANSFORM
                        )
                    }
                    group.resizeObserver?.disconnect()
                    groups.delete(container)
                }
            }

            itemIdMapRef.current.clear()
        }
    }, [isCanvas, hasCollection, settings, gridId])

    useEffect(() => {
        if (isCanvas || !effectEnabledRef.current) return
        const container = containerRef.current
        if (!container) return
        updateGroupSettings(container, settings)
    }, [isCanvas, settings])

    const wrapperStyle: CSSProperties = {
        position: "relative",
        width: "100%",
        height: "100%",
        minHeight: isCanvas && !hasCollection ? 240 : undefined,
    }

    const placeholderStyle: CSSProperties = {
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        minHeight: 240,
        border: "1px dashed rgba(0, 0, 0, 0.25)",
        background: "rgba(0, 0, 0, 0.04)",
        color: "rgba(0, 0, 0, 0.45)",
        fontSize: 12,
        fontFamily: "Inter, system-ui, sans-serif",
        textAlign: "center",
        padding: 24,
        lineHeight: 1.5,
    }

    return (
        <div ref={rootRef} style={wrapperStyle}>
            {hasCollection ? (
                collection
            ) : isCanvas ? (
                <div style={placeholderStyle}>
                    Connect a CMS Collection List
                    <br />
                    Use the Collection outlet or property panel
                </div>
            ) : null}
        </div>
    )
}

CMS_MagneticImageGrid.displayName = "CMS Magnetic Image Grid"

addPropertyControls(CMS_MagneticImageGrid, {
    collection: {
        type: ControlType.ComponentInstance,
        title: "Collection",
        description:
            "Connect your CMS Collection List here. Filter it by project in the list settings.",
    },
    maxScale: {
        type: ControlType.Number,
        title: "Max Scale",
        defaultValue: 1.8,
        min: 1,
        max: 3,
        step: 0.05,
        description: "How large the focused image grows (1 = no growth).",
    },
    minScale: {
        type: ControlType.Number,
        title: "Min Scale",
        defaultValue: 0.55,
        min: 0.2,
        max: 1,
        step: 0.05,
        description: "How small distant images shrink.",
    },
    radius: {
        type: ControlType.Number,
        title: "Radius",
        defaultValue: 280,
        min: 50,
        max: 800,
        step: 10,
        unit: "px",
        description: "Falloff distance of the magnet effect.",
    },
    smoothing: {
        type: ControlType.Number,
        title: "Smoothing",
        defaultValue: 0.15,
        min: 0.02,
        max: 1,
        step: 0.01,
        description: "Motion damping per frame (lower = smoother).",
    },
})
