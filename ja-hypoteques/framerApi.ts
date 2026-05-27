/**
 * Reference copy of API helpers used by Framer components.
 * Do NOT import this file from Framer Code Sync — helpers are inlined in each *Framer.tsx file.
 */
export const DEFAULT_API_BASE_URL = "https://api.jahypotheques.ca"

export const API_PATHS = {
    calculatorResults: "/api/calculator-results",
    publicCode: "/api/public/v1/code",
    publicLeads: "/api/public/v1/leads",
    publicAiderUnProche: "/api/public/v1/contests/aider-un-proche",
} as const

export function normalizeApiBaseUrl(baseUrl?: string): string {
    const trimmed = (baseUrl ?? DEFAULT_API_BASE_URL).trim().replace(/\/+$/, "")
    return trimmed || DEFAULT_API_BASE_URL
}

export function buildApiUrl(baseUrl: string | undefined, path: string): string {
    return `${normalizeApiBaseUrl(baseUrl)}${path}`
}

export function toE164CanadianPhone(phone: string): string {
    const digitsOnly = (phone || "").replace(/\D/g, "")
    const tenDigits =
        digitsOnly.length === 11 && digitsOnly.startsWith("1")
            ? digitsOnly.slice(1)
            : digitsOnly
    return `+1${tenDigits}`
}

export function parseSmsErrorCode(body: Record<string, unknown> | null | undefined): string | undefined {
    if (!body) return undefined
    if (typeof body.error === "string") return body.error
    if (typeof body.errorCode === "string") return body.errorCode
    if (body.data && typeof body.data === "object") {
        const data = body.data as Record<string, unknown>
        if (typeof data.error === "string") return data.error
        if (typeof data.errorCode === "string") return data.errorCode
    }
    return undefined
}

export function parseRetryAfterSeconds(
    body: Record<string, unknown> | null | undefined,
    fallbackSeconds = 20
): number {
    const raw =
        typeof body?.retryAfter === "number"
            ? body.retryAfter
            : body?.data && typeof body.data === "object"
              ? (body.data as Record<string, unknown>).retryAfter
              : undefined
    if (typeof raw !== "number" || raw <= 0) return fallbackSeconds
    return raw > 1000 ? Math.ceil(raw / 1000) : Math.ceil(raw)
}

export const SMS_CODE_THROTTLE_SECONDS = 20
