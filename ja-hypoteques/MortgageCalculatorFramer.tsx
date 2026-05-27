import * as React from "react"
import * as Framer from "framer"
import { addPropertyControls, ControlType } from "framer"

// Framer Code Components must be self-contained (no local file imports).
/** Calculator email lives on Payload CMS, not broker-portal API. */
const DEFAULT_CALCULATOR_CMS_BASE = "https://jahypotheques.payloadcms.app"
const DEFAULT_CALCULATOR_SEND_URL = `${DEFAULT_CALCULATOR_CMS_BASE}/api/calculator-results`

function resolveCalculatorSendEndpoint(custom?: string): string {
    const trimmed = custom?.trim()
    if (!trimmed) return DEFAULT_CALCULATOR_SEND_URL
    if (trimmed.startsWith("http://") || trimmed.startsWith("https://")) {
        return trimmed
    }
    const path = trimmed.startsWith("/") ? trimmed : `/${trimmed}`
    return `${DEFAULT_CALCULATOR_CMS_BASE.replace(/\/+$/, "")}${path}`
}

async function readResponseBody(response: Response): Promise<{
    json: Record<string, unknown>
    text: string
}> {
    const text = await response.text()
    if (!text) return { json: {}, text: "" }
    try {
        const parsed = JSON.parse(text) as unknown
        if (parsed && typeof parsed === "object" && !Array.isArray(parsed)) {
            return { json: parsed as Record<string, unknown>, text }
        }
        return { json: {}, text }
    } catch (_error) {
        return { json: {}, text }
    }
}

const useFramerLocaleInfo: (() => {
    activeLocale?: { id?: string; code?: string; slug?: string; name?: string } | null
    locales?: Array<{ id?: string; code?: string; slug?: string; name?: string }>
}) | undefined = (Framer as any).useLocaleInfo

type Language = "en" | "fr"
type LanguageMode = "auto" | "en" | "fr"

const matchLanguageFromString = (value?: string | null): Language | null => {
    if (!value) return null
    const v = value.toLowerCase()
    if (v.startsWith("en")) return "en"
    if (v.startsWith("fr")) return "fr"
    if (v.includes("english")) return "en"
    if (v.includes("french") || v.includes("français") || v.includes("francais")) return "fr"
    return null
}

const detectLanguageFromUrl = (): Language => {
    if (typeof window === "undefined") return "fr"
    try {
        const path = window.location?.pathname?.toLowerCase() ?? ""
        if (path === "/en" || path.startsWith("/en/") || path.startsWith("/en-")) return "en"
        const htmlLang = document?.documentElement?.lang?.toLowerCase() ?? ""
        if (htmlLang.startsWith("en")) return "en"
    } catch (_error) {
        // ignore detection errors and fallback
    }
    return "fr"
}
type TabKey = "salary" | "purchasePrice" | "desiredPayment"
type FontControlValue = string | { fontFamily?: string; family?: string; font?: string; [key: string]: any }

const COLORS = {
    primaryBackground: "#242b26",
    secondaryBackground: "#d6be75",
    cardBackground: "rgba(49, 62, 55, 0.65)",
    resultCardBackground: "rgba(44, 55, 49, 1)",
    textColor: "#efece5",
    secondaryTextColor: "#ccc5b2",
    textLinkColor: "#d6be75",
    inputBorder: "#9AAEA1",
    errorColor: "rgba(255, 143, 143, 1)",
} as const
const SLIDER_THUMB_SIZE = 18.5
const FLOATING_PERCENT_OPTICAL_OFFSET_X = 2

const copy = {
    en: {
        title: "MORTGAGE CALCULATOR",
        description:
            "Our mortgage calculator is the perfect tool to help you plan your real estate purchase. It allows you to quickly and easily simulate your borrowing capacity based on various parameters. For personalized advice and professional expertise, do not hesitate to contact one of our mortgage brokers.",
        leftTitle: "Your settings",
        tabs: {
            salary: "Salary",
            purchasePrice: "Purchase price",
            desiredPayment: "Desired payment",
        },
        form: {
            salary: "Salary",
            salaryTip: "Please enter the total household income.",
            desiredPayments: "Desired payments",
            desiredPaymentsTip: "Please enter your desired monthly household payment.",
            purchasePrice: "Purchase price",
            downPayment: "Down payment",
            downPaymentDesc:
                "*Please note that the minimum down payment can vary depending on the type of property and/or the amount of financing requested, and that the selected option may not be available.",
            downPaymentTip: "The downpayment must be at least 5% of the purchase price of the property.",
            interest: "Interest rate",
            amortization: "Amortization",
            amortizationDesc:
                "In case of amortization exceeding 25 years, please note that the desired amortization may not be available depending on the percentage of down payment and/or the type of property.",
        },
        rightTitle: "Your results",
        sendByEmail: "Send by email",
        sendByEmailResponsive: "Send results by email",
        contactBroker: "CONTACT A BROKER",
        sendResultsModal: {
            title: "Send results by email",
            submit: "Submit",
            close: "Close",
            consent: "I consent to receiving communications from JA mortgages",
            emailLabel: "Enter email address:",
            emailFormatError: "Invalid email address",
            sendFailed: "Unable to send results. Please try again.",
            sendEmailFailed:
                "We could not send the email. Please verify your address and try again, or contact a broker.",
            successTitle: "Results sent successfully!",
            successMessage:
                "Thank you for using our calculator. We have sent the results to the email address you provided.",
        },
        rightDesc:
            "Please note that the information found on this mortgage calculator is provided for indicative purposes and may not be completely accurate. To ensure the accuracy of the information, we recommend that you contact one of our mortgage brokers.",
        results: {
            salary: [
                { title: "Eligible purchase price without debt" },
                { title: "Amount of financing based on the down payment", desc: "(including the insurer's premium)" },
                { title: "Monthly mortgage payment" },
            ],
            purchasePrice: [
                { title: "Gross annual salary required without debt" },
                { title: "Financing amount based on down payment", desc: "(including insurer's premium)" },
                { title: "Monthly mortgage payment" },
            ],
            desiredPayment: [
                { title: "Purchase price based on down payment" },
                { title: "Financing amount based on the desired payment", desc: "(including insurer's premium)" },
                { title: "Gross annual salary required without debt" },
            ],
        },
        years: (n: number) => `${n} years`,
    },
    fr: {
        title: "CALCULATRICE HYPOTHÉCAIRE",
        description:
            "Notre calculateur hypothécaire est l'outil parfait pour vous aider à planifier votre achat immobilier. Il vous permet de simuler rapidement et facilement votre capacité d'emprunt en fonction de divers paramètres. Pour des conseils personnalisés et une expertise professionnelle, n'hésitez pas à prendre contact avec l'un de nos courtiers hypothécaires.",
        leftTitle: "Vos paramètres",
        tabs: {
            salary: "Salaire",
            purchasePrice: "Prix d'achat",
            desiredPayment: "Paiement désiré",
        },
        form: {
            salary: "Salaire",
            salaryTip: "Veuillez entrer le revenu total du ménage.",
            desiredPayments: "Paiement désiré",
            desiredPaymentsTip: "Veuillez entrer le paiement mensuel désiré du ménage.",
            purchasePrice: "Prix d'achat",
            downPayment: "Mise de fonds",
            downPaymentDesc:
                "*Veuillez noter que la mise de fonds minimum peut varier selon le type de propriété et/ou le montant de financement demandé, et que l'option sélectionnée peut ne pas être disponible.",
            downPaymentTip: "La mise de fonds doit être d'au moins 5% du prix d'achat.",
            interest: "Taux d'intérêt",
            amortization: "Amortissement",
            amortizationDesc:
                "En cas d'amortissement dépassant 25 ans, veuillez noter que l'amortissement souhaité pourrait ne pas être disponible en fonction du pourcentage de mise de fonds et/ou du type de propriété.",
        },
        rightTitle: "Vos résultats",
        sendByEmail: "Envoyer par courriel",
        sendByEmailResponsive: "Envoyer résultats par courriel",
        contactBroker: "CONTACTER UN COURTIER",
        sendResultsModal: {
            title: "Envoyer les résultats par courriel",
            submit: "Envoyer",
            close: "Fermer",
            consent: "J'accepte de recevoir des communications de JA Hypothèques",
            emailLabel: "Veuillez entrer l'adresse courriel :",
            emailFormatError: "Adresse courriel invalide",
            sendFailed: "Impossible d'envoyer les résultats. Veuillez réessayer.",
            sendEmailFailed:
                "Impossible d'envoyer le courriel. Vérifiez l'adresse et réessayez, ou contactez un courtier.",
            successTitle: "Résultats envoyés avec succès!",
            successMessage:
                "Merci d'avoir utilisé notre calculateur. Nous avons envoyé les résultats à l'adresse courriel fournie.",
        },
        rightDesc:
            "Veuillez noter que les informations trouvées sur ce calculateur hypothécaire sont fournies à titre indicatif et peuvent ne pas être totalement précises. Pour garantir l'exactitude des informations, nous vous recommandons de contacter l'un de nos courtiers hypothécaires.",
        results: {
            salary: [
                { title: "Prix d'achat éligible sans dette" },
                { title: "Montant du financement en fonction de la mise de fonds", desc: "(incluant la prime de l'assureur)" },
                { title: "Paiement hypothécaire mensuel" },
            ],
            purchasePrice: [
                { title: "Salaire annuel brut requis sans dette" },
                { title: "Montant du financement en fonction de la mise de fonds", desc: "(incluant la prime de l'assureur)" },
                { title: "Paiement hypothécaire mensuel" },
            ],
            desiredPayment: [
                { title: "Prix d'achat en fonction de la mise de fonds" },
                { title: "Montant du financement en fonction du paiement désiré", desc: "(incluant la prime de l'assureur)" },
                { title: "Salaire annuel brut requis sans dette" },
            ],
        },
        years: (n: number) => `${n} ans`,
    },
} as const

const clamp = (n: number, min: number, max: number) => Math.min(max, Math.max(min, n))
const toNum = (value: string | number) => {
    const n = Number(value)
    return Number.isFinite(n) ? n : 0
}

const formatNumberWithSpaces = (value: number) => {
    const safe = Number.isFinite(value) ? Math.max(0, Math.round(value)) : 0
    return safe.toString().replace(/\B(?=(\d{3})+(?!\d))/g, " ")
}

const parseNumberFromFormatted = (value: string) => {
    const digits = value.replace(/[^\d]/g, "")
    return digits.length === 0 ? 0 : Number(digits)
}

