import * as React from "react"
import { addPropertyControls, ControlType } from "framer"

// Framer Code Components must be self-contained (no local file imports).
const DEFAULT_API_BASE_URL = "https://api.jahypotheques.ca"
const API_PATHS = {
    calculatorResults: "/api/calculator-results",
    publicCode: "/api/public/v1/code",
    publicLeads: "/api/public/v1/leads",
    publicAiderUnProche: "/api/public/v1/contests/aider-un-proche",
} as const
const SMS_CODE_THROTTLE_SECONDS = 20

function normalizeApiBaseUrl(baseUrl?: string): string {
    const trimmed = (baseUrl ?? DEFAULT_API_BASE_URL).trim().replace(/\/+$/, "")
    return trimmed || DEFAULT_API_BASE_URL
}

function buildApiUrl(baseUrl: string | undefined, path: string): string {
    return `${normalizeApiBaseUrl(baseUrl)}${path}`
}

function toE164CanadianPhone(phone: string): string {
    const digitsOnly = (phone || "").replace(/\D/g, "")
    const tenDigits =
        digitsOnly.length === 11 && digitsOnly.startsWith("1")
            ? digitsOnly.slice(1)
            : digitsOnly
    return `+1${tenDigits}`
}

function parseSmsErrorCode(
    body: Record<string, unknown> | null | undefined
): string | undefined {
    if (!body) return undefined
    if (typeof body.error === "string") return body.error
    if (typeof body.errorCode === "string") return body.errorCode
    if (body.data && typeof body.data === "object") {
        const data = body.data as Record<string, unknown>
        if (typeof data.error === "string") return data.error
        if (typeof data.errorCode === "string") return data.errorCode
    }
    return undefined
}

function parseRetryAfterSeconds(
    body: Record<string, unknown> | null | undefined,
    fallbackSeconds = 20
): number {
    const raw =
        typeof body?.retryAfter === "number"
            ? body.retryAfter
            : body?.data && typeof body.data === "object"
              ? (body.data as Record<string, unknown>).retryAfter
              : undefined
    if (typeof raw !== "number" || raw <= 0) return fallbackSeconds
    return raw > 1000 ? Math.ceil(raw / 1000) : Math.ceil(raw)
}

/**
 * ContactFormFramer — contact form for Framer (JA Hypothèques).
 *
 * API (public broker portal):
 *   - POST {apiBaseUrl}/api/public/v1/code — { contact, validationMethod: "sms" }
 *   - POST {apiBaseUrl}/api/public/v1/leads — lead payload + validationCode
 */

type Language = "en" | "fr"
type FontControlValue =
    | string
    | { fontFamily?: string; family?: string; font?: string; [key: string]: any }

const COLORS = {
    primaryBackground: "#242b26",
    cardBackground: "rgba(49, 62, 55, 0.65)",
    textColor: "#efece5",
    secondaryTextColor: "#ccc5b2",
    textLinkColor: "#d6be75",
    formColor: "#bbc7bf",
    borderColor: "#a59875",
    errorColor: "rgba(255, 143, 143, 1)",
    successColor: "#d6be75",
} as const

const LEAD_TYPE = {
    PREQUALIFICATION: "prequalification",
    RENEWAL: "renewal",
    COMMERCIAL_FINANCING: "commercial_financing",
    NOT_SPECIFIED: "not_specified",
} as const

const AMOUNT_TO_FINANCE = {
    UNDER_200K: 100000,
    BETWEEN_200K_450K: 200000,
    BETWEEN_450K_750K: 450000,
    OVER_750K: 750000,
} as const

const PREFERRED_TIME_TO_CONTACT = {
    DAY: "day",
    EVENING: "evening",
    WEEKEND: "weekend",
    ANYTIME: "anytime",
} as const

const SMS_ERROR_CODES = {
    INVALID_PHONE: "invalid_phone",
    RATE_LIMIT: "rate_limit",
    SMS_SERVICE_ERROR: "sms_error",
    NETWORK_ERROR: "network_error",
    SEND_CODE_ERROR: "send_code_error",
    INVALID_CODE: "invalid_code",
} as const

function isApiSuccess(
    response: Response,
    body: Record<string, unknown> | null | undefined
): boolean {
    if (!response.ok) return false
    if (body && typeof body.ok === "boolean") return body.ok === true
    return true
}

function normalizeApiErrorCode(errorCode: string | undefined): string | undefined {
    if (!errorCode) return undefined
    const upper = errorCode.toUpperCase()
    const map: Record<string, string> = {
        INVALID_PHONE: SMS_ERROR_CODES.INVALID_PHONE,
        RATE_LIMIT: SMS_ERROR_CODES.RATE_LIMIT,
        INVALID_CODE: SMS_ERROR_CODES.INVALID_CODE,
        MISSING_VALIDATION_CODE: SMS_ERROR_CODES.INVALID_CODE,
        INVALID_VALIDATION_METHOD: SMS_ERROR_CODES.SEND_CODE_ERROR,
        UNEXPECTED_ERROR: SMS_ERROR_CODES.SEND_CODE_ERROR,
        MISSING_CONSENT: "missing_consent",
        INVALID_EMAIL: "invalid_email",
        INVALID_AMOUNT: "invalid_amount",
        MISSING_REQUIRED_FIELDS: SMS_ERROR_CODES.SEND_CODE_ERROR,
    }
    return map[upper] ?? errorCode.toLowerCase()
}

