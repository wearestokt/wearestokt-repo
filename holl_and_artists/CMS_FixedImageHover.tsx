/**
 * CMS Fixed Image Hover — Framer Code Component
 *
 * Shows a CMS-bound image at a fixed position inside the **collection container**
 * when the user hovers a CMS Collection List item. The preview does not follow
 * the cursor and is not anchored to the individual item — it stays in one spot
 * relative to the whole collection list (e.g. top-right of the list area).
 *
 * Setup:
 * 1. Assets → Code → + → Code Component → paste this file
 * 2. Open your CMS Collection List → edit the item template
 * 3. Add this component as a child layer (anywhere in the item — it is only
 *    used for CMS binding and hover detection; the image renders in the list)
 * 4. In the property panel, bind Image to your collection's image field
 * 5. Set this component's Pointer Events → None
 * 6. Ensure the card/content layer has Pointer Events → Auto
 * 7. Tune anchor, offset, image width, and fade in the property panel (height fits image)
 *
 * @framerDisableUnlink
 * @framerSupportedLayoutWidth any
 * @framerSupportedLayoutHeight any
 * @framerIntrinsicWidth 1
 * @framerIntrinsicHeight 1
 */

import {
    useEffect,
    useMemo,
    useRef,
    useState,
    type CSSProperties,
} from "react"
import { createPortal } from "react-dom"
import {
    addPropertyControls,
    ControlType,
    // @ts-expect-error RenderTarget is provided by Framer at runtime
    RenderTarget,
} from "framer"

// ─── Types ───────────────────────────────────────────────────────────────────

type ResponsiveImageValue = {
    src?: string
    srcSet?: string
    alt?: string
}

type ImageFieldValue = string | ResponsiveImageValue | null | undefined

type Anchor =
    | "topLeft"
    | "topRight"
    | "bottomLeft"
    | "bottomRight"
    | "center"

export interface CMSFixedImageHoverProps {
    image?: ResponsiveImageValue
    imageUrl?: string
    /** Manual preview width — named imageWidth to avoid Framer layout `width` prop collision. */
    imageWidth?: number
    offsetX?: number
    offsetY?: number
    anchor?: Anchor
    borderRadius?: number
    fadeInMs?: number
    fadeOutMs?: number
    zIndex?: number
    scaleOnShow?: boolean
}

// ─── Image helpers ───────────────────────────────────────────────────────────

function trimUrl(raw: string | undefined | null): string | undefined {
    if (raw == null) return undefined
    const s = String(raw).trim()
    return s.length > 0 ? s : undefined
}

function resolveImageUrl(field: ImageFieldValue): string | undefined {
    if (field == null) return undefined
    if (typeof field === "string") return trimUrl(field)
    if (typeof field === "object") {
        const o = field as Record<string, unknown>
        const direct = trimUrl(
            [o.src, o.url, o.value, o.href].find(
                v => typeof v === "string"
            ) as string | undefined
        )
        if (direct) return direct
        const nested = o.image ?? o.file
        if (nested && typeof nested === "object") {
            const n = nested as Record<string, unknown>
            return trimUrl(
                [n.url, n.src].find(v => typeof v === "string") as
                    | string
                    | undefined
            )
        }
    }
    return undefined
}

function resolveImageSrcSet(field: ImageFieldValue): string | undefined {
    if (field == null || typeof field !== "object") return undefined
    const srcSet = (field as ResponsiveImageValue).srcSet
    return typeof srcSet === "string" && srcSet.trim().length > 0
        ? srcSet
        : undefined
}