const fontFamilyFromControl = (value: FontControlValue | undefined, fallback: string) => {
    if (typeof value === "string" && value.trim().length > 0) return value
    if (value && typeof value === "object") {
        const candidate = value.fontFamily || value.family || value.font
        if (candidate && candidate.trim().length > 0) return candidate
    }
    return fallback
}

const typographyFromControl = (value: FontControlValue | undefined, fallbackFamily: string): React.CSSProperties => {
    const family = fontFamilyFromControl(value, fallbackFamily)
    if (!value || typeof value !== "object") return { fontFamily: family }
    return {
        fontFamily: family,
        ...value.fontSize !== undefined ? { fontSize: value.fontSize } : {},
        ...value.fontWeight !== undefined ? { fontWeight: value.fontWeight } : {},
        ...value.lineHeight !== undefined ? { lineHeight: value.lineHeight } : {},
        ...value.letterSpacing !== undefined ? { letterSpacing: value.letterSpacing } : {},
        ...value.color !== undefined ? { color: value.color } : {},
    }
}
const fmt = (value: number) => new Intl.NumberFormat("fr-FR").format(Number((Number.isFinite(value) ? value : 0).toFixed(0)))
/** Payload CMS email template requires formatted strings in `results`, not numbers. */
const formatEmailResult = (value: number) => fmt(value)
const amortizationMap = (amortizationIndex: number) => clamp(amortizationIndex + 1, 1, 30)
const insurerPremium = (percentage: number) => {
    if (percentage < 10) return 4
    if (percentage < 15) return 3.1
    if (percentage < 20) return 2.8
    return 0
}

function safePaymentFactor(rateAnnualPercent: number, amortizationYears: number) {
    const monthly = rateAnnualPercent / 100 / 12
    const n = amortizationYears * 12
    if (monthly <= 0 || n <= 0) return 0
    const den = 1 - Math.pow(1 + monthly, -n)
    if (den === 0) return 0
    return monthly / den
}

function calcNoDebtEligiblePurchasePrice(salary: number, amortizationIndex: number, interestRate: number) {
    const yearlyHeat = 1200
    const debtRatio = 0.38
    const yearlyTaxes = 0.01
    const years = amortizationMap(amortizationIndex)
    const principal = salary * debtRatio - yearlyHeat
    const paymentFactor = safePaymentFactor(interestRate, years)
    const denominator = paymentFactor * 12 + yearlyTaxes
    if (denominator <= 0) return 0
    const result = principal / denominator
    return Number.isFinite(result) && result > 0 ? result : 0
}

function calcSalaryFinancingWithPremium(salary: number, amortizationIndex: number, interestRate: number, downPmtPct: number) {
    const purchaseThreshold = 500000
    const noDebtPrice = calcNoDebtEligiblePurchasePrice(salary, amortizationIndex, interestRate)
    const premium = insurerPremium(downPmtPct)
    const downPmtFraction = downPmtPct / 100

    const under500 = () => {
        const downPmt = noDebtPrice * downPmtFraction
        const insurerAmount = (premium / 100) * (noDebtPrice - downPmtFraction * noDebtPrice)
        return noDebtPrice - downPmt + insurerAmount
    }

    const over500sub10 = () => {
        const remaining = noDebtPrice - purchaseThreshold
        const totalDownPmt = (purchaseThreshold * downPmtPct) / 100 + remaining * 0.1
        return noDebtPrice - totalDownPmt + (premium / 100) * noDebtPrice
    }

    const result =
        noDebtPrice > purchaseThreshold
            ? downPmtFraction >= 0.1
                ? under500()
                : over500sub10()
            : under500()

    return Number.isFinite(result) && result > 0 ? result : 0
}

function calcMortgagePaymentsBasedOnSalary(salary: number, amortizationIndex: number, interestRate: number, downPmtPct: number) {
    const factor = safePaymentFactor(interestRate, amortizationMap(amortizationIndex))
    if (factor <= 0) return 0
    const result = factor * calcSalaryFinancingWithPremium(salary, amortizationIndex, interestRate, downPmtPct)
    return Number.isFinite(result) && result > 0 ? result : 0
}

function calcFinancingAmountFromPurchasePrice(purchasePrice: number, downPayment: number, downPmtSlider: number) {
    const premium = insurerPremium(downPmtSlider) / 100
    return purchasePrice - downPayment + (purchasePrice - downPayment) * premium
}

function calcMortgagePaymentsPurchasePrice(
    purchasePrice: number,
    downPayment: number,
    interestRate: number,
    amortizationIndex: number,
    downPmtSlider: number
) {
    const loan = calcFinancingAmountFromPurchasePrice(purchasePrice, downPayment, downPmtSlider)
    const years = amortizationMap(amortizationIndex)
    const monthly = interestRate / 100 / 12
    const n = years * 12
    if (monthly <= 0 || n <= 0) return 0
    const num = loan * (monthly * Math.pow(1 + monthly, n))
    const den = Math.pow(1 + monthly, n) - 1
    const result = den === 0 ? 0 : num / den
    return Number.isFinite(result) && result > 0 ? result : 0
}

function calcRequiredSalaryPurchasePrice(
    purchasePrice: number,
    downPayment: number,
    interestRate: number,
    amortizationIndex: number,
    downPmtSlider: number
) {
    const yearlyHeat = 1200
    const debtRatio = 0.38
    const yearlyTaxesPct = 0.01
    const monthlyPmt =
        calcMortgagePaymentsPurchasePrice(purchasePrice, downPayment, interestRate, amortizationIndex, downPmtSlider) * 12
    const taxes = purchasePrice * yearlyTaxesPct
    const result = (monthlyPmt + yearlyHeat + taxes) / debtRatio
    return Number.isFinite(result) && result > 0 ? result : 0
}

function calcFinancingAmountDesiredPayments(desiredPayments: number, interestRate: number, amortizationIndex: number) {
    const monthly = interestRate / 100 / 12
    const payments = amortizationMap(amortizationIndex) * 12
    if (monthly <= 0 || payments <= 0) return 0
    const result = (desiredPayments * (1 - Math.pow(1 + monthly, -payments))) / monthly
    return Number.isFinite(result) && result > 0 ? result : 0
}

function calcPurchasePriceDesiredPayments(downPmtSlider: number, desiredPayments: number, interestRate: number, amortizationIndex: number) {
    const financing = calcFinancingAmountDesiredPayments(desiredPayments, interestRate, amortizationIndex)
    const premium = insurerPremium(downPmtSlider) / 100
    const den = 1 - downPmtSlider / 100
    if (den <= 0) return 0
    const result = (financing - financing * premium) / den
    return Number.isFinite(result) && result > 0 ? result : 0
}

function calcRequiredSalaryDesiredPayments(downPmtSlider: number, desiredPayments: number, interestRate: number, amortizationIndex: number) {
    const debtRatio = 0.38
    const yearlyHeat = 1200
    const yearlyTaxes = 0.01
    const annualTaxes = yearlyTaxes * calcPurchasePriceDesiredPayments(downPmtSlider, desiredPayments, interestRate, amortizationIndex)
    const result = (desiredPayments * 12 + annualTaxes + yearlyHeat) / debtRatio
    return Number.isFinite(result) && result > 0 ? result : 0
}

interface Props {
    language?: LanguageMode
    layoutMode?: "auto" | "desktop" | "tablet" | "phone"
    regularFontFamily?: string | { fontFamily?: string; family?: string; font?: string }
    tightFontFamily?: string | { fontFamily?: string; family?: string; font?: string }
    tinyFontFamily?: string | { fontFamily?: string; family?: string; font?: string }
    tinyTightFontFamily?: string | { fontFamily?: string; family?: string; font?: string }
    sendResultsEndpoint?: string
    contactBrokerLink?: string
    contactBrokerOpenInNewTab?: boolean
    style?: React.CSSProperties
    width?: number
    height?: number
}

