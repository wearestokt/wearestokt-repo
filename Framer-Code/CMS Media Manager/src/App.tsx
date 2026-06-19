import { framer, useIsAllowedTo } from "framer-plugin"
import { useEffect, useMemo, useRef, useState } from "react"

import { CollectionPicker } from "./components/CollectionPicker"
import { DropZone } from "./components/DropZone"
import { FieldSelect, StatusMessage } from "./components/FieldSelect"
import { ResultSummary } from "./components/ResultSummary"
import { StagedFileList } from "./components/StagedFileList"
import { Tooltip } from "./components/Tooltip"
import { useCollectionFields } from "./hooks/useCollectionFields"
import { useCollections } from "./hooks/useCollections"
import { validateImageFile } from "./lib/validation"
import { uploadBatch } from "./lib/upload"
import type { AppPhase, StagedFile, UploadResult } from "./types"

import "./App.css"

framer.showUI({
    position: "top right",
    width: 300,
    height: 460,
})

function createStagedFile(file: File): StagedFile {
    const validation = validateImageFile(file)

    if (!validation.valid) {
        if (validation.rejectionType === "unsupported-format") {
            return {
                id: crypto.randomUUID(),
                name: file.name,
                status: "unsupported",
                reason: validation.reason,
            }
        }
        return {
            id: crypto.randomUUID(),
            name: file.name,
            status: "rejected",
            reason: validation.reason,
        }
    }

    return {
        id: crypto.randomUUID(),
        name: file.name,
        file,
        status: "valid",
    }
}

function UploadCloudIcon() {
    return (
        <svg width="32" height="32" viewBox="0 0 32 32" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden>
            <path
                d="M10.667 21.333S6 21.333 6 16.667c0-3.734 2.933-6.4 6.667-6.4.266 0 .533 0 .8.027C14.4 7.893 17.067 6 20 6c4 0 6.667 2.933 6.667 6.667 0 .266 0 .533-.027.8C28.4 14.267 30 16 30 18c0 2.4-2 3.333-4 3.333"
                stroke="currentColor"
                strokeWidth="1.5"
                strokeLinecap="round"
                strokeLinejoin="round"
            />
            <path
                d="M20 24l-4-4-4 4M16 20v10"
                stroke="currentColor"
                strokeWidth="1.5"
                strokeLinecap="round"
                strokeLinejoin="round"
            />
        </svg>
    )
}