const copy = {
    fr: {
        title: "Contact",
        subtitle:
            "Confiez-nous votre projet et laissez notre expertise vous conduire vers la maison de vos rêves.",
        form: {
            title: "Formulaire de contact",
            firstName: "Prénom",
            lastName: "Nom",
            typeOfRequest: {
                placeholder: "Type de demande",
                prequalification: "Préqualification",
                renewal: "Renouvellement / Refinancement",
                commercial: "Financement commercial",
            },
            financingAmount: {
                placeholder: "Montant du financement",
                under200: "200 000$ et moins",
                between200and450: "200 000$ à 450 000$",
                between450and750: "450 000$ à 750 000$",
                over750: "750 000$ et plus",
            },
            email: "Courriel",
            phone: "Téléphone",
            contactTime: {
                placeholder: "Temps de contact préféré",
                day: "Jour",
                evening: "Soir",
                weekend: "Fin de semaine",
                anytime: "Aucune préférence",
            },
            additionalInfo: "Informations supplémentaires pour le rendez-vous:",
            consentCheckbox:
                "En cochant cette case, vous consentez à être contacté par un courtier hypothécaire.",
            submitBtn: "Soumettre",
            submittingBtn: "Envoi en cours...",
            sendCode: "Envoyer le code",
            sendingCode: "Envoi du code...",
            identityValidation: {
                title: "Vérification d'identité",
                description:
                    "Aidez-nous à vérifier votre identité en vérifiant votre numéro de téléphone. Nous vous enverrons un code de validation.",
                messageCharges:
                    "*Des frais de messages et de données peuvent s'appliquer",
                validationCode: "Code de validation",
                noCodeReceived: "Vous n'avez pas reçu de code?",
                resendCode: "Renvoyer le code",
            },
        },
        feedback: {
            success: {
                title: "Demande envoyée avec succès!",
                paragraphs: [
                    "Nous accusons réception de votre demande et vous remercions de votre confiance. Un membre de notre équipe vous contactera prochainement.",
                    "Pour toute question ou urgence, n'hésitez pas à nous appeler au 450-912-1563.",
                ],
            },
            failure: {
                title: "Échec de l'envoi",
                paragraphs: [
                    "L'envoi de la demande a échoué. Veuillez réessayer plus tard.",
                    "Pour toute question ou urgence, n'hésitez pas à nous appeler au 450-912-1563.",
                ],
            },
        },
        errors: {
            sms: {
                fallbackError: "Une erreur est survenue lors de l'envoi du code",
                invalidPhoneNumber: "Le numéro de téléphone est invalide",
                rateLimitExceeded:
                    "Trop de tentatives. Veuillez réessayer dans quelques minutes.",
                smsError:
                    "Impossible d'envoyer le SMS. Veuillez vérifier votre numéro.",
                networkError:
                    "Erreur de connexion. Vérifiez votre connexion internet.",
            },
            invalidCode: "Code de validation invalide",
            missingConsent:
                "Vous devez accepter d'être contacté par un courtier pour soumettre le formulaire.",
            invalidEmail: "L'adresse courriel est invalide.",
            invalidAmount: "Le montant du financement est invalide.",
        },
    },
    en: {
        title: "Contact",
        subtitle:
            "Trust us with your project and let our expertise guide you to the home of your dreams.",
        form: {
            title: "Contact form",
            firstName: "First name",
            lastName: "Last name",
            typeOfRequest: {
                placeholder: "Type of request",
                prequalification: "Prequalification",
                renewal: "Renewal / Refinancing",
                commercial: "Commercial financing",
            },
            financingAmount: {
                placeholder: "Financing amount",
                under200: "200 000$ or less",
                between200and450: "between $200 000 and $450 000",
                between450and750: "between $450 000 and $750 000",
                over750: "$750 000 or more",
            },
            email: "Email",
            phone: "Phone",
            contactTime: {
                placeholder: "Preferred contact time",
                day: "Morning",
                evening: "Evening",
                weekend: "Weekend",
                anytime: "No preference",
            },
            additionalInfo: "Additional information for the appointment:",
            consentCheckbox:
                "By checking this box, you consent to be contacted by a mortgage broker.",
            submitBtn: "Submit",
            submittingBtn: "Submitting...",
            sendCode: "Send Code",
            sendingCode: "Sending code...",
            identityValidation: {
                title: "Identity Verification",
                description:
                    "Help us verify your identity by verifying your phone number. We will send you a validation code.",
                messageCharges: "*Message and data rates may apply",
                validationCode: "Validation code",
                noCodeReceived: "Haven't received a code?",
                resendCode: "Resend code",
            },
        },
        feedback: {
            success: {
                title: "Request sent successfully",
                paragraphs: [
                    "We have received your request and we thank you for your trust. A member of our team will contact you shortly.",
                    "For any questions or emergencies, do not hesitate to call us at 450-912-1563.",
                ],
            },
            failure: {
                title: "Request failed",
                paragraphs: [
                    "The request was not sent successfully. Please try again later.",
                    "For any questions or emergencies, do not hesitate to call us at 450-912-1563.",
                ],
            },
        },
        errors: {
            sms: {
                fallbackError: "An error occurred while sending the code",
                invalidPhoneNumber: "The phone number is invalid",
                rateLimitExceeded:
                    "Too many attempts. Please try again in a few minutes.",
                smsError:
                    "Unable to send SMS. Please check your phone number.",
                networkError:
                    "Connection error. Please check your internet connection.",
            },
            invalidCode: "Invalid validation code",
            missingConsent:
                "You must consent to be contacted by a broker to submit the form.",
            invalidEmail: "The email address is invalid.",
            invalidAmount: "The financing amount is invalid.",
        },
    },
} as const

const fontFamilyFromControl = (
    value: FontControlValue | undefined,
    fallback: string
) => {
    if (typeof value === "string" && value.trim().length > 0) return value
    if (value && typeof value === "object") {
        const candidate = value.fontFamily || value.family || value.font
        if (candidate && candidate.trim().length > 0) return candidate
    }
    return fallback
}

const typographyFromControl = (
    value: FontControlValue | undefined,
    fallbackFamily: string
): React.CSSProperties => {
    const family = fontFamilyFromControl(value, fallbackFamily)
    if (!value || typeof value !== "object") return { fontFamily: family }
    return {
        fontFamily: family,
        ...(value.fontSize !== undefined ? { fontSize: value.fontSize } : {}),
        ...(value.fontWeight !== undefined
            ? { fontWeight: value.fontWeight }
            : {}),
        ...(value.lineHeight !== undefined
            ? { lineHeight: value.lineHeight }
            : {}),
        ...(value.letterSpacing !== undefined
            ? { letterSpacing: value.letterSpacing }
            : {}),
    }
}

const requiredPlaceholder = (label: string) => `${label}*`

type SubmissionStatus = "idle" | "success" | "failure"
type CodeRequestState =
    | { state: "idle" }
    | { state: "loading" }
    | { state: "success" }
    | { state: "error"; message: string }

interface FormValues {
    firstName: string
    lastName: string
    type: string
    amountToFinance: string
    phone: string
    preferredContactPeriod: string
    email: string
    information: string
    consent: boolean
    code: string[]
}

const initialFormValues = (
    prefill: Partial<FormValues> | undefined
): FormValues => ({
    firstName: prefill?.firstName ?? "",
    lastName: prefill?.lastName ?? "",
    type: prefill?.type ?? LEAD_TYPE.NOT_SPECIFIED,
    amountToFinance: prefill?.amountToFinance ?? "",
    phone: prefill?.phone ?? "",
    preferredContactPeriod: prefill?.preferredContactPeriod ?? "",
    email: prefill?.email ?? "",
    information: prefill?.information ?? "",
    consent: prefill?.consent ?? false,
    code: ["", "", "", "", "", ""],
})

