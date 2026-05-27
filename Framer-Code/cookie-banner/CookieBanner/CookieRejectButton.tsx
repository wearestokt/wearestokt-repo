/**
 * Cookie Reject Button – Triggers "Reject Non-Essential" consent.
 * Place inside CookieBanner's children stack. Shares state via CookieBannerStore.
 */

import { addPropertyControls, ControlType } from "framer"
import React, { useCallback } from "react"
import {
    useCookieBannerStore,
    setConsent,
    saveConsent,
    type ConsentCategories,
} from "./CookieBannerStore.tsx"

/**
 * @framerDisableUnlink
 * @framerDisableEdit
 * @framerSupportedLayoutWidth any
 * @framerSupportedLayoutHeight any
 * @framerIntrinsicWidth 140
 * @framerIntrinsicHeight 40
 */
export function CookieRejectButton(props: {
    label?: string
    backgroundColor?: string
    textColor?: string
    borderColor?: string
    children?: React.ReactNode
    style?: React.CSSProperties
}) {
    const {
        label = "Reject",
        backgroundColor = "transparent",
        textColor = "#ffffff",
        borderColor = "#ffffff",
        children,
        style,
    } = props

    const [store, setStore] = useCookieBannerStore()

    const handleClick = useCallback(() => {
        const categories: ConsentCategories = {
            essential: true,
            analytics: false,
            marketing: false,
        }
        setConsent(false, categories, setStore)
        saveConsent(
            store.storageKey ?? "cookie-consent",
            false,
            categories,
            store.expiryDays ?? 365
        )
    }, [store.storageKey, store.expiryDays, setStore])

    const defaultButton = (
        <button
            type="button"
            onClick={handleClick}
            style={{
                padding: "10px 20px",
                borderRadius: 8,
                border: `1px solid ${borderColor}`,
                cursor: "pointer",
                fontSize: 14,
                fontWeight: 500,
                backgroundColor,
                color: textColor,
            }}
        >
            {label}
        </button>
    )

    if (children) {
        return (
            <div onClick={handleClick} style={{ cursor: "pointer", ...style }}>
                {children}
            </div>
        )
    }

    return <div style={style}>{defaultButton}</div>
}

CookieRejectButton.defaultProps = {
    label: "Reject",
    backgroundColor: "transparent",
    textColor: "#ffffff",
    borderColor: "#ffffff",
}

addPropertyControls(CookieRejectButton, {
    label: {
        type: ControlType.String,
        title: "Label",
    },
    backgroundColor: { type: ControlType.Color, title: "Background" },
    textColor: { type: ControlType.Color, title: "Text Color" },
    borderColor: { type: ControlType.Color, title: "Border Color" },
    children: {
        type: ControlType.ComponentInstance,
        title: "Custom",
        description: "Override with custom design",
    },
})
