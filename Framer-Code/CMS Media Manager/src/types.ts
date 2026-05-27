export type StagedFile = {
    id: string
    name: string
    file?: File
    status: "valid" | "rejected" | "unsupported"
    reason?: string
}

export type UploadFailure = {
    filename: string
    error: string
}

export type AppPhase = "configure" | "uploading" | "complete"

export type UploadResult = {
    successCount: number
    failures: UploadFailure[]
}