export default function MortgageCalculatorFramer(props: Props) {
    const languageProp: LanguageMode = props.language ?? "auto"

    let framerLocaleLanguage: Language | null = null
    try {
        if (typeof useFramerLocaleInfo === "function") {
            const info = useFramerLocaleInfo()
            const active = info?.activeLocale
            framerLocaleLanguage =
                matchLanguageFromString(active?.code) ??
                matchLanguageFromString(active?.slug) ??
                matchLanguageFromString(active?.name) ??
                matchLanguageFromString(active?.id)
            if (!framerLocaleLanguage && info && "activeLocale" in info && active === null) {
                framerLocaleLanguage = "fr"
            }
        }
    } catch (_error) {
        framerLocaleLanguage = null
    }

    const [urlLanguage, setUrlLanguage] = React.useState<Language>(() =>
        languageProp === "auto" && !framerLocaleLanguage ? detectLanguageFromUrl() : "fr"
    )

    React.useEffect(() => {
        if (languageProp !== "auto" || framerLocaleLanguage) return

        const updateFromEnv = () => setUrlLanguage(detectLanguageFromUrl())
        updateFromEnv()

        if (typeof window === "undefined") return

        window.addEventListener("popstate", updateFromEnv)
        window.addEventListener("hashchange", updateFromEnv)

        let lastHref = window.location.href
        const intervalId = window.setInterval(() => {
            if (window.location.href !== lastHref) {
                lastHref = window.location.href
                updateFromEnv()
            }
        }, 500)

        let observer: MutationObserver | null = null
        try {
            observer = new MutationObserver(updateFromEnv)
            if (document?.documentElement) {
                observer.observe(document.documentElement, { attributes: true, attributeFilter: ["lang"] })
            }
        } catch (_error) {
            // MutationObserver unavailable; rely on other listeners
        }

        return () => {
            window.removeEventListener("popstate", updateFromEnv)
            window.removeEventListener("hashchange", updateFromEnv)
            window.clearInterval(intervalId)
            if (observer) observer.disconnect()
        }
    }, [languageProp, framerLocaleLanguage])

    const language: Language =
        languageProp === "auto" ? (framerLocaleLanguage ?? urlLanguage) : (languageProp as Language)
    const t = copy[language]

    const regularFontFamily = fontFamilyFromControl(props.regularFontFamily, "PP Right Grotesk, Inter, Arial, sans-serif")
    const tightFontFamily = fontFamilyFromControl(
        props.tightFontFamily,
        "PP Right Grotesk Tight, PP Right Grotesk, Inter, Arial, sans-serif"
    )
    const tinyFontFamily = fontFamilyFromControl(props.tinyFontFamily, "PP Right Grotesk, Inter, Arial, sans-serif")
    const tinyTightFontFamily = fontFamilyFromControl(
        props.tinyTightFontFamily,
        "PP Right Grotesk Tight, PP Right Grotesk, Inter, Arial, sans-serif"
    )
    const regularTextStyle = typographyFromControl(props.regularFontFamily, regularFontFamily)
    const tightTextStyle = typographyFromControl(props.tightFontFamily, tightFontFamily)
    const tinyTextStyle = typographyFromControl(props.tinyFontFamily, tinyFontFamily)

    const [tab, setTab] = React.useState<TabKey>("salary")

    const [salary, setSalary] = React.useState(100000)
    const [salaryDownPct, setSalaryDownPct] = React.useState(20)
    const [salaryInterest, setSalaryInterest] = React.useState(5.5)
    const [salaryAmortization, setSalaryAmortization] = React.useState(24)

    const salaryEligible = calcNoDebtEligiblePurchasePrice(salary, salaryAmortization, salaryInterest)
    const salaryDownPayment = salaryEligible > 0 ? (salaryEligible * salaryDownPct) / 100 : 0

    const [purchasePrice, setPurchasePrice] = React.useState(300000)
    const [purchaseDownPct, setPurchaseDownPct] = React.useState(20)
    const [purchaseInterest, setPurchaseInterest] = React.useState(5.5)
    const [purchaseAmortization, setPurchaseAmortization] = React.useState(24)
    const purchaseDownPayment = purchasePrice > 0 ? (purchasePrice * purchaseDownPct) / 100 : 0

    const [desiredPayment, setDesiredPayment] = React.useState(2000)
    const [desiredDownPct, setDesiredDownPct] = React.useState(20)
    const [desiredInterest, setDesiredInterest] = React.useState(5.5)
    const [desiredAmortization, setDesiredAmortization] = React.useState(24)
    const desiredFinancing = calcFinancingAmountDesiredPayments(desiredPayment, desiredInterest, desiredAmortization)
    const desiredPurchasePrice = calcPurchasePriceDesiredPayments(desiredDownPct, desiredPayment, desiredInterest, desiredAmortization)
    const desiredDownPayment = desiredPurchasePrice > 0 ? (desiredPurchasePrice * desiredDownPct) / 100 : 0

    const downPctError = (value: number) => value < 5

    const salaryResults = [
        fmt(salaryEligible),
        fmt(calcSalaryFinancingWithPremium(salary, salaryAmortization, salaryInterest, salaryDownPct)),
        fmt(calcMortgagePaymentsBasedOnSalary(salary, salaryAmortization, salaryInterest, salaryDownPct)),
    ]
    const purchaseResults = [
        fmt(calcRequiredSalaryPurchasePrice(purchasePrice, purchaseDownPayment, purchaseInterest, purchaseAmortization, purchaseDownPct)),
        fmt(calcFinancingAmountFromPurchasePrice(purchasePrice, purchaseDownPayment, purchaseDownPct)),
        fmt(calcMortgagePaymentsPurchasePrice(purchasePrice, purchaseDownPayment, purchaseInterest, purchaseAmortization, purchaseDownPct)),
    ]
    const desiredResults = [
        fmt(desiredPurchasePrice),
        fmt(desiredFinancing),
        fmt(calcRequiredSalaryDesiredPayments(desiredDownPct, desiredPayment, desiredInterest, desiredAmortization)),
    ]

    const currentResultTitles = t.results[tab]
    const currentResultValues = tab === "salary" ? salaryResults : tab === "purchasePrice" ? purchaseResults : desiredResults

    const years = React.useMemo(() => Array.from({ length: 30 }, (_, i) => ({ value: i, label: t.years(i + 1) })), [t])
    const sendResultsEndpoint = resolveCalculatorSendEndpoint(props.sendResultsEndpoint)
    const [isSendModalOpen, setIsSendModalOpen] = React.useState(false)
    const [sendEmailValue, setSendEmailValue] = React.useState("")
    const [acceptedConsent, setAcceptedConsent] = React.useState(false)
    const [sendError, setSendError] = React.useState("")
    const [isSendSuccess, setIsSendSuccess] = React.useState(false)
    const [isSubmitting, setIsSubmitting] = React.useState(false)

    const isValidEmail = (email: string) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)
    const isSubmittable = isValidEmail(sendEmailValue) && acceptedConsent && !isSubmitting
    const frameWidthFromProps = typeof props.width === "number" ? props.width : undefined
    const styleWidthFromProps =
        typeof props.style?.width === "number"
            ? props.style.width
            : typeof props.style?.width === "string" && props.style.width.endsWith("px")
              ? Number(props.style.width.replace("px", ""))
              : undefined
    const effectiveWidth = frameWidthFromProps ?? styleWidthFromProps ?? 1440
    const resolvedLayoutMode =
        props.layoutMode && props.layoutMode !== "auto"
            ? props.layoutMode
            : effectiveWidth > 1200
              ? "desktop"
              : effectiveWidth > 810
                ? "tablet"
                : "phone"

    const isDesktopLayout = resolvedLayoutMode === "desktop"
    const isTabletLayout = resolvedLayoutMode === "tablet"
    const isPhoneLayout = resolvedLayoutMode === "phone"
    const isTabletMobileLayout = isTabletLayout || isPhoneLayout

    const resetCalculator = () => {
        setSalary(100000)
        setSalaryDownPct(20)
        setSalaryInterest(5.5)
        setSalaryAmortization(24)
        setPurchasePrice(300000)
        setPurchaseDownPct(20)
        setPurchaseInterest(5.5)
        setPurchaseAmortization(24)
        setDesiredPayment(2000)
        setDesiredDownPct(20)
        setDesiredInterest(5.5)
        setDesiredAmortization(24)
    }

    const openSendModal = () => {
        setIsSendModalOpen(true)
        setSendEmailValue("")
        setAcceptedConsent(false)
        setIsSendSuccess(false)
        setSendError("")
    }

    const closeSendModal = () => {
        setIsSendModalOpen(false)
        setIsSubmitting(false)
    }

    const getSendPayload = () => {
        if (tab === "salary") {
            return {
                email: sendEmailValue.trim(),
                activeTab: "salary",
                params: {
                    salary,
                    downPayment: { rate: salaryDownPct, amount: Math.round(salaryDownPayment) },
                    interest: salaryInterest,
                    amortization: salaryAmortization + 1,
                },
                results: {
                    purchasePrice: formatEmailResult(salaryEligible),
                    financingAmount: formatEmailResult(
                        calcSalaryFinancingWithPremium(
                            salary,
                            salaryAmortization,
                            salaryInterest,
                            salaryDownPct
                        )
                    ),
                    mortgagePayment: formatEmailResult(
                        calcMortgagePaymentsBasedOnSalary(
                            salary,
                            salaryAmortization,
                            salaryInterest,
                            salaryDownPct
                        )
                    ),
                },
            }
        }
        if (tab === "purchasePrice") {
            return {
                email: sendEmailValue.trim(),
                activeTab: "purchasePrice",
                params: {
                    purchasePrice,
                    downPayment: { rate: purchaseDownPct, amount: Math.round(purchaseDownPayment) },
                    interest: purchaseInterest,
                    amortization: purchaseAmortization + 1,
                },
                results: {
                    salary: formatEmailResult(
                        calcRequiredSalaryPurchasePrice(
                            purchasePrice,
                            purchaseDownPayment,
                            purchaseInterest,
                            purchaseAmortization,
                            purchaseDownPct
                        )
                    ),
                    financingAmount: formatEmailResult(
                        calcFinancingAmountFromPurchasePrice(
                            purchasePrice,
                            purchaseDownPayment,
                            purchaseDownPct
                        )
                    ),
                    mortgagePayment: formatEmailResult(
                        calcMortgagePaymentsPurchasePrice(
                            purchasePrice,
                            purchaseDownPayment,
                            purchaseInterest,
                            purchaseAmortization,
                            purchaseDownPct
                        )
                    ),
                },
            }
        }
        return {
            email: sendEmailValue.trim(),
            activeTab: "desiredPayment",
            params: {
                mortgagePayment: desiredPayment,
                downPayment: { rate: desiredDownPct, amount: Math.round(desiredDownPayment) },
                interest: desiredInterest,
                amortization: desiredAmortization + 1,
            },
            results: {
                purchasePrice: formatEmailResult(desiredPurchasePrice),
                financingAmount: formatEmailResult(desiredFinancing),
                salary: formatEmailResult(
                    calcRequiredSalaryDesiredPayments(
                        desiredDownPct,
                        desiredPayment,
                        desiredInterest,
                        desiredAmortization
                    )
                ),
            },
        }
    }

    const submitSendResults = async () => {
        if (!isValidEmail(sendEmailValue)) {
            setSendError(t.sendResultsModal.emailFormatError)
            return
        }
        if (!acceptedConsent) return
        if (!isSubmittable) return
        setIsSubmitting(true)
        setSendError("")
        try {
            const response = await fetch(sendResultsEndpoint, {
                method: "POST",
                headers: {
                    "Content-Type": "application/json",
                    "Accept-Language": language,
                },
                body: JSON.stringify(getSendPayload()),
            })
            const { json: body, text: rawText } = await readResponseBody(response)

            if (response.ok && body.ok === true) {
                setIsSendSuccess(true)
                return
            }

            const errorCode =
                typeof body.errorCode === "string" ? body.errorCode : undefined
            if (errorCode === "EMAIL_SEND_FAILED") {
                setSendError(t.sendResultsModal.sendEmailFailed)
                return
            }

            const apiMessage =
                typeof body.message === "string"
                    ? body.message
                    : rawText && rawText.length < 200
                      ? rawText.replace(/^"|"$/g, "")
                      : undefined
            setSendError(apiMessage || t.sendResultsModal.sendFailed)
        } catch (_error) {
            setSendError(t.sendResultsModal.sendFailed)
        } finally {
            setIsSubmitting(false)
        }
    }

    return (
        <div
            style={{
                width: "100%",
                background: "transparent",
                color: COLORS.textColor,
                padding: 0,
                boxSizing: "border-box",
                ...(props.style ?? {}),
            }}
        >
            <style>{`
              .mc-range {
                -webkit-appearance: none; appearance: none; width: 100%; height: 8px; border-radius: 5px; outline: none;
              }
              .mc-range::-webkit-slider-thumb {
                -webkit-appearance: none; appearance: none; width: 18.5px; height: 18.5px;
                border: 2px solid #a59875; background: #ffffff; border-radius: 50%; cursor: pointer;
              }
              .mc-range::-moz-range-thumb {
                width: 18.5px; height: 18.5px; border: 2px solid #a59875; background: #ffffff; border-radius: 50%; cursor: pointer;
              }
              .mc-no-spin::-webkit-outer-spin-button, .mc-no-spin::-webkit-inner-spin-button { -webkit-appearance: none; margin: 0; }
            `}</style>

            {!isTabletMobileLayout ? (
                <div
                    style={{
                        width: "100%",
                        maxWidth: 666,
                        display: "flex",
                        flexDirection: "column",
                        gap: 16,
                        boxSizing: "border-box",
                    }}
                >
                    <div
                        style={{
                            ...regularTextStyle,
                            marginTop: 0,
                            paddingTop: 6,
                            fontSize: 20,
                            lineHeight: "36px",
                            fontWeight: 500,
                            color: COLORS.textColor,
                            overflow: "visible",
                        }}
                    >
                        {language === "fr" ? "Calculer en fonction de votre :" : "Calculate based on your:"}
                    </div>
                    <Tabs tab={tab} setTab={setTab} labels={t.tabs} regularFontFamily={regularFontFamily} variant="desktop" />
                </div>
            ) : null}
            <div
                style={{
                    marginTop: isTabletMobileLayout ? 0 : 40,
                    border: "none",
                    background: "transparent",
                    borderRadius: 0,
                    padding: 0,
                    boxSizing: "border-box",
                }}
            >
                <div
                    style={{
                        marginTop: 0,
                        background: isTabletMobileLayout ? "transparent" : "rgba(36, 43, 38, 0.95)",
                        borderRadius: isTabletMobileLayout ? 0 : 16,
                        paddingTop: isTabletMobileLayout ? 0 : 40,
                        paddingRight: isTabletMobileLayout ? 0 : 40,
                        paddingBottom: isTabletMobileLayout ? 0 : 40,
                        paddingLeft: isTabletMobileLayout ? 0 : 40,
                        height: isTabletMobileLayout ? "auto" : 731,
                        display: "grid",
                        gridTemplateColumns: isTabletMobileLayout ? "minmax(0,1fr)" : "minmax(0,1fr) 1px minmax(0,1fr)",
                        columnGap: isTabletMobileLayout ? 0 : 80,
                        rowGap: isTabletMobileLayout ? 16 : 0,
                        width: "100%",
                        boxSizing: "border-box",
                    }}
                >
                    <div
                        style={{
                            height: "100%",
                            display: "flex",
                            flexDirection: "column",
                            background: isTabletMobileLayout ? "rgba(36, 43, 38, 0.95)" : "transparent",
                            borderRadius: isTabletMobileLayout ? 8 : 0,
                            padding: isTabletMobileLayout ? 20 : 0,
                        }}
                    >
                        {isTabletMobileLayout ? (
                            <div style={{ display: "flex", flexDirection: "column", gap: 18, marginBottom: 32 }}>
                                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                                    <h2
                                        style={{
                                            margin: 0,
                                            fontSize: isPhoneLayout ? 20 : 32,
                                            lineHeight: isPhoneLayout ? "24px" : "36px",
                                            fontWeight: 500,
                                            ...regularTextStyle,
                                        }}
                                    >
                                        {t.leftTitle}
                                    </h2>
                                    <button
                                        onClick={resetCalculator}
                                        style={{
                                            border: "none",
                                            background: "transparent",
                                            color: COLORS.secondaryBackground,
                                            cursor: "pointer",
                                            fontSize: isPhoneLayout ? 14 : 16,
                                            fontWeight: 500,
                                            display: "inline-flex",
                                            alignItems: "center",
                                            gap: 10,
                                            ...regularTextStyle,
                                        }}
                                    >
                                        <RefreshIcon size={isPhoneLayout ? 16 : 20} color={COLORS.secondaryBackground} />
                                        {language === "fr" ? "Rafraîchir" : "Refresh"}
                                    </button>
                                </div>
                                <Tabs tab={tab} setTab={setTab} labels={t.tabs} regularFontFamily={regularFontFamily} variant={isPhoneLayout ? "phone" : "tablet"} />
                            </div>
                        ) : null}
                        {tab === "salary" && (
                            <div style={{ height: "100%", display: "flex", flexDirection: "column", gap: isTabletMobileLayout ? 28 : 56, justifyContent: "center" }}>
                                <div style={{ height: isTabletMobileLayout ? "auto" : 66 }}>
                                <SimpleInput
                                    label={t.form.salary}
                                    hint={t.form.salaryTip}
                                    symbol="$"
                                    value={salary}
                                    onChange={n => setSalary(clamp(n, 0, 100000000))}
                                    regularFontFamily={regularFontFamily}
                                />
                                </div>
                                <div style={{ height: isTabletMobileLayout ? "auto" : 146 }}>
                                <SliderInput
                                    label={t.form.downPayment}
                                    hint={t.form.downPaymentTip}
                                    description={t.form.downPaymentDesc}
                                    symbol="$"
                                    sliderValue={salaryDownPct}
                                    sliderMin={5}
                                    sliderMax={100}
                                    inputValue={salaryDownPayment}
                                    inputMax={salaryEligible}
                                    disabled={salaryEligible <= 0}
                                    showError={downPctError(salaryDownPct)}
                                    onSliderChange={v => setSalaryDownPct(clamp(v, 5, 100))}
                                    onInputChange={v => setSalaryDownPct(salaryEligible > 0 ? clamp((v / salaryEligible) * 100, 5, 100) : 5)}
                                    regularFontFamily={regularFontFamily}
                                    tinyFontFamily={tinyFontFamily}
                                    tinyTightFontFamily={props.tinyTightFontFamily}
                                    isPhoneLayout={isPhoneLayout}
                                />
                                </div>
                                <div style={{ height: isTabletMobileLayout ? "auto" : 146 }}>
                                <SliderInput
                                    label={t.form.interest}
                                    description={t.form.downPaymentDesc}
                                    symbol="%"
                                    sliderValue={salaryInterest}
                                    sliderMax={20}
                                    sliderStep={0.01}
                                    inputValue={salaryInterest}
                                    onSliderChange={v => setSalaryInterest(clamp(v, 0, 20))}
                                    onInputChange={v => setSalaryInterest(clamp(v, 0, 20))}
                                    regularFontFamily={regularFontFamily}
                                    tinyFontFamily={tinyFontFamily}
                                    tinyTightFontFamily={props.tinyTightFontFamily}
                                    isPhoneLayout={isPhoneLayout}
                                />
                                </div>
                                <div style={{ height: isTabletMobileLayout ? "auto" : 114 }}>
                                <Amortization
                                    label={t.form.amortization}
                                    description={t.form.amortizationDesc}
                                    years={years}
                                    value={salaryAmortization}
                                    onChange={setSalaryAmortization}
                                    regularFontFamily={regularFontFamily}
                                    tinyFontFamily={tinyFontFamily}
                                />
                                </div>
                            </div>
                        )}

                        {tab === "purchasePrice" && (
                            <div style={{ height: "100%", display: "flex", flexDirection: "column", gap: isTabletMobileLayout ? 28 : 56, justifyContent: "center" }}>
                                <div style={{ height: isTabletMobileLayout ? "auto" : 66 }}>
                                <SimpleInput
                                    label={t.form.purchasePrice}
                                    symbol="$"
                                    value={purchasePrice}
                                    onChange={n => setPurchasePrice(clamp(n, 0, 100000000))}
                                    regularFontFamily={regularFontFamily}
                                />
                                </div>
                                <div style={{ height: isTabletMobileLayout ? "auto" : 146 }}>
                                <SliderInput
                                    label={t.form.downPayment}
                                    hint={t.form.downPaymentTip}
                                    description={t.form.downPaymentDesc}
                                    symbol="$"
                                    sliderValue={purchaseDownPct}
                                    sliderMin={5}
                                    sliderMax={100}
                                    inputValue={purchaseDownPayment}
                                    inputMax={purchasePrice}
                                    disabled={purchasePrice <= 0}
                                    showError={downPctError(purchaseDownPct)}
                                    onSliderChange={v => setPurchaseDownPct(clamp(v, 5, 100))}
                                    onInputChange={v => setPurchaseDownPct(purchasePrice > 0 ? clamp((v / purchasePrice) * 100, 5, 100) : 5)}
                                    regularFontFamily={regularFontFamily}
                                    tinyFontFamily={tinyFontFamily}
                                    tinyTightFontFamily={props.tinyTightFontFamily}
                                    isPhoneLayout={isPhoneLayout}
                                />
                                </div>
                                <div style={{ height: isTabletMobileLayout ? "auto" : 146 }}>
                                <SliderInput
                                    label={t.form.interest}
                                    description={t.form.downPaymentDesc}
                                    symbol="%"
                                    sliderValue={purchaseInterest}
                                    sliderMax={20}
                                    sliderStep={0.01}
                                    inputValue={purchaseInterest}
                                    onSliderChange={v => setPurchaseInterest(clamp(v, 0, 20))}
                                    onInputChange={v => setPurchaseInterest(clamp(v, 0, 20))}
                                    regularFontFamily={regularFontFamily}
                                    tinyFontFamily={tinyFontFamily}
                                    tinyTightFontFamily={props.tinyTightFontFamily}
                                    isPhoneLayout={isPhoneLayout}
                                />
                                </div>
                                <div style={{ height: isTabletMobileLayout ? "auto" : 114 }}>
                                <Amortization
                                    label={t.form.amortization}
                                    description={t.form.amortizationDesc}
                                    years={years}
                                    value={purchaseAmortization}
                                    onChange={setPurchaseAmortization}
                                    regularFontFamily={regularFontFamily}
                                    tinyFontFamily={tinyFontFamily}
                                />
                                </div>
                            </div>
                        )}

                        {tab === "desiredPayment" && (
                            <div style={{ height: "100%", display: "flex", flexDirection: "column", gap: isTabletMobileLayout ? 28 : 56, justifyContent: "center" }}>
                                <div style={{ height: isTabletMobileLayout ? "auto" : 66 }}>
                                <SimpleInput
                                    label={t.form.desiredPayments}
                                    hint={t.form.desiredPaymentsTip}
                                    tooltipVisible={false}
                                    symbol="$"
                                    value={desiredPayment}
                                    onChange={n => setDesiredPayment(clamp(n, 0, 1000000))}
                                    regularFontFamily={regularFontFamily}
                                />
                                </div>
                                <div style={{ height: isTabletMobileLayout ? "auto" : 146 }}>
                                <SliderInput
                                    label={t.form.downPayment}
                                    hint={t.form.downPaymentTip}
                                    description={t.form.downPaymentDesc}
                                    symbol="$"
                                    sliderValue={desiredDownPct}
                                    sliderMin={5}
                                    sliderMax={100}
                                    inputValue={desiredDownPayment}
                                    inputMax={desiredPurchasePrice}
                                    disabled={desiredFinancing <= 0}
                                    showError={downPctError(desiredDownPct)}
                                    onSliderChange={v => setDesiredDownPct(clamp(v, 5, 100))}
                                    onInputChange={v => setDesiredDownPct(desiredPurchasePrice > 0 ? clamp((v / desiredPurchasePrice) * 100, 5, 100) : 5)}
                                    regularFontFamily={regularFontFamily}
                                    tinyFontFamily={tinyFontFamily}
                                    tinyTightFontFamily={props.tinyTightFontFamily}
                                    isPhoneLayout={isPhoneLayout}
                                />
                                </div>
                                <div style={{ height: isTabletMobileLayout ? "auto" : 146 }}>
                                <SliderInput
                                    label={t.form.interest}
                                    description={t.form.downPaymentDesc}
                                    symbol="%"
                                    sliderValue={desiredInterest}
                                    sliderMax={20}
                                    sliderStep={0.01}
                                    inputValue={desiredInterest}
                                    onSliderChange={v => setDesiredInterest(clamp(v, 0, 20))}
                                    onInputChange={v => setDesiredInterest(clamp(v, 0, 20))}
                                    regularFontFamily={regularFontFamily}
                                    tinyFontFamily={tinyFontFamily}
                                    tinyTightFontFamily={props.tinyTightFontFamily}
                                    isPhoneLayout={isPhoneLayout}
                                />
                                </div>
                                <div style={{ height: isTabletMobileLayout ? "auto" : 114 }}>
                                <Amortization
                                    label={t.form.amortization}
                                    description={t.form.amortizationDesc}
                                    years={years}
                                    value={desiredAmortization}
                                    onChange={setDesiredAmortization}
                                    regularFontFamily={regularFontFamily}
                                    tinyFontFamily={tinyFontFamily}
                                />
                                </div>
                            </div>
                        )}
                    </div>
                    <div
                        style={{
                            width: 1,
                            background: "rgba(162,184,174,0.35)",
                            height: "100%",
                            display: isTabletMobileLayout ? "none" : "block",
                        }}
                    />
                    <div
                        style={{
                            height: "100%",
                            display: "flex",
                            flexDirection: "column",
                            justifyContent: "space-between",
                            boxSizing: "border-box",
                            minWidth: 0,
                            background: isTabletMobileLayout ? "rgba(36, 43, 38, 0.95)" : "transparent",
                            borderRadius: isTabletMobileLayout ? 8 : 0,
                            padding: isTabletMobileLayout ? 20 : 0,
                        }}
                    >
                        <div>
                            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16 }}>
                                <h2 style={{ margin: 0, fontSize: 20, lineHeight: "28px", fontWeight: 500, ...regularTextStyle }}>{t.rightTitle}</h2>
                                {isTabletMobileLayout ? (
                                    <button
                                        onClick={openSendModal}
                                        style={{
                                            border: "none",
                                            background: "transparent",
                                            color: COLORS.secondaryBackground,
                                            fontSize: 16,
                                            fontWeight: 500,
                                            cursor: "pointer",
                                            display: "inline-flex",
                                            alignItems: "center",
                                            gap: 10,
                                            ...regularTextStyle,
                                        }}
                                    >
                                        <EnvelopeIcon size={20} color={COLORS.secondaryBackground} />
                                        {isPhoneLayout ? t.sendByEmail : t.sendByEmailResponsive}
                                    </button>
                                ) : null}
                            </div>

                            <div style={{ display: "flex", flexDirection: isPhoneLayout ? "column" : isTabletMobileLayout ? "row" : "column", gap: isTabletMobileLayout ? 10 : 16 }}>
                                {currentResultTitles.map((item, idx) => (
                                    <div
                                        key={item.title}
                                        style={{
                                            background: COLORS.resultCardBackground,
                                            borderRadius: 8,
                                            minHeight: isPhoneLayout ? 124 : isTabletMobileLayout ? 170 : 140,
                                            height: isPhoneLayout ? 124 : isTabletMobileLayout ? 170 : undefined,
                                            padding: isPhoneLayout ? "16px 18px" : isTabletMobileLayout ? "24px 14px 10px 14px" : idx === 1 ? "36px" : "38px 36px",
                                            boxSizing: "border-box",
                                            display: "flex",
                                            alignItems: isPhoneLayout ? "stretch" : isTabletMobileLayout ? "flex-start" : "center",
                                            flex: isTabletMobileLayout ? 1 : "unset",
                                        }}
                                    >
                                        <div
                                            style={{
                                                display: "flex",
                                                gap: 20,
                                                alignItems: isPhoneLayout ? "flex-start" : isTabletMobileLayout ? "flex-start" : "center",
                                                width: "100%",
                                                flexDirection: isPhoneLayout ? "column" : isTabletMobileLayout ? "column" : "row",
                                                height: isTabletMobileLayout ? "100%" : "auto",
                                                justifyContent: isTabletMobileLayout ? "flex-start" : "space-between",
                                            }}
                                        >
                                            <div
                                                style={{
                                                    maxWidth: isTabletMobileLayout ? "100%" : idx === 1 ? 217 : 223,
                                                    width: isTabletMobileLayout ? "100%" : "auto",
                                                    textAlign: isPhoneLayout ? "left" : isTabletMobileLayout ? "center" : "left",
                                                    marginTop: isPhoneLayout ? 10 : isTabletMobileLayout ? 4 : 0,
                                                    minHeight: isTabletMobileLayout ? 0 : undefined,
                                                    display: isTabletMobileLayout ? "flex" : "block",
                                                    alignItems: isTabletMobileLayout ? "flex-start" : undefined,
                                                    justifyContent: isTabletMobileLayout ? "center" : undefined,
                                                }}
                                            >
                                                <p
                                                    style={{
                                                        ...regularTextStyle,
                                                        margin: 0,
                                                        fontSize: 14,
                                                        lineHeight: "1.25",
                                                        fontWeight: 500,
                                                        maxWidth: isTabletMobileLayout ? "100%" : 220,
                                                        width: isTabletMobileLayout ? "100%" : "auto",
                                                        textAlign: isPhoneLayout ? "left" : isTabletMobileLayout ? "center" : "left",
                                                        textWrap: isTabletMobileLayout ? ("normal" as any) : ("balance" as any),
                                                    }}
                                                >
                                                    {item.title}
                                                    {!isTabletMobileLayout ? (
                                                        <>
                                                            {" "}
                                                            <TooltipQuestionIcon text={item.desc || item.title} visible={false} />
                                                        </>
                                                    ) : null}
                                                </p>
                                                {item.desc && !isTabletMobileLayout ? (
                                                    <span
                                                        style={{
                                                            marginTop: 8,
                                                            display: "inline-block",
                                                            fontSize: 12,
                                                            lineHeight: "1.4",
                                                            fontWeight: 300,
                                                            maxWidth: 220,
                                                            textWrap: "balance" as any,
                                                            ...tinyTextStyle,
                                                        }}
                                                    >
                                                        {item.desc}
                                                    </span>
                                                ) : null}
                                            </div>
                                            <span
                                                style={{
                                                    fontSize: isPhoneLayout ? 52 : isTabletMobileLayout ? 52 : 64,
                                                    lineHeight: isPhoneLayout ? "52px" : isTabletMobileLayout ? "52px" : "64px",
                                                    fontWeight: 500,
                                                    whiteSpace: "nowrap",
                                                    letterSpacing: 0,
                                                    order: isPhoneLayout ? -1 : isTabletMobileLayout ? -1 : 0,
                                                    height: isTabletMobileLayout ? 56 : "auto",
                                                    minHeight: isTabletMobileLayout ? 56 : undefined,
                                                    width: isTabletMobileLayout ? "100%" : "auto",
                                                    display: "flex",
                                                    alignItems: "flex-start",
                                                    justifyContent: isPhoneLayout ? "flex-start" : isTabletMobileLayout ? "center" : "flex-end",
                                                    flexShrink: 0,
                                                    ...tightTextStyle,
                                                }}
                                            >
                                                {currentResultValues[idx]} $
                                            </span>
                                        </div>
                                    </div>
                                ))}
                            </div>

                            <span
                                style={{
                                    display: isTabletMobileLayout ? "none" : "inline-block",
                                    marginTop: 16,
                                    marginBottom: 0,
                                    width: "100%",
                                    maxWidth: "100%",
                                    fontSize: 12,
                                    lineHeight: "1.4",
                                    fontWeight: 300,
                                    color: COLORS.textColor,
                                    opacity: 0.88,
                                    ...tinyTextStyle,
                                }}
                            >
                                {t.rightDesc}
                            </span>
                        </div>

                        <div style={{ display: "flex", gap: 16, alignItems: "center", marginTop: 44, width: "100%" }}>
                            <button
                                onClick={openSendModal}
                                style={{
                                    cursor: "pointer",
                                    borderRadius: 32,
                                    flex: 1,
                                    textTransform: "uppercase",
                                    minWidth: 0,
                                        fontSize: 16,
                                        lineHeight: "40px",
                                    fontWeight: 500,
                                    textAlign: "center",
                                    color: COLORS.textColor,
                                    backgroundColor: "transparent",
                                    border: `1px solid ${COLORS.textColor}`,
                                    ...regularTextStyle,
                                        height: 40,
                                    display: isTabletMobileLayout ? "none" : "block",
                                    padding: "0 16px",
                                }}
                            >
                                {t.sendByEmail}
                            </button>
                            {props.contactBrokerLink ? (
                                <a
                                    href={props.contactBrokerLink}
                                    target={props.contactBrokerOpenInNewTab ? "_blank" : undefined}
                                    rel={props.contactBrokerOpenInNewTab ? "noopener noreferrer" : undefined}
                                    style={{
                                        cursor: "pointer",
                                        borderRadius: 32,
                                        flex: 1,
                                        textTransform: "uppercase",
                                        minWidth: 0,
                                        fontSize: 16,
                                        lineHeight: "40px",
                                        fontWeight: 500,
                                        textAlign: "center",
                                        color: COLORS.primaryBackground,
                                        backgroundColor: COLORS.secondaryBackground,
                                        border: `1px solid ${COLORS.secondaryBackground}`,
                                        ...regularTextStyle,
                                        height: 40,
                                        width: isTabletMobileLayout ? "100%" : "auto",
                                        textDecoration: "none",
                                        display: "inline-flex",
                                        alignItems: "center",
                                        justifyContent: "center",
                                        boxSizing: "border-box",
                                    }}
                                >
                                    {t.contactBroker}
                                </a>
                            ) : (
                                <button
                                    style={{
                                        cursor: "pointer",
                                        borderRadius: 32,
                                        flex: 1,
                                        textTransform: "uppercase",
                                        minWidth: 0,
                                        fontSize: 16,
                                        lineHeight: "40px",
                                        fontWeight: 500,
                                        textAlign: "center",
                                        color: COLORS.primaryBackground,
                                        backgroundColor: COLORS.secondaryBackground,
                                        border: `1px solid ${COLORS.secondaryBackground}`,
                                        ...regularTextStyle,
                                        height: 40,
                                        width: isTabletMobileLayout ? "100%" : "auto",
                                    }}
                                >
                                    {t.contactBroker}
                                </button>
                            )}
                        </div>
                    </div>
                </div>
            </div>
            {isSendModalOpen ? (
                <div
                    onClick={closeSendModal}
                    style={{
                        position: "fixed",
                        inset: 0,
                        background: "rgba(12,14,13,0.72)",
                        zIndex: 9999,
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                        padding: 24,
                        boxSizing: "border-box",
                    }}
                >
                    <div
                        onClick={e => e.stopPropagation()}
                        style={{
                            width: "100%",
                            maxWidth: 560,
                            background: "rgba(36, 43, 38, 0.98)",
                            border: `1px solid ${COLORS.inputBorder}`,
                            borderRadius: 12,
                            padding: 24,
                            boxSizing: "border-box",
                            color: COLORS.textColor,
                        }}
                    >
                        {!isSendSuccess ? (
                            <>
                                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16 }}>
                                    <h3 style={{ margin: 0, fontSize: 24, lineHeight: "30px", fontWeight: 500, ...regularTextStyle }}>
                                        {t.sendResultsModal.title}
                                    </h3>
                                    <button
                                        onClick={closeSendModal}
                                        style={{
                                            border: "none",
                                            background: "transparent",
                                            color: COLORS.textColor,
                                            cursor: "pointer",
                                            fontSize: 24,
                                            lineHeight: "24px",
                                            padding: 0,
                                        }}
                                        aria-label={t.sendResultsModal.close}
                                    >
                                        ×
                                    </button>
                                </div>
                                <label style={{ display: "block", marginBottom: 8, fontSize: 14, lineHeight: "20px", ...regularTextStyle }}>
                                    {t.sendResultsModal.emailLabel}
                                </label>
                                <input
                                    type="email"
                                    value={sendEmailValue}
                                    onChange={e => {
                                        setSendEmailValue(e.target.value)
                                        if (sendError) setSendError("")
                                    }}
                                    onBlur={() => {
                                        if (sendEmailValue && !isValidEmail(sendEmailValue)) setSendError(t.sendResultsModal.emailFormatError)
                                    }}
                                    style={{
                                        width: "100%",
                                        height: 44,
                                        borderRadius: 6,
                                        border: `1px solid ${sendError ? COLORS.errorColor : COLORS.inputBorder}`,
                                        background: "transparent",
                                        color: COLORS.textColor,
                                        padding: "0 12px",
                                        boxSizing: "border-box",
                                        outline: "none",
                                        ...regularTextStyle,
                                    }}
                                />
                                {sendError ? <div style={{ marginTop: 8, fontSize: 12, color: COLORS.errorColor }}>{sendError}</div> : null}

                                <label style={{ marginTop: 14, display: "flex", alignItems: "flex-start", gap: 8, cursor: "pointer" }}>
                                    <input
                                        type="checkbox"
                                        checked={acceptedConsent}
                                        onChange={e => setAcceptedConsent(e.target.checked)}
                                        style={{ marginTop: 2 }}
                                    />
                                    <span style={{ fontSize: 13, lineHeight: "18px", ...tinyTextStyle }}>{t.sendResultsModal.consent}</span>
                                </label>

                                <div style={{ marginTop: 18, display: "flex", justifyContent: "flex-end", gap: 10 }}>
                                    <button
                                        onClick={closeSendModal}
                                        style={{
                                            borderRadius: 28,
                                            border: `1px solid ${COLORS.inputBorder}`,
                                            background: "transparent",
                                            color: COLORS.textColor,
                                            padding: "10px 16px",
                                            cursor: "pointer",
                                            ...regularTextStyle,
                                        }}
                                    >
                                        {t.sendResultsModal.close}
                                    </button>
                                    <button
                                        onClick={submitSendResults}
                                        disabled={!isSubmittable}
                                        style={{
                                            borderRadius: 28,
                                            border: `1px solid ${COLORS.secondaryBackground}`,
                                            background: COLORS.secondaryBackground,
                                            color: COLORS.primaryBackground,
                                            padding: "10px 16px",
                                            cursor: isSubmittable ? "pointer" : "not-allowed",
                                            opacity: isSubmittable ? 1 : 0.55,
                                            ...regularTextStyle,
                                        }}
                                    >
                                        {isSubmitting ? "..." : t.sendResultsModal.submit}
                                    </button>
                                </div>
                            </>
                        ) : (
                            <div
                                style={{
                                    textAlign: "center",
                                    padding: isPhoneLayout ? "24px 0 8px" : isTabletLayout ? "28px 32px 12px" : "32px 48px 12px",
                                    boxSizing: "border-box",
                                }}
                            >
                                <h3
                                    style={{
                                        margin: 0,
                                        fontSize: isPhoneLayout ? 18 : 20,
                                        lineHeight: isPhoneLayout ? "26px" : "28px",
                                        fontWeight: 500,
                                        ...regularTextStyle,
                                    }}
                                >
                                    {t.sendResultsModal.successTitle}
                                </h3>
                                <p
                                    style={{
                                        margin: "16px auto 0",
                                        maxWidth: 400,
                                        fontSize: isPhoneLayout ? 15 : 16,
                                        lineHeight: isPhoneLayout ? "22px" : "24px",
                                        fontWeight: 300,
                                        opacity: 0.92,
                                        ...regularTextStyle,
                                    }}
                                >
                                    {t.sendResultsModal.successMessage}
                                </p>
                                <div style={{ marginTop: isPhoneLayout ? 20 : 24 }}>
                                    <button
                                        onClick={closeSendModal}
                                        style={{
                                            borderRadius: 28,
                                            border: `1px solid ${COLORS.secondaryBackground}`,
                                            background: COLORS.secondaryBackground,
                                            color: COLORS.primaryBackground,
                                            padding: "10px 20px",
                                            minWidth: 120,
                                            cursor: "pointer",
                                            ...regularTextStyle,
                                        }}
                                    >
                                        {t.sendResultsModal.close}
                                    </button>
                                </div>
                            </div>
                        )}
                    </div>
                </div>
            ) : null}
        </div>
    )
}

