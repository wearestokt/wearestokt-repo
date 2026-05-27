import * as React from "react"
import {
    addPropertyControls,
    ControlType,
    // Framer runtime — types may be missing in local tooling
    // @ts-expect-error useQueryData is provided by Framer at runtime
    useQueryData,
    // @ts-expect-error RenderTarget is provided by Framer at runtime
    RenderTarget,
} from "framer"

// CMSLibrary (community) — same pattern as Segment-style CMS slideshows
// @ts-expect-error Remote Framer module
import { getCollectionData } from "https://framer.com/m/CMSLibrary-09eo.js"

/** One broker row from the CMS collection (normalized in code). */
export interface JaBrokersTeamCarouselItem {
    firstName?: string
    lastName?: string
    slug?: string
    /** Image URL or Framer ResponsiveImage / CMS shape */
    profileImage?: string | { src?: string; url?: string }
    linkedinUrl?: string
    tiktokUrl?: string
    instagramUrl?: string
    websiteUrl?: string
}

type CollectionListMeta = {
    query: unknown
    childrenFunction: (d: unknown) => React.ReactNode
}

function trimStrSlot(raw: string | undefined | null): string | undefined {
    if (raw == null) return undefined
    const s = String(raw).trim()
    return s.length > 0 ? s : undefined
}

function parseTeamBrokerSlotProps(
    raw: unknown
): JaBrokersTeamCarouselItem | null {
    if (raw == null || typeof raw !== "object") return null
    const p = raw as Record<string, unknown>

    const firstName = typeof p.firstName === "string" ? p.firstName : undefined
    const lastName = typeof p.lastName === "string" ? p.lastName : undefined
    const slug = typeof p.slug === "string" ? p.slug : undefined

    const profileImage = p.profileImage as JaBrokersTeamCarouselItem["profileImage"]

    const linkedinUrl =
        trimStrSlot(typeof p.linkedinUrl === "string" ? p.linkedinUrl : undefined) ??
        trimStrSlot(typeof p.linkedin === "string" ? p.linkedin : undefined)
    const tiktokUrl = trimStrSlot(
        typeof p.tiktokUrl === "string" ? p.tiktokUrl : undefined
    )
    const instagramUrl = trimStrSlot(
        typeof p.instagramUrl === "string" ? p.instagramUrl : undefined
    )
    const websiteUrl = trimStrSlot(
        typeof p.websiteUrl === "string" ? p.websiteUrl : undefined
    )

    const hasText =
        trimStrSlot(firstName) ||
        trimStrSlot(lastName) ||
        trimStrSlot(slug) ||
        linkedinUrl ||
        tiktokUrl ||
        instagramUrl ||
        websiteUrl
    const hasImage =
        profileImage != null &&
        (typeof profileImage === "string"
            ? Boolean(trimStrSlot(profileImage))
            : typeof profileImage === "object" &&
              Boolean(
                  trimStrSlot((profileImage as { src?: string }).src) ||
                      trimStrSlot((profileImage as { url?: string }).url)
              ))

    if (!hasText && !hasImage) return null

    return {
        firstName,
        lastName,
        slug,
        profileImage,
        linkedinUrl,
        tiktokUrl,
        instagramUrl,
        websiteUrl,
    }
}

function firstCollectionListElement(
    collectionList: React.ReactNode | undefined
): React.ReactElement | null {
    if (collectionList == null) return null
    if (Array.isArray(collectionList)) {
        const first = collectionList[0]
        return React.isValidElement(first) ? first : null
    }
    return React.isValidElement(collectionList) ? collectionList : null
}

function flattenCollectionListChildren(
    clChildren: React.ReactNode
): React.ReactElement[] {
    if (clChildren == null || clChildren === false) return []
    let children: React.ReactNode[] | undefined
    if (Array.isArray(clChildren)) {
        children = clChildren
    } else if (React.isValidElement(clChildren)) {
        const ch = (clChildren.props as { children?: React.ReactNode }).children
        if (Array.isArray(ch) && ch.length > 0 && Array.isArray(ch[0])) {
            children = ch[0] as React.ReactNode[]
        } else if (Array.isArray(ch)) {
            children = ch
        }
    }
    const flat = children ?? React.Children.toArray(clChildren)
    return flat.filter((n): n is React.ReactElement => React.isValidElement(n))
}

const BROKER_TREE_PROP_KEYS = new Set([
    "firstName",
    "lastName",
    "slug",
    "profileImage",
    "image",
    "photo",
    "thumbnail",
    "avatar",
    "linkedinUrl",
    "linkedin",
    "linkedIn",
    "tiktokUrl",
    "tiktok",
    "instagramUrl",
    "instagram",
    "websiteUrl",
    "website",
    "personalWebsite",
    "url",
    "href",
])

