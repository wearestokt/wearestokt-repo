export function stripExtension(filename: string): string {
    const lastDot = filename.lastIndexOf(".")
    if (lastDot <= 0) return filename
    return filename.slice(0, lastDot)
}