interface Props {
    language?: Language
    layoutMode?: "auto" | "desktop" | "tablet" | "phone"
    apiBaseUrl?: string
    requestCodeUrl?: string
    submitFormUrl?: string
    regularFontFamily?: FontControlValue
    mediumFontFamily?: FontControlValue
    tightFontFamily?: FontControlValue
    tinyFontFamily?: FontControlValue
    titleColor?: string
    textColor?: string
    formColor?: string
    accentColor?: string
    style?: React.CSSProperties
    width?: number
    height?: number
}

const SVG_REFRESH = (
    <svg
        xmlns="http://www.w3.org/2000/svg"
        width="16"
        height="16"
        viewBox="0 0 24 24"
        fill="none"
        aria-hidden
    >
        <path
            d="M21 12a9 9 0 1 1-3-6.7"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
        />
        <path
            d="M21 4v5h-5"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
        />
    </svg>
)

const SVG_CARET_DOWN = (
    <svg
        xmlns="http://www.w3.org/2000/svg"
        width="14"
        height="14"
        viewBox="0 0 20 20"
        fill="none"
        aria-hidden
    >
        <path
            d="M5 7.5L10 12.5L15 7.5"
            stroke="currentColor"
            strokeWidth="1.6"
            strokeLinecap="round"
            strokeLinejoin="round"
        />
    </svg>
)

