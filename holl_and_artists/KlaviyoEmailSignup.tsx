/**
 * KlaviyoEmailSignup — Framer Code Component
 *
 * Minimalist Klaviyo newsletter signup: email input, send button, success state.
 * Uses Klaviyo's client-side Subscribe API (no server required).
 *
 * Setup:
 * 1. Assets → Code → + → Code Component → paste this file
 * 2. In the property panel, enter your Klaviyo Public API Key and List ID
 * 3. Customize font, colors, and send icon to match your brand
 *
 * Finding your keys:
 * - Public API Key: Klaviyo → Settings → API Keys → Public API Key (6-char)
 * - List ID: Klaviyo → Lists & Segments → click your list → Settings → List ID
 */

import { useId, useState, type CSSProperties } from "react"
import { addPropertyControls, ControlType } from "framer"

// ─── Arrow icon (exact paths from arrow-01 1.svg) ────────────────────────────

function ArrowRight({ color, size = 16 }: { color: string; size?: number }) {
    return (
        <svg
            width={size}
            height={size}
            viewBox="0 0 8 8"
            fill="none"
            xmlns="http://www.w3.org/2000/svg"
            style={{ display: "block", flexShrink: 0 }}
        >
            <g clipPath="url(#arrow-clip)">
                <path
                    d="M0.69162 4H5.83M3.3959 7.24546L6.64137 4L3.3959 0.754532"
                    stroke={color}
                    strokeWidth="1"
                    strokeMiterlimit="10"
                    strokeLinecap="square"
                    vectorEffect="non-scaling-stroke"
                />
            </g>
            <defs>
                <clipPath id="arrow-clip">
                    <rect width="7.333" height="8" fill="white" />
                </clipPath>
            </defs>
        </svg>
    )
}

// ─── Font helpers (same pattern as ScrollRevealText) ──────────────────────────

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
          /** Framer text styles pass resolved CSS here */
          style?: CSSProperties
          [key: string]: unknown
      }

function typographyFromFont(font: FontControlValue | undefined): CSSProperties {
    if (!font) return {}
    if (typeof font === "string") return { fontFamily: font }

    // When a Framer text style is linked, all resolved CSS lives in `.style`
    const fromStyle: CSSProperties = font.style ? { ...font.style } : {}

    const {
        fontFamily,
        family,
        font: f,
        fontSize,
        fontWeight,
        fontStyle,
        lineHeight,
        letterSpacing,
    } = font

    return {
        // Text style values come first; individual overrides win on top
        ...fromStyle,
        ...(fontFamily || family || f
            ? { fontFamily: (fontFamily || family || f) as string }
            : {}),
        ...(fontSize !== undefined ? { fontSize } : {}),
        ...(fontWeight !== undefined
            ? { fontWeight: fontWeight as CSSProperties["fontWeight"] }
            : {}),
        ...(fontStyle !== undefined
            ? { fontStyle: fontStyle as CSSProperties["fontStyle"] }
            : {}),
        ...(lineHeight !== undefined ? { lineHeight } : {}),
        ...(letterSpacing !== undefined ? { letterSpacing } : {}),
    }
}

// ─── Klaviyo API ──────────────────────────────────────────────────────────────

async function subscribeToKlaviyo(
    publicKey: string,
    listId: string,
    email: string
): Promise<void> {
    const companyId = publicKey.trim()
    const list = listId.trim()
    const url = `https://a.klaviyo.com/client/subscriptions/?company_id=${encodeURIComponent(companyId)}`

    const res = await fetch(url, {
        method: "POST",
        headers: {
            "Content-Type": "application/json",
            revision: "2024-07-15",
        },
        body: JSON.stringify({
            data: {
                type: "subscription",
                attributes: {
                    custom_source: "Newsletter signup form",
                    profile: {
                        data: {
                            type: "profile",
                            attributes: {
                                email: email.trim(),
                            },
                        },
                    },
                },
                relationships: {
                    list: {
                        data: { type: "list", id: list },
                    },
                },
            },
        }),
    })

    if (res.ok) return

    let detail = `Klaviyo error ${res.status}`
    try {
        const body = await res.json()
        const first = body?.errors?.[0]
        if (first?.detail) detail = first.detail
        else if (first?.title) detail = first.title
    } catch {
        // ignore JSON parse errors
    }
    throw new Error(detail)
}

// ─── Component ────────────────────────────────────────────────────────────────

type Status = "idle" | "loading" | "success" | "error"

type KlaviyoEmailSignupProps = {
    publicKey?: string
    listId?: string
    placeholder?: string
    successMessage?: string
    errorMessage?: string
    iconSize?: number
    font?: FontControlValue
    textColor?: string
    inputBorderColor?: string
    iconColor?: string
    style?: CSSProperties
}

/**
 * @framerDisableUnlink
 * @framerSupportedLayoutWidth any
 * @framerSupportedLayoutHeight auto
 * @framerIntrinsicWidth 400
 * @framerIntrinsicHeight 80
 */
