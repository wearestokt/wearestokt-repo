import type { ReactNode } from "react"

import styles from "./FieldSelect.module.css"

type Option = {
    id: string
    name: string
}

type FieldSelectProps = {
    label: string
    value: string
    options: Option[]
    onChange: (value: string) => void
    disabled?: boolean
    placeholder?: string
}

export function FieldSelect({
    label,
    value,
    options,
    onChange,
    disabled = false,
    placeholder = "Select…",
}: FieldSelectProps) {
    return (
        <label className={styles.field}>
            <span className={styles.label}>{label}</span>
            <select
                className={styles.select}
                value={value}
                disabled={disabled || options.length === 0}
                onChange={(event) => onChange(event.target.value)}
            >
                <option value="">{options.length === 0 ? "No fields available" : placeholder}</option>
                {options.map((option) => (
                    <option key={option.id} value={option.id}>
                        {option.name}
                    </option>
                ))}
            </select>
        </label>
    )
}

type StatusMessageProps = {
    children: ReactNode
    tone?: "default" | "error" | "success"
}

export function StatusMessage({ children, tone = "default" }: StatusMessageProps) {
    return <p className={`${styles.message} ${styles[tone]}`}>{children}</p>
}