function extractBrokerFromListItemTree(
    root: React.ReactElement
): JaBrokersTeamCarouselItem | null {
    const acc: Record<string, unknown> = {}

    function walk(node: React.ReactNode) {
        if (node == null || typeof node === "boolean" || typeof node === "number")
            return
        if (Array.isArray(node)) {
            for (const x of node) walk(x)
            return
        }
        if (!React.isValidElement(node)) return
        if (node.type === React.Fragment) {
            walk((node.props as { children?: React.ReactNode }).children)
            return
        }
        const p = node.props as Record<string, unknown>
        for (const [key, val] of Object.entries(p)) {
            if (key === "children") continue
            if (!BROKER_TREE_PROP_KEYS.has(key)) continue
            if (acc[key] !== undefined) continue
            acc[key] = val
        }
        walk(p.children as React.ReactNode)
    }

    walk(root)

    const row = {
        firstName: acc.firstName,
        lastName: acc.lastName,
        slug: acc.slug,
        profileImage:
            acc.profileImage ??
            acc.image ??
            acc.photo ??
            acc.thumbnail ??
            acc.avatar,
        linkedinUrl: acc.linkedinUrl ?? acc.linkedin ?? acc.linkedIn,
        tiktokUrl: acc.tiktokUrl ?? acc.tiktok,
        instagramUrl: acc.instagramUrl ?? acc.instagram,
        websiteUrl:
            acc.websiteUrl ??
            acc.website ??
            acc.personalWebsite ??
            acc.url ??
            acc.href,
    }
    return parseTeamBrokerSlotProps(row)
}

function trimUrl(raw: string | undefined | null): string | undefined {
    if (raw == null) return undefined
    const s = String(raw).trim()
    return s.length > 0 ? s : undefined
}

function resolveImageUrl(
    field: JaBrokersTeamCarouselItem["profileImage"]
): string | undefined {
    if (field == null) return undefined
    if (typeof field === "string") return trimUrl(field)
    if (typeof field === "object" && field !== null) {
        const o = field as Record<string, unknown>
        const direct = trimUrl(
            [o.src, o.url, o.value, o.href].find(
                v => typeof v === "string"
            ) as string | undefined
        )
        if (direct) return direct
        const nested = o.image ?? o.file
        if (nested && typeof nested === "object") {
            const n = nested as Record<string, unknown>
            return trimUrl(
                [n.url, n.src].find(v => typeof v === "string") as
                    | string
                    | undefined
            )
        }
    }
    return undefined
}

function formatBrokerDisplayName(b: JaBrokersTeamCarouselItem): string {
    const fn = trimUrl(b.firstName) ?? ""
    const ln = trimUrl(b.lastName) ?? ""
    const full = `${fn} ${ln}`.trim()
    if (full.length > 0) return full
    const slug = trimUrl(b.slug)
    if (slug && slug.length > 0)
        return slug
            .split(/[-_]+/)
            .filter(Boolean)
            .map(w => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase())
            .join(" ")
    return "—"
}

function asFetchString(v: unknown): string | undefined {
    if (typeof v === "string") {
        const t = v.trim()
        return t.length > 0 ? t : undefined
    }
    return undefined
}

/** Framer / CMS responses often wrap the array (or useQueryData returns a wrapper). */
function unwrapCmsListPayload(data: unknown): unknown {
    if (data == null) return data
    if (Array.isArray(data)) return data
    if (typeof data !== "object") return data
    const o = data as Record<string, unknown>
    const tryArrays = [
        o.items,
        o.records,
        o.results,
        o.collection,
        o.brokers,
        o.nodes,
        o.data,
    ]
    for (const a of tryArrays) {
        if (Array.isArray(a)) return a
    }
    if (o.data && typeof o.data === "object") {
        const inner = o.data as Record<string, unknown>
        if (Array.isArray(inner.items)) return inner.items
        if (Array.isArray(inner.records)) return inner.records
    }
    return data
}

/** First nested object that looks like a Framer image / asset (CMS fieldData values). */
function firstImageLikeInRecord(src: Record<string, unknown>): unknown {
    for (const v of Object.values(src)) {
        if (v == null || typeof v !== "object") continue
        const o = v as Record<string, unknown>
        const u =
            (typeof o.url === "string" && o.url) ||
            (typeof o.src === "string" && o.src) ||
            (typeof o.value === "string" && o.value.startsWith("http"))
        if (u) return v
    }
    return undefined
}

function normalizeCmsFetchPayload(data: unknown): JaBrokersTeamCarouselItem[] {
    const unwrapped = unwrapCmsListPayload(data)
    const rawItems: unknown[] = []
    if (Array.isArray(unwrapped)) rawItems.push(...unwrapped)
    else if (unwrapped && typeof unwrapped === "object") {
        const o = unwrapped as Record<string, unknown>
        if (Array.isArray(o.items)) rawItems.push(...o.items)
        else if (Array.isArray(o.brokers)) rawItems.push(...o.brokers)
        else if (Array.isArray(o.data)) rawItems.push(...o.data)
        else if (Array.isArray(o.collection)) rawItems.push(...o.collection)
        else if (Array.isArray(o.results)) rawItems.push(...o.results)
    }

    const rows: JaBrokersTeamCarouselItem[] = []
    for (const item of rawItems) {
        if (!item || typeof item !== "object") continue
        const r = item as Record<string, unknown>
        const fieldData =
            r.fieldData && typeof r.fieldData === "object"
                ? (r.fieldData as Record<string, unknown>)
                : undefined
        const src = fieldData ? { ...r, ...fieldData } : r

        const firstName = asFetchString(
            src.firstName ?? src.first_name ?? src.FirstName
        )
        const lastName = asFetchString(
            src.lastName ?? src.last_name ?? src.LastName
        )
        const name = asFetchString(src.name ?? src.fullName ?? src.title)
        let fn = firstName
        let ln = lastName
        if ((!fn || !ln) && name) {
            const parts = name.split(/\s+/).filter(Boolean)
            if (!fn && parts.length) fn = parts[0]
            if (!ln && parts.length > 1) ln = parts.slice(1).join(" ")
        }

        const slug = asFetchString(src.slug ?? src.Slug)

        let profileImage =
            src.profileImage ??
            src.image ??
            src.photo ??
            src.thumbnail ??
            src.avatar ??
            (typeof src.profileImageUrl === "string" ? src.profileImageUrl : undefined)
        if (profileImage == null) {
            profileImage = firstImageLikeInRecord(src) as
                | JaBrokersTeamCarouselItem["profileImage"]
                | undefined
        }

        const row = {
            firstName: fn,
            lastName: ln,
            slug,
            profileImage: profileImage as JaBrokersTeamCarouselItem["profileImage"],
            linkedinUrl: asFetchString(
                src.linkedinUrl ?? src.linkedin ?? src.linkedIn
            ),
            tiktokUrl: asFetchString(src.tiktokUrl ?? src.tiktok),
            instagramUrl: asFetchString(src.instagramUrl ?? src.instagram),
            websiteUrl: asFetchString(
                src.websiteUrl ?? src.website ?? src.personalWebsite ?? src.url
            ),
        }
        const parsed = parseTeamBrokerSlotProps(row)
        if (parsed) rows.push(parsed)
    }
    return rows
}

