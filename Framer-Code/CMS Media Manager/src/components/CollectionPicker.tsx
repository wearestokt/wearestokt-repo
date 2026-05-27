import type { Collection } from "framer-plugin"

import styles from "./CollectionPicker.module.css"

type CollectionPickerProps = {
    collections: Collection[]
    value: string
    onChange: (value: string) => void
    disabled?: boolean
    loading?: boolean
}

function StackIcon() {
    return (
        <svg width="16" height="16" viewBox="0 0 16 16" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden>
            <path d="M2 4.5h12M2 8h12M2 11.5h12" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
        </svg>
    )
}

function ChevronIcon() {
    return (
        <svg width="12" height="12" viewBox="0 0 12 12" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden>
            <path d="M3 4.5L6 7.5L9 4.5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
    )
}

export function CollectionPicker({
    collections,
    value,
    onChange,
    disabled = false,
    loading = false,
}: CollectionPickerProps) {
    const selected = collections.find((c) => c.id === value)
    const label = loading
        ? "Loading…"
        : selected?.name ?? "Select a collection"

    return (
        <div className={`${styles.wrapper} ${disabled ? styles.disabled : ""}`}>
            <div className={styles.row}>
                <span className={styles.icon}>
                    <StackIcon />
                </span>
                <span className={`${styles.label} ${!selected ? styles.placeholder : ""}`}>
                    {label}
                </span>
                <span className={styles.chevron}>
                    <ChevronIcon />
                </span>
            </div>
            <select
                className={styles.select}
                value={value}
                disabled={disabled || loading || collections.length === 0}
                onChange={(event) => onChange(event.target.value)}
                aria-label="Select collection"
            >
                <option value="">Select a collection</option>
                {collections.map((collection) => (
                    <option key={collection.id} value={collection.id}>
                        {collection.name}
                    </option>
                ))}
            </select>
        </div>
    )
}
