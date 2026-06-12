/**
 * Logo Migration GSAP Overrides for Framer
 *
 * One scroll progress (0→1) drives position, scale, and variant together.
 *
 * 0 – 50%   Wordmark, scale 1 → linearly down, centered → corner
 * 50 – 99%  Logo-big, scale continues linearly down
 * ≥ 99%     Logo-small + scale snaps to 1 (instant, sharp, reversible on scroll up)
 *
 * Usage:
 * 1. `withLogoTrigger` on the trigger SECTION
 * 2. `withMigratingLogo` on the STACK containing the logo
 * 3. `withLogoVariant` on the logo component (Wordmark / Logo-big / Logo-small)
 */

import type { ComponentType } from "react"
import { useLayoutEffect, useRef, useState } from "react"
import { gsap } from "gsap"
import { ScrollTrigger } from "gsap/ScrollTrigger"

gsap.registerPlugin(ScrollTrigger)

const MAX_WIDTH = 1728
const EDGE_INSET_LEFT = 16
const EDGE_INSET_TOP = 24
const SCALE_END = 0.15

const VARIANT_WORDMARK = "Wordmark"
const VARIANT_LOGO_BIG = "Logo-big"
const VARIANT_LOGO_SMALL = "Logo-small"
const VARIANT_SWITCH_AT = 0.5
/** Scale + variant snap together at 99% — Logo-small at native scale */
const VARIANT_SNAP_AT = 0.99

const SCROLL_TRIGGER_ID = "logo-migrate"
const RETRY_MS = 100
const MAX_SETUP_ATTEMPTS = 60

function centerX() {
    return window.innerWidth / 2
}

function centerY() {
    return window.innerHeight / 2
}

function cornerX() {
    const margin = Math.max((window.innerWidth - MAX_WIDTH) / 2, 0)
    return margin + EDGE_INSET_LEFT
}

function isReady(el: HTMLElement | null): el is HTMLElement {
    if (!el?.isConnected) return false
    return el.offsetWidth > 0 || el.offsetHeight > 0
}

function scheduleScrollTriggerRefresh() {
    ScrollTrigger.refresh()
    requestAnimationFrame(() => {
        ScrollTrigger.refresh()
        requestAnimationFrame(() => ScrollTrigger.refresh())
    })
}

/** Variant and scale use the same progress value */
function variantForProgress(p: number): string {
    if (p >= VARIANT_SNAP_AT) return VARIANT_LOGO_SMALL
    if (p >= VARIANT_SWITCH_AT) return VARIANT_LOGO_BIG
    return VARIANT_WORDMARK
}

function scaleForProgress(p: number): number {
    if (p >= VARIANT_SNAP_AT) return 1
    return gsap.utils.interpolate(1, SCALE_END, p / VARIANT_SNAP_AT)
}

// --- Trigger bridge ---
let triggerElement: HTMLElement | null = null
let triggerGeneration = 0
const triggerListeners = new Set<
    (el: HTMLElement, generation: number) => void
>()

function publishTrigger(el: HTMLElement) {
    triggerElement = el
    triggerGeneration += 1
    triggerListeners.forEach((cb) => cb(el, triggerGeneration))
    scheduleScrollTriggerRefresh()
}

function revokeTrigger(el: HTMLElement) {
    if (triggerElement !== el) return
    triggerElement = null
    triggerGeneration += 1
    scheduleScrollTriggerRefresh()
}

// --- Variant bridge ---
let currentVariant = VARIANT_WORDMARK
const variantListeners = new Set<(variant: string) => void>()

function publishVariant(variant: string) {
    if (variant === currentVariant) return
    currentVariant = variant
    variantListeners.forEach((cb) => cb(variant))
}

function killExistingMigration() {
    ScrollTrigger.getById(SCROLL_TRIGGER_ID)?.kill()
}