function isFramerCmsQuery(query: unknown): boolean {
    if (query == null || typeof query !== "object") return false
    const q = query as Record<string, unknown>
    return q.from != null && typeof q.from === "object"
}

/**
 * **Fully coded** JA Brokers team carousel — portrait, ticker, CTA, socials, thumb rail.
 *
 * Framer does not expose binding Collection List **offset** to variables, so the hero
 * does **not** rely on a second native list with offset. This component loads broker
 * rows from the CMS **query** (`useQueryData`) and renders `brokers[activeIndex]` itself.
 *
 * **Canvas vs real data:** On the **editor canvas**, Framer does not run the live CMS
 * query — you only see **Aperçu / Preview** placeholders when **Collection list** is
 * connected. Open **Preview** (play button) or the **published site** to verify real
 * Members content.
 *
 * **Single file:** paste this entire file into Framer’s code component (no sibling
 * modules).
 */

type LayoutMode = "auto" | "desktop" | "tablet" | "phone"
type Language = "fr" | "en"

type FontControlValue =
    | string
    | {
          fontFamily?: string
          family?: string
          font?: string
          fontSize?: number | string
          fontWeight?: number | string
          lineHeight?: number | string
          letterSpacing?: number | string
          color?: string
          [key: string]: unknown
      }

const copy = {
    fr: {
        ctaDefault: "DÉCOUVRIR SON EXPERTISE",
        certDefault: "Certifié JA Hypothèques",
        emptyState:
            "Connectez **Collection list**. Si c’est déjà fait : ouvrez **Aperçu** (lecture) ou le site publié — le canevas n’exécute pas la requête CMS. Vérifiez aussi que chaque membre a un **slug** (et idéalement prénom/nom ou photo) dans le CMS.",
        noSlug: "Profil indisponible",
    },
    en: {
        ctaDefault: "DISCOVER THEIR EXPERTISE",
        certDefault: "JA Mortgages certified",
        emptyState:
            "Connect **Collection list**. If it is: open **Preview** (play) or the published site — the editor canvas does not run the live CMS query. Ensure each member has a **slug** (and ideally first/last name or image) in CMS.",
        noSlug: "Profile unavailable",
    },
} as const

const COLORS = {
    pageBg: "#0d0d0d",
    tickerText: "rgba(255,255,255,0.12)",
    text: "#ffffff",
    border: "rgba(255,255,255,0.85)",
    thumbInactive: "rgba(255,255,255,0.25)",
    overlayGradient:
        "linear-gradient(to top, rgba(0,0,0,0.75) 0%, transparent 45%)",
} as const

function fontFamilyFromControl(
    value: FontControlValue | undefined,
    fallback: string
): string {
    if (typeof value === "string" && value.trim().length > 0) return value
    if (value && typeof value === "object") {
        const candidate = value.fontFamily || value.family || value.font
        if (typeof candidate === "string" && candidate.trim().length > 0)
            return candidate
    }
    return fallback
}

function typographyFromControl(
    value: FontControlValue | undefined,
    fallbackFamily: string
): React.CSSProperties {
    const family = fontFamilyFromControl(value, fallbackFamily)
    if (!value || typeof value !== "object") return { fontFamily: family }
    return {
        fontFamily: family,
        ...(value.fontSize !== undefined ? { fontSize: value.fontSize } : {}),
        ...(value.fontWeight !== undefined
            ? { fontWeight: value.fontWeight as React.CSSProperties["fontWeight"] }
            : {}),
        ...(value.lineHeight !== undefined
            ? { lineHeight: value.lineHeight as React.CSSProperties["lineHeight"] }
            : {}),
        ...(value.letterSpacing !== undefined
            ? { letterSpacing: value.letterSpacing as React.CSSProperties["letterSpacing"] }
            : {}),
        ...(value.color !== undefined ? { color: value.color } : {}),
    }
}

function normalizeBasePath(base: string): string {
    const t = base.trim()
    if (!t) return ""
    return t.endsWith("/") ? t.slice(0, -1) : t
}

function profileHref(basePath: string, slug: string | undefined): string | null {
    const s = trimUrl(slug)
    if (!s) return null
    const base = normalizeBasePath(basePath)
    if (!base) return `/${s}`
    return `${base}/${s}`
}

function tickerSegment(name: string): string {
    const upper = name.toUpperCase()
    return `${upper}   ·   `
}

const ICON_SIZE = 22

