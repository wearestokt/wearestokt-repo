/**
 * InkDrawReset.tsx
 *
 * Standalone reset button. Place anywhere on your Framer canvas.
 * Style it however you like — this component is a transparent wrapper
 * that passes all clicks through to the drawing component via the store.
 *
 * Add children in Framer to define the button's visual appearance.
 */

import React, { useEffect, useState } from "react"
import { addPropertyControls, ControlType } from "framer"
import { triggerReset, subscribe, getState } from "./InkDrawStore"

interface Props {
    children?: React.ReactNode
    disabled?: boolean
}

export default function InkDrawReset({ children, disabled = false }: Props) {
    const [state, setState] = useState(getState())

    useEffect(() => {
        return subscribe(() => setState({ ...getState() }))
    }, [])

    const isDisabled = disabled || state.isLoading

    return (
        <div
            onClick={() => {
                if (!isDisabled) triggerReset()
            }}
            style={{
                width: "100%",
                height: "100%",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                cursor: isDisabled ? "not-allowed" : "pointer",
                opacity: isDisabled ? 0.4 : 1,
                transition: "opacity 0.2s",
                userSelect: "none",
                boxSizing: "border-box",
            }}
        >
            {children}
        </div>
    )
}

addPropertyControls(InkDrawReset, {
    disabled: {
        type: ControlType.Boolean,
        defaultValue: false,
        title: "Force Disabled",
    },
})