function QuestionMarkIcon() {
    return (
        <span
            style={{
                display: "inline-flex",
                alignItems: "center",
                justifyContent: "center",
                verticalAlign: "middle",
                marginLeft: 4,
            }}
            aria-hidden
        >
            <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 20 20" fill="none">
                <g opacity="0.5">
                    <path
                        d="M10 17.5C14.1421 17.5 17.5 14.1421 17.5 10C17.5 5.85786 14.1421 2.5 10 2.5C5.85786 2.5 2.5 5.85786 2.5 10C2.5 14.1421 5.85786 17.5 10 17.5Z"
                        stroke="#EFECE5"
                        strokeWidth="1.5"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                    />
                    <path
                        d="M10 15C10.5178 15 10.9375 14.5803 10.9375 14.0625C10.9375 13.5447 10.5178 13.125 10 13.125C9.48223 13.125 9.0625 13.5447 9.0625 14.0625C9.0625 14.5803 9.48223 15 10 15Z"
                        fill="#EFECE5"
                    />
                    <path
                        d="M10 11.25V10.625C10.4326 10.625 10.8556 10.4967 11.2153 10.2563C11.575 10.016 11.8554 9.67433 12.021 9.27462C12.1866 8.87491 12.2299 8.43507 12.1455 8.01074C12.0611 7.58641 11.8527 7.19663 11.5468 6.89071C11.2409 6.58478 10.8511 6.37644 10.4268 6.29203C10.0024 6.20763 9.56259 6.25095 9.16288 6.41651C8.76317 6.58208 8.42153 6.86246 8.18116 7.22219C7.94079 7.58192 7.8125 8.00485 7.8125 8.4375"
                        stroke="#EFECE5"
                        strokeWidth="1.5"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                    />
                </g>
            </svg>
        </span>
    )
}

