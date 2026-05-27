/**
 * InkDrawSend.tsx
 *
 * Standalone send button. Place anywhere on your Framer canvas.
 * Style it however you like — this component is a transparent wrapper
 * that passes all clicks through to the drawing component via the store.
 *
 * Automatically reflects loading / success / error state from the store.
 */

import React, { useEffect, useState } from "react"
import { addPropertyControls, ControlType } from "framer"
import {
    triggerSend,
    subscribe,
    subscribeFormData,
    getState,
    getFormData,
} from "./InkDrawStore"

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

function isFormValid(): boolean {
    const { name, email, message } = getFormData()
    const trimmedName = name.trim()
    const trimmedEmail = email.trim()
    const trimmedMessage = message.trim()
    return (
        trimmedName.length > 0 &&
        trimmedEmail.length > 0 &&
        EMAIL_REGEX.test(trimmedEmail) &&
        trimmedMessage.length > 0
    )
}

interface Props {
    children?: React.ReactNode
    loadingLabel?: string
    successLabel?: string
    disabled?: boolean
    labelFontSize: number
    labelFont?: { fontFamily?: string; fontWeight?: number | string }
}

export default function InkDrawSend({
    children,
    loadingLabel = "Sending…",
    successLabel = "Sent",
    disabled = false,
    labelFontSize = 13,
    labelFont,
}: Props) {
    const [state, setState] = useState(getState())
    const [, forceUpdate] = useState({})

    useEffect(() => {
        return subscribe(() => setState({ ...getState() }))
    }, [])

    useEffect(() => {
        return subscribeFormData(() => forceUpdate({}))
    }, [])

    const formValid = isFormValid()
    const isDisabled =
        disabled || state.isLoading || state.isSuccess || !formValid

    function getLabel() {
        if (state.isLoading) return loadingLabel
        if (state.isSuccess) return successLabel
        return null // fall through to children
    }

    const label = getLabel()

    return (
        <div
            onClick={() => {
                if (!isDisabled) triggerSend()
            }}
            style={{
                width: "100%",
                height: "100%",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                cursor: isDisabled ? "not-allowed" : "pointer",
                userSelect: "none",
                boxSizing: "border-box",
            }}
        >
            {label ? (
                <span
                    style={{
                        fontSize: labelFontSize,
                        fontFamily:
                            labelFont?.fontFamily ??
                            '-apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif',
                        fontWeight: labelFont?.fontWeight ?? 400,
                        color: "currentColor",
                    }}
                >
                    {label}
                </span>
            ) : (
                children ?? (
                    <span
                        style={{
                            fontSize: labelFontSize,
                            fontFamily:
                                labelFont?.fontFamily ??
                                '-apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif',
                            fontWeight: labelFont?.fontWeight ?? 400,
                            color: "currentColor",
                        }}
                    >
                        Send
                    </span>
                )
            )}
        </div>
    )
}

addPropertyControls(InkDrawSend, {
    loadingLabel: {
        type: ControlType.String,
        defaultValue: "Sending…",
        title: "Loading Label",
    },
    successLabel: {
        type: ControlType.String,
        defaultValue: "Sent",
        title: "Success Label",
    },
    disabled: {
        type: ControlType.Boolean,
        defaultValue: false,
        title: "Force Disabled",
    },
    labelFontSize: {
        type: ControlType.Number,
        defaultValue: 13,
        min: 10,
        max: 32,
        title: "Label Font Size",
    },
    labelFont: {
        type: ControlType.Font,
        title: "Label Font",
    },
})
