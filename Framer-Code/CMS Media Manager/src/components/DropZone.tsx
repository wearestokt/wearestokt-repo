import { useRef, useState, type DragEvent, type ReactNode } from "react"

import styles from "./DropZone.module.css"

const ACCEPT = "image/jpeg,image/png,image/webp,image/gif"

type DropZoneProps = {
    onFilesSelected: (files: FileList | File[]) => void
    disabled?: boolean
    children?: ReactNode
}

const hiddenInputStyle: React.CSSProperties = {
    position: "absolute",
    width: 0,
    height: 0,
    opacity: 0,
    overflow: "hidden",
    pointerEvents: "none",
}

export function DropZone({ onFilesSelected, disabled = false, children }: DropZoneProps) {
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
        <>
            <input
                ref={inputRef}
                type="file"
                accept={ACCEPT}
                multiple
                style={hiddenInputStyle}
                disabled={disabled}
                tabIndex={-1}
                aria-hidden
                onChange={(event) => {
                    handleFiles(event.target.files)
                    event.target.value = ""
                }}
            />
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
                {children}
            </div>
        </>
    )
}
