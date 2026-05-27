import styles from "./Tooltip.module.css"

type TooltipProps = {
    content: string
}

export function Tooltip({ content }: TooltipProps) {
    return (
        <span className={styles.wrapper} aria-label={content}>
            <span className={styles.icon} aria-hidden>?</span>
            <span className={styles.bubble} role="tooltip">{content}</span>
        </span>
    )
}
