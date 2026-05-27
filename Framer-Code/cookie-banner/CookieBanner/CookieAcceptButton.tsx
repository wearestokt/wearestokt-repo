/**
 * Cookie Accept Button – Triggers "Accept All" consent.
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
 * @framerIntrinsicWidth 100
 * @framerIntrinsicHeight 40
 */
export function CookieAcceptButton(props: {
    label?: string
    backgroundColor?: string
    textColor?: string
    children?: React.ReactNode
    style?: React.CSSProperties
}) {
    const {
        label = "Accept",
        backgroundColor = "#ffffff",
        textColor = "#1a1a1a",
        children,
        style,
    } = props

    const [store, setStore] = useCookieBannerStore()

    const handleClick = useCallback(() => {
        const categories: ConsentCategories = {
            essential: true,
            analytics: true,
            marketing: true,
        }
        setConsent(true, categories, setStore)
        saveConsent(
            store.storageKey ?? "cookie-consent",
            true,
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
                border: "none",
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

CookieAcceptButton.defaultProps = {
    label: "Accept",
    backgroundColor: "#ffffff",
    textColor: "#1a1a1a",
}

addPropertyControls(CookieAcceptButton, {
    label: {
        type: ControlType.String,
        title: "Label",
    },
    backgroundColor: { type: ControlType.Color, title: "Background" },
    textColor: { type: ControlType.Color, title: "Text Color" },
    children: {
        type: ControlType.ComponentInstance,
        title: "Custom",
        description: "Override with custom design",
    },
})
