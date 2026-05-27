import * as React from "react"
import { addPropertyControls, ControlType } from "framer"

type MaskMode = "alpha" | "luminance"
type MaskFit = "cover" | "contain" | "fill" | "custom"
type MaskRepeat = "no-repeat" | "repeat" | "repeat-x" | "repeat-y" | "space" | "round"

type PositionPreset =
    | "center"
    | "top"
    | "right"
    | "bottom"
    | "left"
    | "top left"
    | "top right"
    | "bottom left"
    | "bottom right"
    | "custom"

type Props = {
    maskImage?: string
    maskSvg?: string
    maskSource?: "image" | "svg"
    mode?: MaskMode
    invert?: boolean
    fillColor?: string
    fillOnly?: boolean
    fit?: MaskFit
    customSize?: string
    repeat?: MaskRepeat
    positionPreset?: PositionPreset
    positionX?: string
    positionY?: string
    clip?: "border-box" | "padding-box" | "content-box"
    showDebug?: boolean
    /**
     * When true, children render normally without any masking. Useful for quick A/B comparisons.
     */
    disabled?: boolean
    style?: React.CSSProperties
    children?: React.ReactNode
}

function isNonEmptyString(value: unknown): value is string {
    return typeof value === "string" && value.trim().length > 0
}

function svgToDataUrl(svg: string): string {
    const encoded = encodeURIComponent(svg)
        .replace(/'/g, "%27")
        .replace(/"/g, "%22")
    return `data:image/svg+xml,${encoded}`
}

function invertInlineSvg(svg: string): string {
    const openIdx = svg.search(/<svg\b/i)
    if (openIdx === -1) return svg

    const gtIdx = svg.indexOf(">", openIdx)
    const closeIdx = svg.toLowerCase().lastIndexOf("</svg>")
    if (gtIdx === -1 || closeIdx === -1 || closeIdx <= gtIdx) return svg

    const head = svg.slice(0, gtIdx + 1)
    const body = svg.slice(gtIdx + 1, closeIdx)
    const tail = svg.slice(closeIdx)

    const defs = `
<defs>
  <filter id="__framerMaskInvert" color-interpolation-filters="sRGB">
    <feColorMatrix type="matrix" values="-1 0 0 0 1  0 -1 0 0 1  0 0 -1 0 1  0 0 0 1 0"/>
  </filter>
</defs>`

    return `${head}${defs}<g filter="url(#__framerMaskInvert)">${body}</g>${tail}`
}

function toMaskImageUrl(props: Props): string | undefined {
    if (props.maskSource === "svg" && isNonEmptyString(props.maskSvg)) {
        const svg = props.invert ? invertInlineSvg(props.maskSvg) : props.maskSvg
        return svgToDataUrl(svg)
    }
    if (props.maskSource === "image" && isNonEmptyString(props.maskImage)) {
        return props.maskImage
    }
    if (isNonEmptyString(props.maskImage)) return props.maskImage
    if (isNonEmptyString(props.maskSvg)) return svgToDataUrl(props.maskSvg)
    return undefined
}

function getMaskStyle(props: Props): React.CSSProperties {
    const maskUrl = toMaskImageUrl(props)

    const size =
        props.fit === "custom" && isNonEmptyString(props.customSize)
            ? props.customSize
            : props.fit === "fill"
              ? "100% 100%"
              : props.fit === "contain"
                ? "contain"
                : "cover"

    const position =
        props.positionPreset === "custom"
            ? `${props.positionX ?? "50%"} ${props.positionY ?? "50%"}`
            : props.positionPreset ?? "center"

    const repeat = props.repeat ?? "no-repeat"
    const mode = props.mode ?? "alpha"
    const clip = props.clip ?? "border-box"

    const css = {
        WebkitMaskImage: maskUrl ? `url("${maskUrl}")` : undefined,
        WebkitMaskRepeat: repeat,
        WebkitMaskPosition: position,
        WebkitMaskSize: size,
        WebkitMaskClip: clip,
        WebkitMaskOrigin: clip,

        maskImage: maskUrl ? `url("${maskUrl}")` : undefined,
        maskRepeat: repeat,
        maskPosition: position,
        maskSize: size,
        maskClip: clip,
        maskOrigin: clip,
        maskMode: mode,
    } as React.CSSProperties

    return css
}

/**
 * @framerDisableUnlink
 * @framerDisableEdit
 * @framerSupportedLayoutWidth any
 * @framerSupportedLayoutHeight any
 * @framerIntrinsicWidth 300
 * @framerIntrinsicHeight 300
 */
export default function MaskLayer(props: Props) {
    const {
        style,
        children,
        showDebug = false,
        disabled = false,
    } = props

    const maskUrl = toMaskImageUrl(props)
    const hasMask = !disabled && isNonEmptyString(maskUrl)
    const fillColor = isNonEmptyString(props.fillColor) ? props.fillColor : undefined
    const fillOnly = props.fillOnly ?? false

    return (
        <div
            style={{
                position: "relative",
                width: "100%",
                height: "100%",
                minWidth: 0,
                minHeight: 0,
                ...(hasMask ? getMaskStyle(props) : null),
                ...(showDebug
                    ? {
                          outline: "1px dashed rgba(0, 160, 255, 0.9)",
                          outlineOffset: -1,
                      }
                    : null),
                ...style,
            }}
        >
            {fillColor ? (
                <div
                    style={{
                        position: "absolute",
                        inset: 0,
                        backgroundColor: fillColor,
                        pointerEvents: "none",
                    }}
                />
            ) : null}
            {fillOnly ? null : children}
        </div>
    )
}

addPropertyControls(MaskLayer, {
    maskSource: {
        title: "Source",
        type: ControlType.SegmentedEnum,
        options: ["image", "svg"],
        optionTitles: ["Image", "SVG"],
        defaultValue: "image",
    },
    maskImage: {
        title: "Mask",
        type: ControlType.Image,
        hidden: (p) => p.maskSource !== "image",
    },
    maskSvg: {
        title: "SVG",
        type: ControlType.String,
        displayTextArea: true,
        placeholder: "<svg ...>...</svg>",
        hidden: (p) => p.maskSource !== "svg",
    },
    invert: {
        title: "Invert",
        type: ControlType.Boolean,
        defaultValue: false,
        enabledTitle: "On",
        disabledTitle: "Off",
        hidden: (p) => p.maskSource !== "svg",
    },
    fillColor: {
        title: "Fill",
        type: ControlType.Color,
    },
    fillOnly: {
        title: "Fill only",
        type: ControlType.Boolean,
        defaultValue: false,
        enabledTitle: "Yes",
        disabledTitle: "No",
    },
    disabled: {
        title: "Disable",
        type: ControlType.Boolean,
        defaultValue: false,
        enabledTitle: "Yes",
        disabledTitle: "No",
    },
    mode: {
        title: "Mode",
        type: ControlType.SegmentedEnum,
        options: ["alpha", "luminance"],
        optionTitles: ["Alpha", "Luma"],
        defaultValue: "alpha",
    },
    fit: {
        title: "Fit",
        type: ControlType.Enum,
        options: ["cover", "contain", "fill", "custom"],
        defaultValue: "cover",
    },
    customSize: {
        title: "Size",
        type: ControlType.String,
        defaultValue: "100% 100%",
        hidden: (p) => p.fit !== "custom",
    },
    positionPreset: {
        title: "Position",
        type: ControlType.Enum,
        options: [
            "center",
            "top",
            "right",
            "bottom",
            "left",
            "top left",
            "top right",
            "bottom left",
            "bottom right",
            "custom",
        ],
        defaultValue: "center",
    },
    positionX: {
        title: "X",
        type: ControlType.String,
        defaultValue: "50%",
        hidden: (p) => p.positionPreset !== "custom",
    },
    positionY: {
        title: "Y",
        type: ControlType.String,
        defaultValue: "50%",
        hidden: (p) => p.positionPreset !== "custom",
    },
    repeat: {
        title: "Repeat",
        type: ControlType.Enum,
        options: ["no-repeat", "repeat", "repeat-x", "repeat-y", "space", "round"],
        optionTitles: ["No", "Both", "X", "Y", "Space", "Round"],
        defaultValue: "no-repeat",
    },
    clip: {
        title: "Clip",
        type: ControlType.Enum,
        options: ["border-box", "padding-box", "content-box"],
        optionTitles: ["Border", "Padding", "Content"],
        defaultValue: "border-box",
    },
    showDebug: {
        title: "Debug",
        type: ControlType.Boolean,
        defaultValue: false,
        enabledTitle: "On",
        disabledTitle: "Off",
    },
})