function buildLogoAnimation(logo: HTMLElement, trigger: HTMLElement) {
    killExistingMigration()

    /** Same progress drives variant + scale every frame (fully reversible) */
    const applyFrame = (progress: number) => {
        publishVariant(variantForProgress(progress))
        gsap.set(logo, {
            scale: scaleForProgress(progress),
            overwrite: true,
        })
    }

    gsap.set(logo, {
        position: "fixed",
        top: 0,
        left: 0,
        zIndex: 100,
    })

    // Position scrub — transformOrigin only on the "to" state (keeps center at start)
    const tween = gsap.fromTo(
        logo,
        {
            x: centerX,
            y: centerY,
            xPercent: -50,
            yPercent: -50,
        },
        {
            x: cornerX,
            y: EDGE_INSET_TOP,
            xPercent: 0,
            yPercent: 0,
            transformOrigin: "top left",
            ease: "none",
            immediateRender: true,
            scrollTrigger: {
                id: SCROLL_TRIGGER_ID,
                trigger,
                start: "top bottom",
                end: "top center",
                scrub: true,
                invalidateOnRefresh: true,
                markers: false,
                onUpdate: (self) => applyFrame(self.progress),
                onRefresh: (self) => applyFrame(self.progress),
            },
        }
    )

    const st = tween.scrollTrigger
    if (st) applyFrame(st.progress)

    return tween
}

/** Apply to the SECTION that triggers the migration */
export function withLogoTrigger(Component: ComponentType): ComponentType {
    return (props) => {
        const ref = useRef<HTMLDivElement>(null)

        useLayoutEffect(() => {
            const el = ref.current
            if (!el) return

            publishTrigger(el)

            const ro = new ResizeObserver(() => scheduleScrollTriggerRefresh())
            ro.observe(el)

            return () => {
                ro.disconnect()
                revokeTrigger(el)
            }
        }, [])

        return (
            <div ref={ref} style={{ width: "100%" }}>
                <Component {...props} />
            </div>
        )
    }
}

/** Apply to the STACK containing the logo */
export function withMigratingLogo(Component: ComponentType): ComponentType {
    return (props) => {
        const logoRef = useRef<HTMLDivElement>(null)

        useLayoutEffect(() => {
            const logo = logoRef.current
            if (!logo) return

            let ctx: gsap.Context | null = null
            let alive = true
            let retryTimer: ReturnType<typeof setTimeout> | null = null
            let attempts = 0
            let removeResize: (() => void) | null = null
            let triggerObserver: ResizeObserver | null = null

            const teardown = () => {
                removeResize?.()
                removeResize = null
                triggerObserver?.disconnect()
                triggerObserver = null
                ctx?.revert()
                ctx = null
                killExistingMigration()
            }

            const onResize = () => scheduleScrollTriggerRefresh()

            const setup = (trigger: HTMLElement, generation: number) => {
                if (!alive || generation !== triggerGeneration) return
                if (!isReady(logo) || !isReady(trigger)) return

                teardown()

                ctx = gsap.context(() => {
                    buildLogoAnimation(logo, trigger)
                }, logo)

                triggerObserver = new ResizeObserver(() =>
                    scheduleScrollTriggerRefresh()
                )
                triggerObserver.observe(trigger)

                if (!removeResize) {
                    window.addEventListener("resize", onResize)
                    removeResize = () =>
                        window.removeEventListener("resize", onResize)
                }

                scheduleScrollTriggerRefresh()
            }

            const trySetup = () => {
                if (!alive) return

                const trigger = triggerElement
                if (
                    trigger?.isConnected &&
                    isReady(logo) &&
                    isReady(trigger)
                ) {
                    setup(trigger, triggerGeneration)
                    return
                }

                if (attempts < MAX_SETUP_ATTEMPTS) {
                    attempts += 1
                    retryTimer = window.setTimeout(trySetup, RETRY_MS)
                }
            }

            const onTrigger = (trigger: HTMLElement, generation: number) => {
                if (!alive) return
                attempts = 0
                if (retryTimer) {
                    clearTimeout(retryTimer)
                    retryTimer = null
                }
                setup(trigger, generation)
            }

            triggerListeners.add(onTrigger)
            trySetup()

            document.fonts?.ready?.then(() => {
                if (alive) scheduleScrollTriggerRefresh()
            })

            return () => {
                alive = false
                if (retryTimer) clearTimeout(retryTimer)
                triggerListeners.delete(onTrigger)
                teardown()
                publishVariant(VARIANT_WORDMARK)
            }
        }, [])

        return (
            <div ref={logoRef}>
                <Component {...props} />
            </div>
        )
    }
}

/** Apply to the logo component with Wordmark / Logo-big / Logo-small variants */
export function withLogoVariant(Component: ComponentType): ComponentType {
    return (props) => {
        const [variant, setVariant] = useState(currentVariant)

        useLayoutEffect(() => {
            const onVariant = (v: string) => setVariant(v)
            variantListeners.add(onVariant)
            setVariant(currentVariant)
            return () => variantListeners.delete(onVariant)
        }, [])

        return <Component {...props} variant={variant} />
    }
}