function EnvelopeIcon({ size = 20, color = "#D6BE75" }: { size?: number; color?: string }) {
    return (
        <span style={{ display: "inline-flex", alignItems: "center", justifyContent: "center", lineHeight: 0 }} aria-hidden>
            <svg xmlns="http://www.w3.org/2000/svg" width={size} height={size} viewBox="0 0 24 24" fill="none">
                <path d="M3 7.75L12 14L21 7.75" stroke={color} strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
                <rect x="3" y="5.5" width="18" height="13" rx="2" stroke={color} strokeWidth="1.8" />
            </svg>
        </span>
    )
}

function RefreshIcon({ size = 20, color = "#D6BE75" }: { size?: number; color?: string }) {
    return (
        <span style={{ display: "inline-flex", alignItems: "center", justifyContent: "center", lineHeight: 0 }} aria-hidden>
            <svg xmlns="http://www.w3.org/2000/svg" width={size} height={size} viewBox="0 0 24 24" fill="none">
                <path
                    d="M20 12C20 16.4183 16.4183 20 12 20C7.58172 20 4 16.4183 4 12C4 7.58172 7.58172 4 12 4C14.2091 4 16.2091 4.89543 17.6569 6.34315"
                    stroke={color}
                    strokeWidth="1.8"
                    strokeLinecap="round"
                />
                <path d="M16 3.5H20V7.5" stroke={color} strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
        </span>
    )
}