function IconLinkedIn() {
    return (
        <svg
            xmlns="http://www.w3.org/2000/svg"
            width={ICON_SIZE}
            height={ICON_SIZE}
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.6"
            strokeLinecap="round"
            strokeLinejoin="round"
            aria-hidden
        >
            <path d="M16 8a6 6 0 0 1 6 6v7h-4v-7a2 2 0 0 0-4 0v7h-4v-7a6 6 0 0 1 6-6z" />
            <rect x="2" y="9" width="4" height="12" />
            <circle cx="4" cy="4" r="2" />
        </svg>
    )
}

function IconTikTok() {
    return (
        <svg
            xmlns="http://www.w3.org/2000/svg"
            width={ICON_SIZE}
            height={ICON_SIZE}
            viewBox="0 0 24 24"
            fill="currentColor"
            aria-hidden
        >
            <path d="M19.59 6.69a4.83 4.83 0 0 1-3.77-4.25V2h-3.45v13.67a2.89 2.89 0 0 1-5.2 1.74 2.89 2.89 0 0 1 2.31-4.64 2.93 2.93 0 0 1 .88.13V9.4a6.84 6.84 0 0 0-1-.05A6.33 6.33 0 0 0 5 20.1a6.34 6.34 0 0 0 10.86-4.43v-7a8.16 8.16 0 0 0 4.77 1.52v-3.4a4.85 4.85 0 0 1-1-.1z" />
        </svg>
    )
}

function IconInstagram() {
    return (
        <svg
            xmlns="http://www.w3.org/2000/svg"
            width={ICON_SIZE}
            height={ICON_SIZE}
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.6"
            aria-hidden
        >
            <rect x="2" y="2" width="20" height="20" rx="5" ry="5" />
            <path d="M16 11.37A4 4 0 1 1 12.63 8 4 4 0 0 1 16 11.37z" />
            <line x1="17.5" y1="6.5" x2="17.51" y2="6.5" />
        </svg>
    )
}

function IconWebsite() {
    return (
        <svg
            xmlns="http://www.w3.org/2000/svg"
            width={ICON_SIZE}
            height={ICON_SIZE}
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.6"
            aria-hidden
        >
            <circle cx="12" cy="12" r="10" />
            <path d="M2 12h20M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z" />
        </svg>
    )
}

interface NameTickerProps {
    text: string
    /** Seconds for one full loop of duplicated track */
    durationSec: number
    fontSize: number
    color: string
    fontFamily: string
    /** Unique id for keyframes to avoid clashes */
    instanceId: string
}

function NameTicker({
    text,
    durationSec,
    fontSize,
    color,
    fontFamily,
    instanceId,
}: NameTickerProps) {
    const segment = tickerSegment(text)
    const repeated = segment.repeat(8)
    const animName = `teamBrokerTicker_${instanceId}`

    return (
        <div
            style={{
                position: "absolute",
                left: 0,
                right: 0,
                top: "50%",
                transform: "translateY(-58%)",
                overflow: "hidden",
                pointerEvents: "none",
                zIndex: 0,
            }}
            aria-hidden
        >
            <style>{`
                @keyframes ${animName} {
                    0% { transform: translateX(0); }
                    100% { transform: translateX(-50%); }
                }
                .tbc-ticker-track-${instanceId} {
                    display: flex;
                    width: max-content;
                    animation: ${animName} ${Math.max(8, durationSec)}s linear infinite;
                }
                @media (prefers-reduced-motion: reduce) {
                    .tbc-ticker-track-${instanceId} {
                        animation: none;
                        transform: translateX(0);
                    }
                }
            `}</style>
            <div
                className={`tbc-ticker-track-${instanceId}`}
                style={{
                    fontFamily,
                    fontSize,
                    fontWeight: 700,
                    letterSpacing: "0.04em",
                    color,
                    whiteSpace: "nowrap",
                    textTransform: "uppercase",
                }}
            >
                <span style={{ display: "inline-block", paddingRight: "2rem" }}>
                    {repeated}
                </span>
                <span style={{ display: "inline-block", paddingRight: "2rem" }}>
                    {repeated}
                </span>
            </div>
        </div>
    )
}

interface SocialRowProps {
    linkedin?: string
    tiktok?: string
    instagram?: string
    website?: string
    color: string
    align?: "flex-end" | "center"
}

function SocialRow({
    linkedin,
    tiktok,
    instagram,
    website,
    color,
    align = "flex-end",
}: SocialRowProps) {
    const items: Array<{ href: string; label: string; node: React.ReactNode }> = []
    const li = trimUrl(linkedin)
    const tt = trimUrl(tiktok)
    const ig = trimUrl(instagram)
    const ws = trimUrl(website)
    if (li) items.push({ href: li, label: "LinkedIn", node: <IconLinkedIn /> })
    if (tt) items.push({ href: tt, label: "TikTok", node: <IconTikTok /> })
    if (ig) items.push({ href: ig, label: "Instagram", node: <IconInstagram /> })
    if (ws) items.push({ href: ws, label: "Website", node: <IconWebsite /> })
    if (items.length === 0) return null
    return (
        <div
            style={{
                display: "flex",
                alignItems: "center",
                justifyContent: align,
                gap: 18,
                flexShrink: 0,
                width: align === "center" ? "100%" : undefined,
            }}
        >
            {items.map(it => (
                <a
                    key={it.label}
                    href={it.href}
                    target="_blank"
                    rel="noopener noreferrer"
                    aria-label={it.label}
                    style={{
                        color,
                        display: "inline-flex",
                        alignItems: "center",
                        justifyContent: "center",
                        opacity: 0.95,
                    }}
                >
                    {it.node}
                </a>
            ))}
        </div>
    )
}

