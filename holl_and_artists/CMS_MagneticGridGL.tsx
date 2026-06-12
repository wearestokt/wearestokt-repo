/**
 * CMS Magnetic Grid — Framer Code Component
 *
 * Component-managed image grid with a smooth cursor-proximity scale magnet.
 * The connected Collection List is image source only (hidden). Layout is
 * controlled via Columns and Gap. Image height follows each
 * image's aspect ratio (Fit Image); all columns share the same width.
 *
 * Motion is driven by compositor CSS transitions (no per-frame JS): the
 * browser rasterizes each animated layer at the transition's max scale,
 * so hovered images stay sharp during and after the animation.
 *
 * Setup:
 * 1. Assets → Code → + → Code Component → paste this file
 * 2. Add to your page (width: Fill or fixed)
 * 3. Connect CMS Collection List to **Collection** (image field in item template)
 * 4. Tune Columns, Gap, Min Gap, Max/Min Scale, Smoothing, Interaction, Lightbox
 *
 * @framerDisableUnlink
 * @framerSupportedLayoutWidth any
 * @framerSupportedLayoutHeight any
 * @framerIntrinsicWidth 800
 * @framerIntrinsicHeight 600
 */

import {
    useCallback,
    useEffect,
    useMemo,
    useRef,
    useState,
    type CSSProperties,
    type MouseEvent,
    type PointerEvent as ReactPointerEvent,
    type ReactNode,
} from "react"
import { createPortal } from "react-dom"
import { addPropertyControls, ControlType, RenderTarget } from "framer"

// ─── Types ───────────────────────────────────────────────────────────────────

export interface CMSMagneticGridGLProps {
    collection?: ReactNode
    columns?: number
    gap?: number
    minGap?: number
    maxScale?: number
    minScale?: number
    smoothing?: number
    cornerRadius?: number
    switchHold?: number
    lightbox?: boolean
    /** Set per breakpoint via Framer's Desktop / Tablet / Phone selector. */
    interaction?: InteractionBehavior
}

type InteractionBehavior = "hover" | "scroll" | "off"

const INTERACTION_OPTIONS: InteractionBehavior[] = ["hover", "scroll", "off"]
const INTERACTION_TITLES = ["Hover", "Scroll Focus", "Off"]

type LayoutSettings = {
    columns: number
    gap: number
}

type EffectSettings = {
    maxScale: number
    minScale: number
    minGap: number
    smoothing: number
    cornerRadius: number
    switchHold: number
}

type BaseRect = {
    cx: number
    cy: number
    width: number
    height: number
    x: number
    y: number
}

type ImageSource = {
    element: HTMLElement
    img: HTMLImageElement | null
    src: string
    index: number
}

type OriginX = "left" | "center" | "right"
type OriginY = "top" | "center" | "bottom"

type AppliedState = {
    dx: number
    dy: number
    scale: number
    originX: OriginX
    originY: OriginY
}

type GridCell = {
    id: string
    src: string
    fullSrc: string
    alt: string
    /** Natural width ÷ height, used for the cell's aspect-ratio box. */
    ratio: number
    domElement: HTMLElement
    base: BaseRect
    dx: number
    dy: number
    scale: number
    originX: OriginX
    originY: OriginY
    /** Last values written to the DOM, to skip redundant style writes. */
    applied?: AppliedState
}

type PreviewCell = {
    id: string
    src: string
    fullSrc: string
    alt: string
    ratio: number
}

type LightboxRect = {
    top: number
    left: number
    width: number
    height: number
}

type LightboxPhase = "enter" | "open" | "exit"

type LightboxSession = {
    index: number
    /** Open: start rect. Exit: target grid rect. */
    fromRect: LightboxRect
    phase: LightboxPhase
    /** Actual decoded src at click — matches grid pixels on frame 0. */
    displaySrc?: string
    enterTransitionReady?: boolean
    enterAnimating?: boolean
    exitAnimating?: boolean
}

const LIGHTBOX_EASE = "cubic-bezier(0.22, 1, 0.36, 1)"
const LIGHTBOX_IMAGE_MS = 520
const LIGHTBOX_BG_MS = 420
const LIGHTBOX_CHROME_DELAY_MS = 140

function lightboxChromeTransition(phase: LightboxPhase): string {
    return phase === "exit"
        ? `opacity ${LIGHTBOX_BG_MS}ms ${LIGHTBOX_EASE}`
        : `opacity ${LIGHTBOX_BG_MS}ms ${LIGHTBOX_EASE} ${LIGHTBOX_CHROME_DELAY_MS}ms`
}

function getCellBaseClientRect(
    wrapper: HTMLElement | null,
    cell: GridCell | undefined
): LightboxRect | null {
    if (!wrapper || !cell) return null
    const wr = wrapper.getBoundingClientRect()
    const b = cell.base
    return {
        top: wr.top + b.y,
        left: wr.left + b.x,
        width: b.width,
        height: b.height,
    }
}

function computeLightboxEndRect(ratio: number): LightboxRect {
    const vw = window.innerWidth
    const vh = window.innerHeight
    const padX = 80
    const padY = 48
    const availW = Math.max(1, vw - padX * 2)
    const availH = Math.max(1, vh - padY * 2)
    let width = availW
    let height = width / ratio
    if (height > availH) {
        height = availH
        width = height * ratio
    }
    return {
        top: (vh - height) / 2,
        left: (vw - width) / 2,
        width,
        height,
    }
}

// ─── Constants ───────────────────────────────────────────────────────────────

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

const FRAMER_ITEM_SELECTORS = [
    "[data-framer-cms-item]",
    "[data-framer-collection-item]",
    "[data-framer-name][data-framer-component-type='CollectionItem']",
]

// ─── Utilities ───────────────────────────────────────────────────────────────

function clamp(v: number, min: number, max: number): number {
    return Math.min(max, Math.max(min, v))
}

function prefersReducedMotion(): boolean {
    if (typeof window === "undefined") return false
    return window.matchMedia("(prefers-reduced-motion: reduce)").matches
}

const ROW_GROUP_TOLERANCE = 8
const ROW_FOCUS_HYSTERESIS_PX = 24
const INDEX_FOCUS_HYSTERESIS = 0.12

type GridRow = {
    y: number
    top: number
    bottom: number
    indices: number[]
}

function groupCellsIntoRows(cells: GridCell[]): GridRow[] {
    const rows: GridRow[] = []

    for (let i = 0; i < cells.length; i++) {
        const b = cells[i].base
        if (b.width <= 0 || b.height <= 0) continue

        let row = rows.find(r => Math.abs(r.y - b.y) < ROW_GROUP_TOLERANCE)
        if (!row) {
            row = { y: b.y, top: b.y, bottom: b.y + b.height, indices: [] }
            rows.push(row)
        }
        row.indices.push(i)
        row.top = Math.min(row.top, b.y)
        row.bottom = Math.max(row.bottom, b.y + b.height)
    }

    for (const row of rows) {
        row.indices.sort((a, b) => cells[a].base.x - cells[b].base.x)
    }

    rows.sort((a, b) => a.y - b.y)
    return rows
}

/**
 * Pick the focused cell while scrolling on touch devices.
 * Active row = closest to viewport center; within the row, focus sweeps
 * left-to-right as the row passes through the center zone.
 */
function computeScrollFocusIndex(
    cells: GridCell[],
    wrapper: HTMLElement,
    currentIndex: number
): number {
    if (cells.length === 0) return -1

    const wrapperRect = wrapper.getBoundingClientRect()
    const viewportCenterY = window.innerHeight / 2

    if (
        wrapperRect.bottom < 0 ||
        wrapperRect.top > window.innerHeight ||
        wrapperRect.height <= 0
    ) {
        return -1
    }

    const rows = groupCellsIntoRows(cells)
    if (rows.length === 0) return -1

    const rowDistance = (row: GridRow) =>
        Math.abs(
            wrapperRect.top + (row.top + row.bottom) / 2 - viewportCenterY
        )

    let bestRow = rows[0]
    let bestDist = rowDistance(bestRow)

    for (let r = 1; r < rows.length; r++) {
        const dist = rowDistance(rows[r])
        if (dist < bestDist) {
            bestDist = dist
            bestRow = rows[r]
        }
    }

    if (currentIndex >= 0) {
        const currentRow = rows.find(row => row.indices.includes(currentIndex))
        if (currentRow && currentRow !== bestRow) {
            const currentDist = rowDistance(currentRow)
            if (currentDist <= bestDist + ROW_FOCUS_HYSTERESIS_PX) {
                bestRow = currentRow
            }
        }
    }

    const indices = bestRow.indices
    if (indices.length === 0) return -1
    if (indices.length === 1) return indices[0]

    const rowTopVp = wrapperRect.top + bestRow.top
    const rowBottomVp = wrapperRect.top + bestRow.bottom
    const rowHeight = Math.max(1, rowBottomVp - rowTopVp)
    const t = clamp((viewportCenterY - rowTopVp) / rowHeight, 0, 1)
    let localIndex = Math.round(t * (indices.length - 1))

    if (currentIndex >= 0) {
        const currentLocal = indices.indexOf(currentIndex)
        if (currentLocal >= 0 && currentLocal !== localIndex) {
            const threshold =
                indices.length > 1
                    ? currentLocal / (indices.length - 1)
                    : 0
            if (Math.abs(t - threshold) < INDEX_FOCUS_HYSTERESIS) {
                localIndex = currentLocal
            }
        }
    }

    return indices[localIndex]
}

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
    if (countCollectionItems(root) >= 1) return root
    return root
}

