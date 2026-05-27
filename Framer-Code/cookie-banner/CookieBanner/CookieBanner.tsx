/**
 * Cookie Banner – Wrapper component. Renders children inside a fixed container.
 * Add your stack (message + CookieAcceptButton + CookieRejectButton + CookieCustomizeButton + CookieCustomizePanel) as children.
 * All show/hide together when consent is given.
 */

import { addPropertyControls, ControlType, RenderTarget } from "framer"
import { useEffect, useRef } from "react"
import {
    useCookieBannerStore,
    loadStoredConsent,
} from "./CookieBannerStore.tsx"

const STORAGE_KEY_DEFAULT = "cookie-consent"

type PositionPreset =
    | "bottom"
    | "top"
    | "bottom-left"
    | "bottom-right"
    | "top-left"
    | "top-right"
    | "custom"

type AnimationType = "slide" | "fade" | "none"

function getPositionStyles(
    position: PositionPreset,
    insetTop: number,
    insetBottom: number,
    insetLeft: number,
    insetRight: number
): React.CSSProperties {
    const base: React.CSSProperties = { position: "fixed" }
    switch (position) {
        case "bottom":
            return { ...base, bottom: 0, left: 0, right: 0 }
        case "top":
            return { ...base, top: 0, left: 0, right: 0 }
        case "bottom-left":
            return { ...base, bottom: 16, left: 16 }
        case "bottom-right":
            return { ...base, bottom: 16, right: 16 }
        case "top-left":
            return { ...base, top: 16, left: 16 }
        case "top-right":
            return { ...base, top: 16, right: 16 }
        case "custom":
        default:
            return {
                ...base,
                top: insetTop,
                right: insetRight,
                bottom: insetBottom,
                left: insetLeft,
            }
    }
}

/**
 * @framerDisableUnlink
 * @framerDisableEdit
 * @framerSupportedLayoutWidth any
 * @framerSupportedLayoutHeight any
 * @framerIntrinsicWidth 400
 * @framerIntrinsicHeight 120
 */
export function CookieBanner(props: {
    position?: PositionPreset
    insetTop?: number
    insetBottom?: number
    insetLeft?: number
    insetRight?: number
    maxWidth?: number
    zIndex?: number
    backgroundColor?: string
    textColor?: string
    padding?: string
    borderRadius?: number
    boxShadow?: string
    animation?: AnimationType
    animationDuration?: number
    storageKey?: string
    expiryDays?: number
    children?: React.ReactNode
    style?: React.CSSProperties
}) {
    const {
        position = "bottom",
        insetTop = 16,
        insetBottom = 16,
        insetLeft = 16,
        insetRight = 16,
        maxWidth = 600,
        zIndex = 9999,
        backgroundColor = "#1a1a1a",
        textColor = "#ffffff",
        padding = "20px",
        borderRadius = 12,
        boxShadow = "0px 4px 24px rgba(0,0,0,0.25)",
        animation = "slide",
        animationDuration = 300,
        storageKey = STORAGE_KEY_DEFAULT,
        expiryDays = 365,
        children,
        style,
    } = props

    const [store, setStore] = useCookieBannerStore()
    const initRef = useRef(false)

    const isCanvas = RenderTarget.current() === RenderTarget.canvas

    useEffect(() => {
        if (isCanvas) return
        if (initRef.current) return
        initRef.current = true

        const stored = loadStoredConsent(storageKey, expiryDays)
        setStore({
            storageKey,
            expiryDays,
            ...(stored
                ? {
                      consentGiven: stored.consentGiven,
                      categories: stored.categories,
                      showBanner: false,
                      showCustomizePanel: false,
                  }
                : {}),
        })
    }, [isCanvas, storageKey, expiryDays, setStore])

    if (!store.showBanner && !isCanvas) return null

    const positionStyles = getPositionStyles(
        position,
        insetTop,
        insetBottom,
        insetLeft,
        insetRight
    )

    const animationStyles: React.CSSProperties =
        animation === "slide"
            ? {
                  transform: position.includes("bottom")
                      ? `translateY(${store.showBanner ? 0 : 100}%)`
                      : `translateY(${store.showBanner ? 0 : -100}%)`,
                  transition: `transform ${animationDuration}ms ease`,
              }
            : animation === "fade"
              ? {
                    opacity: store.showBanner ? 1 : 0,
                    transition: `opacity ${animationDuration}ms ease`,
                }
              : {}

    const containerStyle: React.CSSProperties = {
        ...positionStyles,
        zIndex,
        maxWidth,
        margin:
            position === "bottom" || position === "top" ? "auto" : undefined,
        width: position === "bottom" || position === "top" ? "100%" : undefined,
        backgroundColor,
        color: textColor,
        padding,
        borderRadius,
        boxShadow,
        ...animationStyles,
        ...style,
    }

    if (isCanvas) {
        return (
            <div
                style={{
                    ...containerStyle,
                    position: "relative",
                    minHeight: 120,
                }}
            >
                <div style={{ fontSize: 12, opacity: 0.7, marginBottom: 8 }}>
                    Cookie Banner (preview)
                </div>
                <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
                    {children ?? (
                        <div style={{ fontSize: 14 }}>
                            Add a stack as children with Message, CookieRejectButton, CookieAcceptButton, CookieCustomizeButton, CookieCustomizePanel
                        </div>
                    )}
                </div>
            </div>
        )
    }

    return (
        <div style={containerStyle}>
            {children}
        </div>
    )
}