export interface JaBrokersTeamCarouselFramerProps {
    /**
     * Connect your **CMS Collection List** on the canvas. This is the **data bridge**
     * only (`getCollectionData` + `useQueryData`); the carousel UI is fully rendered
     * in code from the returned rows.
     */
    collectionList?: React.ReactNode
    /**
     * How many placeholder brokers to show in the Framer **canvas** when a
     * collection list is connected (CMS query is not available in-editor).
     */
    canvasPreviewCount?: number
    profileBasePath?: string
    language?: Language
    ctaLabel?: string
    showCertificationLine?: boolean
    certificationText?: string
    layoutMode?: LayoutMode
    tickerDurationSec?: number
    tickerFontSize?: number
    tickerColor?: string
    portraitMaxWidth?: number
    portraitAspect?: number
    portraitRadius?: number
    thumbnailSize?: number
    thumbnailGap?: number
    pageBackground?: string
    nameColor?: string
    borderColor?: string
    ctaFont?: FontControlValue
    nameFont?: FontControlValue
    tickerFont?: FontControlValue
    certFont?: FontControlValue
    style?: React.CSSProperties
    width?: number | string
    height?: number | string
}

type JaBrokersTeamCarouselShellProps = {
    framerProps: JaBrokersTeamCarouselFramerProps
    collectionRef: React.ReactElement | null
    collectionMeta: CollectionListMeta | null
    isCanvasEnv: boolean
    collectionData: unknown
}

function JaBrokersTeamCarouselQueryShell(
    shell: Omit<JaBrokersTeamCarouselShellProps, "collectionData"> & {
        query: unknown
    }
) {
    const { query, ...rest } = shell
    const collectionData = useQueryData(query as never)
    return (
        <JaBrokersTeamCarouselShell
            {...rest}
            collectionData={collectionData}
        />
    )
}

