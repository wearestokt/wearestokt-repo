import { useRef, useState, type DragEvent } from "react"

import styles from "./DropZone.module.css"

const ACCEPT = "image/jpeg,image/png,image/webp,image/gif"

type DropZoneProps = {
    onFilesSelected: (files: FileList | File[]) => void
    disabled?: boolean
}

export function DropZone({ onFilesSelected, disabled = false }: DropZoneProps) {
    const inputRef = useRef<HTMLInputElement>(null)
    const [isDragging, setIsDragging] = useState(false)

    function handleFiles(fileList: FileList | null) {
        if (!fileList || disabled) return
        onFilesSelected(fileList)
    }

    function handleDragOver(event: DragEvent<HTMLDivElement>) {
        event.preventDefault()
        if (disabled) return
        setIsDragging(true)
    }

    function handleDragLeave(event: DragEvent<HTMLDivElement>) {
        event.preventDefault()
        setIsDragging(false)
    }

    function handleDrop(event: DragEvent<HTMLDivElement>) {
        event.preventDefault()
        setIsDragging(false)
        handleFiles(event.dataTransfer.files)
    }

    return (
        <div
            className={`${styles.dropZone} ${isDragging ? styles.dragging : ""} ${disabled ? styles.disabled : ""}`}
            onDragOver={handleDragOver}
            onDragLeave={handleDragLeave}
            onDrop={handleDrop}
            onClick={() => {
                if (!disabled) inputRef.current?.click()
            }}
            role="button"
            tabIndex={disabled ? -1 : 0}
            onKeyDown={(event) => {
                if (disabled) return
                if (event.key === "Enter" || event.key === " ") {
                    event.preventDefault()
                    inputRef.current?.click()
                }
            }}
        >
            <input
                ref={inputRef}
                type="file"
                accept={ACCEPT}
                multiple
                className={styles.input}
                disabled={disabled}
                onChange={(event) => {
                    handleFiles(event.target.files)
                    event.target.value = ""
                }}
            />
            <span className={styles.title}>Drop images here</span>
            <span className={styles.subtitle}>JPEG, PNG, WebP, GIF · Max 10 MB</span>
        </div>
    )
}