export default function KlaviyoEmailSignup(props: KlaviyoEmailSignupProps) {
    const {
        publicKey = "",
        listId = "",
        placeholder = "Email Address",
        successMessage = "You're in. Talk soon.",
        errorMessage = "Something went wrong. Please try again.",
        iconSize = 16,
        font,
        textColor = "#000000",
        inputBorderColor = "#CCCCCC",
        iconColor = "#000000",
        style,
    } = props

    const uid = useId().replace(/:/g, "")
    const inputClass = `klv-input-${uid}`

    const [email, setEmail] = useState("")
    const [status, setStatus] = useState<Status>("idle")

    const fontStyle = typographyFromFont(font)
    const baseFontSize = fontStyle.fontSize ?? 14

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault()
        if (!email || status === "loading") return

        if (!publicKey || !listId) {
            // In Framer canvas / no keys set — show success for preview
            setStatus("success")
            return
        }

        setStatus("loading")
        try {
            await subscribeToKlaviyo(publicKey, listId, email)
            setStatus("success")
            setEmail("")
        } catch (err) {
            console.error("[Klaviyo signup]", err)
            setStatus("error")
        }
    }

    const renderIcon = () => {
        const color = status === "loading" ? inputBorderColor : iconColor
        return <ArrowRight color={color} size={iconSize} />
    }

    return (
        <div
            style={{
                width: "100%",
                display: "flex",
                flexDirection: "column",
                ...style,
            }}
        >
            <style>{`.${inputClass}::placeholder { color: ${textColor}; }`}</style>
            {/* Input row or success */}
            {status === "success" ? (
                <span
                    style={{
                        ...fontStyle,
                        fontSize: baseFontSize,
                        color: textColor,
                        paddingBottom: 10,
                        borderBottom: `1px solid ${inputBorderColor}`,
                    }}
                >
                    {successMessage}
                </span>
            ) : (
                <form
                    onSubmit={handleSubmit}
                    style={{
                        display: "flex",
                        alignItems: "center",
                        borderBottom: `1px solid ${inputBorderColor}`,
                        paddingBottom: 10,
                        gap: 8,
                    }}
                >
                    <input
                        type="email"
                        required
                        value={email}
                        onChange={(e) => {
                            setEmail(e.target.value)
                            if (status === "error") setStatus("idle")
                        }}
                        placeholder={placeholder}
                        disabled={status === "loading"}
                        className={inputClass}
                        style={{
                            flex: 1,
                            border: "none",
                            outline: "none",
                            background: "transparent",
                            ...fontStyle,
                            fontSize: baseFontSize,
                            color: textColor,
                            opacity: status === "loading" ? 0.5 : 1,
                        }}
                    />
                    <button
                        type="submit"
                        aria-label="Subscribe"
                        disabled={status === "loading"}
                        style={{
                            border: "none",
                            background: "transparent",
                            padding: 0,
                            cursor: status === "loading" ? "default" : "pointer",
                            display: "flex",
                            alignItems: "center",
                            justifyContent: "center",
                            flexShrink: 0,
                            opacity: status === "loading" ? 0.4 : 1,
                            transition: "opacity 0.2s",
                        }}
                    >
                        {renderIcon()}
                    </button>
                </form>
            )}

            {/* Error message */}
            {status === "error" && (
                <span
                    style={{
                        ...fontStyle,
                        fontSize: typeof baseFontSize === "number" ? baseFontSize - 2 : 12,
                        color: "#cc0000",
                    }}
                >
                    {errorMessage}
                </span>
            )}
        </div>
    )
}

KlaviyoEmailSignup.displayName = "Klaviyo Email Signup"

addPropertyControls(KlaviyoEmailSignup, {
    // ── Klaviyo config ──────────────────────────────────────────────────────
    publicKey: {
        type: ControlType.String,
        title: "Public API Key",
        placeholder: "AbCd12",
        description:
            "Klaviyo → Settings → API Keys → Public API Key (6 characters). Do NOT use the private key.",
    },
    listId: {
        type: ControlType.String,
        title: "List ID",
        placeholder: "Y6nRLr",
        description:
            "Klaviyo → Lists & Segments → your list → Settings → List ID",
    },

    // ── Content ─────────────────────────────────────────────────────────────
    placeholder: {
        type: ControlType.String,
        title: "Placeholder",
        defaultValue: "Email Address",
    },
    successMessage: {
        type: ControlType.String,
        title: "Success",
        defaultValue: "You're in. Talk soon.",
    },
    errorMessage: {
        type: ControlType.String,
        title: "Error",
        defaultValue: "Something went wrong. Please try again.",
    },

    // ── Appearance ───────────────────────────────────────────────────────────
    font: {
        type: ControlType.Font,
        title: "Font",
        controls: "extended",
        defaultValue: {
            fontFamily: "Inter",
            fontSize: 14,
            fontWeight: 400,
        },
    },
    textColor: {
        type: ControlType.Color,
        title: "Text",
        defaultValue: "#000000",
    },
    inputBorderColor: {
        type: ControlType.Color,
        title: "Border",
        defaultValue: "#CCCCCC",
    },
    iconSize: {
        type: ControlType.Number,
        title: "Icon Size",
        defaultValue: 16,
        min: 8,
        max: 64,
        step: 1,
        unit: "px",
    },
    iconColor: {
        type: ControlType.Color,
        title: "Icon Color",
        defaultValue: "#000000",
    },
})
