/**
 * Art direction for Stream Bunny Hero.
 *
 * Tweak defaults here, pass partial config from code, or use URL params in dev/embed.
 * Run `npm run dev` then open `/?debug=1` for live sliders.
 */
export type ArtDirection = {
    /** Flip camera to the front of the face (C4D → glTF) */
    cameraFlip: boolean
    /** Rotate entire model on Y (degrees). Fine-tune after faceAxis. */
    modelYawOffsetDeg: number
    /**
     * Which local axis on the head points at the glasses/face (C4D export).
     * This asset: +X. Try -X, +Z, -Z if your export differs.
     */
    faceAxis: "+X" | "-X" | "+Z" | "-Z"
    cameraFov: number
    /** Multiplier on auto-fit camera distance */
    cameraDistanceMult: number
    /** Look-at lift as fraction of model height */
    cameraLookAtY: number

    exposure: number
    backgroundColor: string

    ambientIntensity: number
    hemisphereSky: string
    hemisphereGround: string
    hemisphereIntensity: number

    keyIntensity: number
    keyColor: string
    fillIntensity: number
    fillColor: string

    rimColor: string
    rimLeftIntensity: number
    rimRightIntensity: number
    rimTopIntensity: number
    /** Rim placement relative to bounding box */
    rimBackMult: number
    rimSideMult: number
    rimTopMult: number

    /** Override GLB Plastic material (set false to use C4D export only) */
    overrideMaterials: boolean
    headColor: string
    headRoughness: number
    headMetalness: number

    lensEmissiveIntensity: number
    /** Keep baked Polarized texture when no video URL */
    lensKeepPolarized: boolean
}

export const DEFAULT_ART: ArtDirection = {
    cameraFlip: true,
    /** Cancels C4D export rotation so the glasses face the camera (try 90 or -90). */
    modelYawOffsetDeg: 0,
    /** World axis the camera sits on to view the face */
    cameraAxis: "+Z" | "-Z" | "+X" | "-X",
    faceAxis: "+X",
    cameraAxis: "+X",
    cameraFov: 30,
    cameraDistanceMult: 1.02,
    cameraLookAtY: 0.1,

    exposure: 1.28,
    backgroundColor: "#000000",

    ambientIntensity: 0.16,
    hemisphereSky: "#3a3a48",
    hemisphereGround: "#050505",
    hemisphereIntensity: 0.32,

    keyIntensity: 0.45,
    keyColor: "#ffffff",
    fillIntensity: 0.18,
    fillColor: "#ff7744",

    rimColor: "#FF4A1F",
    rimLeftIntensity: 5.5,
    rimRightIntensity: 4.5,
    rimTopIntensity: 3,
    rimBackMult: 0.75,
    rimSideMult: 0.85,
    rimTopMult: 0.55,

    overrideMaterials: true,
    headColor: "#0c0c0c",
    headRoughness: 0.9,
    headMetalness: 0.03,

    lensEmissiveIntensity: 0.1,
    lensKeepPolarized: true,
}

export function mergeArtDirection(partial?: Partial<ArtDirection>): ArtDirection {
    return { ...DEFAULT_ART, ...partial }
}

function parseBool(v: string | null, fallback: boolean): boolean {
    if (v === null || v === "") return fallback
    return v === "1" || v === "true" || v === "yes"
}

function parseNum(v: string | null, fallback: number): number {
    if (v === null || v === "") return fallback
    const n = Number(v)
    return Number.isFinite(n) ? n : fallback
}

function parseHexColor(v: string | null, fallback: string): string {
    if (v === null || v === "") return fallback
    const s = v.trim()
    if (s.startsWith("#")) return s
    if (/^[0-9a-fA-F]{6}$/.test(s)) return `#${s}`
    return fallback
}

/** Map URL search params → partial art direction (for embed + dev). */
export function artDirectionFromSearchParams(params: URLSearchParams): Partial<ArtDirection> {
    const out: Partial<ArtDirection> = {}
    if (params.has("flip")) out.cameraFlip = parseBool(params.get("flip"), DEFAULT_ART.cameraFlip)
    if (params.has("yaw")) out.modelYawOffsetDeg = parseNum(params.get("yaw"), DEFAULT_ART.modelYawOffsetDeg)
    if (params.has("face")) {
        const f = params.get("face") as ArtDirection["faceAxis"]
        if (f === "+X" || f === "-X" || f === "+Z" || f === "-Z") out.faceAxis = f
    }
    if (params.has("cam")) {
        const c = params.get("cam") as ArtDirection["cameraAxis"]
        if (c === "+X" || c === "-X" || c === "+Z" || c === "-Z") out.cameraAxis = c
    }
    if (params.has("fov")) out.cameraFov = parseNum(params.get("fov"), DEFAULT_ART.cameraFov)
    if (params.has("dist")) out.cameraDistanceMult = parseNum(params.get("dist"), DEFAULT_ART.cameraDistanceMult)
    if (params.has("exposure")) out.exposure = parseNum(params.get("exposure"), DEFAULT_ART.exposure)
    if (params.has("bg")) out.backgroundColor = parseHexColor(params.get("bg"), DEFAULT_ART.backgroundColor)
    if (params.has("rim")) out.rimColor = parseHexColor(params.get("rim"), DEFAULT_ART.rimColor)
    if (params.has("rimL")) out.rimLeftIntensity = parseNum(params.get("rimL"), DEFAULT_ART.rimLeftIntensity)
    if (params.has("rimR")) out.rimRightIntensity = parseNum(params.get("rimR"), DEFAULT_ART.rimRightIntensity)
    if (params.has("rimT")) out.rimTopIntensity = parseNum(params.get("rimT"), DEFAULT_ART.rimTopIntensity)
    if (params.has("ambient")) out.ambientIntensity = parseNum(params.get("ambient"), DEFAULT_ART.ambientIntensity)
    if (params.has("key")) out.keyIntensity = parseNum(params.get("key"), DEFAULT_ART.keyIntensity)
    if (params.has("fill")) out.fillIntensity = parseNum(params.get("fill"), DEFAULT_ART.fillIntensity)
    if (params.has("head")) out.headColor = parseHexColor(params.get("head"), DEFAULT_ART.headColor)
    if (params.has("rough")) out.headRoughness = parseNum(params.get("rough"), DEFAULT_ART.headRoughness)
    if (params.has("metal")) out.headMetalness = parseNum(params.get("metal"), DEFAULT_ART.headMetalness)
    if (params.has("glbMat")) out.overrideMaterials = !parseBool(params.get("glbMat"), false)
    return out
}