export function App() {
    const fileInputRef = useRef<HTMLInputElement>(null)

    const {
        collections,
        selectedCollection,
        selectedCollectionId,
        setSelectedCollectionId,
        loading: collectionsLoading,
        error: collectionsError,
    } = useCollections()

    const { stringFields, imageFields, loading: fieldsLoading, error: fieldsError } =
        useCollectionFields(selectedCollection)

    const [titleFieldId, setTitleFieldId] = useState("")
    const [imageFieldId, setImageFieldId] = useState("")
    const [stagedFiles, setStagedFiles] = useState<StagedFile[]>([])
    const [allowUnsupported, setAllowUnsupported] = useState(false)
    const [phase, setPhase] = useState<AppPhase>("configure")
    const [uploadProgress, setUploadProgress] = useState({ current: 0, total: 0 })
    const [uploadResult, setUploadResult] = useState<UploadResult | null>(null)

    useEffect(() => {
        setTitleFieldId("")
        setImageFieldId("")
    }, [selectedCollectionId])

    const validFileCount = useMemo(
        () =>
            stagedFiles.filter(
                (file) =>
                    file.status === "valid" ||
                    (allowUnsupported && file.status === "unsupported")
            ).length,
        [stagedFiles, allowUnsupported]
    )

    const unsupportedCount = useMemo(
        () => stagedFiles.filter((file) => file.status === "unsupported").length,
        [stagedFiles]
    )

    const canAddItems = useIsAllowedTo("Collection.addItems")

    const isBusy = phase === "uploading"
    const controlsDisabled = isBusy || collectionsLoading || fieldsLoading

    const canUpload =
        !!selectedCollection &&
        !!titleFieldId &&
        !!imageFieldId &&
        validFileCount > 0 &&
        canAddItems &&
        !controlsDisabled

    function handleFilesSelected(fileList: FileList | File[]) {
        const incoming = Array.from(fileList).map(createStagedFile)
        setStagedFiles((current) => [...current, ...incoming])
    }

    function handleRemoveFile(id: string) {
        setStagedFiles((current) => current.filter((file) => file.id !== id))
    }

    function handleReset() {
        setStagedFiles([])
        setUploadResult(null)
        setUploadProgress({ current: 0, total: 0 })
        setPhase("configure")
    }

    async function handleUpload() {
        if (!selectedCollection || !titleFieldId || !imageFieldId || validFileCount === 0) return

        setPhase("uploading")
        setUploadResult(null)
        setUploadProgress({ current: 0, total: validFileCount })

        try {
            const result = await uploadBatch({
                collection: selectedCollection,
                files: stagedFiles,
                titleFieldId,
                imageFieldId,
                allowUnsupported,
                onProgress: (current, total) => setUploadProgress({ current, total }),
            })
            setUploadResult(result)
            setPhase("complete")
        } catch (error) {
            const message =
                error instanceof Error ? error.message : "Upload failed. Please try again."
            framer.notify(message, { variant: "error" })
            setPhase("configure")
        }
    }

    const hasFiles = stagedFiles.length > 0
    const isComplete = phase === "complete" && uploadResult !== null

    return (
        <main className="app-main">
            {/* Collection picker row */}
            {collectionsError ? (
                <div className="app-section">
                    <StatusMessage tone="error">{collectionsError}</StatusMessage>
                </div>
            ) : (
                <CollectionPicker
                    collections={collections}
                    value={selectedCollectionId}
                    onChange={setSelectedCollectionId}
                    disabled={controlsDisabled || isComplete}
                    loading={collectionsLoading}
                />
            )}

            <div className="app-divider" />

            {/* Field selectors — compact 2-col, only when collection is selected */}
            {selectedCollection && !isComplete ? (
                <>
                    <div className="app-fields">
                        {fieldsError ? (
                            <StatusMessage tone="error">{fieldsError}</StatusMessage>
                        ) : (
                            <>
                                <FieldSelect
                                    label="Title field"
                                    value={titleFieldId}
                                    options={stringFields.map((f) => ({ id: f.id, name: f.name }))}
                                    onChange={setTitleFieldId}
                                    disabled={controlsDisabled}
                                    placeholder="Select…"
                                />
                                <FieldSelect
                                    label="Image field"
                                    value={imageFieldId}
                                    options={imageFields.map((f) => ({ id: f.id, name: f.name }))}
                                    onChange={setImageFieldId}
                                    disabled={controlsDisabled}
                                    placeholder="Select…"
                                />
                            </>
                        )}
                    </div>
                    <div className="app-divider" />
                </>
            ) : null}

            {/* Body */}
            {isComplete ? (
                <div className="app-section">
                    <ResultSummary
                        successCount={uploadResult.successCount}
                        failures={uploadResult.failures}
                        onReset={handleReset}
                    />
                </div>
            ) : !hasFiles ? (
                /* Empty state */
                <div className="app-empty-state">
                    <DropZone onFilesSelected={handleFilesSelected} disabled={controlsDisabled}>
                        <div className="app-empty-inner">
                            <span className="app-empty-icon">
                                <UploadCloudIcon />
                            </span>
                            <span className="app-empty-title">Drop images here</span>
                            <span className="app-empty-sub">
                                or click to browse · JPEG, PNG, WebP, GIF · 10 MB max
                            </span>
                        </div>
                    </DropZone>
                </div>
            ) : (
                /* Staged files */
                <div className="app-section">
                    <StagedFileList
                        files={stagedFiles}
                        onRemove={handleRemoveFile}
                        disabled={controlsDisabled}
                        allowUnsupported={allowUnsupported}
                    />

                    {unsupportedCount > 0 ? (
                        <label className="app-checkbox-row">
                            <input
                                type="checkbox"
                                checked={allowUnsupported}
                                disabled={controlsDisabled}
                                onChange={(event) => setAllowUnsupported(event.target.checked)}
                            />
                            <span className="app-checkbox-label">
                                Create items for unsupported files
                            </span>
                            <Tooltip content="When enabled, files with unsupported formats (e.g. videos) still create a new CMS item with the filename as the title. The image field is left empty — useful for linking a Bunny.net video ID later." />
                        </label>
                    ) : null}

                    {phase === "uploading" ? (
                        <StatusMessage>
                            Uploading {uploadProgress.current} of {uploadProgress.total}…
                        </StatusMessage>
                    ) : !canAddItems ? (
                        <StatusMessage tone="error">
                            You don't have permission to edit this collection.
                        </StatusMessage>
                    ) : null}

                    <div className="app-actions">
                        <button
                            type="button"
                            className="framer-button-secondary"
                            disabled={controlsDisabled}
                            onClick={() => {
                                if (!controlsDisabled) fileInputRef.current?.click()
                            }}
                        >
                            Add more
                        </button>
                        <button
                            type="button"
                            className="framer-button-primary"
                            disabled={!canUpload}
                            onClick={() => void handleUpload()}
                        >
                            Upload {validFileCount > 0 ? `${validFileCount} file${validFileCount === 1 ? "" : "s"}` : ""}
                        </button>
                    </div>

                    {/* Hidden file input for "Add more" — must be zero-size, not display:none */}
                    <input
                        ref={fileInputRef}
                        type="file"
                        accept="image/jpeg,image/png,image/webp,image/gif"
                        multiple
                        style={{ position: "absolute", width: 0, height: 0, opacity: 0, overflow: "hidden", pointerEvents: "none" }}
                        tabIndex={-1}
                        aria-hidden
                        onChange={(event) => {
                            if (event.target.files) handleFilesSelected(event.target.files)
                            event.target.value = ""
                        }}
                    />
                </div>
            )}
        </main>
    )
}
