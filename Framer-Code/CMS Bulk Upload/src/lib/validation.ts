const ACCEPTED_MIME_TYPES = new Set([
    "image/jpeg",
    "image/png",
    "image/webp",
    "image/gif",
])

const ACCEPTED_EXTENSIONS = new Set([".jpg", ".jpeg", ".png", ".webp", ".gif"])

const MAX_FILE_SIZE_BYTES = 10 * 1024 * 1024

function hasAcceptedExtension(filename: string): boolean {
    const lower = filename.toLowerCase()
    for (const ext of ACCEPTED_EXTENSIONS) {
        if (lower.endsWith(ext)) return true
    }
    return false
}

export type ValidationResult =
    | { valid: true }
    | { valid: false; reason: string; rejectionType: "unsupported-format" | "too-large" }

export function validateImageFile(file: File): ValidationResult {
    const mimeOk = ACCEPTED_MIME_TYPES.has(file.type)
    const extensionOk = hasAcceptedExtension(file.name)

    if (!mimeOk && !extensionOk) {
        return { valid: false, reason: "Unsupported format", rejectionType: "unsupported-format" }
    }

    if (file.size > MAX_FILE_SIZE_BYTES) {
        const sizeMb = (file.size / (1024 * 1024)).toFixed(1)
        return { valid: false, reason: `File too large (${sizeMb} MB)`, rejectionType: "too-large" }
    }

    return { valid: true }
}