function JaBrokersTeamCarouselShell(shell: JaBrokersTeamCarouselShellProps) {
    const props = shell.framerProps
    const { collectionRef, collectionMeta, isCanvasEnv, collectionData } =
        shell

    const language: Language = props.language ?? "fr"
    const t = copy[language]

    const cmsBrokers = React.useMemo(() => {
        if (isCanvasEnv) return []
        if (!collectionMeta) return []

        const fromQuery = normalizeCmsFetchPayload(collectionData)
        if (fromQuery.length > 0) return fromQuery

        if (!collectionMeta.childrenFunction) return []
        try {
            const clChildren = collectionMeta.childrenFunction(collectionData)
            const itemEls = flattenCollectionListChildren(clChildren)
            return itemEls
                .map(extractBrokerFromListItemTree)
                .filter((b): b is JaBrokersTeamCarouselItem => b != null)
        } catch {
            return []
        }
    }, [collectionMeta, collectionData, isCanvasEnv])

    const previewBrokers = React.useMemo((): JaBrokersTeamCarouselItem[] => {
        if (!isCanvasEnv) return []
        const n = Math.max(
            1,
            Math.min(12, props.canvasPreviewCount ?? 4)
        )
        if (!collectionRef) return []
        return Array.from({ length: n }, (_, i) => ({
            firstName: language === "fr" ? "Aperçu" : "Preview",
            lastName: String(i + 1),
            slug: `preview-${i + 1}`,
        }))
    }, [isCanvasEnv, collectionRef, props.canvasPreviewCount, language])

    const list =
        cmsBrokers.length > 0
            ? cmsBrokers
            : isCanvasEnv && previewBrokers.length > 0
              ? previewBrokers
              : []

    const [activeIndex, setActiveIndex] = React.useState(0)
    const tickerId = React.useId().replace(/:/g, "")

    React.useEffect(() => {
        if (list.length === 0) return
        setActiveIndex(i => Math.min(i, Math.max(0, list.length - 1)))
    }, [list.length])

    const broker = list[activeIndex] ?? list[0]
    const name = broker ? formatBrokerDisplayName(broker) : "—"
    const imgUrl = broker ? resolveImageUrl(broker.profileImage) : undefined
    const href = broker ? profileHref(props.profileBasePath ?? "", broker.slug) : null

    const frameWidthFromProps =
        typeof props.width === "number" ? props.width : undefined
    const styleWidthFromProps =
        typeof props.style?.width === "number"
            ? props.style.width
            : typeof props.style?.width === "string" &&
                props.style.width.endsWith("px")
              ? Number(props.style.width.replace("px", ""))
              : undefined
    const effectiveWidth = frameWidthFromProps ?? styleWidthFromProps ?? 1200

    const resolvedLayout: LayoutMode =
        props.layoutMode && props.layoutMode !== "auto"
            ? props.layoutMode
            : effectiveWidth > 1024
              ? "desktop"
              : effectiveWidth > 640
                ? "tablet"
                : "phone"

    const isPhone = resolvedLayout === "phone"
    const isTablet = resolvedLayout === "tablet"

    const serifFallback = "Georgia, 'Times New Roman', serif"
    const sansFallback = "system-ui, -apple-system, Segoe UI, sans-serif"

    const nameStyle = typographyFromControl(
        props.nameFont,
        serifFallback
    )
    const ctaStyle = typographyFromControl(
        props.ctaFont,
        sansFallback
    )
    const tickerFamily = fontFamilyFromControl(
        props.tickerFont,
        sansFallback
    )
    const certStyle = typographyFromControl(props.certFont, serifFallback)

    const pageBg = props.pageBackground ?? COLORS.pageBg
    const nameColor = props.nameColor ?? COLORS.text
    const borderCol = props.borderColor ?? COLORS.border
    const tickerColor = props.tickerColor ?? COLORS.tickerText
    const tickerFontSizeResolved =
        typeof props.tickerFontSize === "number" && props.tickerFontSize > 0
            ? props.tickerFontSize
            : isPhone
              ? 36
              : 56
    const tickerDuration = props.tickerDurationSec ?? 45
    const portraitMax = props.portraitMaxWidth ?? (isPhone ? 280 : isTablet ? 360 : 420)
    const aspect = Math.max(
        0.35,
        typeof props.portraitAspect === "number" && props.portraitAspect > 0
            ? props.portraitAspect
            : 0.75
    )
    const radius = props.portraitRadius ?? 12
    const thumbSize = props.thumbnailSize ?? (isPhone ? 52 : 64)
    const thumbGap = props.thumbnailGap ?? 10

    const ctaText = (props.ctaLabel && props.ctaLabel.trim()) || t.ctaDefault
    const certLine =
        (props.certificationText && props.certificationText.trim()) || t.certDefault

    const goPrev = () => {
        setActiveIndex(i => (i - 1 + list.length) % list.length)
    }
    const goNext = () => {
        setActiveIndex(i => (i + 1) % list.length)
    }

    const arrowBtnStyle: React.CSSProperties = {
        background: "transparent",
        border: "none",
        color: nameColor,
        cursor: "pointer",
        padding: 8,
        display: "inline-flex",
        alignItems: "center",
        justifyContent: "center",
        flexShrink: 0,
    }

    if (list.length === 0) {
        return (
            <div
                style={{
                    boxSizing: "border-box",
                    width: "100%",
                    minHeight: 400,
                    background: pageBg,
                    color: nameColor,
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    padding: 24,
                    textAlign: "center",
                    ...typographyFromControl(undefined, sansFallback),
                    ...(props.style ?? {}),
                }}
            >
                <span>{t.emptyState}</span>
            </div>
        )
    }

    return (
        <div
            style={{
                boxSizing: "border-box",
                width: "100%",
                background: pageBg,
                color: nameColor,
                display: "flex",
                flexDirection: "column",
                alignItems: "center",
                padding: isPhone ? "24px 16px 32px" : "40px 24px 48px",
                gap: isPhone ? 20 : 28,
                ...(props.style ?? {}),
            }}
        >
            {/* Featured */}
            <div
                style={{
                    position: "relative",
                    width: "100%",
                    maxWidth: portraitMax + 80,
                    display: "flex",
                    flexDirection: "column",
                    alignItems: "center",
                }}
            >
                <NameTicker
                    text={name}
                    durationSec={tickerDuration}
                    fontSize={tickerFontSizeResolved}
                    color={tickerColor}
                    fontFamily={tickerFamily}
                    instanceId={tickerId}
                />

                <div
                    style={{
                        position: "relative",
                        zIndex: 1,
                        width: "100%",
                        maxWidth: portraitMax,
                        aspectRatio: aspect,
                        borderRadius: radius,
                        overflow: "hidden",
                        background: "rgba(255,255,255,0.06)",
                        boxShadow: "0 24px 60px rgba(0,0,0,0.45)",
                    }}
                >
                    {imgUrl ? (
                        <img
                            src={imgUrl}
                            alt=""
                            style={{
                                width: "100%",
                                height: "100%",
                                objectFit: "cover",
                                display: "block",
                            }}
                        />
                    ) : (
                        <div
                            style={{
                                width: "100%",
                                height: "100%",
                                display: "flex",
                                alignItems: "center",
                                justifyContent: "center",
                                fontSize: 14,
                                opacity: 0.4,
                                ...typographyFromControl(undefined, sansFallback),
                            }}
                        >
                            Photo
                        </div>
                    )}
                    <div
                        style={{
                            position: "absolute",
                            inset: 0,
                            background: COLORS.overlayGradient,
                            pointerEvents: "none",
                        }}
                    />
                    {props.showCertificationLine !== false ? (
                        <div
                            style={{
                                position: "absolute",
                                left: 16,
                                bottom: 14,
                                right: 16,
                                display: "flex",
                                alignItems: "center",
                                gap: 8,
                                color: "#fff",
                                fontSize: isPhone ? 11 : 13,
                                fontStyle: "italic",
                                ...certStyle,
                            }}
                        >
                            <span
                                aria-hidden
                                style={{
                                    width: 20,
                                    height: 20,
                                    borderRadius: 4,
                                    border: "1px solid rgba(255,255,255,0.5)",
                                    flexShrink: 0,
                                }}
                            />
                            <span>{certLine}</span>
                        </div>
                    ) : null}
                </div>
            </div>

            {/* Info bar */}
            <div
                style={{
                    width: "100%",
                    maxWidth: portraitMax + 120,
                    display: "flex",
                    flexDirection: isPhone ? "column" : "row",
                    alignItems: isPhone ? "stretch" : "center",
                    justifyContent: "space-between",
                    gap: isPhone ? 16 : 20,
                    flexWrap: "wrap",
                }}
            >
                <div
                    style={{
                        ...nameStyle,
                        fontSize:
                            (nameStyle.fontSize as number | string | undefined) ??
                            (isPhone ? 22 : 28),
                        fontWeight: 400,
                        minWidth: 0,
                    }}
                >
                    {name}
                </div>

                <div
                    style={{
                        display: "flex",
                        justifyContent: "center",
                        flex: isPhone ? undefined : "1 1 auto",
                        order: isPhone ? 3 : undefined,
                        width: isPhone ? "100%" : undefined,
                    }}
                >
                    {href ? (
                        <a
                            href={href}
                            style={{
                                display: "inline-flex",
                                alignItems: "center",
                                justifyContent: "center",
                                padding: "12px 22px",
                                borderRadius: 9999,
                                border: `1px solid ${borderCol}`,
                                color: nameColor,
                                textDecoration: "none",
                                textTransform: "uppercase",
                                letterSpacing: "0.06em",
                                fontSize: isPhone ? 11 : 12,
                                fontWeight: 500,
                                whiteSpace: isPhone ? "normal" : "nowrap",
                                textAlign: "center",
                                ...ctaStyle,
                            }}
                        >
                            {ctaText}
                        </a>
                    ) : (
                        <span
                            style={{
                                opacity: 0.45,
                                fontSize: 12,
                                ...ctaStyle,
                            }}
                            title={t.noSlug}
                        >
                            {t.noSlug}
                        </span>
                    )}
                </div>

                <SocialRow
                    linkedin={broker?.linkedinUrl}
                    tiktok={broker?.tiktokUrl}
                    instagram={broker?.instagramUrl}
                    website={broker?.websiteUrl}
                    color={nameColor}
                    align={isPhone ? "center" : "flex-end"}
                />
            </div>

            {/* Thumbnail rail */}
            <div
                style={{
                    width: "100%",
                    maxWidth: Math.min(effectiveWidth - 32, 960),
                    borderTop: `1px solid ${borderCol}`,
                    borderBottom: `1px solid ${borderCol}`,
                    paddingTop: 16,
                    paddingBottom: 16,
                    boxSizing: "border-box",
                }}
            >
                <div
                    style={{
                        display: "flex",
                        alignItems: "center",
                        gap: 8,
                    }}
                >
                    <button
                        type="button"
                        onClick={goPrev}
                        aria-label="Previous broker"
                        style={arrowBtnStyle}
                    >
                        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" aria-hidden>
                            <path
                                d="M15 18l-6-6 6-6"
                                stroke="currentColor"
                                strokeWidth="2"
                                strokeLinecap="round"
                                strokeLinejoin="round"
                            />
                        </svg>
                    </button>

                    <div
                        style={{
                            flex: 1,
                            minWidth: 0,
                            display: "flex",
                            gap: thumbGap,
                            overflowX: "auto",
                            overflowY: "hidden",
                            padding: "4px 0",
                            scrollbarWidth: "thin",
                            WebkitOverflowScrolling: "touch",
                            justifyContent: list.length <= 4 && !isPhone ? "center" : "flex-start",
                        }}
                    >
                        {list.map((b, idx) => {
                            const u = resolveImageUrl(b.profileImage)
                            const active = idx === activeIndex
                            return (
                                <button
                                    key={`${trimUrl(b.slug) ?? idx}-${idx}`}
                                    type="button"
                                    onClick={() => setActiveIndex(idx)}
                                    aria-label={`Show ${formatBrokerDisplayName(b)}`}
                                    aria-current={active ? "true" : undefined}
                                    style={{
                                        width: thumbSize,
                                        height: thumbSize,
                                        padding: 0,
                                        borderRadius: 8,
                                        overflow: "hidden",
                                        cursor: "pointer",
                                        flexShrink: 0,
                                        border: active
                                            ? `2px solid ${borderCol}`
                                            : `1px solid ${COLORS.thumbInactive}`,
                                        boxSizing: "border-box",
                                        background: "rgba(255,255,255,0.05)",
                                        outline: "none",
                                    }}
                                >
                                    {u ? (
                                        <img
                                            src={u}
                                            alt=""
                                            style={{
                                                width: "100%",
                                                height: "100%",
                                                objectFit: "cover",
                                                display: "block",
                                                opacity: active ? 1 : 0.75,
                                            }}
                                        />
                                    ) : (
                                        <div
                                            style={{
                                                width: "100%",
                                                height: "100%",
                                                fontSize: 10,
                                                display: "flex",
                                                alignItems: "center",
                                                justifyContent: "center",
                                                opacity: 0.5,
                                            }}
                                        >
                                            —
                                        </div>
                                    )}
                                </button>
                            )
                        })}
                    </div>

                    <button
                        type="button"
                        onClick={goNext}
                        aria-label="Next broker"
                        style={arrowBtnStyle}
                    >
                        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" aria-hidden>
                            <path
                                d="M9 18l6-6-6-6"
                                stroke="currentColor"
                                strokeWidth="2"
                                strokeLinecap="round"
                                strokeLinejoin="round"
                            />
                        </svg>
                    </button>
                </div>
            </div>
        </div>
    )
}

