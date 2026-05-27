import * as React from "react"
import { useEffect, useState } from "react"
import { addPropertyControls, ControlType } from "framer"

type IntlWithSupportedValuesOf = typeof Intl & {
    supportedValuesOf?: (key: string) => string[]
}

const fallbackTimezones = [
    "America/New_York",
    "America/Chicago",
    "America/Denver",
    "America/Los_Angeles",
    "Europe/London",
    "Europe/Paris",
    "Asia/Tokyo",
    "Australia/Sydney",
]

const tzValues =
    (Intl as IntlWithSupportedValuesOf).supportedValuesOf?.("timeZone") ??
    fallbackTimezones

const allTimezones = tzValues.filter(
    (tz) => !tz.startsWith("Etc") && !tz.startsWith("SystemV")
)

function getCityLabel(tz: string): string {
    const parts = tz.split("/")
    const city = parts[1]?.replace(/_/g, " ") || tz
    return `${city} (${parts[0]})`
}

const timezoneOptions = allTimezones.map((tz) => ({
    value: tz,
    title: getCityLabel(tz),
}))

type WorldTimeProps = {
    city: string
    show: "time" | "date" | "both"
    format: "12hr" | "24hr"
    ampmCase: "upper" | "lower"
    showSeconds: boolean
    twoDigitHour: boolean
    dateFormat: "small" | "medium" | "large"
    customFont?: { fontFamily?: string; fontWeight?: number | string }
    fontSize: string
    lineHeight: number
    letterSpacing: number
    color: string
}

function WorldTime(props: WorldTimeProps) {
    const {
        city,
        show,
        format,
        ampmCase,
        showSeconds,
        twoDigitHour,
        dateFormat,
        customFont,
        fontSize,
        lineHeight,
        letterSpacing,
        color,
    } = props

    const [output, setOutput] = useState("")

    useEffect(() => {
        const updateOutput = () => {
            const now = new Date()
            let timeString = ""
            let dateString = ""

            if (show !== "date") {
                const timeOptions: Intl.DateTimeFormatOptions = {
                    hour: twoDigitHour ? "2-digit" : "numeric",
                    minute: "2-digit",
                    second: showSeconds ? "2-digit" : undefined,
                    hour12: format === "12hr",
                    timeZone: city,
                }
                timeString = new Intl.DateTimeFormat("en-US", timeOptions).format(now)

                if (format === "12hr") {
                    const [timePart, ampmPart = ""] = timeString.split(" ")
                    const ampm =
                        ampmCase === "lower"
                            ? ampmPart.toLowerCase()
                            : ampmPart.toUpperCase()
                    timeString = `${timePart} ${ampm}`.trim()
                }
            }

            if (show !== "time") {
                const dateOptions: Intl.DateTimeFormatOptions =
                    dateFormat === "large"
                        ? {
                              year: "numeric",
                              month: "long",
                              day: "numeric",
                              timeZone: city,
                          }
                        : dateFormat === "small"
                        ? {
                              year: "2-digit",
                              month: "2-digit",
                              day: "2-digit",
                              timeZone: city,
                          }
                        : {
                              weekday: "short",
                              month: "short",
                              day: "numeric",
                              timeZone: city,
                          }
                dateString = new Intl.DateTimeFormat("en-US", dateOptions).format(now)
            }

            setOutput(
                show === "time"
                    ? timeString
                    : show === "date"
                    ? dateString
                    : `${timeString} ${dateString}`
            )
        }

        updateOutput()
        const interval = setInterval(updateOutput, 1000)
        return () => clearInterval(interval)
    }, [city, format, showSeconds, ampmCase, twoDigitHour, show, dateFormat])

    return (
        <div
            style={{
                width: "100%",
                height: "100%",
                display: "flex",
                alignItems: "center",
                overflow: "hidden",
            }}
        >
            <div
                style={{
                    fontFamily: customFont?.fontFamily ?? "Inter",
                    fontWeight: customFont?.fontWeight ?? 400,
                    fontSize,
                    lineHeight,
                    color,
                    letterSpacing,
                    whiteSpace: "normal",
                    overflowWrap: "anywhere",
                }}
            >
                {output}
            </div>
        </div>
    )
}

export default WorldTime

addPropertyControls(WorldTime, {
    city: {
        type: ControlType.Enum,
        options: timezoneOptions.map((tz) => tz.value),
        optionTitles: timezoneOptions.map((tz) => tz.title),
        defaultValue: "America/New_York",
        title: "City",
    },
    show: {
        type: ControlType.Enum,
        options: ["time", "date", "both"],
        optionTitles: ["Time", "Date", "Time & Date"],
        defaultValue: "time",
        title: "Show",
    },
    format: {
        type: ControlType.Enum,
        options: ["12hr", "24hr"],
        optionTitles: ["12-Hour", "24-Hour"],
        defaultValue: "12hr",
        title: "Time Format",
    },
    ampmCase: {
        type: ControlType.Enum,
        options: ["upper", "lower"],
        optionTitles: ["AM/PM", "am/pm"],
        defaultValue: "upper",
        title: "Case",
    },
    showSeconds: {
        type: ControlType.Boolean,
        defaultValue: false,
        title: "Show Seconds",
    },
    twoDigitHour: {
        type: ControlType.Boolean,
        defaultValue: false,
        title: "2-Digit Hour",
    },
    dateFormat: {
        type: ControlType.Enum,
        options: ["small", "medium", "large"],
        optionTitles: [
            "Small (07/02/25)",
            "Medium (Wed, Jul 2)",
            "Large (July 2, 2025)",
        ],
        defaultValue: "small",
        title: "Date Format",
    },
    customFont: {
        title: "Font",
        type: ControlType.Font,
    },
    fontSize: {
        type: ControlType.String,
        defaultValue: "48px",
        title: "Font Size",
        placeholder: "e.g. 2rem, 48px",
    },
    lineHeight: {
        type: ControlType.Number,
        min: 0.7,
        max: 3,
        step: 0.05,
        defaultValue: 1.1,
        title: "Line Height",
    },
    letterSpacing: {
        type: ControlType.Number,
        defaultValue: 0,
        title: "Letter Spacing",
    },
    color: {
        type: ControlType.Color,
        defaultValue: "#000000",
        title: "Color",
    },
})
