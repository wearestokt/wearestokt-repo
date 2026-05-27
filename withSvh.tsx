/**
 * DVH Viewport Code Overrides for Framer
 * Mobile only. Uses 100dvh on mobile; passthrough on desktop.
 * Two options: withSvh | withSvhNoScroll
 */

import {
    forwardRef,
    useEffect,
    useState,
    type ComponentType,
    type CSSProperties,
} from "react"

function checkIsMobile(): boolean {
    if (typeof window === "undefined") return false
    return (
        window.innerWidth < 768 ||
        ("ontouchstart" in window && window.innerWidth < 1024) ||
        /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(
            navigator.userAgent
        )
    )
}

function useIsMobile() {
    const [isMobile, setIsMobile] = useState(checkIsMobile)

    useEffect(() => {
        const update = () => setIsMobile(checkIsMobile())
        window.addEventListener("resize", update)
        window.addEventListener("orientationchange", () => setTimeout(update, 100))
        return () => window.removeEventListener("resize", update)
    }, [])

    return isMobile
}

const DVH = "100dvh"

/** DVH — Dynamic viewport height on mobile. Passthrough on desktop. Content can scroll. */
export const withSvh = (Component: ComponentType): ComponentType => {
    const Wrapped = Component as ComponentType<any>
    return forwardRef((props: { style?: CSSProperties }, ref) => {
        const isMobile = useIsMobile()
        const { style, ...rest } = props

        if (!isMobile) {
            return <Wrapped ref={ref} {...rest} style={style} />
        }

        return (
            <Wrapped
                ref={ref}
                {...rest}
                style={{
                    ...style,
                    height: DVH,
                    minHeight: DVH,
                }}
            />
        )
    })
}

/** DVH + Scroll Block — Dynamic viewport on mobile, scroll locked. Passthrough on desktop. */
export const withSvhNoScroll = (Component: ComponentType): ComponentType => {
    const Wrapped = Component as ComponentType<any>
    return forwardRef((props: { style?: CSSProperties }, ref) => {
        const isMobile = useIsMobile()
        const { style, ...rest } = props

        if (!isMobile) {
            return <Wrapped ref={ref} {...rest} style={style} />
        }

        return (
            <Wrapped
                ref={ref}
                {...rest}
                style={{
                    ...style,
                    height: DVH,
                    minHeight: DVH,
                    maxHeight: DVH,
                    overflow: "hidden",
                    overflowY: "hidden",
                    overscrollBehavior: "none",
                    touchAction: "pan-x",
                }}
            />
        )
    })
}
