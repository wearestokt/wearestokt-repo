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

type Language = "fr" | "en"
type LayoutMode = "auto" | "desktop" | "tablet" | "phone"
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
          [key: string]: any
      }

const COLORS = {
    pageBackground: "#242b26",
    cardBackground: "#313E37",
    textPrimary: "#f6f7f7",
    textSecondary: "#e0e7e2",
    textTertiary: "#9aaea1",
    textMuted: "#5a7263",
    textBrand: "#d6be75",
    textDark: "#161d19",
    borderPrimary: "#9aaea1",
    borderTertiary: "#3b4a42",
    borderBrand: "#d6be75",
    borderError: "#ff8f8f",
    bgBrand: "#d6be75",
    bgBrandHover: "#e5d7a3",
    bgDisabled: "#161d19",
    bgInput: "#313E37",
    bgError: "rgba(255, 143, 143, 0.1)",
} as const

const SMS_ERROR_CODES = {
    INVALID_PHONE: "invalid_phone",
    RATE_LIMIT: "rate_limit",
    SMS_SERVICE_ERROR: "sms_error",
    NETWORK_ERROR: "network_error",
    SEND_CODE_ERROR: "send_code_error",
    INVALID_CODE: "invalid_code",
} as const

const SUBMISSION_ERROR_CODES = {
    DUPLICATE_NOMINEE: "duplicate_nominee",
    INVALID_VERIFICATION_CODE: "invalid_verification_code",
    INVALID_EMAIL: "invalid_email",
    INVALID_PHONE: "invalid_phone",
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
        INVALID_VERIFICATION_CODE: SUBMISSION_ERROR_CODES.INVALID_VERIFICATION_CODE,
        DUPLICATE_NOMINEE: SUBMISSION_ERROR_CODES.DUPLICATE_NOMINEE,
        INVALID_EMAIL: SUBMISSION_ERROR_CODES.INVALID_EMAIL,
        UNEXPECTED_ERROR: SMS_ERROR_CODES.SEND_CODE_ERROR,
    }
    return map[upper] ?? errorCode.toLowerCase()
}