function QuestionMarkIconSmall({ size = 20 }: { size?: number }) {
    return (
        <span style={{ display: "inline-flex", alignItems: "center", justifyContent: "center", opacity: 0.5 }} aria-hidden>
            <svg xmlns="http://www.w3.org/2000/svg" width={size} height={size} viewBox="0 0 20 20" fill="none">
                <g opacity="0.5">
                    <path
                        d="M10 17.5C14.1421 17.5 17.5 14.1421 17.5 10C17.5 5.85786 14.1421 2.5 10 2.5C5.85786 2.5 2.5 5.85786 2.5 10C2.5 14.1421 5.85786 17.5 10 17.5Z"
                        stroke="#EFECE5"
                        strokeWidth="1.5"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                    />
                    <path
                        d="M10 15C10.5178 15 10.9375 14.5803 10.9375 14.0625C10.9375 13.5447 10.5178 13.125 10 13.125C9.48223 13.125 9.0625 13.5447 9.0625 14.0625C9.0625 14.5803 9.48223 15 10 15Z"
                        fill="#EFECE5"
                    />
                    <path
                        d="M10 11.25V10.625C10.4326 10.625 10.8556 10.4967 11.2153 10.2563C11.575 10.016 11.8554 9.67433 12.021 9.27462C12.1866 8.87491 12.2299 8.43507 12.1455 8.01074C12.0611 7.58641 11.8527 7.19663 11.5468 6.89071C11.2409 6.58478 10.8511 6.37644 10.4268 6.29203C10.0024 6.20763 9.56259 6.25095 9.16288 6.41651C8.76317 6.58208 8.42153 6.86246 8.18116 7.22219C7.94079 7.58192 7.8125 8.00485 7.8125 8.4375"
                        stroke="#EFECE5"
                        strokeWidth="1.5"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                    />
                </g>
            </svg>
        </span>
    )
}