CookieBanner.defaultProps = {
    position: "bottom" as const,
    insetTop: 16,
    insetBottom: 16,
    insetLeft: 16,
    insetRight: 16,
    maxWidth: 600,
    zIndex: 9999,
    backgroundColor: "#1a1a1a",
    textColor: "#ffffff",
    padding: "20px",
    borderRadius: 12,
    boxShadow: "0px 4px 24px rgba(0,0,0,0.25)",
    animation: "slide" as const,
    animationDuration: 300,
    storageKey: STORAGE_KEY_DEFAULT,
    expiryDays: 365,
}

addPropertyControls(CookieBanner, {
    position: {
        type: ControlType.Enum,
        title: "Position",
        options: [
            "bottom",
            "top",
            "bottom-left",
            "bottom-right",
            "top-left",
            "top-right",
            "custom",
        ],
        optionTitles: [
            "Bottom",
            "Top",
            "Bottom Left",
            "Bottom Right",
            "Top Left",
            "Top Right",
            "Custom",
        ],
    },
    insetTop: {
        type: ControlType.Number,
        title: "Inset Top",
        min: 0,
        max: 200,
        unit: "px",
        hidden: (props) => props.position !== "custom",
    },
    insetBottom: {
        type: ControlType.Number,
        title: "Inset Bottom",
        min: 0,
        max: 200,
        unit: "px",
        hidden: (props) => props.position !== "custom",
    },
    insetLeft: {
        type: ControlType.Number,
        title: "Inset Left",
        min: 0,
        max: 200,
        unit: "px",
        hidden: (props) => props.position !== "custom",
    },
    insetRight: {
        type: ControlType.Number,
        title: "Inset Right",
        min: 0,
        max: 200,
        unit: "px",
        hidden: (props) => props.position !== "custom",
    },
    maxWidth: {
        type: ControlType.Number,
        title: "Max Width",
        min: 200,
        max: 1200,
        unit: "px",
    },
    zIndex: {
        type: ControlType.Number,
        title: "Z-Index",
        min: 1,
        max: 99999,
    },
    backgroundColor: { type: ControlType.Color, title: "Background" },
    textColor: { type: ControlType.Color, title: "Text Color" },
    padding: {
        type: ControlType.Padding,
        title: "Padding",
        defaultValue: "20px",
    },
    borderRadius: {
        type: ControlType.Number,
        title: "Border Radius",
        min: 0,
        max: 48,
        unit: "px",
    },
    boxShadow: {
        type: ControlType.BoxShadow,
        title: "Shadow",
        defaultValue: "0px 4px 24px rgba(0,0,0,0.25)",
    },
    animation: {
        type: ControlType.Enum,
        title: "Animation",
        options: ["slide", "fade", "none"],
        optionTitles: ["Slide", "Fade", "None"],
    },
    animationDuration: {
        type: ControlType.Number,
        title: "Duration",
        min: 0,
        max: 1000,
        unit: "ms",
        hidden: (props) => props.animation === "none",
    },
    storageKey: {
        type: ControlType.String,
        title: "Storage Key",
    },
    expiryDays: {
        type: ControlType.Number,
        title: "Expiry Days",
        min: 0,
        max: 365,
        unit: "days",
        description: "0 = session only",
    },
    children: {
        type: ControlType.ComponentInstance,
        title: "Content",
        description:
            "Your stack: Message + CookieRejectButton + CookieAcceptButton + CookieCustomizeButton + CookieCustomizePanel",
    },
})