export default function ContactFormFramer(props: Props) {
    const language: Language = props.language ?? "fr"
    const t = copy[language]

    const regularFontFamily = fontFamilyFromControl(
        props.regularFontFamily,
        "PP Right Grotesk, Inter, Arial, sans-serif"
    )
    const tightFontFamily = fontFamilyFromControl(
        props.tightFontFamily,
        "PP Right Grotesk Tight, PP Right Grotesk, Inter, Arial, sans-serif"
    )
    const tinyFontFamily = fontFamilyFromControl(
        props.tinyFontFamily,
        "PP Right Grotesk, Inter, Arial, sans-serif"
    )

    const regularTextStyle = typographyFromControl(
        props.regularFontFamily,
        regularFontFamily
    )
    const mediumTextStyle = typographyFromControl(
        props.mediumFontFamily,
        "PP Right Grotesk Medium, PP Right Grotesk, Inter, Arial, sans-serif"
    )
    const tightTextStyle = typographyFromControl(
        props.tightFontFamily,
        tightFontFamily
    )
    const tinyTextStyle = typographyFromControl(
        props.tinyFontFamily,
        tinyFontFamily
    )

    const titleColor = props.titleColor ?? COLORS.textColor
    const textColor = props.textColor ?? COLORS.textColor
    const formColor = props.formColor ?? COLORS.formColor
    const accentColor = props.accentColor ?? COLORS.textLinkColor

    const apiBaseUrl = normalizeApiBaseUrl(props.apiBaseUrl)
    const requestCodeUrl = props.requestCodeUrl?.trim()
        ? props.requestCodeUrl.trim()
        : buildApiUrl(apiBaseUrl, API_PATHS.publicCode)
    const submitFormUrl = props.submitFormUrl?.trim()
        ? props.submitFormUrl.trim()
        : buildApiUrl(apiBaseUrl, API_PATHS.publicLeads)

    const frameWidthFromProps =
        typeof props.width === "number" ? props.width : undefined
    const styleWidthFromProps =
        typeof props.style?.width === "number"
            ? props.style.width
            : typeof props.style?.width === "string" &&
                props.style.width.endsWith("px")
              ? Number(props.style.width.replace("px", ""))
              : undefined
    const effectiveWidth =
        frameWidthFromProps ?? styleWidthFromProps ?? 1440
    const resolvedLayoutMode =
        props.layoutMode && props.layoutMode !== "auto"
            ? props.layoutMode
            : effectiveWidth > 1024
              ? "desktop"
              : effectiveWidth > 640
                ? "tablet"
                : "phone"

    const isPhoneLayout = resolvedLayoutMode === "phone"

    const [formValues, setFormValues] = React.useState<FormValues>(() =>
        initialFormValues(undefined)
    )
    const [hasRequestedCode, setHasRequestedCode] = React.useState(false)
    const [codeRequestStatus, setCodeRequestStatus] =
        React.useState<CodeRequestState>({ state: "idle" })
    const [submissionStatus, setSubmissionStatus] =
        React.useState<SubmissionStatus>("idle")
    const [submitError, setSubmitError] = React.useState<string | null>(null)
    const [isSubmitting, setIsSubmitting] = React.useState(false)
    const [countdownSeconds, setCountdownSeconds] = React.useState(0)
    const countdownIntervalRef = React.useRef<ReturnType<
        typeof setInterval
    > | null>(null)

    const startCountdown = React.useCallback((seconds: number) => {
        setCountdownSeconds(seconds)
        if (countdownIntervalRef.current) {
            clearInterval(countdownIntervalRef.current)
            countdownIntervalRef.current = null
        }
        countdownIntervalRef.current = setInterval(() => {
            setCountdownSeconds(prev => {
                if (prev <= 1) {
                    if (countdownIntervalRef.current) {
                        clearInterval(countdownIntervalRef.current)
                        countdownIntervalRef.current = null
                    }
                    return 0
                }
                return prev - 1
            })
        }, 1000)
    }, [])

    React.useEffect(
        () => () => {
            if (countdownIntervalRef.current) {
                clearInterval(countdownIntervalRef.current)
            }
        },
        []
    )

    const updateField = <K extends keyof FormValues>(
        key: K,
        value: FormValues[K]
    ) => {
        setFormValues(prev => ({ ...prev, [key]: value }))
    }

    const getSmsErrorMessage = (errorCode: string | undefined) => {
        const messages = t.errors.sms
        const normalized = normalizeApiErrorCode(errorCode)
        switch (normalized) {
            case SMS_ERROR_CODES.INVALID_PHONE:
                return messages.invalidPhoneNumber
            case SMS_ERROR_CODES.RATE_LIMIT:
                return messages.rateLimitExceeded
            case SMS_ERROR_CODES.SMS_SERVICE_ERROR:
                return messages.smsError
            case SMS_ERROR_CODES.NETWORK_ERROR:
                return messages.networkError
            default:
                return messages.fallbackError
        }
    }

    const getSubmitErrorMessage = (
        errorCode: string | undefined,
        apiMessage?: string
    ) => {
        const normalized = normalizeApiErrorCode(errorCode)
        switch (normalized) {
            case SMS_ERROR_CODES.INVALID_CODE:
                return t.errors.invalidCode
            case "missing_consent":
                return t.errors.missingConsent
            case "invalid_email":
                return t.errors.invalidEmail
            case "invalid_amount":
                return t.errors.invalidAmount
            case SMS_ERROR_CODES.INVALID_PHONE:
                return t.errors.sms.invalidPhoneNumber
            default:
                return apiMessage || t.feedback.failure.paragraphs[0]
        }
    }

    const handleRequestCode = async (e?: React.MouseEvent) => {
        e?.preventDefault()
        if (!formValues.phone.trim() || codeRequestStatus.state === "loading") {
            return
        }
        if (countdownSeconds > 0) return

        setCodeRequestStatus({ state: "loading" })
        setSubmitError(null)

        try {
            const response = await fetch(requestCodeUrl, {
                method: "POST",
                headers: {
                    "Content-Type": "application/json",
                    "Accept-Language": language,
                },
                body: JSON.stringify({
                    contact: toE164CanadianPhone(formValues.phone),
                    validationMethod: "sms",
                }),
            })

            const body = (await response.json().catch(() => ({}))) as Record<
                string,
                unknown
            >

            if (isApiSuccess(response, body)) {
                setHasRequestedCode(true)
                setCodeRequestStatus({ state: "success" })
                startCountdown(SMS_CODE_THROTTLE_SECONDS)
                return
            }

            const errorCode =
                normalizeApiErrorCode(parseSmsErrorCode(body)) ??
                SMS_ERROR_CODES.SEND_CODE_ERROR
            setCodeRequestStatus({
                state: "error",
                message: getSmsErrorMessage(errorCode),
            })

            if (errorCode === SMS_ERROR_CODES.RATE_LIMIT) {
                startCountdown(parseRetryAfterSeconds(body, SMS_CODE_THROTTLE_SECONDS))
            }
        } catch (_error) {
            setCodeRequestStatus({
                state: "error",
                message: t.errors.sms.networkError,
            })
        }
    }

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault()
        if (!hasRequestedCode || isSubmitting) return
        if (!formValues.consent) {
            setSubmitError(t.errors.missingConsent)
            return
        }

        setIsSubmitting(true)
        setSubmitError(null)

        const code = formValues.code.join("")

        const payload: Record<string, unknown> = {
            validationCode: code,
            firstName: formValues.firstName.trim(),
            lastName: formValues.lastName.trim(),
            email: formValues.email.trim(),
            phone: formValues.phone.trim(),
            type: formValues.type,
            amountToFinance: Number(formValues.amountToFinance),
            consent: true,
        }
        if (formValues.information.trim()) {
            payload.information = formValues.information.trim()
        }
        if (formValues.preferredContactPeriod) {
            payload.preferredContactPeriod = [formValues.preferredContactPeriod]
        }

        try {
            const response = await fetch(submitFormUrl, {
                method: "POST",
                headers: {
                    "Content-Type": "application/json",
                    "Accept-Language": language,
                },
                body: JSON.stringify(payload),
            })

            const body = (await response.json().catch(() => ({}))) as Record<
                string,
                unknown
            >

            if (isApiSuccess(response, body)) {
                setSubmissionStatus("success")
                return
            }

            const apiMessage =
                typeof body?.message === "string" ? body.message : undefined
            const errorCode = normalizeApiErrorCode(parseSmsErrorCode(body))
            setSubmitError(getSubmitErrorMessage(errorCode, apiMessage))
            setSubmissionStatus("failure")
        } catch (_error) {
            setSubmissionStatus("failure")
        } finally {
            setIsSubmitting(false)
        }
    }

    if (submissionStatus !== "idle") {
        return (
            <SubmissionFeedback
                statusValue={submissionStatus}
                regularTextStyle={regularTextStyle}
                tightTextStyle={tightTextStyle}
                titleColor={titleColor}
                textColor={textColor}
                style={props.style}
                t={t}
            />
        )
    }

    const fieldRowStyle: React.CSSProperties = {
        display: "flex",
        gap: isPhoneLayout ? 0 : 16,
        flexDirection: isPhoneLayout ? "column" : "row",
        width: "100%",
    }

    const inputBaseStyle: React.CSSProperties = {
        width: "100%",
        border: "none",
        outline: "none",
        background: "transparent",
        borderBottom: `1px solid ${formColor}`,
        color: formColor,
        fontSize: isPhoneLayout ? 16 : 20,
        lineHeight: isPhoneLayout ? "110%" : "180%",
        height: isPhoneLayout ? "2rem" : "2.5rem",
        boxSizing: "border-box",
        padding: "0 0 4px 0",
        marginBottom: "1.25rem",
        ...regularTextStyle,
        fontWeight: 200,
    }

    const selectStyle: React.CSSProperties = {
        ...inputBaseStyle,
        appearance: "none",
        WebkitAppearance: "none",
        MozAppearance: "none",
        paddingRight: 24,
        cursor: "pointer",
    }

    const labelHiddenStyle: React.CSSProperties = {
        position: "absolute",
        width: 1,
        height: 1,
        padding: 0,
        margin: -1,
        overflow: "hidden",
        clip: "rect(0,0,0,0)",
        whiteSpace: "nowrap",
        border: 0,
    }

    const helperTextStyle: React.CSSProperties = {
        margin: 0,
        padding: 0,
        fontSize: isPhoneLayout ? 14 : 16,
        color: formColor,
        ...regularTextStyle,
        fontWeight: 200,
    }

    return (
        <div
            style={{
                position: "relative",
                boxSizing: "border-box",
                color: formColor,
                fontFamily: regularFontFamily,
                fontWeight: 200,
                display: "flex",
                flexDirection: "column",
                justifyContent: "center",
                width: "100%",
                ...(props.style ?? {}),
            }}
        >
            <style>{`
                .cf-input::placeholder, .cf-textarea::placeholder { color: ${formColor}; opacity: 1; }
                .cf-input:focus, .cf-select:focus, .cf-textarea:focus { box-shadow: 0 1px 0 0 ${COLORS.borderColor}; }
                .cf-select option { color: ${COLORS.textColor}; background: ${COLORS.primaryBackground}; }
                .cf-digit:focus { outline-color: ${accentColor}; border-color: ${accentColor}; }
                .cf-link-button:hover { opacity: 0.8; }
                .cf-primary-button:disabled { opacity: 0.45; cursor: not-allowed; }
            `}</style>

            <form
                    onSubmit={handleSubmit}
                    style={{
                        display: "flex",
                        flexDirection: "column",
                        alignItems: "stretch",
                        margin: 0,
                        width: "100%",
                        maxWidth: "100%",
                    }}
                >
                    <p
                        style={{
                            fontSize: 24,
                            lineHeight: "36px",
                            color: textColor,
                            margin: "0 0 1.25rem 0",
                            ...mediumTextStyle,
                        }}
                    >
                        {t.form.title}
                    </p>

                    <div style={fieldRowStyle}>
                        <span style={{ flex: 1, position: "relative" }}>
                            <label
                                htmlFor="cf-firstName"
                                style={labelHiddenStyle}
                            >
                                {t.form.firstName}
                            </label>
                            <input
                                className="cf-input"
                                id="cf-firstName"
                                name="firstName"
                                value={formValues.firstName}
                                onChange={e =>
                                    updateField("firstName", e.target.value)
                                }
                                placeholder={requiredPlaceholder(
                                    t.form.firstName
                                )}
                                required
                                style={inputBaseStyle}
                            />
                        </span>
                        <span style={{ flex: 1, position: "relative" }}>
                            <label
                                htmlFor="cf-lastName"
                                style={labelHiddenStyle}
                            >
                                {t.form.lastName}
                            </label>
                            <input
                                className="cf-input"
                                id="cf-lastName"
                                name="lastName"
                                value={formValues.lastName}
                                onChange={e =>
                                    updateField("lastName", e.target.value)
                                }
                                placeholder={requiredPlaceholder(
                                    t.form.lastName
                                )}
                                required
                                style={inputBaseStyle}
                            />
                        </span>
                    </div>

                    <div style={fieldRowStyle}>
                        <SelectField
                            flex
                            id="cf-type"
                            name="type"
                            value={formValues.type}
                            onChange={value => updateField("type", value)}
                            label={t.form.typeOfRequest.placeholder}
                            ariaLabel={t.form.typeOfRequest.placeholder}
                            options={[
                                {
                                    value: LEAD_TYPE.NOT_SPECIFIED,
                                    label: t.form.typeOfRequest.placeholder,
                                    disabled: true,
                                },
                                {
                                    value: LEAD_TYPE.PREQUALIFICATION,
                                    label: t.form.typeOfRequest
                                        .prequalification,
                                },
                                {
                                    value: LEAD_TYPE.RENEWAL,
                                    label: t.form.typeOfRequest.renewal,
                                },
                                {
                                    value: LEAD_TYPE.COMMERCIAL_FINANCING,
                                    label: t.form.typeOfRequest.commercial,
                                },
                            ]}
                            inputStyle={selectStyle}
                            labelHiddenStyle={labelHiddenStyle}
                            accentColor={accentColor}
                            formColor={formColor}
                        />
                        <SelectField
                            flex
                            id="cf-amount"
                            name="amountToFinance"
                            value={formValues.amountToFinance}
                            onChange={value =>
                                updateField("amountToFinance", value)
                            }
                            label={requiredPlaceholder(
                                t.form.financingAmount.placeholder
                            )}
                            ariaLabel={t.form.financingAmount.placeholder}
                            options={[
                                {
                                    value: "",
                                    label: requiredPlaceholder(
                                        t.form.financingAmount.placeholder
                                    ),
                                    disabled: true,
                                },
                                {
                                    value: String(
                                        AMOUNT_TO_FINANCE.UNDER_200K
                                    ),
                                    label: t.form.financingAmount.under200,
                                },
                                {
                                    value: String(
                                        AMOUNT_TO_FINANCE.BETWEEN_200K_450K
                                    ),
                                    label: t.form.financingAmount
                                        .between200and450,
                                },
                                {
                                    value: String(
                                        AMOUNT_TO_FINANCE.BETWEEN_450K_750K
                                    ),
                                    label: t.form.financingAmount
                                        .between450and750,
                                },
                                {
                                    value: String(
                                        AMOUNT_TO_FINANCE.OVER_750K
                                    ),
                                    label: t.form.financingAmount.over750,
                                },
                            ]}
                            inputStyle={selectStyle}
                            labelHiddenStyle={labelHiddenStyle}
                            accentColor={accentColor}
                            formColor={formColor}
                        />
                    </div>

                    <div style={fieldRowStyle}>
                        <span style={{ flex: 1, position: "relative" }}>
                            <label
                                htmlFor="cf-phone-1"
                                style={labelHiddenStyle}
                            >
                                {t.form.phone}
                            </label>
                            <input
                                className="cf-input"
                                id="cf-phone-1"
                                name="phone"
                                type="tel"
                                value={formValues.phone}
                                onChange={e =>
                                    updateField("phone", e.target.value)
                                }
                                placeholder={requiredPlaceholder(
                                    t.form.phone
                                )}
                                required
                                style={inputBaseStyle}
                            />
                        </span>
                        <SelectField
                            flex
                            id="cf-time"
                            name="preferredContactPeriod"
                            value={formValues.preferredContactPeriod}
                            onChange={value =>
                                updateField(
                                    "preferredContactPeriod",
                                    value
                                )
                            }
                            label={t.form.contactTime.placeholder}
                            ariaLabel={t.form.contactTime.placeholder}
                            options={[
                                {
                                    value: "",
                                    label: t.form.contactTime.placeholder,
                                    disabled: true,
                                },
                                {
                                    value: PREFERRED_TIME_TO_CONTACT.DAY,
                                    label: t.form.contactTime.day,
                                },
                                {
                                    value: PREFERRED_TIME_TO_CONTACT.EVENING,
                                    label: t.form.contactTime.evening,
                                },
                                {
                                    value: PREFERRED_TIME_TO_CONTACT.WEEKEND,
                                    label: t.form.contactTime.weekend,
                                },
                                {
                                    value: PREFERRED_TIME_TO_CONTACT.ANYTIME,
                                    label: t.form.contactTime.anytime,
                                },
                            ]}
                            inputStyle={selectStyle}
                            labelHiddenStyle={labelHiddenStyle}
                            accentColor={accentColor}
                            formColor={formColor}
                        />
                    </div>

                    <label htmlFor="cf-email" style={labelHiddenStyle}>
                        {t.form.email}
                    </label>
                    <input
                        className="cf-input"
                        id="cf-email"
                        name="email"
                        type="email"
                        value={formValues.email}
                        onChange={e => updateField("email", e.target.value)}
                        placeholder={requiredPlaceholder(t.form.email)}
                        required
                        style={inputBaseStyle}
                    />

                    <label
                        style={{
                            width: "100%",
                            display: "flex",
                            flexDirection: "column",
                            color: formColor,
                            fontSize: isPhoneLayout ? 16 : 20,
                            lineHeight: isPhoneLayout ? "110%" : "180%",
                            ...regularTextStyle,
                            fontWeight: 200,
                            marginTop: "1rem",
                        }}
                    >
                        {t.form.additionalInfo}
                        <textarea
                            className="cf-textarea"
                            name="information"
                            value={formValues.information}
                            onChange={e =>
                                updateField("information", e.target.value)
                            }
                            style={{
                                marginTop: "1rem",
                                height: isPhoneLayout ? "1.5rem" : "4rem",
                                width: "100%",
                                resize: "none",
                                border: "none",
                                outline: "none",
                                background: "transparent",
                                borderBottom: `1px solid ${formColor}`,
                                color: formColor,
                                fontSize: isPhoneLayout ? 16 : 20,
                                lineHeight: isPhoneLayout ? "110%" : "180%",
                                marginBottom: "1.25rem",
                                ...regularTextStyle,
                                fontWeight: 200,
                                boxSizing: "border-box",
                                padding: "4px 0",
                            }}
                        />
                    </label>

                    <label
                        style={{
                            display: "flex",
                            alignItems: "center",
                            alignSelf: "flex-start",
                            margin: "1.5rem 0",
                            cursor: "pointer",
                            color: formColor,
                            fontSize: isPhoneLayout ? 16 : 20,
                            lineHeight: "140%",
                            ...regularTextStyle,
                            fontWeight: 200,
                        }}
                    >
                        <span
                            style={{
                                border: `1px solid ${formColor}`,
                                height: "1.25rem",
                                width: "1.25rem",
                                display: "flex",
                                alignItems: "center",
                                justifyContent: "center",
                                flexShrink: 0,
                            }}
                        >
                            <input
                                name="consent"
                                type="checkbox"
                                checked={formValues.consent}
                                onChange={e =>
                                    updateField("consent", e.target.checked)
                                }
                                required
                                style={labelHiddenStyle}
                            />
                            <span
                                style={{
                                    height: "0.75rem",
                                    width: "0.75rem",
                                    background: formColor,
                                    opacity: formValues.consent ? 1 : 0,
                                    transition: "opacity 100ms ease",
                                    pointerEvents: "none",
                                }}
                            />
                        </span>
                        <span
                            style={{
                                marginLeft: "0.75rem",
                                display: "flex",
                                alignItems: "center",
                            }}
                        >
                            {t.form.consentCheckbox}
                        </span>
                    </label>

                    <div
                        style={{
                            display: "flex",
                            flexDirection: "column",
                            gap: "0.5rem",
                            width: "100%",
                        }}
                    >
                        <p
                            style={{
                                margin: "1rem 0 0 0",
                                fontSize: 24,
                                lineHeight: "36px",
                                color: textColor,
                                ...mediumTextStyle,
                            }}
                        >
                            {t.form.identityValidation.title}
                        </p>
                        <p
                            style={{
                                margin: "0 0 1rem 0",
                                fontWeight: 200,
                                fontSize: 20,
                                lineHeight: "36px",
                                color: textColor,
                                ...regularTextStyle,
                            }}
                        >
                            {t.form.identityValidation.description}
                        </p>
                    </div>

                    <div
                        style={{
                            display: "flex",
                            flexDirection: isPhoneLayout ? "column" : "row",
                            gap: "1rem",
                            width: "100%",
                            paddingBottom: "1rem",
                            alignItems: isPhoneLayout
                                ? "stretch"
                                : "flex-end",
                        }}
                    >
                        <div
                            style={{
                                display: "flex",
                                flexDirection: "column",
                                flex: 2,
                                minWidth: 0,
                            }}
                        >
                            <label
                                htmlFor="cf-phone-2"
                                style={labelHiddenStyle}
                            >
                                {t.form.phone}
                            </label>
                            <input
                                className="cf-input"
                                id="cf-phone-2"
                                name="phone"
                                type="tel"
                                value={formValues.phone}
                                onChange={e =>
                                    updateField("phone", e.target.value)
                                }
                                placeholder={requiredPlaceholder(
                                    t.form.phone
                                )}
                                required
                                style={{
                                    ...inputBaseStyle,
                                    marginBottom: "0.5rem",
                                }}
                            />
                            <p
                                style={{
                                    ...helperTextStyle,
                                    fontSize: 12.8,
                                }}
                            >
                                {t.form.identityValidation.messageCharges}
                            </p>
                        </div>
                        <button
                            type="button"
                            onClick={handleRequestCode}
                            disabled={
                                codeRequestStatus.state === "loading" ||
                                countdownSeconds > 0 ||
                                !formValues.phone.trim()
                            }
                            className="cf-primary-button"
                            style={{
                                flex: isPhoneLayout ? undefined : "0 0 260px",
                                width: isPhoneLayout ? "100%" : "260px",
                                height: 50,
                                minWidth: isPhoneLayout ? "auto" : 220,
                                background: "transparent",
                                color: COLORS.textColor,
                                border: `1px solid ${COLORS.textColor}`,
                                borderRadius: 9999,
                                cursor: "pointer",
                                textTransform: "uppercase",
                                letterSpacing: "0.05em",
                                fontSize: isPhoneLayout ? 14 : 16,
                                fontWeight: 500,
                                ...regularTextStyle,
                                display: "flex",
                                alignItems: "center",
                                justifyContent: "center",
                                gap: 8,
                                whiteSpace: "nowrap",
                                padding: "0 16px",
                            }}
                        >
                            {codeRequestStatus.state === "loading"
                                ? t.form.sendingCode
                                : countdownSeconds > 0
                                  ? `${t.form.identityValidation.resendCode} (${countdownSeconds}s)`
                                  : hasRequestedCode
                                    ? t.form.identityValidation.resendCode
                                    : t.form.sendCode}
                        </button>
                    </div>

                    {codeRequestStatus.state === "error" ? (
                        <p
                            role="alert"
                            style={{
                                color: COLORS.errorColor,
                                margin: "0 0 1rem 0",
                                fontSize: 14,
                                ...regularTextStyle,
                            }}
                        >
                            {codeRequestStatus.message}
                        </p>
                    ) : null}

                    <div
                        style={{
                            display: "flex",
                            flexDirection: "column",
                            alignItems: "flex-start",
                            gap: "0.5rem",
                            marginBottom: "2rem",
                            paddingTop: "1rem",
                            width: "100%",
                        }}
                    >
                        <SixDigitsCode
                            label={t.form.identityValidation.validationCode}
                            value={formValues.code}
                            onChange={value => updateField("code", value)}
                            disabled={!hasRequestedCode}
                            regularTextStyle={regularTextStyle}
                            accentColor={accentColor}
                            textColor={textColor}
                        />
                        <div
                            style={{
                                display: "flex",
                                alignItems: "center",
                                gap: "0.5rem",
                                flexWrap: "wrap",
                            }}
                        >
                            <span
                                style={{
                                    margin: 0,
                                    color: formColor,
                                    fontSize: 14,
                                    ...regularTextStyle,
                                }}
                            >
                                {
                                    t.form.identityValidation
                                        .noCodeReceived
                                }
                            </span>
                            <button
                                type="button"
                                onClick={handleRequestCode}
                                disabled={
                                    codeRequestStatus.state ===
                                        "loading" ||
                                    countdownSeconds > 0 ||
                                    !formValues.phone.trim()
                                }
                                className="cf-link-button"
                                style={{
                                    cursor: "pointer",
                                    border: "none",
                                    padding: 0,
                                    margin: 0,
                                    color: accentColor,
                                    background: "none",
                                    textTransform: "none",
                                    lineHeight: 1,
                                    display: "flex",
                                    alignItems: "center",
                                    fontSize: 14,
                                    fontWeight: 500,
                                    ...regularTextStyle,
                                    opacity:
                                        codeRequestStatus.state ===
                                            "loading" ||
                                        countdownSeconds > 0
                                            ? 0.55
                                            : 1,
                                }}
                            >
                                {countdownSeconds > 0
                                    ? `${t.form.identityValidation.resendCode} (${countdownSeconds}s)`
                                    : t.form.identityValidation.resendCode}
                                <span
                                    style={{
                                        width: 16,
                                        height: 16,
                                        paddingLeft: 8,
                                        display: "inline-flex",
                                        color: accentColor,
                                    }}
                                >
                                    {SVG_REFRESH}
                                </span>
                            </button>
                        </div>
                        {submitError ? (
                            <p
                                role="alert"
                                style={{
                                    color: COLORS.errorColor,
                                    marginLeft: "0.5rem",
                                    fontSize: 14,
                                    margin: 0,
                                    ...regularTextStyle,
                                }}
                            >
                                {submitError}
                            </p>
                        ) : null}
                    </div>

                    <button
                        type="submit"
                        disabled={!hasRequestedCode || isSubmitting}
                        className="cf-primary-button"
                        style={{
                            width: "100%",
                            height: 56,
                            background: accentColor,
                            color: COLORS.primaryBackground,
                            border: "none",
                            borderRadius: 9999,
                            cursor: "pointer",
                            textTransform: "uppercase",
                            letterSpacing: "0.05em",
                            fontSize: isPhoneLayout ? 14 : 16,
                            fontWeight: 600,
                            ...regularTextStyle,
                            marginTop: 8,
                        }}
                    >
                        {isSubmitting
                            ? t.form.submittingBtn
                            : t.form.submitBtn}
                    </button>
            </form>
        </div>
    )
}