function TooltipQuestionIcon({ text, size = 20, visible = true }: { text: string; size?: number; visible?: boolean }) {
    const [open, setOpen] = React.useState(false)
    return (
        <span
            style={{
                position: "relative",
                display: "inline-flex",
                alignItems: "center",
                justifyContent: "center",
                width: size,
                height: size,
                visibility: visible ? "visible" : "hidden",
                pointerEvents: visible ? "auto" : "none",
            }}
            onMouseEnter={() => visible && setOpen(true)}
            onMouseLeave={() => setOpen(false)}
            aria-hidden
        >
            <QuestionMarkIconSmall size={size} />
            {open && visible ? (
                <span
                    style={{
                        position: "absolute",
                        bottom: "155%",
                        left: "50%",
                        transform: "translateX(-50%)",
                        width: 200,
                        height: "fit-content",
                        padding: 10,
                        backgroundColor: "rgba(12, 14, 13, 1)",
                        borderRadius: 4,
                        zIndex: 50,
                        color: "#EFECE5",
                        fontSize: 14,
                        fontWeight: 400,
                        lineHeight: "1.3",
                        whiteSpace: "normal",
                    }}
                >
                    {text}
                    <span
                        style={{
                            position: "absolute",
                            top: "100%",
                            left: "45%",
                            borderWidth: 10,
                            borderStyle: "solid",
                            borderColor: "rgba(12, 14, 13, 1) transparent transparent transparent",
                        }}
                    />
                </span>
            ) : null}
        </span>
    )
}

function Tabs({
    tab,
    setTab,
    labels,
    regularFontFamily,
    variant = "desktop",
}: {
    tab: TabKey
    setTab: (tab: TabKey) => void
    labels: Record<TabKey, string>
    regularFontFamily: FontControlValue
    variant?: "desktop" | "tablet" | "phone"
}) {
    const regularTextStyle = typographyFromControl(regularFontFamily, "PP Right Grotesk, Inter, Arial, sans-serif")
    const items: TabKey[] = ["salary", "purchasePrice", "desiredPayment"]
    if (variant === "tablet") {
        return (
            <div style={{ width: "100%" }}>
                <div style={{ width: "100%", boxSizing: "border-box", borderBottom: "1px solid rgba(162,184,174,0.5)", display: "flex", alignItems: "flex-end" }}>
                    {items.map(key => {
                        const active = tab === key
                        return (
                            <button
                                key={key}
                                onClick={() => setTab(key)}
                                style={{
                                    border: "none",
                                    background: "transparent",
                                    color: active ? COLORS.secondaryBackground : COLORS.textColor,
                                    fontSize: 16,
                                    lineHeight: "22px",
                                    letterSpacing: "0.32px",
                                    fontWeight: 500,
                                    cursor: "pointer",
                                    padding: "0 24px 14px 24px",
                                    borderBottom: "none",
                                    marginBottom: -1,
                                    position: "relative",
                                    ...regularTextStyle,
                                }}
                            >
                                {labels[key]}
                                {active ? (
                                    <span
                                        aria-hidden
                                        style={{
                                            position: "absolute",
                                            left: 0,
                                            right: 0,
                                            bottom: 0,
                                            height: 4,
                                            borderRadius: 999,
                                            background: COLORS.secondaryBackground,
                                        }}
                                    />
                                ) : null}
                            </button>
                        )
                    })}
                </div>
            </div>
        )
    }
    if (variant === "phone") {
        return (
            <div style={{ width: "100%" }}>
                <div
                    style={{
                        width: "100%",
                        boxSizing: "border-box",
                        borderBottom: "1px solid rgba(162,184,174,0.5)",
                        display: "flex",
                        alignItems: "flex-end",
                    }}
                >
                    {items.map(key => {
                        const active = tab === key
                        return (
                            <button
                                key={key}
                                onClick={() => setTab(key)}
                                style={{
                                    border: "none",
                                    background: "transparent",
                                    color: active ? COLORS.secondaryBackground : COLORS.textColor,
                                    fontSize: 12,
                                    lineHeight: "18px",
                                    fontWeight: 500,
                                    cursor: "pointer",
                                    padding: "0 12px 10px 12px",
                                    position: "relative",
                                    ...regularTextStyle,
                                }}
                            >
                                {labels[key]}
                                {active ? (
                                    <span
                                        aria-hidden
                                        style={{
                                            position: "absolute",
                                            left: 0,
                                            right: 0,
                                            bottom: 0,
                                            height: 4,
                                            borderRadius: 999,
                                            background: COLORS.secondaryBackground,
                                        }}
                                    />
                                ) : null}
                            </button>
                        )
                    })}
                </div>
            </div>
        )
    }
    return (
        <div
            style={{
                display: "flex",
                gap: 0,
                border: "1px solid rgba(162,184,174,0.5)",
                borderRadius: 8,
                overflow: "hidden",
                marginBottom: 0,
                width: "100%",
                maxWidth: 666,
                boxShadow: "0 1px 1px rgba(0,0,0,0.2)",
            }}
        >
            {items.map(key => {
                const active = tab === key
                return (
                    <button
                        key={key}
                        onClick={() => setTab(key)}
                        style={{
                            display: "flex",
                            alignItems: "center",
                            justifyContent: "center",
                            flex: 1,
                            minWidth: 0,
                            border: "none",
                            borderRight: key !== "desiredPayment" ? "1px solid rgba(162,184,174,0.5)" : "none",
                            background: active ? "rgba(73, 85, 77, 0.6)" : "transparent",
                            color: COLORS.textColor,
                            padding: "12px 24px",
                            fontSize: 16,
                            lineHeight: "22px",
                            letterSpacing: "0.32px",
                            fontWeight: active ? 500 : 400,
                            ...regularTextStyle,
                            cursor: "pointer",
                            position: "relative",
                            minHeight: 40,
                            textAlign: "center",
                        }}
                    >
                        {labels[key]}
                    </button>
                )
            })}
        </div>
    )
}

function LabelRow({
    label,
    hint,
    regularFontFamily,
    showHint = true,
}: {
    label: string
    hint?: string
    regularFontFamily: FontControlValue
    showHint?: boolean
}) {
    const regularTextStyle = typographyFromControl(regularFontFamily, "PP Right Grotesk, Inter, Arial, sans-serif")
    return (
        <div style={{ display: "flex", gap: 8, marginTop: 0, alignItems: "center" }}>
            <h3 style={{ margin: 0, fontSize: 16, lineHeight: "22px", fontWeight: 500, color: COLORS.textColor, ...regularTextStyle }}>
                {label}
            </h3>
            {hint && showHint ? <TooltipQuestionIcon text={hint} size={20} /> : null}
        </div>
    )
}

function SimpleInput({
    label,
    hint,
    tooltipVisible = true,
    symbol,
    value,
    onChange,
    regularFontFamily,
}: {
    label: string
    hint?: string
    tooltipVisible?: boolean
    symbol: string
    value: number
    onChange: (value: number) => void
    regularFontFamily: FontControlValue
}) {
    const regularTextStyle = typographyFromControl(regularFontFamily, "PP Right Grotesk, Inter, Arial, sans-serif")
    const displayValue = formatNumberWithSpaces(value)
    return (
        <>
            <LabelRow label={label} hint={hint} regularFontFamily={regularFontFamily} showHint={false} />
            <div
                style={{
                    marginTop: 8,
                    display: "flex",
                    alignItems: "center",
                    gap: 8,
                    width: "100%",
                    border: `1px solid ${COLORS.inputBorder}`,
                    borderRadius: 4,
                    padding: "8px 12px",
                    boxSizing: "border-box",
                }}
            >
                {symbol === "$" ? <span style={{ color: COLORS.textLinkColor, fontSize: 18, lineHeight: "18px" }}>$</span> : null}
                <input
                    className="mc-no-spin"
                    type="text"
                    value={displayValue}
                    onChange={e => onChange(parseNumberFromFormatted(e.target.value))}
                    style={{
                        width: "100%",
                        border: "none",
                        background: "transparent",
                        color: COLORS.textColor,
                        outline: "none",
                        fontSize: 13,
                        lineHeight: "18px",
                        ...regularTextStyle,
                    }}
                />
                {symbol === "$" ? null : <span style={{ color: COLORS.textLinkColor, fontSize: 18, lineHeight: "18px" }}>{symbol}</span>}
                {hint ? <TooltipQuestionIcon text={hint} size={16} visible={tooltipVisible} /> : null}
            </div>
        </>
    )
}

