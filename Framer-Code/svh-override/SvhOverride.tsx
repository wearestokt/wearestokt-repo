import type { ComponentType, CSSProperties, ReactElement } from "react"
import { useLayoutEffect } from "react"

type AnyProps = {
    style?: CSSProperties
    [key: string]: unknown
}

function withViewportHeightValue(
    Component: ComponentType<any>,
    value: "100dvh" | "100lvh" | "100svh"
): ComponentType<any> {
    return (props: AnyProps): ReactElement => {
        const combinedStyle: CSSProperties = {
            ...props.style,
            height: value,
        }

        return <Component {...props} style={combinedStyle} />
    }
}

function withViewportHeightValueAndScrollBlock(
    Component: ComponentType<any>,
    value: "100dvh" | "100lvh" | "100svh"
): ComponentType<any> {
    return (props: AnyProps): ReactElement => {
        useLayoutEffect(() => {
            const html = document.documentElement
            const body = document.body
            const scrollY = window.scrollY || window.pageYOffset || 0

            const prevHtmlOverflow = html.style.overflow
            const prevBodyOverflow = body.style.overflow
            const prevBodyOverscrollBehavior = body.style.overscrollBehavior
            const prevBodyPosition = body.style.position
            const prevBodyTop = body.style.top
            const prevBodyLeft = body.style.left
            const prevBodyRight = body.style.right
            const prevBodyWidth = body.style.width

            // Lock scrolling while preserving the exact visual position.
            html.style.overflow = "hidden"
            body.style.overflow = "hidden"
            body.style.overscrollBehavior = "none"
            body.style.position = "fixed"
            body.style.top = `-${scrollY}px`
            body.style.left = "0"
            body.style.right = "0"
            body.style.width = "100%"

            return () => {
                html.style.overflow = prevHtmlOverflow
                body.style.overflow = prevBodyOverflow
                body.style.overscrollBehavior = prevBodyOverscrollBehavior
                body.style.position = prevBodyPosition
                body.style.top = prevBodyTop
                body.style.left = prevBodyLeft
                body.style.right = prevBodyRight
                body.style.width = prevBodyWidth
                window.scrollTo(0, scrollY)
            }
        }, [])

        const combinedStyle: CSSProperties = {
            ...props.style,
            height: value,
            overflow: "hidden",
            overscrollBehavior: "none",
        }

        return <Component {...props} style={combinedStyle} />
    }
}

/**
 * Applies `height: 100dvh` (Dynamic Viewport Height).
 */
export function withDynamicViewportHeight(Component: ComponentType<any>): ComponentType<any> {
    return withViewportHeightValue(Component, "100dvh")
}

/**
 * Applies `height: 100lvh` (Large Viewport Height).
 */
export function withLargeViewportHeight(Component: ComponentType<any>): ComponentType<any> {
    return withViewportHeightValue(Component, "100lvh")
}

/**
 * Applies `height: 100svh` (Small Viewport Height).
 */
export function withSmallViewportHeight(Component: ComponentType<any>): ComponentType<any> {
    return withViewportHeightValue(Component, "100svh")
}

/**
 * Applies `height: 100dvh` and blocks page scrolling while mounted.
 */
export function withDynamicViewportHeightScrollBlock(
    Component: ComponentType<any>
): ComponentType<any> {
    return withViewportHeightValueAndScrollBlock(Component, "100dvh")
}

/**
 * Applies `height: 100svh` and blocks page scrolling while mounted.
 * Use this only when you explicitly want scroll lock behavior.
 */
export function withSmallViewportHeightScrollBlock(
    Component: ComponentType<any>
): ComponentType<any> {
    return withViewportHeightValueAndScrollBlock(Component, "100svh")
}

// Backward-compatible aliases
export const withSvh = withSmallViewportHeight
export const withSvhScrollBlock = withSmallViewportHeightScrollBlock
export const withDvhScrollBlock = withDynamicViewportHeightScrollBlock
