/**
 * Cookie Customize Button – Toggles the customize panel.
 * Place inside CookieBanner's children stack. Shares state via CookieBannerStore.
 */

import { addPropertyControls, ControlType } from "framer"
import React, { useCallback } from "react"
import { useCookieBannerStore } from "./CookieBannerStore.tsx"

/**
 * @framerDisableUnlink
 * @framerDisableEdit
 * @framerSupportedLayoutWidth any
 * @framerSupportedLayoutHeight any
 * @framerIntrinsicWidth 100
 * @framerIntrinsicHeight 40
 */
export function CookieCustomizeButton(props: {
    label?: string
    backgroundColor?: string
    textColor?: string
    borderColor?: string
    children?: React.ReactNode
    style?: React.CSSProperties
}) {
    const {
        label = "Customize",
        backgroundColor = "transparent",
        textColor = "#ffffff",
        borderColor = "#ffffff",
        children,
        style,
    } = props

    const [store, setStore] = useCookieBannerStore()

    const handleClick = useCallback(() => {
        setStore({ showCustomizePanel: !store.showCustomizePanel })
    }, [store.showCustomizePanel, setStore])

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

CookieCustomizeButton.defaultProps = {
    label: "Customize",
    backgroundColor: "transparent",
    textColor: "#ffffff",
    borderColor: "#ffffff",
}

addPropertyControls(CookieCustomizeButton, {
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
