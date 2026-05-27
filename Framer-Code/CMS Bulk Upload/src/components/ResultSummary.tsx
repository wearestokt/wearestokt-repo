import type { UploadFailure } from "../types"

import { StatusMessage } from "./FieldSelect"
import styles from "./ResultSummary.module.css"

type ResultSummaryProps = {
    successCount: number
    failures: UploadFailure[]
    onReset: () => void
}

export function ResultSummary({ successCount, failures, onReset }: ResultSummaryProps) {
    const hasFailures = failures.length > 0

    return (
        <section className={styles.summary}>
            {successCount > 0 ? (
                <StatusMessage tone="success">
                    Created {successCount} item{successCount === 1 ? "" : "s"}
                </StatusMessage>
            ) : (
                <StatusMessage tone="error">No items were created</StatusMessage>
            )}

            {hasFailures ? (
                <div className={styles.failures}>
                    <p className={styles.failuresTitle}>
                        {failures.length} failure{failures.length === 1 ? "" : "s"}
                    </p>
                    <ul className={styles.failuresList}>
                        {failures.map((failure) => (
                            <li key={`${failure.filename}-${failure.error}`}>
                                <span className={styles.failureName}>{failure.filename}</span>
                                <span className={styles.failureError}>{failure.error}</span>
                            </li>
                        ))}
                    </ul>
                </div>
            ) : null}

            <button type="button" className="framer-button-primary" onClick={onReset}>
                Upload more
            </button>
        </section>
    )
}