interface SelectFieldProps {
    id: string
    name: string
    value: string
    onChange: (value: string) => void
    label: string
    ariaLabel: string
    options: Array<{ value: string; label: string; disabled?: boolean }>
    inputStyle: React.CSSProperties
    labelHiddenStyle: React.CSSProperties
    accentColor: string
    formColor: string
    flex?: boolean
}

function SelectField({
    id,
    name,
    value,
    onChange,
    label,
    ariaLabel,
    options,
    inputStyle,
    labelHiddenStyle,
    accentColor,
    flex,
}: SelectFieldProps) {
    return (
        <span
            style={{
                flex: flex ? 1 : undefined,
                position: "relative",
                display: "block",
            }}
        >
            <label htmlFor={id} style={labelHiddenStyle}>
                {ariaLabel}
            </label>
            <select
                className="cf-select"
                id={id}
                name={name}
                value={value}
                onChange={e => onChange(e.target.value)}
                required={name === "amountToFinance"}
                style={inputStyle}
            >
                {options.map(option => (
                    <option
                        key={`${option.value}-${option.label}`}
                        value={option.value}
                        disabled={option.disabled}
                    >
                        {option.label}
                    </option>
                ))}
            </select>
            <span
                aria-hidden
                style={{
                    position: "absolute",
                    right: 4,
                    top: "calc(50% - 0.625rem)",
                    transform: "translateY(-50%)",
                    pointerEvents: "none",
                    color: accentColor,
                    display: "inline-flex",
                }}
            >
                {SVG_CARET_DOWN}
            </span>
        </span>
    )
}

