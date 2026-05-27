import type { StagedFile } from "../types"

import styles from "./StagedFileList.module.css"

type StagedFileListProps = {
    files: StagedFile[]
    onRemove: (id: string) => void
    disabled?: boolean
    allowUnsupported?: boolean
}

export function StagedFileList({ files, onRemove, disabled = false, allowUnsupported = false }: StagedFileListProps) {
    if (files.length === 0) return null

    return (
        <ul className={styles.list}>
            {files.map((file) => (
                <li
                    key={file.id}
                    className={`${styles.item} ${file.status === "unsupported" ? styles.itemUnsupported : ""}`}
                >
                    <div className={styles.meta}>
                        <span className={styles.name}>{file.name}</span>
                        {file.status === "rejected" && file.reason ? (
                            <span className={styles.reasonError}>{file.reason}</span>
                        ) : null}
                        {file.status === "unsupported" ? (
                            <span className={styles.reasonWarning}>
                                {allowUnsupported ? "Title only — no image" : file.reason}
                            </span>
                        ) : null}
                    </div>
                    {file.status === "valid" || file.status === "unsupported" ? (
                        <button
                            type="button"
                            className={styles.remove}
                            disabled={disabled}
                            aria-label={`Remove ${file.name}`}
                            onClick={() => onRemove(file.id)}
                        >
                            ×
                        </button>
                    ) : null}
                </li>
            ))}
        </ul>
    )
}
