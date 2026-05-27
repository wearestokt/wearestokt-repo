import type { StagedFile } from "../types"

import styles from "./StagedFileList.module.css"

type StagedFileListProps = {
    files: StagedFile[]
    onRemove: (id: string) => void
    disabled?: boolean
}

export function StagedFileList({ files, onRemove, disabled = false }: StagedFileListProps) {
    if (files.length === 0) return null

    return (
        <ul className={styles.list}>
            {files.map((file) => (
                <li key={file.id} className={styles.item}>
                    <div className={styles.meta}>
                        <span className={styles.name}>{file.name}</span>
                        {file.status === "rejected" && file.reason ? (
                            <span className={styles.reason}>{file.reason}</span>
                        ) : null}
                    </div>
                    {file.status === "valid" ? (
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