interface SixDigitsCodeProps {
    label: string
    value: string[]
    onChange: (value: string[]) => void
    disabled?: boolean
    regularTextStyle: React.CSSProperties
    accentColor: string
    textColor: string
}

function SixDigitsCode({
    label,
    value,
    onChange,
    disabled,
    regularTextStyle,
    textColor,
}: SixDigitsCodeProps) {
    const inputsRef = React.useRef<Array<HTMLInputElement | null>>([])

    const handleChange = (index: number, raw: string) => {
        const next = [...value]
        const digit = raw.replace(/\D/g, "").slice(-1)
        next[index] = digit
        onChange(next)
        if (digit && index < value.length - 1) {
            inputsRef.current[index + 1]?.focus()
        }
    }

    const handleKeyDown = (
        index: number,
        e: React.KeyboardEvent<HTMLInputElement>
    ) => {
        if (e.key === "Backspace" && !value[index] && index > 0) {
            inputsRef.current[index - 1]?.focus()
        }
    }

    const handlePaste = (
        index: number,
        e: React.ClipboardEvent<HTMLInputElement>
    ) => {
        e.preventDefault()
        const pasteData = e.clipboardData
            .getData("text")
            .replace(/\D/g, "")
            .slice(0, value.length)
        if (!pasteData) return
        const next = [...value]
        for (let i = 0; i < value.length; i += 1) {
            next[i] = pasteData[i] ?? next[i] ?? ""
        }
        onChange(next)
        const lastIndex = Math.min(pasteData.length, value.length) - 1
        if (lastIndex >= 0) {
            inputsRef.current[lastIndex]?.focus()
        }
    }

    return (
        <fieldset
            style={{
                border: "none",
                padding: 0,
                margin: 0,
                opacity: disabled ? 0.5 : 1,
            }}
        >
            <legend
                style={{
                    fontWeight: 500,
                    fontSize: 16,
                    lineHeight: "20px",
                    color: textColor,
                    marginBottom: 4,
                    ...regularTextStyle,
                }}
            >
                {label}
            </legend>
            <div style={{ display: "flex", gap: 4 }}>
                {value.map((digit, index) => (
                    <input
                        key={index}
                        ref={el => {
                            inputsRef.current[index] = el
                        }}
                        type="text"
                        inputMode="numeric"
                        pattern="\d*"
                        maxLength={1}
                        value={digit}
                        onChange={e => handleChange(index, e.target.value)}
                        onKeyDown={e => handleKeyDown(index, e)}
                        onPaste={e => handlePaste(index, e)}
                        disabled={disabled}
                        aria-label={`Digit ${index + 1} of ${value.length}`}
                        className="cf-digit"
                        style={{
                            background: "transparent",
                            boxShadow: "none",
                            boxSizing: "border-box",
                            border: `1px solid ${COLORS.formColor}`,
                            borderRadius: 4,
                            height: 48,
                            paddingLeft: 12,
                            color: textColor,
                            outlineColor: COLORS.textLinkColor,
                            marginRight: 0,
                            width: 35,
                            fontSize: 18,
                            fontWeight: 200,
                            ...regularTextStyle,
                        }}
                    />
                ))}
            </div>
        </fieldset>
    )
}