function resolveImageAlt(field: ImageFieldValue): string | undefined {
    if (field == null || typeof field !== "object") return undefined
    const alt = (field as ResponsiveImageValue).alt
    return typeof alt === "string" && alt.trim().length > 0 ? alt : undefined
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

function findCollectionListItem(start: HTMLElement | null): HTMLElement | null {
    if (!start) return null

    for (const selector of COLLECTION_ITEM_SELECTORS) {
        const match = start.closest(selector)
        if (match instanceof HTMLElement) return match
    }

    let node: HTMLElement | null = start.parentElement
    let depth = 0
    while (node && depth < 8) {
        const rect = node.getBoundingClientRect()
        if (rect.width > 40 && rect.height > 40) return node
        node = node.parentElement
        depth += 1
    }

    return start.parentElement
}

function countCollectionItems(root: ParentNode): number {
    let total = 0
    for (const selector of COLLECTION_ITEM_SELECTORS) {
        total = Math.max(total, root.querySelectorAll(selector).length)
    }
    return total
}

function findCollectionContainer(item: HTMLElement | null): HTMLElement | null {
    if (!item) return null

    for (const selector of COLLECTION_CONTAINER_SELECTORS) {
        const match = item.closest(selector)
        if (match instanceof HTMLElement && match !== item) return match
    }

    let node: HTMLElement | null = item.parentElement
    while (node) {
        if (countCollectionItems(node) > 1) return node
        node = node.parentElement
    }

    return item.parentElement?.parentElement ?? item.parentElement
}

const POSITIONING_FLAG = "data-cms-fixed-hover-positioned"

function ensurePositioningContext(el: HTMLElement): (() => void) | undefined {
    const computed = window.getComputedStyle(el)
    if (computed.position !== "static") return undefined

    const count = Number(el.getAttribute(POSITIONING_FLAG) || "0") + 1
    el.setAttribute(POSITIONING_FLAG, String(count))

    const previous = el.style.position
    el.style.position = "relative"

    return () => {
        const next = Number(el.getAttribute(POSITIONING_FLAG) || "1") - 1
        if (next <= 0) {
            el.removeAttribute(POSITIONING_FLAG)
            el.style.position = previous
        } else {
            el.setAttribute(POSITIONING_FLAG, String(next))
        }
    }
}

function anchorStyles(
    anchor: Anchor,
    offsetX: number,
    offsetY: number
): CSSProperties {
    switch (anchor) {
        case "topRight":
            return {
                top: offsetY,
                right: offsetX,
                left: "auto",
                bottom: "auto",
            }
        case "bottomLeft":
            return {
                bottom: offsetY,
                left: offsetX,
                top: "auto",
                right: "auto",
            }
        case "bottomRight":
            return {
                bottom: offsetY,
                right: offsetX,
                top: "auto",
                left: "auto",
            }
        case "center":
            return {
                top: "50%",
                left: "50%",
                right: "auto",
                bottom: "auto",
            }
        case "topLeft":
        default:
            return {
                top: offsetY,
                left: offsetX,
                right: "auto",
                bottom: "auto",
            }
    }
}

function buildTransform(
    anchor: Anchor,
    offsetX: number,
    offsetY: number,
    scaleOnShow: boolean,
    isShown: boolean
): string | undefined {
    if (anchor === "center") {
        const scale = scaleOnShow ? (isShown ? 1 : 0.96) : 1
        return `translate(calc(-50% + ${offsetX}px), calc(-50% + ${offsetY}px)) scale(${scale})`
    }
    if (!scaleOnShow) return undefined
    return isShown ? "scale(1)" : "scale(0.96)"
}

// ─── Component ───────────────────────────────────────────────────────────────

/**
 * @framerDisableUnlink
 * @framerSupportedLayoutWidth any
 * @framerSupportedLayoutHeight any
 * @framerIntrinsicWidth 1
 * @framerIntrinsicHeight 1
 */
export default function CMS_FixedImageHover(props: CMSFixedImageHoverProps) {
    const {
        image,
        imageUrl = "",
        imageWidth = 200,
        offsetX = 0,
        offsetY = 0,
        anchor = "topRight",
        borderRadius = 0,
        fadeInMs = 250,
        fadeOutMs = 200,
        zIndex = 10,
        scaleOnShow = true,
    } = props

    const rootRef = useRef<HTMLDivElement>(null)
    const [visible, setVisible] = useState(false)
    const [collectionContainer, setCollectionContainer] =
        useState<HTMLElement | null>(null)

    const isCanvas =
        typeof RenderTarget !== "undefined" &&
        RenderTarget.current() === RenderTarget.canvas

    const resolvedSrc = useMemo(() => {
        const fromImage = resolveImageUrl(image)
        if (fromImage) return fromImage
        return trimUrl(imageUrl)
    }, [image, imageUrl])

    const resolvedSrcSet = useMemo(() => resolveImageSrcSet(image), [image])
    const resolvedAlt = useMemo(
        () => resolveImageAlt(image) ?? "Preview image",
        [image]
    )

    const hasImage = Boolean(resolvedSrc)
    const previewWidth = Math.min(
        1200,
        Math.max(40, Number(imageWidth) || 200)
    )
    const previewWidthPx = `${previewWidth}px`

    useEffect(() => {
        if (isCanvas) return

        const root = rootRef.current
        const item = findCollectionListItem(root)
        const container = findCollectionContainer(item)
        if (!container) return

        const restorePosition = ensurePositioningContext(container)
        setCollectionContainer(container)

        return () => {
            restorePosition?.()
            setCollectionContainer(null)
        }
    }, [isCanvas])

    useEffect(() => {
        if (isCanvas || !hasImage) return

        const root = rootRef.current
        const item = findCollectionListItem(root)
        if (!item) return

        const show = () => setVisible(true)
        const hide = () => setVisible(false)

        item.addEventListener("mouseenter", show)
        item.addEventListener("mouseleave", hide)

        return () => {
            item.removeEventListener("mouseenter", show)
            item.removeEventListener("mouseleave", hide)
        }
    }, [isCanvas, hasImage])

    useEffect(() => {
        if (!resolvedSrc) return
        const preload = new window.Image()
        preload.src = resolvedSrc
        if (resolvedSrcSet) preload.srcset = resolvedSrcSet
    }, [resolvedSrc, resolvedSrcSet])

    const showPlaceholder = isCanvas && !hasImage
    const showPreview = isCanvas && hasImage
    const isShown = visible || showPreview

    const anchorPosition = anchorStyles(anchor, offsetX, offsetY)
    const imageTransform = buildTransform(
        anchor,
        offsetX,
        offsetY,
        scaleOnShow,
        isShown
    )

    const anchorWrapperStyle: CSSProperties = {
        position: "absolute",
        width: "auto",
        height: "auto",
        maxWidth: "none",
        top: anchorPosition.top,
        left: anchorPosition.left,
        right: anchorPosition.right,
        bottom: anchorPosition.bottom,
        transform: imageTransform,
        opacity: showPlaceholder || showPreview || visible ? 1 : 0,
        visibility:
            showPlaceholder || showPreview || visible ? "visible" : "hidden",
        transition: showPreview
            ? "none"
            : [
                  `opacity ${visible ? fadeInMs : fadeOutMs}ms ease`,
                  `visibility ${visible ? fadeInMs : fadeOutMs}ms ease`,
                  `transform ${visible ? fadeInMs : fadeOutMs}ms ease`,
              ].join(", "),
        pointerEvents: "none",
        flex: "none",
        alignSelf: "flex-start",
        justifySelf: "start",
    }

    const imageFrameStyle: CSSProperties = {
        width: previewWidthPx,
        maxWidth: previewWidthPx,
        height: "auto",
        borderRadius,
        overflow: "hidden",
        boxSizing: "border-box",
        lineHeight: 0,
    }

    const imgStyle: CSSProperties = {
        display: "block",
        width: previewWidthPx,
        maxWidth: previewWidthPx,
        height: "auto",
        pointerEvents: "none",
    }

    const placeholderStyle: CSSProperties = {
        ...imageFrameStyle,
        position: "relative",
        minHeight: 80,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        border: "1px dashed rgba(0, 0, 0, 0.25)",
        background: "rgba(0, 0, 0, 0.04)",
        color: "rgba(0, 0, 0, 0.45)",
        fontSize: 11,
        fontFamily: "Inter, system-ui, sans-serif",
        textAlign: "center",
        padding: 8,
        lineHeight: 1.35,
    }

    const portalOverlay =
        !isCanvas && collectionContainer && hasImage
            ? createPortal(
                  <div
                      style={{
                          ...anchorWrapperStyle,
                          zIndex,
                      }}
                      aria-hidden={!visible}
                  >
                      <div style={imageFrameStyle}>
                          <img
                              src={resolvedSrc}
                              srcSet={resolvedSrcSet}
                              alt={resolvedAlt}
                              style={imgStyle}
                              draggable={false}
                          />
                      </div>
                  </div>,
                  collectionContainer
              )
            : null

    const canvasContent = showPlaceholder ? (
        <div style={placeholderStyle}>
            Bind CMS image
            <br />
            Preview renders in collection
        </div>
    ) : showPreview ? (
        <div
            style={{
                ...imageFrameStyle,
                border: "1px solid rgba(0,0,0,0.12)",
            }}
        >
            <img
                src={resolvedSrc}
                srcSet={resolvedSrcSet}
                alt={resolvedAlt}
                style={imgStyle}
                draggable={false}
            />
        </div>
    ) : null

    return (
        <>
            <div
                ref={rootRef}
                style={
                    isCanvas
                        ? {
                              position: "relative",
                              width: "auto",
                              height: "auto",
                              pointerEvents: "none",
                          }
                        : {
                              position: "absolute",
                              width: 1,
                              height: 1,
                              overflow: "hidden",
                              pointerEvents: "none",
                              opacity: 0,
                          }
                }
                aria-hidden={!isCanvas}
            >
                {isCanvas ? canvasContent : null}
            </div>
            {!isCanvas ? portalOverlay : null}
        </>
    )
}

CMS_FixedImageHover.displayName = "CMS Fixed Image Hover"

addPropertyControls(CMS_FixedImageHover, {
    image: {
        type: ControlType.ResponsiveImage,
        title: "Image",
        description: "Bind to your CMS collection image field.",
    },
    imageUrl: {
        type: ControlType.String,
        title: "Image URL",
        placeholder: "https://…",
        description: "Optional fallback if Image is not bound.",
    },
    imageWidth: {
        type: ControlType.Number,
        title: "Image Width",
        defaultValue: 200,
        min: 40,
        max: 1200,
        step: 1,
        unit: "px",
        description: "Preview width in px. Height fits the image aspect ratio.",
    },
    offsetX: {
        type: ControlType.Number,
        title: "Offset X",
        defaultValue: 24,
        min: -500,
        max: 500,
        step: 1,
        unit: "px",
        description: "From the collection container edge (per anchor).",
    },
    offsetY: {
        type: ControlType.Number,
        title: "Offset Y",
        defaultValue: 24,
        min: -500,
        max: 500,
        step: 1,
        unit: "px",
        description: "From the collection container edge (per anchor).",
    },
    anchor: {
        type: ControlType.Enum,
        title: "Anchor",
        options: ["topLeft", "topRight", "bottomLeft", "bottomRight", "center"],
        optionTitles: [
            "Top Left",
            "Top Right",
            "Bottom Left",
            "Bottom Right",
            "Center",
        ],
        defaultValue: "topRight",
        description: "Fixed corner/edge inside the collection list container.",
    },
    borderRadius: {
        type: ControlType.Number,
        title: "Radius",
        defaultValue: 0,
        min: 0,
        max: 200,
        step: 1,
        unit: "px",
    },
    fadeInMs: {
        type: ControlType.Number,
        title: "Fade In",
        defaultValue: 250,
        min: 0,
        max: 2000,
        step: 10,
        unit: "ms",
    },
    fadeOutMs: {
        type: ControlType.Number,
        title: "Fade Out",
        defaultValue: 200,
        min: 0,
        max: 2000,
        step: 10,
        unit: "ms",
    },
    zIndex: {
        type: ControlType.Number,
        title: "Z-Index",
        defaultValue: 10,
        min: 0,
        max: 100,
        step: 1,
    },
    scaleOnShow: {
        type: ControlType.Boolean,
        title: "Scale On Show",
        defaultValue: true,
        enabledTitle: "On",
        disabledTitle: "Off",
    },
})