const copy = {
    fr: {
        formTitle: "Formulaire d'inscription",
        formDescriptionStep1:
            "Veuillez entrer les coordonnées de la personne que vous souhaitez inscrire. Vous devez nous expliquer sa situation et la manière dont cette aide pourrait transformer sa vie.",
        formDescriptionStep2:
            "Veuillez entrer vos coordonnées et vérifier votre identité.",
        tabStep1: "A propos de votre proche",
        tabStep2: "A propos de vous",
        firstName: "Prenom",
        lastName: "Nom",
        email: "Courriel",
        phone: "Telephone",
        lovedOneStoryLabel:
            "Parlez-nous de cette personne et de sa situation",
        lovedOneStoryPlaceholder:
            "Decrivez sa situation et ce qu'elle traverse en ce moment...",
        sensitiveInfoNotice:
            "Remarque : il est conseille de ne pas inclure d'informations trop sensibles.",
        lovedOneNeedLabel:
            "De quelle aide financiere cette personne aurait-elle besoin?",
        lovedOneNeedPlaceholder:
            "Decrivez le besoin financier concret et le montant qui ferait la difference.",
        continueButton: "CONTINUER",
        backButton: "RETOUR",
        identityVerification: "Vérification d'identité",
        verificationSubtext:
            "Aidez-nous a verifier votre identite en inscrivant votre numero de cellulaire. Nous vous enverrons un code de validation. Cette etape nous permet simplement de confirmer que la demande est authentique. Votre numero ne sera jamais partage.",
        phoneSubtitle:
            "*Des frais de messages et de donnees peuvent s'appliquer.",
        verificationCode: "Code de verification",
        sendCodeButton: "Envoyer le code",
        sendCodeAgain: "Renvoyer le code",
        submitButton: "INSCRIRE MON PROCHE",
        submittingButton: "Inscription en cours...",
        acceptPersonalInfoCollection:
            "J'accepte la collecte de renseignements personnels. *",
        acceptContactForVideo:
            "J'accepte d'etre contacte(e) si notre demande est retenue, et je comprends que le moment surprise pourra etre filme et partage sur les reseaux sociaux de JA Hypotheques et de Pierre-Charles Jolicoeur. *",
        successTitle: "Inscription reussie !",
        successMessage:
            "Vous avez inscrit votre proche afin de lui offrir une aide financiere. Si cette demande est selectionnee, nous vous contacterons pour en discuter. Merci d'avoir pris le temps de partager son histoire.",
        errors: {
            submissionError: "Une erreur est survenue. Veuillez reessayer.",
            duplicateNominee: "Cette personne a deja ete inscrite.",
            invalidVerificationCode:
                "Le code de verification est invalide.",
            invalidEmail: "L'adresse courriel est invalide.",
            invalidPhone: "Le numero de telephone est invalide.",
            smsFallback: "Une erreur est survenue lors de l'envoi du code.",
            smsRateLimit:
                "Trop de tentatives. Veuillez reessayer dans quelques minutes.",
            smsNetwork:
                "Erreur de connexion. Verifiez votre connexion internet.",
            smsService:
                "Impossible d'envoyer le SMS. Veuillez verifier votre numero.",
        },
    },
    en: {
        formTitle: "Registration form",
        formDescriptionStep1:
            "Please enter the contact information of the person you wish to nominate. You must explain their situation and how this help could transform their life.",
        formDescriptionStep2:
            "Please enter your contact information and verify your identity.",
        tabStep1: "About your loved one",
        tabStep2: "About you",
        firstName: "First name",
        lastName: "Last name",
        email: "Email",
        phone: "Phone",
        lovedOneStoryLabel: "Tell us about this person and their situation",
        lovedOneStoryPlaceholder:
            "Describe their situation and what they are going through right now...",
        sensitiveInfoNotice:
            "Note: it is recommended not to include overly sensitive information.",
        lovedOneNeedLabel: "What financial help would this person need?",
        lovedOneNeedPlaceholder:
            "Describe the specific financial need and the amount that would make a difference.",
        continueButton: "CONTINUE",
        backButton: "BACK",
        identityVerification: "Identity verification",
        verificationSubtext:
            "Help us verify your identity by entering your cell phone number. We will send you a validation code. This step simply allows us to confirm that the request is genuine. Your number will never be shared.",
        phoneSubtitle: "*Message and data rates may apply.",
        verificationCode: "Verification code",
        sendCodeButton: "Send code",
        sendCodeAgain: "Resend code",
        submitButton: "REGISTER MY LOVED ONE",
        submittingButton: "Registering...",
        acceptPersonalInfoCollection:
            "I accept the collection of personal information. *",
        acceptContactForVideo:
            "I accept to be contacted if our application is selected, and I understand that the surprise moment may be filmed and shared on the social media of JA Mortgages and Pierre-Charles Jolicoeur. *",
        successTitle: "Registration successful!",
        successMessage:
            "You have registered your loved one to offer them financial assistance. If this request is selected, we will contact you to discuss it. Thank you for taking the time to share their story.",
        errors: {
            submissionError: "An error occurred. Please try again.",
            duplicateNominee: "This person has already been nominated.",
            invalidVerificationCode: "The verification code is invalid.",
            invalidEmail: "The email address is invalid.",
            invalidPhone: "The phone number is invalid.",
            smsFallback: "An error occurred while sending the code.",
            smsRateLimit:
                "Too many attempts. Please try again in a few minutes.",
            smsNetwork:
                "Connection error. Please check your internet connection.",
            smsService:
                "Unable to send SMS. Please check your phone number.",
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

const normalizePhoneDigits = (phone: string) => {
    const digitsOnly = (phone || "").replace(/\D/g, "")
    if (digitsOnly.length === 11 && digitsOnly.startsWith("1")) {
        return digitsOnly.slice(1)
    }
    return digitsOnly
}

const formatPhoneDisplay = (raw: string) => {
    const digits = normalizePhoneDigits(raw).slice(0, 10)
    if (!digits) return ""
    if (digits.length <= 3) return `(${digits}`
    if (digits.length <= 6) return `(${digits.slice(0, 3)}) ${digits.slice(3)}`
    return `(${digits.slice(0, 3)}) ${digits.slice(3, 6)}-${digits.slice(6)}`
}

const isValidPhone = (phone: string) => {
    const digits = normalizePhoneDigits(phone)
    return digits.length === 10 && digits[0] >= "2" && digits[0] <= "9"
}

const isValidEmail = (email: string) =>
    /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email || "")

const isValidVerificationCode = (code: string) => /^\d{6}$/.test((code || "").trim())

type StepId = 1 | 2 | 3
type SubmitStatus = "idle" | "loading" | "success"
type CodeRequestState =
    | { state: "idle" }
    | { state: "loading" }
    | { state: "success" }
    | { state: "error"; message: string }

interface LovedOneData {
    firstName: string
    lastName: string
    email: string
    phone: string
    why: string
    how: string
}

interface ApplicantData {
    firstName: string
    lastName: string
    email: string
    phone: string
}

interface Props {
    language?: Language
    layoutMode?: LayoutMode
    devPreviewMode?: boolean
    devPreviewStep?: "step1" | "step2"
    apiBaseUrl?: string
    requestCodeUrl?: string
    submitFormUrl?: string
    regularFontFamily?: FontControlValue
    mediumFontFamily?: FontControlValue
    tightFontFamily?: FontControlValue
    cardBackground?: string
    textColor?: string
    secondaryTextColor?: string
    accentColor?: string
    borderColor?: string
    style?: React.CSSProperties
    width?: number
    height?: number
}

export default function AideUnProcheFormFramer(props: Props) {
    const language: Language = props.language ?? "fr"
    const t = copy[language]

    const apiBaseUrl = normalizeApiBaseUrl(props.apiBaseUrl)
    const requestCodeUrl = props.requestCodeUrl?.trim()
        ? props.requestCodeUrl.trim()
        : buildApiUrl(apiBaseUrl, API_PATHS.publicCode)
    const submitFormUrl = props.submitFormUrl?.trim()
        ? props.submitFormUrl.trim()
        : buildApiUrl(apiBaseUrl, API_PATHS.publicAiderUnProche)

    const cardBackground = props.cardBackground ?? COLORS.cardBackground
    const textColor = props.textColor ?? COLORS.textPrimary
    const secondaryTextColor = props.secondaryTextColor ?? COLORS.textSecondary
    const accentColor = props.accentColor ?? COLORS.bgBrand
    const borderColor = props.borderColor ?? COLORS.borderPrimary

    const regularFamily = fontFamilyFromControl(
        props.regularFontFamily,
        "PP Right Grotesk, Inter, Arial, sans-serif"
    )
    const mediumFamily = fontFamilyFromControl(
        props.mediumFontFamily,
        "PP Right Grotesk Medium, PP Right Grotesk, Inter, Arial, sans-serif"
    )
    const tightFamily = fontFamilyFromControl(
        props.tightFontFamily,
        "PP Right Grotesk Tight, PP Right Grotesk, Inter, Arial, sans-serif"
    )
    const regularTextStyle = typographyFromControl(
        props.regularFontFamily,
        regularFamily
    )
    const mediumTextStyle = typographyFromControl(
        props.mediumFontFamily,
        mediumFamily
    )
    const tightTextStyle = typographyFromControl(props.tightFontFamily, tightFamily)

    const widthFromFrame = typeof props.width === "number" ? props.width : undefined
    const widthFromStyle =
        typeof props.style?.width === "number"
            ? props.style.width
            : typeof props.style?.width === "string" &&
                props.style.width.endsWith("px")
              ? Number(props.style.width.replace("px", ""))
              : undefined
    const effectiveWidth = widthFromFrame ?? widthFromStyle ?? 1024
    const layoutMode: LayoutMode =
        props.layoutMode && props.layoutMode !== "auto"
            ? props.layoutMode
            : effectiveWidth > 960
              ? "desktop"
              : effectiveWidth > 640
                ? "tablet"
                : "phone"

    const isPhone = layoutMode === "phone"
    const isTablet = layoutMode === "tablet"
    const devPreviewMode = props.devPreviewMode ?? false
    const devPreviewStep = props.devPreviewStep ?? "step1"

    const [step, setStep] = React.useState<StepId>(1)
    const [lovedOne, setLovedOne] = React.useState<LovedOneData>({
        firstName: "",
        lastName: "",
        email: "",
        phone: "",
        why: "",
        how: "",
    })
    const [applicant, setApplicant] = React.useState<ApplicantData>({
        firstName: "",
        lastName: "",
        email: "",
        phone: "",
    })
    const [verificationCode, setVerificationCode] = React.useState("")
    const [confirmUseOfPersonalInfo, setConfirmUseOfPersonalInfo] =
        React.useState(false)
    const [acceptModalities, setAcceptModalities] = React.useState(false)
    const [submitStatus, setSubmitStatus] = React.useState<SubmitStatus>("idle")
    const [submitError, setSubmitError] = React.useState<string | null>(null)
    const [codeRequestStatus, setCodeRequestStatus] =
        React.useState<CodeRequestState>({ state: "idle" })
    const [countdownSeconds, setCountdownSeconds] = React.useState(0)
    const countdownRef = React.useRef<ReturnType<typeof setInterval> | null>(null)

    React.useEffect(
        () => () => {
            if (countdownRef.current) clearInterval(countdownRef.current)
        },
        []
    )

    const startCountdown = React.useCallback((seconds: number) => {
        const safe = Number.isFinite(seconds) ? Math.max(1, Math.ceil(seconds)) : 20
        setCountdownSeconds(safe)
        if (countdownRef.current) clearInterval(countdownRef.current)
        countdownRef.current = setInterval(() => {
            setCountdownSeconds(prev => {
                if (prev <= 1) {
                    if (countdownRef.current) clearInterval(countdownRef.current)
                    countdownRef.current = null
                    return 0
                }
                return prev - 1
            })
        }, 1000)
    }, [])

    const getSmsErrorMessage = (errorCode: string | undefined) => {
        switch (normalizeApiErrorCode(errorCode)) {
            case SMS_ERROR_CODES.INVALID_PHONE:
                return t.errors.invalidPhone
            case SMS_ERROR_CODES.RATE_LIMIT:
                return t.errors.smsRateLimit
            case SMS_ERROR_CODES.SMS_SERVICE_ERROR:
                return t.errors.smsService
            case SMS_ERROR_CODES.NETWORK_ERROR:
                return t.errors.smsNetwork
            default:
                return t.errors.smsFallback
        }
    }

    const getSubmissionErrorMessage = (
        errorCode: string | undefined,
        apiMessage?: string
    ) => {
        switch (normalizeApiErrorCode(errorCode)) {
            case SUBMISSION_ERROR_CODES.DUPLICATE_NOMINEE:
                return t.errors.duplicateNominee
            case SUBMISSION_ERROR_CODES.INVALID_VERIFICATION_CODE:
                return t.errors.invalidVerificationCode
            case SUBMISSION_ERROR_CODES.INVALID_EMAIL:
                return t.errors.invalidEmail
            case SUBMISSION_ERROR_CODES.INVALID_PHONE:
                return t.errors.invalidPhone
            default:
                return apiMessage || t.errors.submissionError
        }
    }

    const step1Valid =
        lovedOne.firstName.trim().length > 0 &&
        lovedOne.lastName.trim().length > 0 &&
        isValidEmail(lovedOne.email) &&
        isValidPhone(lovedOne.phone) &&
        lovedOne.why.trim().length > 0 &&
        lovedOne.how.trim().length > 0

    const step2IdentityValid =
        applicant.firstName.trim().length > 0 &&
        applicant.lastName.trim().length > 0 &&
        isValidEmail(applicant.email) &&
        isValidPhone(applicant.phone)

    const step2Valid =
        step2IdentityValid &&
        codeRequestStatus.state === "success" &&
        isValidVerificationCode(verificationCode) &&
        confirmUseOfPersonalInfo &&
        acceptModalities

    const canSendCode =
        isValidPhone(applicant.phone) &&
        codeRequestStatus.state !== "loading" &&
        countdownSeconds === 0

    const renderedStep: StepId = devPreviewMode
        ? devPreviewStep === "step2"
            ? 2
            : 1
        : step

    const requestVerificationCode = async () => {
        if (!canSendCode) return
        setSubmitError(null)
        setVerificationCode("")
        setCodeRequestStatus({ state: "loading" })

        try {
            const response = await fetch(requestCodeUrl, {
                method: "POST",
                headers: {
                    "Content-Type": "application/json",
                    "Accept-Language": language,
                },
                body: JSON.stringify({
                    contact: toE164CanadianPhone(applicant.phone),
                    validationMethod: "sms",
                }),
            })
            const result = (await response.json().catch(() => ({}))) as Record<
                string,
                unknown
            >

            if (isApiSuccess(response, result)) {
                setCodeRequestStatus({ state: "success" })
                startCountdown(SMS_CODE_THROTTLE_SECONDS)
                return
            }

            const errorCode =
                normalizeApiErrorCode(parseSmsErrorCode(result)) ??
                SMS_ERROR_CODES.SEND_CODE_ERROR

            setCodeRequestStatus({
                state: "error",
                message: getSmsErrorMessage(errorCode),
            })

            if (errorCode === SMS_ERROR_CODES.RATE_LIMIT) {
                startCountdown(
                    parseRetryAfterSeconds(result, SMS_CODE_THROTTLE_SECONDS)
                )
            }
        } catch (_error) {
            setCodeRequestStatus({
                state: "error",
                message: t.errors.smsNetwork,
            })
        }
    }

    const submitForm = async () => {
        if (!step2Valid || submitStatus === "loading") return

        setSubmitStatus("loading")
        setSubmitError(null)

        const payload = {
            applicant: {
                firstName: applicant.firstName,
                lastName: applicant.lastName,
                email: applicant.email,
                phone: toE164CanadianPhone(applicant.phone),
            },
            lovedOne: {
                firstName: lovedOne.firstName,
                lastName: lovedOne.lastName,
                email: lovedOne.email,
                phone: toE164CanadianPhone(lovedOne.phone),
                why: lovedOne.why,
                how: lovedOne.how,
            },
            verificationCode: verificationCode.trim(),
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
            const result = (await response.json().catch(() => ({}))) as Record<
                string,
                unknown
            >
            if (isApiSuccess(response, result)) {
                setSubmitStatus("success")
                setStep(3)
                return
            }

            const apiMessage =
                typeof result?.message === "string" ? result.message : undefined
            const errorCode = normalizeApiErrorCode(parseSmsErrorCode(result))

            setSubmitError(getSubmissionErrorMessage(errorCode, apiMessage))
            setSubmitStatus("idle")
        } catch (_error) {
            setSubmitError(t.errors.submissionError)
            setSubmitStatus("idle")
        }
    }

    const baseInputStyle: React.CSSProperties = {
        width: "100%",
        border: `1px solid ${borderColor}`,
        background: COLORS.bgInput,
        color: textColor,
        borderRadius: 8,
        boxSizing: "border-box",
        padding: "14px 16px",
        fontSize: 14,
        lineHeight: "18px",
        outline: "none",
        ...regularTextStyle,
    }

    const labelStyle: React.CSSProperties = {
        color: secondaryTextColor,
        fontSize: 12,
        lineHeight: "16px",
        fontWeight: 500,
        marginBottom: 6,
        ...regularTextStyle,
    }

    const sectionTitleStyle: React.CSSProperties = {
        color: secondaryTextColor,
        fontSize: isPhone ? 22 : 26,
        lineHeight: "1.2",
        fontWeight: 500,
        margin: 0,
        ...mediumTextStyle,
    }

    const fieldRowStyle: React.CSSProperties = {
        display: "grid",
        gridTemplateColumns: isPhone ? "1fr" : "1fr 1fr",
        gap: isPhone ? 12 : isTablet ? 16 : 20,
    }

    const renderStepBar = () => (
        <div
            style={{
                display: "grid",
                gridTemplateColumns: "1fr 1fr",
                gap: 16,
                width: "100%",
            }}
        >
            {[1, 2].map(index => {
                const active = renderedStep === index
                const done = renderedStep > index
                return (
                    <div
                        key={index}
                        style={{
                            display: "flex",
                            flexDirection: "column",
                            gap: 6,
                        }}
                    >
                        <span
                            style={{
                                color: active
                                    ? COLORS.textTertiary
                                    : COLORS.textMuted,
                                fontSize: isPhone ? 12 : 15,
                                minHeight: isPhone ? 18 : 22,
                                ...regularTextStyle,
                            }}
                        >
                            {index === 1 ? t.tabStep1 : t.tabStep2}
                        </span>
                        <span
                            style={{
                                display: "block",
                                height: 6,
                                borderRadius: 9999,
                                background:
                                    active || done
                                        ? accentColor
                                        : COLORS.borderTertiary,
                            }}
                        />
                    </div>
                )
            })}
        </div>
    )

    if (!devPreviewMode && (step === 3 || submitStatus === "success")) {
        return (
            <div
                style={{
                    width: "100%",
                    boxSizing: "border-box",
                    color: textColor,
                    ...regularTextStyle,
                    ...(props.style ?? {}),
                }}
            >
                <div
                    style={{
                        maxWidth: 900,
                        margin: "0 auto",
                        borderRadius: 12,
                        background: cardBackground,
                        border: `1px solid ${COLORS.borderTertiary}`,
                        padding: isPhone ? 24 : 40,
                        textAlign: "center",
                    }}
                >
                    <div
                        style={{
                            width: 92,
                            height: 92,
                            margin: "0 auto 24px auto",
                            borderRadius: "50%",
                            border: `2px solid ${accentColor}`,
                            display: "flex",
                            alignItems: "center",
                            justifyContent: "center",
                            color: accentColor,
                        }}
                        aria-hidden
                    >
                        <svg
                            xmlns="http://www.w3.org/2000/svg"
                            width="46"
                            height="46"
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
                    </div>
                    <h2
                        style={{
                            margin: "0 0 16px 0",
                            color: textColor,
                            fontSize: isPhone ? 28 : 38,
                            lineHeight: 1.1,
                            fontWeight: 500,
                            ...tightTextStyle,
                        }}
                    >
                        {t.successTitle}
                    </h2>
                    <p
                        style={{
                            margin: 0,
                            color: secondaryTextColor,
                            maxWidth: 700,
                            marginInline: "auto",
                            fontSize: isPhone ? 14 : 16,
                            lineHeight: 1.6,
                            ...regularTextStyle,
                        }}
                    >
                        {t.successMessage}
                    </p>
                </div>
            </div>
        )
    }

    return (
        <div
            style={{
                width: "100%",
                boxSizing: "border-box",
                color: textColor,
                ...regularTextStyle,
                ...(props.style ?? {}),
            }}
        >
            <style>{`
                .aup-field::placeholder, .aup-textarea::placeholder { color: ${COLORS.textTertiary}; opacity: 1; }
                .aup-field:focus, .aup-textarea:focus { border-color: ${accentColor}; box-shadow: 0 0 0 1px ${accentColor}; }
                .aup-primary-btn:disabled, .aup-secondary-btn:disabled { opacity: 0.55; cursor: not-allowed; }
                .aup-primary-btn:hover:not(:disabled) { background: ${COLORS.bgBrandHover}; }
                .aup-secondary-btn:hover:not(:disabled) { background: #1e2822; }
                .aup-code::placeholder { color: ${COLORS.textTertiary}; }
            `}</style>
            <div
                style={{
                    maxWidth: 900,
                    margin: "0 auto",
                    borderRadius: 12,
                    background: cardBackground,
                    border: `1px solid ${COLORS.borderTertiary}`,
                    boxShadow: "0 4px 12px rgba(0, 0, 0, 0.25)",
                    padding: isPhone ? 20 : 32,
                    display: "flex",
                    flexDirection: "column",
                    gap: 28,
                }}
            >
                <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
                    <h2
                        style={{
                            margin: 0,
                            color: textColor,
                            fontSize: isPhone ? 24 : 30,
                            lineHeight: 1.2,
                            fontWeight: 500,
                            ...mediumTextStyle,
                        }}
                    >
                        {t.formTitle}
                    </h2>
                    {renderStepBar()}
                    <p
                        style={{
                            margin: 0,
                            color: secondaryTextColor,
                            fontSize: isPhone ? 14 : 16,
                            lineHeight: 1.6,
                            ...regularTextStyle,
                        }}
                    >
                        {renderedStep === 1
                            ? t.formDescriptionStep1
                            : t.formDescriptionStep2}
                    </p>
                </div>

                {renderedStep === 1 ? (
                    <form
                        onSubmit={e => {
                            e.preventDefault()
                            if (!step1Valid) return
                            setStep(2)
                        }}
                        style={{ display: "flex", flexDirection: "column", gap: 24 }}
                    >
                        <div style={fieldRowStyle}>
                            <LabeledField label={`${t.firstName} *`} labelStyle={labelStyle}>
                                <input
                                    className="aup-field"
                                    style={baseInputStyle}
                                    value={lovedOne.firstName}
                                    onChange={e =>
                                        setLovedOne(prev => ({
                                            ...prev,
                                            firstName: e.target.value,
                                        }))
                                    }
                                    maxLength={25}
                                    required
                                />
                            </LabeledField>
                            <LabeledField label={`${t.lastName} *`} labelStyle={labelStyle}>
                                <input
                                    className="aup-field"
                                    style={baseInputStyle}
                                    value={lovedOne.lastName}
                                    onChange={e =>
                                        setLovedOne(prev => ({
                                            ...prev,
                                            lastName: e.target.value,
                                        }))
                                    }
                                    maxLength={25}
                                    required
                                />
                            </LabeledField>
                        </div>

                        <LabeledField label={`${t.email} *`} labelStyle={labelStyle}>
                            <input
                                className="aup-field"
                                type="email"
                                style={baseInputStyle}
                                value={lovedOne.email}
                                onChange={e =>
                                    setLovedOne(prev => ({
                                        ...prev,
                                        email: e.target.value,
                                    }))
                                }
                                maxLength={255}
                                required
                            />
                        </LabeledField>

                        <LabeledField label={`${t.phone} *`} labelStyle={labelStyle}>
                            <PhoneField
                                value={lovedOne.phone}
                                onChange={phone =>
                                    setLovedOne(prev => ({ ...prev, phone }))
                                }
                                inputStyle={baseInputStyle}
                            />
                        </LabeledField>

                        <LabeledField
                            label={`${t.lovedOneStoryLabel} *`}
                            labelStyle={labelStyle}
                        >
                            <textarea
                                className="aup-textarea"
                                style={{
                                    ...baseInputStyle,
                                    minHeight: 132,
                                    resize: "vertical",
                                }}
                                value={lovedOne.why}
                                onChange={e =>
                                    setLovedOne(prev => ({ ...prev, why: e.target.value }))
                                }
                                maxLength={2000}
                                placeholder={t.lovedOneStoryPlaceholder}
                                required
                            />
                        </LabeledField>

                        <p
                            style={{
                                margin: "-8px 0 0 0",
                                color: COLORS.textTertiary,
                                fontSize: 12,
                                lineHeight: "16px",
                                ...regularTextStyle,
                            }}
                        >
                            {t.sensitiveInfoNotice}
                        </p>

                        <LabeledField label={`${t.lovedOneNeedLabel} *`} labelStyle={labelStyle}>
                            <textarea
                                className="aup-textarea"
                                style={{
                                    ...baseInputStyle,
                                    minHeight: 132,
                                    resize: "vertical",
                                }}
                                value={lovedOne.how}
                                onChange={e =>
                                    setLovedOne(prev => ({ ...prev, how: e.target.value }))
                                }
                                maxLength={2000}
                                placeholder={t.lovedOneNeedPlaceholder}
                                required
                            />
                        </LabeledField>

                        <div
                            style={{
                                borderTop: `1px solid ${COLORS.borderTertiary}`,
                                paddingTop: 18,
                                display: "flex",
                                justifyContent: "flex-end",
                            }}
                        >
                            <button
                                className="aup-primary-btn"
                                type="submit"
                                disabled={!step1Valid}
                                style={primaryButtonStyle(accentColor, regularTextStyle)}
                            >
                                {t.continueButton}
                            </button>
                        </div>
                    </form>
                ) : null}

                {renderedStep === 2 ? (
                    <form
                        onSubmit={e => {
                            e.preventDefault()
                            submitForm()
                        }}
                        style={{ display: "flex", flexDirection: "column", gap: 24 }}
                    >
                        <div style={fieldRowStyle}>
                            <LabeledField label={`${t.firstName} *`} labelStyle={labelStyle}>
                                <input
                                    className="aup-field"
                                    style={baseInputStyle}
                                    value={applicant.firstName}
                                    onChange={e =>
                                        setApplicant(prev => ({
                                            ...prev,
                                            firstName: e.target.value,
                                        }))
                                    }
                                    maxLength={25}
                                    required
                                />
                            </LabeledField>
                            <LabeledField label={`${t.lastName} *`} labelStyle={labelStyle}>
                                <input
                                    className="aup-field"
                                    style={baseInputStyle}
                                    value={applicant.lastName}
                                    onChange={e =>
                                        setApplicant(prev => ({
                                            ...prev,
                                            lastName: e.target.value,
                                        }))
                                    }
                                    maxLength={25}
                                    required
                                />
                            </LabeledField>
                        </div>

                        <LabeledField label={`${t.email} *`} labelStyle={labelStyle}>
                            <input
                                className="aup-field"
                                type="email"
                                style={baseInputStyle}
                                value={applicant.email}
                                onChange={e =>
                                    setApplicant(prev => ({
                                        ...prev,
                                        email: e.target.value,
                                    }))
                                }
                                maxLength={255}
                                required
                            />
                        </LabeledField>

                        <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                            <h3 style={sectionTitleStyle}>{t.identityVerification}</h3>
                            <p
                                style={{
                                    margin: 0,
                                    color: secondaryTextColor,
                                    fontSize: isPhone ? 14 : 15,
                                    lineHeight: 1.6,
                                    ...regularTextStyle,
                                }}
                            >
                                {t.verificationSubtext}
                            </p>
                        </div>

                        <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                            <label style={labelStyle}>{`${t.phone} *`}</label>
                            <div
                                style={{
                                    display: "grid",
                                    gridTemplateColumns: isPhone
                                        ? "1fr"
                                        : "minmax(0,1fr) auto",
                                    gap: 10,
                                    alignItems: "center",
                                }}
                            >
                                <PhoneField
                                    value={applicant.phone}
                                    onChange={phone =>
                                        setApplicant(prev => ({ ...prev, phone }))
                                    }
                                    inputStyle={baseInputStyle}
                                />
                                <button
                                    type="button"
                                    className="aup-secondary-btn"
                                    onClick={requestVerificationCode}
                                    disabled={!canSendCode}
                                    style={secondaryButtonStyle(accentColor, regularTextStyle)}
                                >
                                    {codeRequestStatus.state === "loading"
                                        ? `${t.sendCodeButton}...`
                                        : countdownSeconds > 0
                                          ? `${t.sendCodeAgain} (${countdownSeconds}s)`
                                          : codeRequestStatus.state === "success"
                                            ? t.sendCodeAgain
                                            : t.sendCodeButton}
                                </button>
                            </div>
                            <span
                                style={{
                                    color: COLORS.textTertiary,
                                    fontSize: 12,
                                    lineHeight: "16px",
                                    ...regularTextStyle,
                                }}
                            >
                                {t.phoneSubtitle}
                            </span>
                        </div>

                        {codeRequestStatus.state === "error" ? (
                            <div
                                role="alert"
                                style={{
                                    padding: "10px 12px",
                                    borderRadius: 6,
                                    background: COLORS.bgError,
                                    border: `1px solid ${COLORS.borderError}`,
                                    color: COLORS.borderError,
                                    fontSize: 14,
                                    ...regularTextStyle,
                                }}
                            >
                                {codeRequestStatus.message}
                            </div>
                        ) : null}

                        {codeRequestStatus.state === "success" ? (
                            <LabeledField
                                label={`${t.verificationCode} *`}
                                labelStyle={labelStyle}
                            >
                                <input
                                    className="aup-field aup-code"
                                    style={{
                                        ...baseInputStyle,
                                        maxWidth: 220,
                                        letterSpacing: "0.3em",
                                        textTransform: "none",
                                    }}
                                    value={verificationCode}
                                    onChange={e => {
                                        const digits = e.target.value
                                            .replace(/\D/g, "")
                                            .slice(0, 6)
                                        setVerificationCode(digits)
                                    }}
                                    inputMode="numeric"
                                    placeholder="000000"
                                    required
                                />
                            </LabeledField>
                        ) : null}

                        <ConsentRow
                            checked={confirmUseOfPersonalInfo}
                            onChange={setConfirmUseOfPersonalInfo}
                            label={t.acceptPersonalInfoCollection}
                            accentColor={accentColor}
                            textColor={secondaryTextColor}
                            regularTextStyle={regularTextStyle}
                        />

                        <ConsentRow
                            checked={acceptModalities}
                            onChange={setAcceptModalities}
                            label={t.acceptContactForVideo}
                            accentColor={accentColor}
                            textColor={secondaryTextColor}
                            regularTextStyle={regularTextStyle}
                        />

                        {submitError ? (
                            <div
                                role="alert"
                                style={{
                                    padding: "12px 14px",
                                    borderRadius: 6,
                                    background: COLORS.bgError,
                                    border: `1px solid ${COLORS.borderError}`,
                                    color: COLORS.borderError,
                                    fontSize: 14,
                                    ...regularTextStyle,
                                }}
                            >
                                {submitError}
                            </div>
                        ) : null}

                        <div
                            style={{
                                borderTop: `1px solid ${COLORS.borderTertiary}`,
                                paddingTop: 18,
                                display: "flex",
                                flexDirection: isPhone ? "column" : "row",
                                justifyContent: "space-between",
                                gap: 10,
                            }}
                        >
                            <button
                                type="button"
                                className="aup-secondary-btn"
                                onClick={() => setStep(1)}
                                style={secondaryButtonStyle(accentColor, regularTextStyle)}
                            >
                                {t.backButton}
                            </button>
                            <button
                                type="submit"
                                className="aup-primary-btn"
                                disabled={!step2Valid || submitStatus === "loading"}
                                style={primaryButtonStyle(accentColor, regularTextStyle)}
                            >
                                {submitStatus === "loading"
                                    ? t.submittingButton
                                    : t.submitButton}
                            </button>
                        </div>
                    </form>
                ) : null}
            </div>
        </div>
    )
}

function primaryButtonStyle(
    accentColor: string,
    regularTextStyle: React.CSSProperties
): React.CSSProperties {
    return {
        display: "inline-flex",
        justifyContent: "center",
        alignItems: "center",
        gap: 8,
        borderRadius: 9999,
        border: "none",
        padding: "12px 22px",
        background: accentColor,
        color: COLORS.textDark,
        cursor: "pointer",
        textTransform: "uppercase",
        letterSpacing: "0.03em",
        fontSize: 14,
        fontWeight: 600,
        lineHeight: "18px",
        ...regularTextStyle,
    }
}

function secondaryButtonStyle(
    accentColor: string,
    regularTextStyle: React.CSSProperties
): React.CSSProperties {
    return {
        display: "inline-flex",
        justifyContent: "center",
        alignItems: "center",
        gap: 8,
        borderRadius: 9999,
        border: `2px solid ${accentColor}`,
        padding: "10px 18px",
        background: "transparent",
        color: accentColor,
        cursor: "pointer",
        fontSize: 14,
        fontWeight: 600,
        lineHeight: "18px",
        ...regularTextStyle,
    }
}

function LabeledField(props: {
    label: string
    children: React.ReactNode
    labelStyle: React.CSSProperties
}) {
    return (
        <label
            style={{
                display: "flex",
                flexDirection: "column",
                width: "100%",
            }}
        >
            <span style={props.labelStyle}>{props.label}</span>
            {props.children}
        </label>
    )
}

function PhoneField({
    value,
    onChange,
    inputStyle,
}: {
    value: string
    onChange: (phone: string) => void
    inputStyle: React.CSSProperties
}) {
    return (
        <div style={{ position: "relative", width: "100%" }}>
            <span
                style={{
                    position: "absolute",
                    left: 12,
                    top: "50%",
                    transform: "translateY(-50%)",
                    color: COLORS.textTertiary,
                    fontSize: 13,
                    pointerEvents: "none",
                }}
            >
                +1
            </span>
            <input
                className="aup-field"
                type="tel"
                value={formatPhoneDisplay(value)}
                onChange={e => onChange(e.target.value)}
                style={{ ...inputStyle, paddingLeft: 38 }}
                required
            />
        </div>
    )
}

function ConsentRow({
    checked,
    onChange,
    label,
    accentColor,
    textColor,
    regularTextStyle,
}: {
    checked: boolean
    onChange: (value: boolean) => void
    label: string
    accentColor: string
    textColor: string
    regularTextStyle: React.CSSProperties
}) {
    return (
        <label
            style={{
                display: "flex",
                gap: 10,
                alignItems: "flex-start",
                cursor: "pointer",
                color: textColor,
                fontSize: 14,
                lineHeight: 1.5,
                ...regularTextStyle,
            }}
        >
            <span
                style={{
                    width: 18,
                    height: 18,
                    border: `1px solid ${accentColor}`,
                    borderRadius: 4,
                    marginTop: 2,
                    flexShrink: 0,
                    display: "inline-flex",
                    alignItems: "center",
                    justifyContent: "center",
                    background: checked ? accentColor : "transparent",
                    color: checked ? COLORS.textDark : "transparent",
                    transition: "all 120ms ease",
                }}
                aria-hidden
            >
                <svg
                    xmlns="http://www.w3.org/2000/svg"
                    width="11"
                    height="11"
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
            </span>
            <input
                type="checkbox"
                checked={checked}
                onChange={e => onChange(e.target.checked)}
                style={{
                    position: "absolute",
                    opacity: 0,
                    pointerEvents: "none",
                    width: 1,
                    height: 1,
                }}
                required
            />
            <span>{label}</span>
        </label>
    )
}

addPropertyControls(AideUnProcheFormFramer, {
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
    devPreviewMode: {
        title: "Dev Preview",
        type: ControlType.Boolean,
        defaultValue: false,
        enabledTitle: "On",
        disabledTitle: "Off",
    },
    devPreviewStep: {
        title: "Preview Step",
        type: ControlType.Enum,
        defaultValue: "step1",
        options: ["step1", "step2"],
        optionTitles: ["Step 1", "Step 2"],
        hidden: (props: Props) => !props.devPreviewMode,
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
        placeholder: "Leave empty to use API Base + /api/public/v1/contests/aider-un-proche",
    },
    cardBackground: {
        title: "Card BG",
        type: ControlType.Color,
        defaultValue: "#313E37",
    },
    textColor: {
        title: "Text",
        type: ControlType.Color,
        defaultValue: "#F6F7F7",
    },
    secondaryTextColor: {
        title: "Sub Text",
        type: ControlType.Color,
        defaultValue: "#E0E7E2",
    },
    accentColor: {
        title: "Accent",
        type: ControlType.Color,
        defaultValue: "#D6BE75",
    },
    borderColor: {
        title: "Border",
        type: ControlType.Color,
        defaultValue: "#9AAEA1",
    },
    regularFontFamily: {
        title: "Regular Font",
        type: ControlType.Font,
        defaultValue: {
            fontFamily: "PP Right Grotesk",
            fontSize: 14,
            fontWeight: 400,
            lineHeight: "1.5",
            letterSpacing: "0px",
            color: "#F6F7F7",
        },
        controls: "extended",
    },
    mediumFontFamily: {
        title: "Medium Font",
        type: ControlType.Font,
        defaultValue: {
            fontFamily: "PP Right Grotesk Medium",
            fontSize: 30,
            fontWeight: 500,
            lineHeight: "1.2",
            letterSpacing: "0px",
            color: "#F6F7F7",
        },
        controls: "extended",
    },
    tightFontFamily: {
        title: "Tight Font",
        type: ControlType.Font,
        defaultValue: {
            fontFamily: "PP Right Grotesk Tight",
            fontSize: 38,
            fontWeight: 500,
            lineHeight: "1.1",
            letterSpacing: "0px",
            color: "#F6F7F7",
        },
        controls: "extended",
    },
})