interface SubmissionFeedbackProps {
    statusValue: SubmissionStatus
    regularTextStyle: React.CSSProperties
    tightTextStyle: React.CSSProperties
    titleColor: string
    textColor: string
    style?: React.CSSProperties
    t: (typeof copy)[Language]
}

function SubmissionFeedback({
    statusValue,
    regularTextStyle,
    tightTextStyle,
    titleColor,
    textColor,
    style,
    t,
}: SubmissionFeedbackProps) {
    const isSuccess = statusValue === "success"
    const feedback = isSuccess ? t.feedback.success : t.feedback.failure
    const iconColor = isSuccess ? COLORS.successColor : COLORS.errorColor

    return (
        <div
            style={{
                width: "100%",
                color: textColor,
                fontFamily: regularTextStyle.fontFamily as string,
                ...regularTextStyle,
                textAlign: "center",
                ...(style ?? {}),
            }}
        >
            <div
                style={{
                    textAlign: "center",
                    margin: "0 auto",
                    maxWidth: 720,
                    padding: "0 1.25rem",
                }}
            >
                <div
                    style={{
                        marginTop: "7.5rem",
                        display: "inline-flex",
                        width: 96,
                        height: 96,
                        borderRadius: "50%",
                        border: `2px solid ${iconColor}`,
                        alignItems: "center",
                        justifyContent: "center",
                        color: iconColor,
                    }}
                    aria-hidden
                >
                    {isSuccess ? (
                        <svg
                            xmlns="http://www.w3.org/2000/svg"
                            width="48"
                            height="48"
                            viewBox="0 0 24 24"
                            fill="none"
                        >
                            <path
                                d="M5 12.5L10 17.5L19 7.5"
                                stroke="currentColor"
                                strokeWidth="2.2"
                                strokeLinecap="round"
                                strokeLinejoin="round"
                            />
                        </svg>
                    ) : (
                        <svg
                            xmlns="http://www.w3.org/2000/svg"
                            width="48"
                            height="48"
                            viewBox="0 0 24 24"
                            fill="none"
                        >
                            <path
                                d="M6 6L18 18M6 18L18 6"
                                stroke="currentColor"
                                strokeWidth="2.2"
                                strokeLinecap="round"
                                strokeLinejoin="round"
                            />
                        </svg>
                    )}
                </div>
                <h2
                    style={{
                        color: titleColor,
                        fontSize: "1.5rem",
                        fontStyle: "normal",
                        fontWeight: 200,
                        lineHeight: "140%",
                        margin: "2rem 0 3rem 0",
                        ...tightTextStyle,
                    }}
                >
                    {feedback.title}
                </h2>
                {feedback.paragraphs.map(paragraph => (
                    <p
                        key={paragraph}
                        style={{
                            maxWidth: "42rem",
                            marginBottom: "2rem",
                            color: textColor,
                            ...regularTextStyle,
                            fontWeight: 200,
                            margin: "0 auto 2rem auto",
                        }}
                    >
                        {paragraph}
                    </p>
                ))}
            </div>
        </div>
    )
}

