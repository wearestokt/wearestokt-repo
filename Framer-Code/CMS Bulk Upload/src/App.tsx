import { framer } from "framer-plugin"
import { useEffect, useMemo, useState } from "react"

import { DropZone } from "./components/DropZone"
import { FieldSelect, StatusMessage } from "./components/FieldSelect"
import { ResultSummary } from "./components/ResultSummary"
import { StagedFileList } from "./components/StagedFileList"
import { useCollectionFields } from "./hooks/useCollectionFields"
import { useCollections } from "./hooks/useCollections"
import { validateImageFile } from "./lib/validation"
import { uploadBatch } from "./lib/upload"
import type { AppPhase, StagedFile, UploadResult } from "./types"

import "./App.css"

framer.showUI({
    position: "top right",
    width: 320,
    height: 520,
})

function createStagedFile(file: File): StagedFile {
    const validation = validateImageFile(file)

    if (!validation.valid) {
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

export function App() {
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
    const [phase, setPhase] = useState<AppPhase>("configure")
    const [uploadProgress, setUploadProgress] = useState({ current: 0, total: 0 })
    const [uploadResult, setUploadResult] = useState<UploadResult | null>(null)

    useEffect(() => {
        setTitleFieldId("")
        setImageFieldId("")
    }, [selectedCollectionId])

    const validFileCount = useMemo(
        () => stagedFiles.filter((file) => file.status === "valid").length,
        [stagedFiles]
    )

    const isBusy = phase === "uploading"
    const controlsDisabled = isBusy || collectionsLoading || fieldsLoading

    const canUpload =
        !!selectedCollection &&
        !!titleFieldId &&
        !!imageFieldId &&
        validFileCount > 0 &&
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

        const result = await uploadBatch({
            collection: selectedCollection,
            files: stagedFiles,
            titleFieldId,
            imageFieldId,
            onProgress: (current, total) => setUploadProgress({ current, total }),
        })

        setUploadResult(result)
        setPhase("complete")
    }

    return (
        <main className="app-main">
            <header className="app-header">
                <h1 className="app-title">CMS Bulk Upload</h1>
                <p className="app-subtitle">Upload images as new CMS items.</p>
            </header>

            {collectionsError ? <StatusMessage tone="error">{collectionsError}</StatusMessage> : null}
            {fieldsError ? <StatusMessage tone="error">{fieldsError}</StatusMessage> : null}

            {collectionsLoading ? (
                <StatusMessage>Loading collections…</StatusMessage>
            ) : collections.length === 0 ? (
                <StatusMessage>No writable CMS collections found.</StatusMessage>
            ) : (
                <FieldSelect
                    label="Collection"
                    value={selectedCollectionId}
                    options={collections.map((collection) => ({
                        id: collection.id,
                        name: collection.name,
                    }))}
                    onChange={setSelectedCollectionId}
                    disabled={controlsDisabled || phase === "complete"}
                    placeholder="Select collection"
                />
            )}

            {selectedCollection ? (
                <>
                    <FieldSelect
                        label="Title field"
                        value={titleFieldId}
                        options={stringFields.map((field) => ({ id: field.id, name: field.name }))}
                        onChange={setTitleFieldId}
                        disabled={controlsDisabled || phase === "complete"}
                        placeholder="Select string field"
                    />

                    <FieldSelect
                        label="Image field"
                        value={imageFieldId}
                        options={imageFields.map((field) => ({ id: field.id, name: field.name }))}
                        onChange={setImageFieldId}
                        disabled={controlsDisabled || phase === "complete"}
                        placeholder="Select image field"
                    />
                </>
            ) : null}

            {phase === "complete" && uploadResult ? (
                <ResultSummary
                    successCount={uploadResult.successCount}
                    failures={uploadResult.failures}
                    onReset={handleReset}
                />
            ) : (
                <>
                    <DropZone onFilesSelected={handleFilesSelected} disabled={controlsDisabled} />
                    <StagedFileList
                        files={stagedFiles}
                        onRemove={handleRemoveFile}
                        disabled={controlsDisabled}
                    />

                    {phase === "uploading" ? (
                        <StatusMessage>
                            Uploading {uploadProgress.current} of {uploadProgress.total}…
                        </StatusMessage>
                    ) : null}

                    <button
                        type="button"
                        className="framer-button-primary"
                        disabled={!canUpload}
                        onClick={() => void handleUpload()}
                    >
                        Upload
                    </button>
                </>
            )}
        </main>
    )
}