function normalizeSrcKey(src: string): string {
    try {
        const url = new URL(src, window.location.href)
        return `${url.origin}${url.pathname}`
    } catch {
        return src.split("?")[0]
    }
}

function getImageSrc(img: HTMLImageElement | null): string {
    if (!img) return ""
    return (
        img.currentSrc ||
        img.src ||
        img.getAttribute("src") ||
        ""
    ).trim()
}

function getImageAlt(img: HTMLImageElement | null): string {
    if (!img?.alt) return "Gallery image"
    return img.alt
}

function parseSrcset(srcset: string): { url: string; width: number }[] {
    return srcset
        .split(",")
        .map(part => {
            const tokens = part.trim().split(/\s+/)
            const url = tokens[0] ?? ""
            const desc = tokens[1] ?? ""
            const width = desc.endsWith("w") ? parseFloat(desc) : 0
            return { url, width: Number.isFinite(width) ? width : 0 }
        })
        .filter(c => c.url.length > 0)
}

/** Strip Framer's `scale-down-to` param to get the original file. */
function stripScaleDown(src: string): string {
    try {
        const url = new URL(src, window.location.href)
        if (url.searchParams.has("scale-down-to")) {
            url.searchParams.delete("scale-down-to")
            return url.toString()
        }
    } catch {
        // Keep original src if URL parsing fails
    }
    return src
}

/**
 * The hidden source list is 1×1, so the browser picks the smallest
 * responsive variant — upscaling it on hover looks blurry. Pick a srcset
 * candidate large enough for the hovered size; if none is big enough,
 * fall back to the original file (scale-down param removed).
 */
function pickBestImageSrc(
    img: HTMLImageElement | null,
    targetWidth: number
): string {
    if (!img) return ""

    const srcset = img.getAttribute("srcset") ?? ""
    if (srcset) {
        const candidates = parseSrcset(srcset).sort(
            (a, b) => a.width - b.width
        )
        const fit = candidates.find(c => c.width >= targetWidth)
        if (fit) return fit.url
        const largest = candidates[candidates.length - 1]
        if (largest) return stripScaleDown(largest.url)
    }

    const src = getImageSrc(img)
    return src ? stripScaleDown(src) : ""
}

/** Largest available source for the lightbox. */
function pickFullResImageSrc(img: HTMLImageElement | null): string {
    if (!img) return ""

    const srcset = img.getAttribute("srcset") ?? ""
    if (srcset) {
        const candidates = parseSrcset(srcset).sort(
            (a, b) => b.width - a.width
        )
        if (candidates[0]) return stripScaleDown(candidates[0].url)
    }

    const src = getImageSrc(img)
    return src ? stripScaleDown(src) : ""
}

function getWrapperWidth(wrapper: HTMLElement): number {
    let el: HTMLElement | null = wrapper
    for (let depth = 0; depth < 6 && el; depth++) {
        const rect = el.getBoundingClientRect()
        if (rect.width > 48) return rect.width
        if (el.offsetWidth > 48) return el.offsetWidth
        if (el.clientWidth > 48) return el.clientWidth
        el = el.parentElement
    }
    return 800
}

function measureCellRects(
    wrapper: HTMLElement,
    cellEls: (HTMLDivElement | null)[]
): BaseRect[] {
    const wrapperRect = wrapper.getBoundingClientRect()
    return cellEls.map(el => {
        if (!el) {
            return { x: 0, y: 0, width: 0, height: 0, cx: 0, cy: 0 }
        }
        const rect = el.getBoundingClientRect()
        const x = rect.left - wrapperRect.left
        const y = rect.top - wrapperRect.top
        return {
            x,
            y,
            width: rect.width,
            height: rect.height,
            cx: x + rect.width / 2,
            cy: y + rect.height / 2,
        }
    })
}

function findImageInItem(item: HTMLElement): HTMLImageElement | null {
    for (const node of item.querySelectorAll("img")) {
        if (!(node instanceof HTMLImageElement)) continue
        const src =
            node.currentSrc ||
            node.src ||
            node.getAttribute("src") ||
            ""
        if (src.trim().length > 0) return node
    }
    return null
}

function resolveImageSrc(item: HTMLElement): string {
    const img = findImageInItem(item)
    return img ? getImageSrc(img) : ""
}

function findCollectionItems(container: HTMLElement): HTMLElement[] {
    for (const selector of FRAMER_ITEM_SELECTORS) {
        const items = Array.from(
            container.querySelectorAll(selector)
        ).filter((el): el is HTMLElement => el instanceof HTMLElement)

        if (items.length > 0) {
            const leaves = items.filter(
                el =>
                    resolveImageSrc(el).length > 0 &&
                    !items.some(
                        other => other !== el && el.contains(other)
                    )
            )
            if (leaves.length > 0) return leaves
            return items.filter(el => resolveImageSrc(el).length > 0)
        }
    }
    return []
}

function dedupeImageSources(sources: ImageSource[]): ImageSource[] {
    const seenImgs = new Set<HTMLImageElement>()
    const seenSrcs = new Set<string>()
    const result: ImageSource[] = []

    for (const source of sources) {
        if (source.img && seenImgs.has(source.img)) continue
        const srcKey = source.src ? normalizeSrcKey(source.src) : ""
        if (srcKey && seenSrcs.has(srcKey)) continue
        if (source.img) seenImgs.add(source.img)
        if (srcKey) seenSrcs.add(srcKey)
        result.push({ ...source, index: result.length })
    }

    return result
}

function extractImageSources(root: HTMLElement): ImageSource[] {
    const container = findCollectionContainerInRoot(root) ?? root
    const items = findCollectionItems(container)

    if (items.length > 0) {
        return dedupeImageSources(
            items.map((element, index) => ({
                element,
                img: findImageInItem(element),
                src: resolveImageSrc(element),
                index,
            }))
        )
    }

    const seenImgs = new Set<HTMLImageElement>()
    const seenSrcs = new Set<string>()
    const fallback: ImageSource[] = []

    for (const img of root.querySelectorAll("img")) {
        if (!(img instanceof HTMLImageElement)) continue
        const src = getImageSrc(img)
        if (!src) continue
        const srcKey = normalizeSrcKey(src)
        if (seenImgs.has(img) || seenSrcs.has(srcKey)) continue
        seenImgs.add(img)
        seenSrcs.add(srcKey)
        fallback.push({
            element: img.parentElement ?? img,
            img,
            src,
            index: fallback.length,
        })
    }

    return fallback
}

// ─── Magnet targets (local push model) ───────────────────────────────────────
//
// Only the hovered image scales up. The space it needs is taken with this
// hierarchy: (1) compress surrounding gaps down to Min Gap, (2) push
// neighbor chains outward, (3) only if a chain hits the container edge,
// scale those neighbors down (never below Min Scale). Cells outside the
// push chains are completely untouched. Movement is purely translational
// and monotonic per chain, so images can never overlap or overflow.

type CellTarget = {
    dx: number
    dy: number
    scale: number
    originX: OriginX
    originY: OriginY
}

const IDENTITY_TARGET: CellTarget = {
    dx: 0,
    dy: 0,
    scale: 1,
    originX: "center",
    originY: "center",
}

function originXFromExpansion(el: number, er: number): OriginX {
    if (el <= 0.5 && er > 0.5) return "left"
    if (er <= 0.5 && el > 0.5) return "right"
    return "center"
}

function originYFromExpansion(et: number, eb: number): OriginY {
    if (et <= 0.5 && eb > 0.5) return "top"
    if (eb <= 0.5 && et > 0.5) return "bottom"
    return "center"
}

function anchorPoint(
    b: BaseRect,
    originX: OriginX,
    originY: OriginY
): { x: number; y: number } {
    return {
        x:
            originX === "left"
                ? b.x
                : originX === "right"
                  ? b.x + b.width
                  : b.cx,
        y:
            originY === "top"
                ? b.y
                : originY === "bottom"
                  ? b.y + b.height
                  : b.cy,
    }
}

function targetTranslate(
    b: BaseRect,
    originX: OriginX,
    originY: OriginY,
    newLeft: number,
    newRight: number,
    newTop: number,
    newBottom: number
): { dx: number; dy: number } {
    const anchor = anchorPoint(b, originX, originY)
    const targetX =
        originX === "left"
            ? newLeft
            : originX === "right"
              ? newRight
              : (newLeft + newRight) / 2
    const targetY =
        originY === "top"
            ? newTop
            : originY === "bottom"
              ? newBottom
              : (newTop + newBottom) / 2
    return { dx: targetX - anchor.x, dy: targetY - anchor.y }
}

function originFraction(axis: OriginX | OriginY): number {
    if (axis === "left" || axis === "top") return 0
    if (axis === "right" || axis === "bottom") return 1
    return 0.5
}

