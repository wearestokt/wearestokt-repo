import type { ArtDirection } from "./art-direction"
import type { HeroScene } from "./hero-scene"

type SliderDef = {
    key: keyof ArtDirection
    label: string
    min: number
    max: number
    step: number
}

const SLIDERS: SliderDef[] = [
    { key: "exposure", label: "Exposure", min: 0.5, max: 2.5, step: 0.02 },
    { key: "cameraFov", label: "Camera FOV", min: 18, max: 50, step: 1 },
    { key: "cameraDistanceMult", label: "Camera distance", min: 0.7, max: 1.6, step: 0.01 },
    { key: "cameraLookAtY", label: "Look-at Y", min: 0, max: 0.25, step: 0.01 },
    { key: "ambientIntensity", label: "Ambient", min: 0, max: 0.6, step: 0.01 },
    { key: "hemisphereIntensity", label: "Hemisphere", min: 0, max: 1, step: 0.01 },
    { key: "keyIntensity", label: "Key light", min: 0, max: 2, step: 0.05 },
    { key: "fillIntensity", label: "Fill light", min: 0, max: 1, step: 0.02 },
    { key: "rimLeftIntensity", label: "Rim left", min: 0, max: 12, step: 0.1 },
    { key: "rimRightIntensity", label: "Rim right", min: 0, max: 12, step: 0.1 },
    { key: "rimTopIntensity", label: "Rim top", min: 0, max: 10, step: 0.1 },
    { key: "headRoughness", label: "Head roughness", min: 0.2, max: 1, step: 0.02 },
    { key: "headMetalness", label: "Head metalness", min: 0, max: 0.5, step: 0.01 },
    { key: "lensEmissiveIntensity", label: "Lens emissive", min: 0, max: 0.5, step: 0.01 },
]

export function mountDevPanel(hero: HeroScene) {
    const panel = document.createElement("aside")
    panel.style.cssText =
        "position:fixed;right:12px;top:12px;z-index:100;width:260px;max-height:90vh;overflow:auto;padding:12px;background:rgba(10,10,10,0.92);border:1px solid #2a2a2a;border-radius:8px;color:#e5e5e5;font:12px/1.4 system-ui,sans-serif;"

    const title = document.createElement("strong")
    title.textContent = "Art direction"
    panel.appendChild(title)

    const hint = document.createElement("p")
    hint.style.cssText = "margin:8px 0 12px;color:#888;font-size:11px;"
    hint.textContent = "Values copy to URL on change. Edit defaults in src/art-direction.ts."
    panel.appendChild(hint)

    const axisWrap = document.createElement("label")
    axisWrap.style.cssText = "display:block;margin-bottom:10px;"
    axisWrap.textContent = "Face axis "
    const axisSelect = document.createElement("select")
    for (const opt of ["+X", "-X", "+Z", "-Z"] as const) {
        const o = document.createElement("option")
        o.value = opt
        o.textContent = opt
        if (hero.getArtDirection().faceAxis === opt) o.selected = true
        axisSelect.appendChild(o)
    }
    axisSelect.addEventListener("change", () => {
        hero.updateArtDirection({
            faceAxis: axisSelect.value as "+X" | "-X" | "+Z" | "-Z",
        })
        syncUrl(hero)
    })
    axisWrap.appendChild(axisSelect)
    panel.appendChild(axisWrap)

    const yawWrap = document.createElement("label")
    yawWrap.style.cssText = "display:block;margin-bottom:10px;"
    const yawTop = document.createElement("span")
    yawTop.style.cssText = "display:flex;justify-content:space-between;"
    yawTop.textContent = "Model yaw °"
    const yawReadout = document.createElement("span")
    yawReadout.textContent = String(hero.getArtDirection().modelYawOffsetDeg)
    yawTop.appendChild(yawReadout)
    yawWrap.appendChild(yawTop)
    const yawInput = document.createElement("input")
    yawInput.type = "range"
    yawInput.min = "-180"
    yawInput.max = "180"
    yawInput.step = "90"
    yawInput.value = String(hero.getArtDirection().modelYawOffsetDeg)
    yawInput.style.width = "100%"
    yawInput.addEventListener("input", () => {
        const n = parseFloat(yawInput.value)
        hero.updateArtDirection({ modelYawOffsetDeg: n })
        yawReadout.textContent = yawInput.value
        syncUrl(hero)
    })
    yawWrap.appendChild(yawInput)
    panel.appendChild(yawWrap)

    const flipLabel = document.createElement("label")
    flipLabel.style.cssText = "display:flex;align-items:center;gap:8px;margin-bottom:10px;"
    const flipInput = document.createElement("input")
    flipInput.type = "checkbox"
    flipInput.checked = hero.getArtDirection().cameraFlip
    flipInput.addEventListener("change", () => {
        hero.updateArtDirection({ cameraFlip: flipInput.checked })
        syncUrl(hero)
    })
    flipLabel.appendChild(flipInput)
    flipLabel.appendChild(document.createTextNode(" Face camera (flip)"))
    panel.appendChild(flipLabel)

    const colorRow = (label: string, key: "rimColor" | "headColor" | "backgroundColor") => {
        const row = document.createElement("label")
        row.style.cssText = "display:flex;justify-content:space-between;align-items:center;margin:8px 0;"
        row.textContent = label
        const input = document.createElement("input")
        input.type = "color"
        input.value = hero.getArtDirection()[key]
        input.addEventListener("input", () => {
            hero.updateArtDirection({ [key]: input.value } as Partial<ArtDirection>)
            syncUrl(hero)
        })
        row.appendChild(input)
        panel.appendChild(row)
    }

    colorRow("Rim", "rimColor")
    colorRow("Head", "headColor")
    colorRow("Background", "backgroundColor")

    for (const def of SLIDERS) {
        const art = hero.getArtDirection()
        const val = art[def.key]
        if (typeof val !== "number") continue

        const wrap = document.createElement("label")
        wrap.style.cssText = "display:block;margin:10px 0 0;"
        const top = document.createElement("span")
        top.style.cssText = "display:flex;justify-content:space-between;"
        top.textContent = def.label
        const readout = document.createElement("span")
        readout.textContent = String(Number(val.toFixed(3)))
        top.appendChild(readout)
        wrap.appendChild(top)

        const input = document.createElement("input")
        input.type = "range"
        input.min = String(def.min)
        input.max = String(def.max)
        input.step = String(def.step)
        input.value = String(val)
        input.style.width = "100%"
        input.addEventListener("input", () => {
            const n = parseFloat(input.value)
            hero.updateArtDirection({ [def.key]: n } as Partial<ArtDirection>)
            readout.textContent = input.value
            syncUrl(hero)
        })
        wrap.appendChild(input)
        panel.appendChild(wrap)
    }

    document.body.appendChild(panel)
}

function syncUrl(hero: HeroScene) {
    const a = hero.getArtDirection()
    const p = new URLSearchParams(window.location.search)
    p.set("flip", a.cameraFlip ? "1" : "0")
    p.set("yaw", String(a.modelYawOffsetDeg))
    p.set("face", a.faceAxis)
    p.set("exposure", String(a.exposure))
    p.set("fov", String(a.cameraFov))
    p.set("dist", String(a.cameraDistanceMult))
    p.set("rim", a.rimColor.replace("#", ""))
    p.set("head", a.headColor.replace("#", ""))
    p.set("bg", a.backgroundColor.replace("#", ""))
    p.set("rimL", String(a.rimLeftIntensity))
    p.set("rimR", String(a.rimRightIntensity))
    history.replaceState(null, "", `?${p.toString()}`)
}
