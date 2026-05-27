/**
 * InkDrawStore.tsx
 *
 * Shared state bridge between InkDrawCanvas and the standalone Reset / Send
 * button components. Because Framer code components are separate React trees,
 * we use a module-level store so buttons placed anywhere on the canvas can
 * control the drawing component.
 *
 * Place this component on your canvas (it renders nothing visible) so the
 * store is loaded. Or wrap your InkDrawCanvas + buttons with it.
 */

import React from "react"
import { addPropertyControls, ControlType } from "framer"

// ─── Types ────────────────────────────────────────────────────────────────────

export type DrawState = {
    isLoading: boolean
    isSuccess: boolean
    isError: boolean
    errorMessage: string
}

export type FormData = {
    message: string
    name: string
    email: string
}

// ─── State management ──────────────────────────────────────────────────────────

let state: DrawState = {
    isLoading: false,
    isSuccess: false,
    isError: false,
    errorMessage: "",
}

let formData: FormData = {
    message: "",
    name: "",
    email: "",
}

type FormListener = () => void
let formListeners: FormListener[] = []

type Listener = () => void
let listeners: Listener[] = []

export function getState(): DrawState {
    return state
}

export function setState(partial: Partial<DrawState>) {
    state = { ...state, ...partial }
    listeners.forEach((fn) => fn())
}

export function subscribe(fn: Listener): () => void {
    listeners.push(fn)
    return () => {
        listeners = listeners.filter((l) => l !== fn)
    }
}

// ─── Form data (message, name, email) ───────────────────────────────────────────

export function getFormData(): FormData {
    return formData
}

export function setFormData(partial: Partial<FormData>) {
    formData = { ...formData, ...partial }
    formListeners.forEach((fn) => fn())
}

export function subscribeFormData(fn: FormListener): () => void {
    formListeners.push(fn)
    return () => {
        formListeners = formListeners.filter((l) => l !== fn)
    }
}

// ─── Action registry ───────────────────────────────────────────────────────────
// The canvas component registers these on mount so buttons can call them.

let resetFn: (() => void) | null = null
let sendFn: (() => void) | null = null

export function registerReset(fn: () => void) {
    resetFn = fn
}

export function registerSend(fn: () => void) {
    sendFn = fn
}

export function triggerReset() {
    resetFn?.()
}

export function triggerSend() {
    sendFn?.()
}

// ─── Framer code component ──────────────────────────────────────────────────────
// Renders nothing. Must exist so Framer can upload this file as a code component.
// Place it on your canvas (or not — it loads when InkDrawCanvas is used).

interface Props {
    children?: React.ReactNode
}

export default function InkDrawStore({ children }: Props) {
    return <>{children ?? null}</>
}

addPropertyControls(InkDrawStore, {
    children: {
        type: ControlType.ComponentInstance,
        title: "Contents",
    },
})