function visualBounds(b: BaseRect, t: CellTarget) {
    const fx = originFraction(t.originX)
    const fy = originFraction(t.originY)
    const w = b.width * t.scale
    const h = b.height * t.scale
    const ax = b.x + fx * b.width
    const ay = b.y + fy * b.height
    const left = ax + t.dx - fx * w
    const top = ay + t.dy - fy * h
    return { left, top, right: left + w, bottom: top + h }
}

function computeContentHeight(
    cells: GridCell[],
    targets: CellTarget[]
): number {
    let maxBottom = 0
    for (let i = 0; i < cells.length; i++) {
        const b = cells[i].base
        if (b.width <= 0 || b.height <= 0) continue
        maxBottom = Math.max(maxBottom, visualBounds(b, targets[i]).bottom)
    }
    return maxBottom
}

type PackItem = { index: number; start: number; size: number }
type PackedItem = { index: number; start: number; size: number }

function rangesOverlap(
    a0: number,
    a1: number,
    b0: number,
    b1: number
): boolean {
    return a0 < b1 - 0.5 && b0 < a1 - 0.5
}

/**
 * Lay out a chain of neighbors on one side of the hovered image.
 * Items are ordered outward from the hovered cell. Each item stays at its
 * original position until the gap to the previous (pushed) item compresses
 * to minGap, then it translates. If the chain hits the wall, items shrink
 * proportionally (floored at minScale).
 */
function packSide(
    items: PackItem[],
    origin: number,
    wall: number,
    dir: 1 | -1,
    minGap: number,
    minScale: number
): PackedItem[] {
    if (items.length === 0) return []

    const place = (
        sizes: number[]
    ): { placed: PackedItem[]; overflow: number } => {
        const placed: PackedItem[] = []
        if (dir === 1) {
            let prevEnd = origin
            for (let i = 0; i < items.length; i++) {
                const start = Math.max(items[i].start, prevEnd + minGap)
                placed.push({ index: items[i].index, start, size: sizes[i] })
                prevEnd = start + sizes[i]
            }
            return { placed, overflow: Math.max(0, prevEnd - wall) }
        }
        let prevStart = origin
        for (let i = 0; i < items.length; i++) {
            const end = Math.min(
                items[i].start + items[i].size,
                prevStart - minGap
            )
            const start = end - sizes[i]
            placed.push({ index: items[i].index, start, size: sizes[i] })
            prevStart = start
        }
        return { placed, overflow: Math.max(0, wall - prevStart) }
    }

    const originalSizes = items.map(i => i.size)
    let result = place(originalSizes)

    if (result.overflow > 0) {
        const total = originalSizes.reduce((a, b) => a + b, 0)
        const ratio = Math.max(
            minScale,
            total > 0 ? (total - result.overflow) / total : 1
        )
        result = place(originalSizes.map(s => s * ratio))
    }

    if (result.overflow > 0) {
        // Shrink floor reached — clamp against the wall as a last resort.
        const placed = result.placed
        if (dir === 1) {
            let limit = wall
            for (let i = placed.length - 1; i >= 0; i--) {
                const end = Math.min(placed[i].start + placed[i].size, limit)
                placed[i].start = end - placed[i].size
                limit = placed[i].start - minGap
            }
        } else {
            let limit = wall
            for (let i = placed.length - 1; i >= 0; i--) {
                placed[i].start = Math.max(placed[i].start, limit)
                limit = placed[i].start + placed[i].size + minGap
            }
        }
    }

    return result.placed
}

/** Max distance the hovered edge can expand on one side. */
function sideCapacity(
    items: PackItem[],
    hoveredEdge: number,
    wall: number,
    dir: 1 | -1,
    minGap: number,
    minScale: number
): number {
    let cap = 0
    let prevEdge = hoveredEdge
    for (const item of items) {
        const gap =
            dir === 1
                ? item.start - prevEdge
                : prevEdge - (item.start + item.size)
        cap += Math.max(0, gap - minGap) + item.size * (1 - minScale)
        prevEdge = dir === 1 ? item.start + item.size : item.start
    }
    cap += dir === 1 ? Math.max(0, wall - prevEdge) : Math.max(0, prevEdge - wall)
    return Math.max(0, cap)
}

/**
 * Distribute expansion across the two sides proportionally to the room
 * available on each. A cell touching a container edge has zero capacity on
 * that side, so it stays anchored to the edge and grows inward only.
 */
function splitExpansion(
    total: number,
    capA: number,
    capB: number
): [number, number] {
    const capSum = capA + capB
    if (capSum <= 0) return [0, 0]
    const e = Math.min(total, capSum)
    let a = Math.min(e * (capA / capSum), capA)
    let b = Math.min(e - a, capB)
    a = Math.min(e - b, capA)
    return [a, b]
}

function computeMagnetTargets(
    cells: GridCell[],
    hoveredIndex: number,
    bounds: { width: number; height: number },
    settings: EffectSettings
): CellTarget[] {
    const targets: CellTarget[] = cells.map(() => ({ ...IDENTITY_TARGET }))
    const h = cells[hoveredIndex].base
    const { maxScale, minScale, minGap } = settings
    if (h.width <= 0 || h.height <= 0) return targets

    // Same-row cells (vertical overlap with hovered) get pushed horizontally.
    const leftRow: PackItem[] = []
    const rightRow: PackItem[] = []
    const sameRowSet = new Set<number>()

    for (let i = 0; i < cells.length; i++) {
        if (i === hoveredIndex) continue
        const b = cells[i].base
        if (rangesOverlap(b.y, b.y + b.height, h.y, h.y + h.height)) {
            sameRowSet.add(i)
            const item = { index: i, start: b.x, size: b.width }
            if (b.cx < h.cx) leftRow.push(item)
            else rightRow.push(item)
        }
    }
    leftRow.sort((a, b) => b.start - a.start)
    rightRow.sort((a, b) => a.start - b.start)

    // Snap sub-pixel capacities to zero so edge cells stay hard-anchored.
    const snap = (cap: number) => (cap < 1 ? 0 : cap)

    const capL = snap(sideCapacity(leftRow, h.x, 0, -1, minGap, minScale))
    const capR = snap(
        sideCapacity(
            rightRow,
            h.x + h.width,
            bounds.width,
            1,
            minGap,
            minScale
        )
    )

    // Provisional horizontal expansion (widest the image could get) to
    // find every column the expanded image may overlap.
    const sXCap =
        (h.width + Math.min((maxScale - 1) * h.width, capL + capR)) / h.width
    const provisionalScale = Math.max(1, Math.min(maxScale, sXCap))
    const [pel, per] = splitExpansion(
        (provisionalScale - 1) * h.width,
        capL,
        capR
    )
    const provLeft = h.x - pel
    const provRight = h.x + h.width + per

    // Group all overlapped cells by column. Vertical capacity must be the
    // minimum across these columns — an incomplete row gives the hovered
    // column more room than its neighbors, and growing past a neighbor
    // column's capacity would overlap its images.
    const columns = new Map<number, { above: PackItem[]; below: PackItem[] }>()
    for (let i = 0; i < cells.length; i++) {
        if (i === hoveredIndex || sameRowSet.has(i)) continue
        const b = cells[i].base
        if (
            !rangesOverlap(
                b.x,
                b.x + b.width,
                provLeft - minGap,
                provRight + minGap
            )
        ) {
            continue
        }
        const key = Math.round(b.x / 8)
        let group = columns.get(key)
        if (!group) {
            group = { above: [], below: [] }
            columns.set(key, group)
        }
        const item = { index: i, start: b.y, size: b.height }
        if (b.cy < h.cy) group.above.push(item)
        else group.below.push(item)
    }

    let capT = snap(h.y)
    let capB = snap(bounds.height - (h.y + h.height))
    for (const group of columns.values()) {
        group.above.sort((a, b) => b.start - a.start)
        group.below.sort((a, b) => a.start - b.start)
        capT = Math.min(
            capT,
            snap(sideCapacity(group.above, h.y, 0, -1, minGap, minScale))
        )
        capB = Math.min(
            capB,
            snap(
                sideCapacity(
                    group.below,
                    h.y + h.height,
                    bounds.height,
                    1,
                    minGap,
                    minScale
                )
            )
        )
    }

    // Single-row grids: anchor top, grow downward into fresh space below the
    // row (container height will follow — no overflow crop).
    if (columns.size === 0) {
        capT = 0
        capB = Math.max(capB, (maxScale - 1) * h.height)
    }

    const sY =
        (h.height + Math.min((maxScale - 1) * h.height, capT + capB)) /
        h.height
    const scale = Math.max(1, Math.min(provisionalScale, sY))

    const [el, er] = splitExpansion((scale - 1) * h.width, capL, capR)
    const [et, eb] = splitExpansion((scale - 1) * h.height, capT, capB)

    const newLeft = h.x - el
    const newRight = h.x + h.width + er
    const newTop = h.y - et
    const newBottom = h.y + h.height + eb

    const originX = originXFromExpansion(el, er)
    const originY = originYFromExpansion(et, eb)
    const { dx, dy } = targetTranslate(
        h,
        originX,
        originY,
        newLeft,
        newRight,
        newTop,
        newBottom
    )

    targets[hoveredIndex] = { dx, dy, scale, originX, originY }

    // Horizontal push within the hovered row.
    const applyHorizontal = (placed: PackedItem[]) => {
        for (const p of placed) {
            const b = cells[p.index].base
            targets[p.index] = {
                dx: p.start + p.size / 2 - b.cx,
                dy: 0,
                scale: b.width > 0 ? p.size / b.width : 1,
                originX: "center",
                originY: "top",
            }
        }
    }
    applyHorizontal(
        packSide(rightRow, newRight, bounds.width, 1, minGap, minScale)
    )
    applyHorizontal(packSide(leftRow, newLeft, 0, -1, minGap, minScale))

    // Vertical push for every overlapped column.
    const applyVertical = (placed: PackedItem[]) => {
        for (const p of placed) {
            const b = cells[p.index].base
            targets[p.index] = {
                dx: 0,
                dy: p.start + p.size / 2 - b.cy,
                scale: b.height > 0 ? p.size / b.height : 1,
                originX: "center",
                originY: "center",
            }
        }
    }
    for (const group of columns.values()) {
        applyVertical(
            packSide(group.below, newBottom, bounds.height, 1, minGap, minScale)
        )
        applyVertical(packSide(group.above, newTop, 0, -1, minGap, minScale))
    }

    return targets
}