export default function JaBrokersTeamCarouselFramer(
    props: JaBrokersTeamCarouselFramerProps
) {
    const isCanvasEnv = RenderTarget.current() === RenderTarget.canvas

    const collectionRef = React.useMemo(
        () => firstCollectionListElement(props.collectionList),
        [props.collectionList]
    )

    const collectionMeta = React.useMemo((): CollectionListMeta | null => {
        if (isCanvasEnv) return null
        if (!collectionRef) return null
        try {
            const o = getCollectionData(collectionRef as never) as {
                query: unknown
                childrenFunction: (d: unknown) => React.ReactNode
            }
            if (!o?.query || !o?.childrenFunction) return null
            return o
        } catch {
            return null
        }
    }, [collectionRef, isCanvasEnv])

    const shellBase: Omit<JaBrokersTeamCarouselShellProps, "collectionData"> = {
        framerProps: props,
        collectionRef,
        collectionMeta,
        isCanvasEnv,
    }

    if (
        !isCanvasEnv &&
        collectionMeta &&
        isFramerCmsQuery(collectionMeta.query)
    ) {
        return (
            <JaBrokersTeamCarouselQueryShell
                {...shellBase}
                query={collectionMeta.query}
            />
        )
    }

    return (
        <JaBrokersTeamCarouselShell
            {...shellBase}
            collectionData={undefined}
        />
    )
}

