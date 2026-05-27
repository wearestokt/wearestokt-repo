/**
 * Shared store for Cookie Banner consent state.
 * Copy this file to Framer as CookieBanner/CookieBannerStore.
 */

// @ts-expect-error - Framer CDN URL import
import { createStore } from "https://framer.com/m/framer/store.js@^1.0.0"

export interface ConsentCategories {
    essential: boolean
    analytics: boolean
    marketing: boolean
}

export interface StoredConsent {
    consentGiven: boolean
    categories: ConsentCategories
    expiresAt: number | null
}

const defaultCategories: ConsentCategories = {
    essential: true,
    analytics: false,
    marketing: false,
}

const STORAGE_KEY_DEFAULT = "cookie-consent"

const initialState = {
    consentGiven: null as boolean | null,
    categories: defaultCategories,
    showBanner: true,
    showCustomizePanel: false,
    storageKey: STORAGE_KEY_DEFAULT,
    expiryDays: 365,
}

export const useCookieBannerStore = createStore(initialState)

export function setConsent(
    accepted: boolean,
    categories: ConsentCategories,
    setStore: (s: Record<string, unknown>) => void
) {
    setStore({
        consentGiven: accepted,
        categories,
        showBanner: false,
        showCustomizePanel: false,
    })
}

export function reset(setStore: (s: Record<string, unknown>) => void) {
    setStore({
        ...initialState,
        categories: { ...defaultCategories },
    })
}

export function loadStoredConsent(
    storageKey: string,
    expiryDays: number
): StoredConsent | null {
    if (typeof window === "undefined") return null
    try {
        const raw = localStorage.getItem(storageKey)
        if (!raw) return null
        const data = JSON.parse(raw) as StoredConsent
        if (data.expiresAt != null && Date.now() > data.expiresAt) {
            localStorage.removeItem(storageKey)
            return null
        }
        return data
    } catch {
        return null
    }
}

export function saveConsent(
    storageKey: string,
    consentGiven: boolean,
    categories: ConsentCategories,
    expiryDays: number
) {
    if (typeof window === "undefined" || expiryDays <= 0) return
    try {
        const expiresAt =
            expiryDays > 0 ? Date.now() + expiryDays * 24 * 60 * 60 * 1000 : null
        localStorage.setItem(
            storageKey,
            JSON.stringify({
                consentGiven,
                categories,
                expiresAt,
            } as StoredConsent)
        )
    } catch {
        // ignore
    }
}