const MAGNET_EASING = "cubic-bezier(0.22, 1, 0.36, 1)"

/**
 * Write a cell's target transform as a CSS transition.
 *
 * Compositor-driven transitions are the key to both smoothness and
 * sharpness: the browser animates the transform off the main thread
 * (zero JS per frame) and rasterizes the layer at the *maximum* scale of
 * the transition — so the scaled-up image is never visibly upscaled,
 * during motion or at rest.
 */
function writeCellTarget(
    el: HTMLElement,
    cell: GridCell,
    target: CellTarget,
    durationMs: number
): void {
    const { dx, dy, scale, originX, originY } = target
    const a = cell.applied
    if (
        a &&
        Math.abs(a.dx - dx) < 0.05 &&
        Math.abs(a.dy - dy) < 0.05 &&
        Math.abs(a.scale - scale) < 0.0005 &&
        a.originX === originX &&
        a.originY === originY
    ) {
        return
    }

    el.style.transition =
        durationMs > 0
            ? `transform ${durationMs}ms ${MAGNET_EASING}`
            : "none"
    el.style.transformOrigin = `${originX} ${originY}`
    el.style.transform = `translate(${dx}px, ${dy}px) scale(${scale})`
    el.style.zIndex = scale > 1.001 ? "1" : ""
    cell.applied = { dx, dy, scale, originX, originY }
}

// ─── Component ───────────────────────────────────────────────────────────────