function SliderInput({
    label,
    hint,
    tooltipVisible = true,
    description,
    symbol,
    sliderValue,
    sliderMin = 0,
    sliderMax,
    sliderStep = 1,
    inputValue,
    inputMax,
    disabled,
    showError,
    onSliderChange,
    onInputChange,
    regularFontFamily,
    tinyFontFamily,
    tinyTightFontFamily,
    isPhoneLayout = false,
}: {
    label: string
    hint?: string
    tooltipVisible?: boolean
    description?: string
    symbol: string
    sliderValue: number
    sliderMin?: number
    sliderMax: number
    sliderStep?: number
    inputValue: number
    inputMax?: number
    disabled?: boolean
    showError?: boolean
    onSliderChange: (value: number) => void
    onInputChange: (value: number) => void
    regularFontFamily: FontControlValue
    tinyFontFamily?: FontControlValue
    tinyTightFontFamily?: FontControlValue
    isPhoneLayout?: boolean
}) {
    const regularTextStyle = typographyFromControl(regularFontFamily, "PP Right Grotesk, Inter, Arial, sans-serif")
    const tinyTextStyle = typographyFromControl(tinyFontFamily, "PP Right Grotesk, Inter, Arial, sans-serif")
    const tinyTightTextStyle = typographyFromControl(
        tinyTightFontFamily,
        "PP Right Grotesk Tight, PP Right Grotesk, Inter, Arial, sans-serif"
    )
    const sliderRange = Math.max(sliderMax - sliderMin, 1)
    const pct = clamp(((sliderValue - sliderMin) / sliderRange) * 100, 0, 100)
    const track = `linear-gradient(to right, #D6BE75 0%, #D6BE75 ${pct}%, #5A7263 ${pct}%, #5A7263 100%)`
    const errorColor = showError ? COLORS.errorColor : COLORS.textLinkColor
    const labelColor = showError ? COLORS.errorColor : COLORS.textColor
    const isDownPaymentPercentScale = sliderMin === 5 && sliderMax === 100
    const isInterestPercentScale = symbol === "%" && sliderMin === 0 && sliderMax === 20
    const showFloatingValue = isDownPaymentPercentScale || isInterestPercentScale
    const currentPercentValue = isInterestPercentScale
        ? Number(clamp(sliderValue, sliderMin, sliderMax).toFixed(2)).toString()
        : Math.round(clamp(sliderValue, sliderMin, sliderMax)).toString()
    const marks =
        isDownPaymentPercentScale
            ? [
                  { value: sliderMin, label: `${sliderMin}% (min)` },
                  { value: 100, label: "100%" },
              ]
            : [
                  { value: sliderMin, label: symbol === "%" ? `${sliderMin}%` : `${sliderMin}` },
                  { value: Math.round((sliderMin + sliderMax) / 2), label: symbol === "%" ? `${Math.round((sliderMin + sliderMax) / 2)}%` : `${Math.round((sliderMin + sliderMax) / 2)}` },
                  { value: sliderMax, label: symbol === "%" ? `${sliderMax}%` : `${sliderMax}` },
              ]

    return (
        <div style={{ display: "flex", flexDirection: "column" }}>
            <LabelRow label={label} hint={hint} regularFontFamily={regularFontFamily} showHint={tooltipVisible} />
            <div
                style={{
                    marginTop: 28,
                    display: "flex",
                    flexDirection: isPhoneLayout ? "column" : "row",
                    alignItems: "center",
                    gap: isPhoneLayout ? 40 : 16,
                }}
            >
                <div style={{ width: "100%", flex: isPhoneLayout ? "0 0 auto" : 1, minWidth: 0, position: "relative", height: 8, overflow: "visible" }}>
                    {showFloatingValue ? (
                        <div
                            style={{
                                position: "absolute",
                                left: `calc(${pct}% + ${(0.5 - pct / 100) * SLIDER_THUMB_SIZE}px + ${FLOATING_PERCENT_OPTICAL_OFFSET_X}px)`,
                                top: -24,
                                display: "flex",
                                alignItems: "center",
                                justifyContent: "center",
                                gap: 2,
                                boxSizing: "border-box",
                                transform: "translateX(-50%)",
                                whiteSpace: "nowrap",
                            }}
                        >
                            <span
                                style={{
                                    color: COLORS.textColor,
                                    fontSize: 14,
                                    lineHeight: "14px",
                                    fontWeight: 500,
                                    ...tinyTightTextStyle,
                                }}
                            >
                                {currentPercentValue}
                            </span>
                            <span
                                style={{
                                    color: COLORS.textColor,
                                    fontSize: 14,
                                    lineHeight: "14px",
                                    fontWeight: 500,
                                    ...tinyTightTextStyle,
                                }}
                            >
                                %
                            </span>
                        </div>
                    ) : null}
                    <input
                        className="mc-range"
                        type="range"
                        min={sliderMin}
                        max={sliderMax}
                        step={sliderStep}
                        value={sliderValue}
                        onChange={e => onSliderChange(toNum(e.target.value))}
                        style={{ background: track }}
                    />
                    <div style={{ position: "absolute", left: 0, right: 0, top: 24, display: "flex", justifyContent: "space-between" }}>
                        {marks.map(mark => (
                            <span key={mark.label} style={{ fontSize: 10, lineHeight: "12px", color: COLORS.textColor, opacity: 0.9, ...tinyTightTextStyle }}>
                                {mark.label}
                            </span>
                        ))}
                    </div>
                </div>

                <div
                    style={{
                        width: isPhoneLayout ? "100%" : 156,
                        flexShrink: 0,
                        pointerEvents: disabled ? "none" : "auto",
                        opacity: disabled ? 0.5 : 1,
                    }}
                >
                    <div
                        style={{
                            display: "flex",
                            alignItems: "center",
                            gap: 8,
                            width: "100%",
                            border: `1px solid ${showError ? COLORS.errorColor : COLORS.inputBorder}`,
                            borderRadius: 4,
                            padding: "8px 12px",
                            boxSizing: "border-box",
                        }}
                    >
                        {symbol === "$" ? <span style={{ color: errorColor, fontSize: 18, lineHeight: "18px" }}>$</span> : null}
                        <input
                            className="mc-no-spin"
                            type="text"
                            value={symbol === "$" ? formatNumberWithSpaces(inputValue) : `${inputValue}`}
                            onChange={e =>
                                onInputChange(
                                    clamp(
                                        symbol === "$" ? parseNumberFromFormatted(e.target.value) : toNum(e.target.value),
                                        sliderMin,
                                        inputMax ?? Number.MAX_SAFE_INTEGER
                                    )
                                )
                            }
                            style={{
                                width: "100%",
                                border: "none",
                                background: "transparent",
                                color: labelColor,
                                outline: "none",
                                fontSize: 13,
                                lineHeight: "18px",
                                ...regularTextStyle,
                            }}
                        />
                        {symbol === "%" ? <span style={{ color: errorColor, fontSize: 18, lineHeight: "18px" }}>%</span> : null}
                    </div>
                </div>
            </div>
            {description ? (
                <span style={{ width: "100%", maxWidth: "100%", marginTop: 36, color: COLORS.secondaryTextColor, fontSize: 12, lineHeight: "16px", fontWeight: 300, ...tinyTextStyle }}>
                    {description}
                </span>
            ) : null}
        </div>
    )
}

function Amortization({
    label,
    description,
    years,
    value,
    onChange,
    regularFontFamily,
    tinyFontFamily,
}: {
    label: string
    description: string
    years: Array<{ value: number; label: string }>
    value: number
    onChange: (value: number) => void
    regularFontFamily: FontControlValue
    tinyFontFamily?: FontControlValue
}) {
    const regularTextStyle = typographyFromControl(regularFontFamily, "PP Right Grotesk, Inter, Arial, sans-serif")
    const tinyTextStyle = typographyFromControl(tinyFontFamily, "PP Right Grotesk, Inter, Arial, sans-serif")
    return (
        <div>
            <h3
                style={{
                    fontSize: 16,
                    lineHeight: "22px",
                    color: COLORS.textColor,
                    margin: "0 0 8px 0",
                    fontWeight: 500,
                    ...regularTextStyle,
                }}
            >
                {label}
            </h3>
            <div style={{ position: "relative", width: "100%" }}>
                <select
                    value={value}
                    onChange={e => onChange(Number(e.target.value))}
                    style={{
                        width: "100%",
                        height: 36,
                        borderRadius: 4,
                        border: `1px solid ${COLORS.inputBorder}`,
                        background: "transparent",
                        color: COLORS.textColor,
                        padding: "0 44px 0 15px",
                        fontSize: 13,
                        outline: "none",
                        appearance: "none",
                        WebkitAppearance: "none",
                        MozAppearance: "none",
                        ...regularTextStyle,
                    }}
                >
                    {years.map(option => (
                        <option key={option.value} value={option.value} style={{ backgroundColor: "rgba(49, 62, 55, 1)", color: COLORS.textColor }}>
                            {option.label}
                        </option>
                    ))}
                </select>
                <span
                    aria-hidden
                    style={{
                        position: "absolute",
                        right: 16,
                        top: "50%",
                        transform: "translateY(-50%)",
                        display: "inline-flex",
                        alignItems: "center",
                        justifyContent: "center",
                        pointerEvents: "none",
                    }}
                >
                    <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 20 20" fill="none">
                        <path d="M5 7.5L10 12.5L15 7.5" stroke={COLORS.textLinkColor} strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
                    </svg>
                </span>
            </div>
            <p style={{ fontSize: 12, color: COLORS.textColor, fontWeight: 300, width: "100%", maxWidth: "100%", lineHeight: "16px", margin: "16px 0 0 0", ...tinyTextStyle }}>
                {description}
            </p>
        </div>
    )
}

addPropertyControls(MortgageCalculatorFramer, {
    language: {
        title: "Language",
        type: ControlType.Enum,
        defaultValue: "auto",
        options: ["auto", "fr", "en"],
        optionTitles: ["Auto (Detect Locale)", "French", "English"],
    },
    layoutMode: {
        title: "Layout",
        type: ControlType.Enum,
        defaultValue: "auto",
        options: ["auto", "desktop", "tablet", "phone"],
        optionTitles: ["Auto", "Desktop", "Tablet", "Phone"],
    },
    regularFontFamily: {
        title: "Regular Font",
        type: ControlType.Font,
        defaultValue: {
            fontFamily: "PP Right Grotesk",
            fontSize: 16,
            fontWeight: 500,
            lineHeight: "1.4",
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
            fontSize: 64,
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
            color: "#EFECE5",
        },
        controls: "extended",
    },
    tinyTightFontFamily: {
        title: "Tiny Tight Font",
        type: ControlType.Font,
        defaultValue: {
            fontFamily: "PP Right Grotesk Tight",
            fontSize: 14,
            fontWeight: 500,
            lineHeight: "1",
            letterSpacing: "0px",
            color: "#EFECE5",
        },
        controls: "extended",
    },
    sendResultsEndpoint: {
        title: "Send API URL (CMS)",
        type: ControlType.String,
        defaultValue: DEFAULT_CALCULATOR_SEND_URL,
        placeholder: "https://jahypotheques.payloadcms.app/api/calculator-results",
    },
    contactBrokerLink: {
        title: "Contact Broker Link",
        type: ControlType.Link,
    },
    contactBrokerOpenInNewTab: {
        title: "Open in New Tab",
        type: ControlType.Boolean,
        defaultValue: false,
        enabledTitle: "Yes",
        disabledTitle: "No",
    },
})
