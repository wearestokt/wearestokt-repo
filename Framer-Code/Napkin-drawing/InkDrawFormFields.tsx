/**
 * InkDrawFormFields.tsx
 *
 * Standalone form component for message, name, and email. Place anywhere on
 * your Framer canvas. Linked to InkDrawCanvas via the store — data is shared
 * so the Send button (in InkDrawCanvas or InkDrawSend) uses these values.
 */

import React, { useEffect, useState, useMemo, useRef, useCallback } from "react"
import { addPropertyControls, ControlType } from "framer"
import {
    getFormData,
    setFormData,
    subscribeFormData,
    subscribe,
    getState,
} from "./InkDrawStore"

interface Props {
    maxChars: number
    messagePlaceholder: string
    namePlaceholder: string
    emailPlaceholder: string
    messageMinHeight: number
    inputFontSize: number
    inputTextColor: string
    inputFont?: { fontFamily?: string; fontWeight?: number | string }
}

export default function InkDrawFormFields({
    maxChars = 265,
    messagePlaceholder = "Write a message…",
    namePlaceholder = "Your name",
    emailPlaceholder = "Your email",
    messageMinHeight = 60,
    inputFontSize = 13,
    inputTextColor = "#1a1a1a",
    inputFont,
}: Props) {
    const [formData, setLocalFormData] = useState(getFormData())
    const [storeState, setLocalState] = useState(getState())
    const textareaRef = useRef<HTMLTextAreaElement>(null)
    const messageContainerRef = useRef<HTMLDivElement>(null)

    const adjustTextareaHeight = useCallback(() => {
        const ta = textareaRef.current
        const container = messageContainerRef.current
        if (!ta || !container) return
        ta.style.height = "auto"
        const scrollH = ta.scrollHeight
        const containerH = container.clientHeight
        // Fill when content is short, grow when content overflows
        if (scrollH > containerH) {
            ta.style.height = `${Math.max(scrollH, messageMinHeight)}px`
        } else {
            ta.style.height = "100%"
        }
        ta.style.minHeight = `${messageMinHeight}px`
    }, [messageMinHeight])

    useEffect(() => {
        adjustTextareaHeight()
    }, [formData.message, adjustTextareaHeight])

    useEffect(() => {
        const container = messageContainerRef.current
        if (!container) return
        const observer = new ResizeObserver(adjustTextareaHeight)
        observer.observe(container)
        return () => observer.disconnect()
    }, [adjustTextareaHeight])

    useEffect(() => {
        return subscribeFormData(() => setLocalFormData({ ...getFormData() }))
    }, [])

    useEffect(() => {
        return subscribe(() => setLocalState({ ...getState() }))
    }, [])

    const inputStyle: React.CSSProperties = useMemo(
        () => ({
            width: "100%",
            background: "transparent",
            border: "none",
            outline: "none",
            fontSize: inputFontSize,
            fontFamily:
                inputFont?.fontFamily ??
                '-apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif',
            fontWeight: inputFont?.fontWeight ?? 400,
            color: inputTextColor,
            padding: "6px 0",
            boxSizing: "border-box" as const,
        }),
        [inputFontSize, inputTextColor, inputFont]
    )

    return (
        <div
            style={{
                width: "100%",
                height: "100%",
                display: "flex",
                flexDirection: "column",
                gap: 12,
                fontFamily:
                    inputFont?.fontFamily ??
                    '-apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif',
                fontWeight: inputFont?.fontWeight ?? 400,
                boxSizing: "border-box",
            }}
        >
            {/* Name and Email — side by side */}
            <div
                style={{
                    display: "flex",
                    gap: 12,
                    width: "100%",
                }}
            >
                <input
                    type="text"
                    value={formData.name}
                    onChange={(e) => setFormData({ name: e.target.value })}
                    placeholder={namePlaceholder}
                    disabled={storeState.isSuccess}
                    style={{ ...inputStyle, flex: 1 }}
                />
                <input
                    type="email"
                    value={formData.email}
                    onChange={(e) => setFormData({ email: e.target.value })}
                    placeholder={emailPlaceholder}
                    disabled={storeState.isSuccess}
                    style={{ ...inputStyle, flex: 1 }}
                />
            </div>

            {/* Message textarea — fills remaining space, grows with content */}
            <div
                ref={messageContainerRef}
                style={{
                    position: "relative",
                    width: "100%",
                    flex: 1,
                    minHeight: messageMinHeight,
                    display: "flex",
                }}
            >
                <textarea
                    ref={textareaRef}
                    value={formData.message}
                    onChange={(e) => {
                        if (e.target.value.length <= maxChars) {
                            setFormData({ message: e.target.value })
                        }
                    }}
                    placeholder={messagePlaceholder}
                    rows={1}
                    disabled={storeState.isSuccess}
                    style={{
                        ...inputStyle,
                        resize: "none",
                        minHeight: messageMinHeight,
                        flex: 1,
                        overflow: "hidden",
                        boxSizing: "border-box",
                    }}
                />
                <span
                    style={{
                        position: "absolute",
                        bottom: 8,
                        right: 0,
                        fontSize: 10,
                        fontFamily:
                            inputFont?.fontFamily ??
                            '-apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif',
                        fontWeight: inputFont?.fontWeight ?? 400,
                        color: inputTextColor,
                        opacity: 0.35,
                    }}
                >
                    {formData.message.length}/{maxChars}
                </span>
            </div>

            {/* Inline error */}
            {storeState.isError && (
                <p
                    style={{
                        margin: 0,
                        fontSize: 11,
                        fontFamily:
                            inputFont?.fontFamily ??
                            '-apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif',
                        fontWeight: inputFont?.fontWeight ?? 400,
                        color: "#c0392b",
                        opacity: 0.8,
                    }}
                >
                    {storeState.errorMessage}
                </p>
            )}
        </div>
    )
}

addPropertyControls(InkDrawFormFields, {
    maxChars: {
        type: ControlType.Number,
        defaultValue: 265,
        min: 50,
        max: 1000,
        step: 5,
        title: "Max Characters",
    },
    messagePlaceholder: {
        type: ControlType.String,
        defaultValue: "Write a message…",
        title: "Message Placeholder",
    },
    namePlaceholder: {
        type: ControlType.String,
        defaultValue: "Your name",
        title: "Name Placeholder",
    },
    emailPlaceholder: {
        type: ControlType.String,
        defaultValue: "Your email",
        title: "Email Placeholder",
    },
    messageMinHeight: {
        type: ControlType.Number,
        defaultValue: 60,
        min: 40,
        max: 200,
        step: 4,
        title: "Message Min Height",
    },
    inputFontSize: {
        type: ControlType.Number,
        defaultValue: 13,
        min: 10,
        max: 20,
        title: "Input Font Size",
    },
    inputTextColor: {
        type: ControlType.Color,
        defaultValue: "#1a1a1a",
        title: "Input Text Color",
    },
    inputFont: {
        type: ControlType.Font,
        title: "Form Font",
    },
})