export default function CMS_MagneticGridGL(props: CMSMagneticGridGLProps) {
    const {
        collection,
        columns = 5,
        gap = 16,
        minGap = 16,
        maxScale = 2.2,
        minScale = 0.6,
        smoothing = 0.18,
        cornerRadius = 0,
        switchHold = 220,
        lightbox = true,
        interaction = "hover",
    } = props

    const wrapperRef = useRef<HTMLDivElement>(null)
    const sourceRef = useRef<HTMLDivElement>(null)
    const gridRef = useRef<HTMLDivElement>(null)
    const cellRefs = useRef<(HTMLDivElement | null)[]>([])
    const measureRafRef = useRef<number | null>(null)
    const cellsRef = useRef<GridCell[]>([])
    const boundsRef = useRef({ width: 1, height: 1 })
    const hoveredRef = useRef(-1)
    const pointerHoverActiveRef = useRef(false)
    const resetHoldTimerRef = useRef<number | null>(null)

    const layoutRef = useRef<LayoutSettings | null>(null)
    const effectRef = useRef<EffectSettings | null>(null)
    const syncRef = useRef<() => void>(() => {})

    const [gridCells, setGridCells] = useState<PreviewCell[]>([])
    const [lightboxSession, setLightboxSession] =
        useState<LightboxSession | null>(null)
    /** Decoded image index — may lag session.index during nav preload. */
    const [lightboxShownIndex, setLightboxShownIndex] = useState(0)
    /** Full-res layer faded in on top; grid stays opaque underneath. */
    const [lightboxShowFull, setLightboxShowFull] = useState(false)
    const previewRef = useRef<PreviewCell[]>([])
    const lightboxSessionRef = useRef<LightboxSession | null>(null)
    const lightboxGridLockedRef = useRef(false)
    const suppressGridClickUntilRef = useRef(0)
    const suppressHoverUntilRef = useRef(0)
    const lastPointerRef = useRef({ x: 0, y: 0, active: false })
    const scrollLockRef = useRef<{
        bodyOverflow: string
        bodyPaddingRight: string
        bodyPaddingBottom: string
        htmlOverflow: string
    } | null>(null)
    const lightboxCloseTimerRef = useRef<number | null>(null)
    const lightboxGridResetTimerRef = useRef<number | null>(null)
    const lightboxPreloadedIndexRef = useRef<number | null>(null)
    lightboxSessionRef.current = lightboxSession

    const isDesignCanvas =
        typeof RenderTarget !== "undefined" &&
        RenderTarget.current() === RenderTarget.canvas

    const hasCollection = Boolean(collection)

    const motionReduced = useMemo(() => {
        if (typeof window === "undefined") return true
        if (isDesignCanvas) return true
        if (prefersReducedMotion()) return true
        return false
    }, [isDesignCanvas])

    const hoverInteractionEnabled = !motionReduced && interaction === "hover"
    const scrollFocusEnabled = !motionReduced && interaction === "scroll"
    const interactionEnabled =
        hoverInteractionEnabled || scrollFocusEnabled

    const layoutSettings: LayoutSettings = useMemo(
        () => ({
            columns: clamp(Math.round(columns), 1, 12),
            gap: clamp(gap, 0, 120),
        }),
        [columns, gap]
    )

    const effectSettings: EffectSettings = useMemo(
        () => ({
            maxScale: clamp(maxScale, 1, 4),
            minScale: clamp(minScale, 0.15, 1),
            minGap: clamp(minGap, 0, 120),
            smoothing: clamp(smoothing, 0.05, 1),
            cornerRadius: clamp(cornerRadius, 0, 80),
            switchHold: clamp(switchHold, 0, 800),
        }),
        [maxScale, minScale, minGap, smoothing, cornerRadius, switchHold]
    )

    layoutRef.current = layoutSettings
    effectRef.current = effectSettings

    /**
     * Compute targets for a hovered cell (or reset for -1) and hand them
     * to the browser as CSS transitions. No per-frame JS runs after this.
     */
    const applyTargets = (
        hoveredIndex: number,
        options?: { force?: boolean; instant?: boolean }
    ) => {
        if (!options?.force && lightboxGridLockedRef.current) return

        const settings = effectRef.current
        if (!settings) return
        const cells = cellsRef.current

        const targets =
            hoveredIndex >= 0
                ? computeMagnetTargets(
                      cells,
                      hoveredIndex,
                      boundsRef.current,
                      settings
                  )
                : null
        const duration = options?.instant
            ? 0
            : Math.round(clamp(50 / settings.smoothing, 50, 1200))

        for (let i = 0; i < cells.length; i++) {
            const el = cellRefs.current[i]
            const cell = cells[i]
            if (!el || !cell) continue
            const t = targets ? targets[i] : IDENTITY_TARGET
            cell.dx = t.dx
            cell.dy = t.dy
            cell.scale = t.scale
            cell.originX = t.originX
            cell.originY = t.originY
            writeCellTarget(el, cell, t, duration)
        }

        const grid = gridRef.current
        if (grid) {
            if (targets && hoveredIndex >= 0) {
                const contentH = computeContentHeight(cells, targets)
                const baseH = boundsRef.current.height
                grid.style.transition =
                    duration > 0
                        ? `min-height ${duration}ms ${MAGNET_EASING}`
                        : "none"
                grid.style.minHeight = `${Math.max(baseH, contentH)}px`
            } else {
                grid.style.transition = ""
                grid.style.minHeight = ""
            }
        }
    }

    /** Snap grid to default behind the white overlay (lock stays on). */
    const resetGridBehindLightbox = (instant = true) => {
        hoveredRef.current = -1
        applyTargets(-1, { force: true, instant })
    }

    const resumeHoverIfPointerOverGrid = () => {
        if (!hoverInteractionEnabled) return
        if (performance.now() < suppressHoverUntilRef.current) return

        const { x, y, active } = lastPointerRef.current
        if (!active) return

        const wrapper = wrapperRef.current
        if (!wrapper) return

        const idx = hitTestCell(x, y)
        if (idx < 0) return

        pointerHoverActiveRef.current = true
        wrapper.style.cursor = "pointer"
        hoveredRef.current = idx
        applyTargets(idx)
    }

    /**
     * Hit-test against the cells' live rects (getBoundingClientRect
     * reflects in-flight transitions), preferring the currently hovered
     * cell for hysteresis so hover can't flip-flop mid-transition.
     */
    const hitTestCell = (clientX: number, clientY: number): number => {
        const els = cellRefs.current
        const contains = (i: number) => {
            const el = els[i]
            if (!el) return false
            const r = el.getBoundingClientRect()
            return (
                clientX >= r.left &&
                clientX <= r.right &&
                clientY >= r.top &&
                clientY <= r.bottom
            )
        }
        const prev = hoveredRef.current
        if (prev >= 0 && prev < els.length && contains(prev)) return prev
        for (let i = 0; i < els.length; i++) {
            if (contains(i)) return i
        }
        return -1
    }

    useEffect(() => {
        if (!hasCollection) return

        const wrapper = wrapperRef.current
        const source = sourceRef.current
        if (!wrapper || !source) return

        const measureLayout = () => {
            if (lightboxGridLockedRef.current || lightboxSessionRef.current) {
                return
            }

            const grid = gridRef.current
            if (!wrapper || !grid || cellsRef.current.length === 0) return

            grid.style.minHeight = ""

            // Disable transitions while measuring so the temporary clear
            // doesn't animate (no paint happens within this task).
            const savedTransforms: string[] = []
            for (let i = 0; i < cellRefs.current.length; i++) {
                const el = cellRefs.current[i]
                if (!el) continue
                savedTransforms[i] = el.style.transform
                el.style.transition = "none"
                el.style.transform = ""
            }

            const wrapperWidth = getWrapperWidth(wrapper)
            const rects = measureCellRects(wrapper, cellRefs.current)
            const gridHeight = grid.offsetHeight

            cellsRef.current = cellsRef.current.map((cell, index) => ({
                ...cell,
                base: rects[index] ?? cell.base,
                applied: undefined,
            }))

            boundsRef.current = {
                width: wrapperWidth,
                height: Math.max(1, gridHeight),
            }

            for (let i = 0; i < cellRefs.current.length; i++) {
                const el = cellRefs.current[i]
                if (!el) continue
                const cell = cellsRef.current[i]
                if (cell) {
                    writeCellTarget(
                        el,
                        cell,
                        {
                            dx: cell.dx,
                            dy: cell.dy,
                            scale: cell.scale,
                            originX: cell.originX,
                            originY: cell.originY,
                        },
                        0
                    )
                } else {
                    el.style.transform = savedTransforms[i] || ""
                }
            }

            // Bases changed — recompute targets for the active focus.
            if (pointerHoverActiveRef.current && hoveredRef.current >= 0) {
                applyTargets(hoveredRef.current)
            } else if (scrollFocusEnabled) {
                const idx = computeScrollFocusIndex(
                    cellsRef.current,
                    wrapper,
                    hoveredRef.current
                )
                hoveredRef.current = idx
                applyTargets(idx)
            } else if (interactionEnabled && hoveredRef.current >= 0) {
                applyTargets(hoveredRef.current)
            }
        }

        const scheduleMeasure = () => {
            if (measureRafRef.current != null) {
                cancelAnimationFrame(measureRafRef.current)
            }
            measureRafRef.current = requestAnimationFrame(() => {
                measureRafRef.current = requestAnimationFrame(() => {
                    measureRafRef.current = null
                    measureLayout()
                })
            })
        }

        const sync = () => {
            let sources = extractImageSources(source)
            if (sources.length === 0) sources = extractImageSources(wrapper)
            if (sources.length === 0) return

            // Resolution target: column width at full hover scale, in
            // physical pixels.
            const layout = layoutRef.current ?? layoutSettings
            const effect = effectRef.current
            const wrapperWidth = getWrapperWidth(wrapper)
            const colWidth =
                (wrapperWidth - (layout.columns - 1) * layout.gap) /
                layout.columns
            const dpr = Math.min(window.devicePixelRatio || 1, 2)
            const targetWidth =
                colWidth * (effect ? effect.maxScale : 2.2) * dpr

            const prev = cellsRef.current
            const nextCells: GridCell[] = sources.map((source, index) => {
                const img = source.img
                const ratio =
                    img && img.naturalWidth > 0 && img.naturalHeight > 0
                        ? img.naturalWidth / img.naturalHeight
                        : (prev[index]?.ratio ?? 0.75)
                const gridSrc =
                    pickBestImageSrc(img, targetWidth) ||
                    source.src ||
                    getImageSrc(img)
                const fullSrc =
                    pickFullResImageSrc(img) || gridSrc

                return {
                    id: `cell-${index}`,
                    src: gridSrc,
                    fullSrc,
                    alt: getImageAlt(img),
                    ratio,
                    domElement: source.element,
                    base: prev[index]?.base ?? {
                        x: 0,
                        y: 0,
                        width: 0,
                        height: 0,
                        cx: 0,
                        cy: 0,
                    },
                    dx: prev[index]?.dx ?? 0,
                    dy: prev[index]?.dy ?? 0,
                    scale: prev[index]?.scale ?? 1,
                    originX: prev[index]?.originX ?? "center",
                    originY: prev[index]?.originY ?? "center",
                }
            })

            cellsRef.current = nextCells

            // Only re-render and re-measure when the data actually changed —
            // the periodic syncs would otherwise cause constant layout work.
            const nextPreview: PreviewCell[] = nextCells.map(c => ({
                id: c.id,
                src: c.src,
                fullSrc: c.fullSrc,
                alt: c.alt,
                ratio: c.ratio,
            }))
            const lastPreview = previewRef.current
            const previewChanged =
                lastPreview.length !== nextPreview.length ||
                nextPreview.some((p, i) => {
                    const l = lastPreview[i]
                    return (
                        l.id !== p.id ||
                        l.src !== p.src ||
                        l.fullSrc !== p.fullSrc ||
                        l.alt !== p.alt ||
                        Math.abs(l.ratio - p.ratio) > 0.001
                    )
                })
            const sizeChanged =
                Math.abs(wrapperWidth - boundsRef.current.width) > 1

            if (previewChanged) {
                previewRef.current = nextPreview
                setGridCells(nextPreview)
            }

            for (const source of sources) {
                if (source.img && !source.img.complete) {
                    source.img.addEventListener("load", sync, { once: true })
                }
            }

            if (previewChanged || sizeChanged) scheduleMeasure()
        }

        syncRef.current = sync
        sync()

        let retries = 0
        const retryTimer = window.setInterval(() => {
            sync()
            retries += 1
            if (retries >= 60) window.clearInterval(retryTimer)
        }, 200)

        const mutationObserver = new MutationObserver(sync)
        mutationObserver.observe(source, { childList: true, subtree: true })

        const resizeObserver = new ResizeObserver(() => {
            sync()
        })
        resizeObserver.observe(wrapper)
        if (wrapper.parentElement) {
            resizeObserver.observe(wrapper.parentElement)
        }

        return () => {
            window.clearInterval(retryTimer)
            mutationObserver.disconnect()
            resizeObserver.disconnect()
            if (measureRafRef.current != null) {
                cancelAnimationFrame(measureRafRef.current)
            }
            pointerHoverActiveRef.current = false
            hoveredRef.current = -1
            cellsRef.current = []
        }
    }, [hasCollection, layoutSettings, interactionEnabled, scrollFocusEnabled])

    useEffect(() => {
        if (!hasCollection || motionReduced) return
        const wrapper = wrapperRef.current
        if (!wrapper) return

        pointerHoverActiveRef.current = false

        if (interaction === "scroll") {
            const idx = computeScrollFocusIndex(
                cellsRef.current,
                wrapper,
                -1
            )
            hoveredRef.current = idx
            applyTargets(idx)
        } else {
            hoveredRef.current = -1
            applyTargets(-1)
        }
    }, [interaction, hasCollection, motionReduced, gridCells.length])

    useEffect(() => {
        if (!hoverInteractionEnabled || !hasCollection) return

        const wrapper = wrapperRef.current
        if (!wrapper) return

        const cancelResetHold = () => {
            if (resetHoldTimerRef.current != null) {
                window.clearTimeout(resetHoldTimerRef.current)
                resetHoldTimerRef.current = null
            }
        }

        const scheduleResetHold = () => {
            if (lightboxGridLockedRef.current || lightboxSessionRef.current) {
                return
            }

            const holdMs = effectRef.current?.switchHold ?? 0
            if (holdMs <= 0) {
                if (hoveredRef.current !== -1) {
                    hoveredRef.current = -1
                    applyTargets(-1)
                }
                return
            }

            cancelResetHold()
            resetHoldTimerRef.current = window.setTimeout(() => {
                resetHoldTimerRef.current = null
                if (
                    lightboxGridLockedRef.current ||
                    lightboxSessionRef.current
                ) {
                    return
                }
                if (!pointerHoverActiveRef.current) return
                if (hoveredRef.current === -1) return
                hoveredRef.current = -1
                applyTargets(-1)
            }, holdMs)
        }

        const onPointerMove = (e: PointerEvent) => {
            lastPointerRef.current = {
                x: e.clientX,
                y: e.clientY,
                active: true,
            }

            // Per-input: fingers use scroll focus; mouse/pen keep hover.
            if (e.pointerType === "touch") return
            if (
                lightboxGridLockedRef.current ||
                lightboxSessionRef.current ||
                performance.now() < suppressHoverUntilRef.current
            ) {
                return
            }

            pointerHoverActiveRef.current = true
            const idx = hitTestCell(e.clientX, e.clientY)

            if (idx >= 0) {
                cancelResetHold()
                wrapper.style.cursor = "pointer"
                if (idx !== hoveredRef.current) {
                    hoveredRef.current = idx
                    applyTargets(idx)
                }
                return
            }

            // Cursor is over a gap — keep the current layout instead of
            // snapping back while moving toward the next image.
            wrapper.style.cursor =
                hoveredRef.current >= 0 ? "pointer" : "default"
            if (hoveredRef.current >= 0) {
                scheduleResetHold()
            }
        }

        const onPointerLeave = (e: PointerEvent) => {
            if (e.pointerType === "touch") return
            // Opening the lightbox triggers pointerleave before React
            // commits — the grid lock must already be set synchronously.
            if (
                lightboxGridLockedRef.current ||
                lightboxSessionRef.current
            ) {
                return
            }

            cancelResetHold()
            pointerHoverActiveRef.current = false
            wrapper.style.cursor = "default"

            if (scrollFocusEnabled) {
                const wrapperEl = wrapperRef.current
                if (!wrapperEl) return
                const idx = computeScrollFocusIndex(
                    cellsRef.current,
                    wrapperEl,
                    hoveredRef.current
                )
                if (idx !== hoveredRef.current) {
                    hoveredRef.current = idx
                    applyTargets(idx)
                }
            } else if (hoveredRef.current !== -1) {
                hoveredRef.current = -1
                applyTargets(-1)
            }
        }

        wrapper.addEventListener("pointermove", onPointerMove)
        wrapper.addEventListener("pointerleave", onPointerLeave)

        return () => {
            wrapper.removeEventListener("pointermove", onPointerMove)
            wrapper.removeEventListener("pointerleave", onPointerLeave)
            cancelResetHold()
            pointerHoverActiveRef.current = false
        }
    }, [hoverInteractionEnabled, scrollFocusEnabled, hasCollection, gridCells.length])

    useEffect(() => {
        if (!scrollFocusEnabled || !hasCollection) return

        const wrapper = wrapperRef.current
        if (!wrapper) return

        let scrollRaf: number | null = null

        const updateScrollFocus = () => {
            scrollRaf = null
            if (pointerHoverActiveRef.current) return
            if (
                lightboxGridLockedRef.current ||
                lightboxSessionRef.current
            ) {
                return
            }

            const idx = computeScrollFocusIndex(
                cellsRef.current,
                wrapper,
                hoveredRef.current
            )
            if (idx !== hoveredRef.current) {
                hoveredRef.current = idx
                applyTargets(idx)
            }
        }

        const scheduleScrollUpdate = () => {
            if (scrollRaf == null) {
                scrollRaf = requestAnimationFrame(updateScrollFocus)
            }
        }

        scheduleScrollUpdate()

        window.addEventListener("scroll", scheduleScrollUpdate, {
            passive: true,
        })
        window.addEventListener("resize", scheduleScrollUpdate, {
            passive: true,
        })

        return () => {
            window.removeEventListener("scroll", scheduleScrollUpdate)
            window.removeEventListener("resize", scheduleScrollUpdate)
            if (scrollRaf != null) cancelAnimationFrame(scrollRaf)
        }
    }, [scrollFocusEnabled, hasCollection, gridCells.length, interaction])

    const clearLightboxGridResetTimer = useCallback(() => {
        if (lightboxGridResetTimerRef.current != null) {
            window.clearTimeout(lightboxGridResetTimerRef.current)
            lightboxGridResetTimerRef.current = null
        }
    }, [])

    const lockPageScroll = useCallback(() => {
        if (scrollLockRef.current) return
        const scrollbarWidth = Math.max(
            0,
            window.innerWidth - document.documentElement.clientWidth
        )
        const scrollbarHeight = Math.max(
            0,
            window.innerHeight - document.documentElement.clientHeight
        )
        scrollLockRef.current = {
            bodyOverflow: document.body.style.overflow,
            bodyPaddingRight: document.body.style.paddingRight,
            bodyPaddingBottom: document.body.style.paddingBottom,
            htmlOverflow: document.documentElement.style.overflow,
        }
        document.documentElement.style.overflow = "hidden"
        document.body.style.overflow = "hidden"
        if (scrollbarWidth > 0) {
            document.body.style.paddingRight = `${scrollbarWidth}px`
        }
        if (scrollbarHeight > 0) {
            document.body.style.paddingBottom = `${scrollbarHeight}px`
        }
    }, [])

    const unlockPageScroll = useCallback(() => {
        const saved = scrollLockRef.current
        if (!saved) return
        document.body.style.overflow = saved.bodyOverflow
        document.body.style.paddingRight = saved.bodyPaddingRight
        document.body.style.paddingBottom = saved.bodyPaddingBottom
        document.documentElement.style.overflow = saved.htmlOverflow
        scrollLockRef.current = null
    }, [])

    const finishLightboxClose = useCallback(() => {
        for (const el of cellRefs.current) {
            if (el) el.style.visibility = ""
        }
        lightboxGridLockedRef.current = false
        lightboxSessionRef.current = null
        setLightboxSession(null)
        setLightboxShownIndex(0)
        setLightboxShowFull(false)
        lightboxPreloadedIndexRef.current = null

        suppressHoverUntilRef.current = performance.now() + 80
        window.setTimeout(() => {
            resumeHoverIfPointerOverGrid()
        }, 80)
    }, [hoverInteractionEnabled])

    const closeLightbox = useCallback(() => {
        if (resetHoldTimerRef.current != null) {
            window.clearTimeout(resetHoldTimerRef.current)
            resetHoldTimerRef.current = null
        }
        clearLightboxGridResetTimer()
        suppressGridClickUntilRef.current =
            performance.now() + LIGHTBOX_IMAGE_MS + 150

        setLightboxSession(session => {
            if (!session || session.phase === "exit") return session

            const cell = cellsRef.current[session.index]
            const baseRect = getCellBaseClientRect(
                wrapperRef.current,
                cell
            )
            if (!baseRect) {
                return { ...session, phase: "exit", exitAnimating: false }
            }
            return {
                ...session,
                phase: "exit",
                exitAnimating: false,
                fromRect: baseRect,
            }
        })
        if (lightboxCloseTimerRef.current != null) {
            window.clearTimeout(lightboxCloseTimerRef.current)
        }
        lightboxCloseTimerRef.current = window.setTimeout(() => {
            lightboxCloseTimerRef.current = null
            finishLightboxClose()
        }, LIGHTBOX_IMAGE_MS)
    }, [clearLightboxGridResetTimer, finishLightboxClose])

    const showLightboxPrev = useCallback(() => {
        setLightboxSession(session => {
            if (!session || session.phase !== "open" || session.index <= 0) {
                return session
            }
            return { ...session, index: session.index - 1 }
        })
    }, [])

    const showLightboxNext = useCallback(() => {
        setLightboxSession(session => {
            if (
                !session ||
                session.phase !== "open" ||
                session.index >= gridCells.length - 1
            ) {
                return session
            }
            return { ...session, index: session.index + 1 }
        })
    }, [gridCells.length])

    const openLightbox = useCallback((idx: number) => {
        lightboxGridLockedRef.current = true

        if (resetHoldTimerRef.current != null) {
            window.clearTimeout(resetHoldTimerRef.current)
            resetHoldTimerRef.current = null
        }
        clearLightboxGridResetTimer()

        const el = cellRefs.current[idx]
        if (!el) {
            lightboxGridLockedRef.current = false
            return
        }

        const r = el.getBoundingClientRect()
        const imgEl = el.querySelector("img")
        const displaySrc =
            (imgEl instanceof HTMLImageElement && imgEl.currentSrc) ||
            cellsRef.current[idx]?.src ||
            ""

        const session: LightboxSession = {
            index: idx,
            fromRect: {
                top: r.top,
                left: r.left,
                width: r.width,
                height: r.height,
            },
            phase: "enter",
            displaySrc,
            enterTransitionReady: false,
            enterAnimating: false,
        }

        setLightboxShownIndex(idx)
        setLightboxShowFull(false)
        lockPageScroll()
        lightboxSessionRef.current = session
        setLightboxSession(session)

        // Frame 0: portal paints over grid at hover rect. Frame 1: prime transition.
        // Frame 2: expand — browser animates from primed start (no snap/lag).
        requestAnimationFrame(() => {
            setLightboxSession(current =>
                current?.phase === "enter"
                    ? { ...current, enterTransitionReady: true }
                    : current
            )
            requestAnimationFrame(() => {
                setLightboxSession(current =>
                    current?.phase === "enter"
                        ? { ...current, enterAnimating: true }
                        : current
                )
            })
        })
    }, [clearLightboxGridResetTimer, lockPageScroll])

    const lightboxScrollLocked =
        lightboxSession != null && !isDesignCanvas
    useEffect(() => {
        if (!lightboxScrollLocked) return
        lockPageScroll()
        return unlockPageScroll
    }, [lightboxScrollLocked, lockPageScroll, unlockPageScroll])

    useEffect(() => {
        if (!lightboxSession || isDesignCanvas) return
        const idx = lightboxSession.index
        const cell = cellsRef.current[idx]
        if (!cell) return

        let cancelled = false

        const preloadFull = (gridSrc: string, fullSrc: string) => {
            if (!fullSrc || fullSrc === gridSrc) {
                setLightboxShowFull(false)
                return
            }
            setLightboxShowFull(false)
            const img = new Image()
            const reveal = () => {
                if (cancelled) return
                requestAnimationFrame(() => {
                    if (!cancelled) setLightboxShowFull(true)
                })
            }
            img.onload = reveal
            img.onerror = reveal
            img.src = fullSrc
            if (img.complete && img.naturalWidth > 0) reveal()
        }

        if (lightboxSession.phase === "enter") {
            setLightboxShownIndex(idx)
            lightboxPreloadedIndexRef.current = idx
            preloadFull(
                lightboxSession.displaySrc || cell.src,
                cell.fullSrc
            )
            return () => {
                cancelled = true
            }
        }

        if (lightboxPreloadedIndexRef.current === idx) return

        // Nav: drop to grid layer immediately (old image stays until new decodes).
        setLightboxShowFull(false)

        const gridImg = new Image()
        const onGridReady = () => {
            if (cancelled || !gridImg.complete || gridImg.naturalWidth === 0) {
                return
            }
            setLightboxShownIndex(idx)
            lightboxPreloadedIndexRef.current = idx
            preloadFull(cell.src, cell.fullSrc)
        }
        gridImg.onload = onGridReady
        gridImg.onerror = onGridReady
        gridImg.src = cell.src
        onGridReady()

        return () => {
            cancelled = true
            gridImg.onload = null
            gridImg.onerror = null
        }
    }, [lightboxSession?.index, isDesignCanvas])

    useEffect(() => {
        if (
            lightboxSession?.phase !== "enter" ||
            !lightboxSession.enterAnimating
        ) {
            return
        }

        const timer = window.setTimeout(() => {
            if (lightboxSessionRef.current?.phase !== "enter") return
            resetGridBehindLightbox(true)
            setLightboxSession(session =>
                session?.phase === "enter"
                    ? { ...session, phase: "open" }
                    : session
            )
        }, LIGHTBOX_IMAGE_MS)

        return () => window.clearTimeout(timer)

    }, [
        lightboxSession?.phase,
        lightboxSession?.enterAnimating,
        lightboxSession?.index,
    ])

    useEffect(() => {
        if (
            lightboxSession?.phase !== "exit" ||
            lightboxSession.exitAnimating
        ) {
            return
        }
        const id = requestAnimationFrame(() => {
            requestAnimationFrame(() => {
                setLightboxSession(session =>
                    session?.phase === "exit" && !session.exitAnimating
                        ? { ...session, exitAnimating: true }
                        : session
                )
            })
        })
        return () => cancelAnimationFrame(id)
    }, [lightboxSession?.phase, lightboxSession?.exitAnimating])

    const handlePointerDown = (e: ReactPointerEvent<HTMLDivElement>) => {
        if (
            lightboxSessionRef.current ||
            performance.now() < suppressGridClickUntilRef.current
        ) {
            return
        }
        if (!lightbox || isDesignCanvas || e.pointerType === "touch") return
        const idx = hitTestCell(e.clientX, e.clientY)
        if (idx < 0) return
        lightboxGridLockedRef.current = true
    }

    const handleGridClick = (e: MouseEvent<HTMLDivElement>) => {
        if (performance.now() < suppressGridClickUntilRef.current) return
        if (lightboxSessionRef.current) return

        const idx = hitTestCell(e.clientX, e.clientY)
        if (idx < 0) return

        if (lightbox && !isDesignCanvas) {
            e.preventDefault()
            e.stopPropagation()
            openLightbox(idx)
            return
        }

        const cell = cellsRef.current[idx]
        if (!cell) return
        const link = cell.domElement.querySelector("a")
        if (link instanceof HTMLAnchorElement) link.click()
        else cell.domElement.click()
    }

    useEffect(() => {
        if (lightboxSession === null || isDesignCanvas) return

        const onPointerMove = (e: PointerEvent) => {
            lastPointerRef.current = {
                x: e.clientX,
                y: e.clientY,
                active: true,
            }
        }
        window.addEventListener("pointermove", onPointerMove, {
            passive: true,
        })

        const onKeyDown = (e: KeyboardEvent) => {
            if (e.key === "Escape") closeLightbox()
            else if (e.key === "ArrowLeft") showLightboxPrev()
            else if (e.key === "ArrowRight") showLightboxNext()
        }

        window.addEventListener("keydown", onKeyDown)

        return () => {
            window.removeEventListener("pointermove", onPointerMove)
            window.removeEventListener("keydown", onKeyDown)
        }
    }, [
        lightboxSession,
        isDesignCanvas,
        closeLightbox,
        showLightboxPrev,
        showLightboxNext,
    ])

    useEffect(() => {
        if (
            lightboxSession != null &&
            lightboxSession.index >= gridCells.length
        ) {
            finishLightboxClose()
        }
    }, [gridCells.length, lightboxSession, finishLightboxClose])

    const wrapperStyle: CSSProperties = {
        position: "relative",
        width: "100%",
        display: "block",
        boxSizing: "border-box",
        minHeight: isDesignCanvas && !hasCollection ? 240 : undefined,
    }

    const hiddenSourceStyle: CSSProperties = {
        position: "absolute",
        width: 1,
        height: 1,
        left: 0,
        top: 0,
        opacity: 0,
        pointerEvents: "none",
        overflow: "hidden",
        zIndex: -1,
    }

    const gridStyle: CSSProperties = {
        display: "grid",
        gridTemplateColumns: `repeat(${layoutSettings.columns}, minmax(0, 1fr))`,
        gap: layoutSettings.gap,
        width: "100%",
        alignItems: "start",
        position: "relative",
        overflow: "visible",
    }

    const cellStyle: CSSProperties = {
        position: "relative",
        width: "100%",
        minWidth: 0,
        overflow: "visible",
        borderRadius: effectSettings.cornerRadius,
    }

    const imgStyle: CSSProperties = {
        position: "absolute",
        inset: 0,
        display: "block",
        width: "100%",
        height: "100%",
        objectFit: "cover",
        pointerEvents: "none",
        userSelect: "none",
        borderRadius: effectSettings.cornerRadius,
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

    const lightboxCell =
        lightboxSession != null
            ? gridCells[lightboxSession.index]
            : null
    const lightboxPhase = lightboxSession?.phase
    const lightboxAtFullscreen =
        lightboxPhase === "open" ||
        (lightboxPhase === "enter" && lightboxSession?.enterAnimating) ||
        (lightboxPhase === "exit" && !lightboxSession?.exitAnimating)
    const lightboxEndRect =
        lightboxCell && typeof window !== "undefined"
            ? computeLightboxEndRect(lightboxCell.ratio)
            : null
    const lightboxGridRect = lightboxSession?.fromRect ?? null
    const lightboxImageRect =
        lightboxAtFullscreen && lightboxEndRect
            ? lightboxEndRect
            : lightboxGridRect
    const lightboxChromeMounted =
        (lightboxPhase === "enter" && lightboxSession?.enterAnimating) ||
        lightboxPhase === "open" ||
        lightboxPhase === "exit"
    const lightboxChromeOpaque =
        (lightboxPhase === "enter" && lightboxSession?.enterAnimating) ||
        lightboxPhase === "open"
    const lightboxChromeFade: CSSProperties = {
        opacity: lightboxChromeOpaque ? 1 : 0,
        transition: lightboxChromeTransition(lightboxPhase ?? "enter"),
        pointerEvents: lightboxChromeOpaque ? "auto" : "none",
    }
    const hasLightboxPrev =
        lightboxChromeMounted && lightboxSession.index > 0
    const hasLightboxNext =
        lightboxChromeMounted &&
        lightboxSession.index < gridCells.length - 1
    const lightboxImageAnimating =
        (lightboxPhase === "enter" &&
            (lightboxSession?.enterTransitionReady ||
                lightboxSession?.enterAnimating)) ||
        lightboxPhase === "open" ||
        (lightboxPhase === "exit" && lightboxSession?.exitAnimating)
    const lightboxShownCell = gridCells[lightboxShownIndex] ?? lightboxCell
    const lightboxGridSrc =
        lightboxPhase === "enter" &&
        lightboxShownIndex === lightboxSession?.index &&
        lightboxSession?.displaySrc
            ? lightboxSession.displaySrc
            : lightboxShownCell?.src ?? ""
    const lightboxFullSrc = lightboxShownCell?.fullSrc ?? ""
    const lightboxSameRes =
        !lightboxFullSrc || lightboxFullSrc === lightboxGridSrc
    const lightboxImageTransition = lightboxImageAnimating
        ? `top ${LIGHTBOX_IMAGE_MS}ms ${LIGHTBOX_EASE}, left ${LIGHTBOX_IMAGE_MS}ms ${LIGHTBOX_EASE}, width ${LIGHTBOX_IMAGE_MS}ms ${LIGHTBOX_EASE}, height ${LIGHTBOX_IMAGE_MS}ms ${LIGHTBOX_EASE}, border-radius ${LIGHTBOX_IMAGE_MS}ms ${LIGHTBOX_EASE}`
        : "none"
    const lightboxOverlay =
        lightbox &&
        !isDesignCanvas &&
        lightboxSession &&
        lightboxCell &&
        lightboxImageRect &&
        typeof document !== "undefined"
            ? createPortal(
                  <div
                      role="dialog"
                      aria-modal="true"
                      aria-label={lightboxCell.alt}
                      style={{
                          position: "fixed",
                          inset: 0,
                          zIndex: 2147483646,
                          pointerEvents: "auto",
                      }}
                  >
                      <div
                          aria-hidden
                          style={{
                              position: "absolute",
                              inset: 0,
                              background: "#ffffff",
                              ...lightboxChromeFade,
                          }}
                          onPointerDown={e => {
                              e.preventDefault()
                              e.stopPropagation()
                              if (lightboxSession.phase === "open") {
                                  closeLightbox()
                              }
                          }}
                      />

                      <div
                          style={{
                              position: "fixed",
                              top: lightboxImageRect.top,
                              left: lightboxImageRect.left,
                              width: lightboxImageRect.width,
                              height: lightboxImageRect.height,
                              overflow: "hidden",
                              borderRadius: lightboxAtFullscreen
                                  ? 0
                                  : effectSettings.cornerRadius,
                              transition: lightboxImageTransition,
                              pointerEvents: "none",
                              zIndex: 1,
                              isolation: "isolate",
                          }}
                      >
                          <img
                              src={lightboxGridSrc}
                              alt={
                                  lightboxShowFull && !lightboxSameRes
                                      ? ""
                                      : lightboxShownCell?.alt ?? ""
                              }
                              aria-hidden={
                                  lightboxShowFull && !lightboxSameRes
                              }
                              draggable={false}
                              decoding="sync"
                              style={{
                                  position: "absolute",
                                  inset: 0,
                                  width: "100%",
                                  height: "100%",
                                  objectFit: "cover",
                              }}
                          />
                          {!lightboxSameRes ? (
                              <img
                                  src={lightboxFullSrc}
                                  alt={lightboxShownCell?.alt ?? ""}
                                  draggable={false}
                                  decoding="sync"
                                  style={{
                                      position: "absolute",
                                      inset: 0,
                                      width: "100%",
                                      height: "100%",
                                      objectFit: "cover",
                                      opacity: lightboxShowFull ? 1 : 0,
                                      transition: lightboxShowFull
                                          ? `opacity ${LIGHTBOX_BG_MS}ms ${LIGHTBOX_EASE}`
                                          : "none",
                                  }}
                              />
                          ) : null}
                      </div>

                      <button
                          type="button"
                          aria-label="Close"
                          onClick={e => {
                              e.stopPropagation()
                              closeLightbox()
                          }}
                          style={{
                              ...lightboxChromeStyle(),
                              ...lightboxChromeFade,
                          }}
                      >
                          <CloseIcon />
                      </button>

                      {hasLightboxPrev ? (
                          <button
                              type="button"
                              aria-label="Previous image"
                              onClick={e => {
                                  e.stopPropagation()
                                  showLightboxPrev()
                              }}
                              style={{
                                  ...lightboxNavStyle("left"),
                                  ...lightboxChromeFade,
                              }}
                          >
                              <ChevronIcon direction="left" />
                          </button>
                      ) : null}

                      {hasLightboxNext ? (
                          <button
                              type="button"
                              aria-label="Next image"
                              onClick={e => {
                                  e.stopPropagation()
                                  showLightboxNext()
                              }}
                              style={{
                                  ...lightboxNavStyle("right"),
                                  ...lightboxChromeFade,
                              }}
                          >
                              <ChevronIcon direction="right" />
                          </button>
                      ) : null}
                  </div>,
                  document.body
              )
            : null

    return (
        <div
            ref={wrapperRef}
            style={{
                ...wrapperStyle,
                pointerEvents:
                    lightboxSession && !isDesignCanvas ? "none" : undefined,
            }}
            onPointerDown={handlePointerDown}
            onClick={handleGridClick}
        >
            <div ref={sourceRef} style={hiddenSourceStyle} aria-hidden>
                {hasCollection ? collection : null}
            </div>

            {hasCollection && gridCells.length > 0 ? (
                <div ref={gridRef} style={gridStyle}>
                    {gridCells.map((cell, index) => (
                        <div
                            key={cell.id}
                            ref={el => {
                                cellRefs.current[index] = el
                            }}
                            style={{
                                ...cellStyle,
                                aspectRatio: String(cell.ratio),
                                visibility:
                                    lightboxSession?.index === index &&
                                    (lightboxSession.phase === "open" ||
                                        lightboxSession.phase === "exit" ||
                                        lightboxSession.enterTransitionReady ||
                                        lightboxSession.enterAnimating)
                                        ? "hidden"
                                        : "visible",
                            }}
                        >
                            {cell.src ? (
                                <img
                                    src={cell.src}
                                    alt={cell.alt}
                                    style={imgStyle}
                                    draggable={false}
                                    decoding="async"
                                    onLoad={() => syncRef.current()}
                                />
                            ) : (
                                <div
                                    style={{
                                        width: "100%",
                                        height: "100%",
                                        background: "rgba(0,0,0,0.06)",
                                    }}
                                />
                            )}
                        </div>
                    ))}
                </div>
            ) : null}

            {!hasCollection && isDesignCanvas ? (
                <div style={placeholderStyle}>
                    Connect a CMS Collection List
                    <br />
                    Grid layout managed by this component
                </div>
            ) : null}

            {hasCollection && gridCells.length === 0 && isDesignCanvas ? (
                <div style={placeholderStyle}>Loading CMS images…</div>
            ) : null}

            {lightboxOverlay}
        </div>
    )
}

function lightboxChromeStyle(): CSSProperties {
    return {
        position: "fixed",
        top: 28,
        left: 28,
        border: "none",
        background: "transparent",
        color: "#000000",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        cursor: "pointer",
        padding: 4,
        zIndex: 2,
    }
}

function lightboxNavStyle(side: "left" | "right"): CSSProperties {
    return {
        position: "fixed",
        top: "50%",
        left: side === "left" ? 28 : undefined,
        right: side === "right" ? 28 : undefined,
        transform: "translateY(-50%)",
        border: "none",
        background: "transparent",
        color: "#000000",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        cursor: "pointer",
        padding: 4,
        zIndex: 2,
    }
}

function CloseIcon() {
    return (
        <svg
            width="22"
            height="22"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            aria-hidden
        >
            <line x1="18" y1="6" x2="6" y2="18" />
            <line x1="6" y1="6" x2="18" y2="18" />
        </svg>
    )
}

function ChevronIcon({ direction }: { direction: "left" | "right" }) {
    return (
        <svg
            width="22"
            height="22"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
            aria-hidden
        >
            {direction === "left" ? (
                <polyline points="15 18 9 12 15 6" />
            ) : (
                <polyline points="9 18 15 12 9 6" />
            )}
        </svg>
    )
}

CMS_MagneticGridGL.displayName = "CMS Magnetic Grid GL"

addPropertyControls(CMS_MagneticGridGL, {
    collection: {
        type: ControlType.ComponentInstance,
        title: "Collection",
        description: "Image source only — layout is managed below.",
    },
    columns: {
        type: ControlType.Number,
        title: "Columns",
        defaultValue: 5,
        min: 1,
        max: 12,
        step: 1,
        displayStepper: true,
    },
    gap: {
        type: ControlType.Number,
        title: "Gap",
        defaultValue: 16,
        min: 0,
        max: 120,
        step: 1,
        unit: "px",
    },
    minGap: {
        type: ControlType.Number,
        title: "Min Gap",
        defaultValue: 16,
        min: 0,
        max: 120,
        step: 1,
        unit: "px",
        description: "Gaps around the hovered image compress to this.",
    },
    maxScale: {
        type: ControlType.Number,
        title: "Max Scale",
        defaultValue: 2.2,
        min: 1,
        max: 4,
        step: 0.05,
        description: "Hovered image target scale.",
    },
    minScale: {
        type: ControlType.Number,
        title: "Min Scale",
        defaultValue: 0.6,
        min: 0.15,
        max: 1,
        step: 0.05,
        description: "Smallest neighbors may shrink when squeezed.",
    },
    smoothing: {
        type: ControlType.Number,
        title: "Smoothing",
        defaultValue: 0.18,
        min: 0.05,
        max: 1,
        step: 0.01,
        description: "Lower = slower, softer motion. Higher = snappier.",
    },
    switchHold: {
        type: ControlType.Number,
        title: "Switch Hold",
        defaultValue: 220,
        min: 0,
        max: 800,
        step: 10,
        unit: "ms",
        description:
            "Keeps the layout settled while moving across gaps between images. 0 = instant reset.",
    },
    cornerRadius: {
        type: ControlType.Number,
        title: "Corner Radius",
        defaultValue: 0,
        min: 0,
        max: 80,
        step: 1,
        unit: "px",
    },
    interaction: {
        type: ControlType.Enum,
        title: "Interaction",
        defaultValue: "hover",
        options: INTERACTION_OPTIONS,
        optionTitles: INTERACTION_TITLES,
        description:
            "Switch Desktop / Tablet / Phone in the breakpoint bar, then set this per breakpoint.",
    },
    lightbox: {
        type: ControlType.Boolean,
        title: "Lightbox",
        defaultValue: true,
        enabledTitle: "On",
        disabledTitle: "Off",
        description: "Click an image to open it fullscreen with prev/next navigation.",
    },
})