JaBrokersTeamCarouselFramer.displayName = "JA Brokers Team Carousel"

addPropertyControls(JaBrokersTeamCarouselFramer, {
    collectionList: {
        title: "Collection list",
        type: ControlType.ComponentInstance,
        description:
            "CMS data bridge only: connect your Framer CMS Collection List (CMSLibrary + useQueryData). This component renders the full carousel in code from the query result—no native hero/ticker lists or offset binding required.",
    },
    canvasPreviewCount: {
        title: "Canvas preview count",
        type: ControlType.Number,
        defaultValue: 4,
        min: 1,
        max: 12,
        step: 1,
        displayStepper: true,
        description:
            "Placeholder brokers in the Framer editor canvas when a collection list is connected.",
    },
    profileBasePath: {
        title: "Profile base path",
        type: ControlType.String,
        defaultValue: "/fr/membres/courtiers",
        placeholder: "/fr/membres/courtiers",
    },
    language: {
        title: "Language",
        type: ControlType.Enum,
        defaultValue: "fr",
        options: ["fr", "en"],
        optionTitles: ["French", "English"],
    },
    ctaLabel: {
        title: "CTA label",
        type: ControlType.String,
        defaultValue: "",
        placeholder: "DÉCOUVRIR SON EXPERTISE",
    },
    showCertificationLine: {
        title: "Show certification line",
        type: ControlType.Boolean,
        defaultValue: true,
    },
    certificationText: {
        title: "Certification text",
        type: ControlType.String,
        defaultValue: "",
    },
    layoutMode: {
        title: "Layout",
        type: ControlType.Enum,
        defaultValue: "auto",
        options: ["auto", "desktop", "tablet", "phone"],
        optionTitles: ["Auto", "Desktop", "Tablet", "Phone"],
    },
    tickerDurationSec: {
        title: "Ticker duration (s)",
        type: ControlType.Number,
        defaultValue: 45,
        min: 8,
        max: 120,
        step: 1,
        displayStepper: true,
    },
    tickerFontSize: {
        title: "Ticker font size",
        type: ControlType.Number,
        defaultValue: 0,
        min: 0,
        max: 120,
        step: 1,
        description: "0 = auto by breakpoint",
    },
    tickerColor: {
        title: "Ticker color",
        type: ControlType.Color,
        defaultValue: "rgba(255,255,255,0.12)",
    },
    portraitMaxWidth: {
        title: "Portrait max width",
        type: ControlType.Number,
        defaultValue: 420,
        min: 200,
        max: 720,
        step: 4,
        displayStepper: true,
    },
    portraitAspect: {
        title: "Portrait aspect (w/h)",
        type: ControlType.Number,
        defaultValue: 0.75,
        min: 0.5,
        max: 1.2,
        step: 0.05,
        displayStepper: true,
    },
    portraitRadius: {
        title: "Portrait radius",
        type: ControlType.Number,
        defaultValue: 12,
        min: 0,
        max: 48,
        step: 1,
        displayStepper: true,
    },
    thumbnailSize: {
        title: "Thumbnail size",
        type: ControlType.Number,
        defaultValue: 64,
        min: 40,
        max: 120,
        step: 2,
        displayStepper: true,
    },
    thumbnailGap: {
        title: "Thumbnail gap",
        type: ControlType.Number,
        defaultValue: 10,
        min: 4,
        max: 32,
        step: 1,
        displayStepper: true,
    },
    pageBackground: {
        title: "Page background",
        type: ControlType.Color,
        defaultValue: "#0d0d0d",
    },
    nameColor: {
        title: "Text / border tone",
        type: ControlType.Color,
        defaultValue: "#ffffff",
    },
    borderColor: {
        title: "CTA border",
        type: ControlType.Color,
        defaultValue: "rgba(255,255,255,0.85)",
    },
    nameFont: {
        title: "Name font",
        type: ControlType.Font,
        defaultValue: {
            fontFamily: "Georgia",
            fontSize: 28,
            fontWeight: 400,
            lineHeight: "1.2",
        },
        controls: "extended",
    },
    ctaFont: {
        title: "CTA font",
        type: ControlType.Font,
        defaultValue: {
            fontFamily: "system-ui",
            fontSize: 12,
            fontWeight: 500,
            lineHeight: "1.2",
            letterSpacing: "0.06em",
        },
        controls: "extended",
    },
    tickerFont: {
        title: "Ticker font",
        type: ControlType.Font,
        defaultValue: {
            fontFamily: "system-ui",
            fontSize: 48,
            fontWeight: 700,
            lineHeight: "1",
            letterSpacing: "0.04em",
        },
        controls: "extended",
    },
    certFont: {
        title: "Certification font",
        type: ControlType.Font,
        defaultValue: {
            fontFamily: "Georgia",
            fontSize: 13,
            fontStyle: "italic",
            fontWeight: 400,
        },
        controls: "extended",
    },
})