addPropertyControls(ContactFormFramer, {
    language: {
        title: "Language",
        type: ControlType.Enum,
        defaultValue: "fr",
        options: ["fr", "en"],
        optionTitles: ["French", "English"],
    },
    layoutMode: {
        title: "Layout",
        type: ControlType.Enum,
        defaultValue: "auto",
        options: ["auto", "desktop", "tablet", "phone"],
        optionTitles: ["Auto", "Desktop", "Tablet", "Phone"],
    },
    apiBaseUrl: {
        title: "API Base URL",
        type: ControlType.String,
        defaultValue: DEFAULT_API_BASE_URL,
        placeholder: "https://api.jahypotheques.ca",
    },
    requestCodeUrl: {
        title: "Request Code URL",
        type: ControlType.String,
        defaultValue: "",
        placeholder: "Leave empty to use API Base + /api/public/v1/code",
    },
    submitFormUrl: {
        title: "Submit Form URL",
        type: ControlType.String,
        defaultValue: "",
        placeholder: "Leave empty to use API Base + /api/public/v1/leads",
    },
    titleColor: {
        title: "Title Color",
        type: ControlType.Color,
        defaultValue: "#EFECE5",
    },
    textColor: {
        title: "Text Color",
        type: ControlType.Color,
        defaultValue: "#EFECE5",
    },
    formColor: {
        title: "Form Color",
        type: ControlType.Color,
        defaultValue: "#BBC7BF",
    },
    accentColor: {
        title: "Accent Color",
        type: ControlType.Color,
        defaultValue: "#D6BE75",
    },
    regularFontFamily: {
        title: "Regular Font",
        type: ControlType.Font,
        defaultValue: {
            fontFamily: "PP Right Grotesk",
            fontSize: 16,
            fontWeight: 200,
            lineHeight: "1.4",
            letterSpacing: "0px",
            color: "#BBC7BF",
        },
        controls: "extended",
    },
    mediumFontFamily: {
        title: "Medium Font",
        type: ControlType.Font,
        defaultValue: {
            fontFamily: "PP Right Grotesk Medium",
            fontSize: 24,
            fontWeight: 500,
            lineHeight: "1.5",
            letterSpacing: "0px",
            color: "#EFECE5",
        },
        controls: "extended",
    },
    tightFontFamily: {
        title: "Tight Font",
        type: ControlType.Font,
        defaultValue: {
            fontFamily: "PP Right Grotesk Tight",
            fontSize: 32,
            fontWeight: 500,
            lineHeight: "1",
            letterSpacing: "0px",
            color: "#EFECE5",
        },
        controls: "extended",
    },
    tinyFontFamily: {
        title: "Tiny Font",
        type: ControlType.Font,
        defaultValue: {
            fontFamily: "PP Right Grotesk",
            fontSize: 12,
            fontWeight: 300,
            lineHeight: "1.4",
            letterSpacing: "0px",
            color: "#BBC7BF",
        },
        controls: "extended",
    },
})
