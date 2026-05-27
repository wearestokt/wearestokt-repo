/**
 * Cookie Customize Panel – Category toggles and Save button.
 * Place inside CookieBanner's children stack. Shows when customize is expanded.
 */

import { addPropertyControls, ControlType, RenderTarget } from "framer"
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
 * @framerIntrinsicWidth 300
 * @framerIntrinsicHeight 180
 */
export function CookieCustomizePanel(props: {
    textColor?: string
    saveLabel?: string
    style?: React.CSSProperties
}) {
    const {
        textColor = "#ffffff",
        saveLabel = "Save Preferences",
        style,
    } = props

    const [store, setStore] = useCookieBannerStore()
    const isCanvas = RenderTarget.current() === RenderTarget.canvas

    const handleToggleCategory = useCallback(
        (name: keyof ConsentCategories) => {
            if (name === "essential") return
            setStore({
                categories: {
                    ...store.categories,
                    [name]: !store.categories[name],
                },
            })
        },
        [store.categories, setStore]
    )

    const handleSave = useCallback(() => {
        const categories = store.categories
        setConsent(true, categories, setStore)
        saveConsent(
            store.storageKey ?? "cookie-consent",
            true,
            categories,
            store.expiryDays ?? 365
        )
    }, [store.categories, store.storageKey, store.expiryDays, setStore])

    if (!store.showCustomizePanel && !isCanvas) return null

    const panelContent = (
        <div
            style={{
                display: "flex",
                flexDirection: "column",
                gap: 12,
                paddingTop: 12,
                borderTop: `1px solid ${textColor}33`,
                color: textColor,
                fontSize: 14,
                ...style,
            }}
        >
            <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                <input
                    type="checkbox"
                    checked={store.categories.essential}
                    disabled
                    readOnly
                />
                <span>Essential (required)</span>
            </div>
            <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                <input
                    type="checkbox"
                    checked={store.categories.analytics}
                    onChange={() => handleToggleCategory("analytics")}
                />
                <span>Analytics</span>
            </div>
            <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                <input
                    type="checkbox"
                    checked={store.categories.marketing}
                    onChange={() => handleToggleCategory("marketing")}
                />
                <span>Marketing</span>
            </div>
            <button
                type="button"
                onClick={handleSave}
                style={{
                    padding: "10px 20px",
                    borderRadius: 8,
                    border: "none",
                    cursor: "pointer",
                    fontSize: 14,
                    fontWeight: 500,
                    backgroundColor: "#fff",
                    color: "#1a1a1a",
                }}
            >
                {saveLabel}
            </button>
        </div>
    )

    if (isCanvas && !store.showCustomizePanel) {
        return (
            <div
                style={{
                    minHeight: 60,
                    minWidth: 200,
                    display: "flex",
                    alignItems: "center",
                    fontSize: 12,
                    color: `${textColor}99`,
                }}
            >
                Customize panel (expands when Customize is clicked)
            </div>
        )
    }

    return panelContent
}

CookieCustomizePanel.defaultProps = {
    textColor: "#ffffff",
    saveLabel: "Save Preferences",
}

addPropertyControls(CookieCustomizePanel, {
    textColor: { type: ControlType.Color, title: "Text Color" },
    saveLabel: {
        type: ControlType.String,
        title: "Save Label",
    },
})
