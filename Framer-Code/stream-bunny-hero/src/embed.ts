import { artDirectionFromSearchParams } from "./art-direction"
import { createHeroScene } from "./hero-scene"

const CDN_MODEL = "https://stokt.b-cdn.net/STREAM-BUNNY-3D.glb"

const params = new URLSearchParams(window.location.search)
const modelUrl = params.get("model") || CDN_MODEL
const videos = [params.get("v1"), params.get("v2"), params.get("v3")].filter(
    (v): v is string => Boolean(v?.trim())
)

const root = document.getElementById("hero-root")
if (!root) {
    throw new Error("#hero-root not found")
}

document.documentElement.style.background = "#000"
document.body.style.margin = "0"
document.body.style.background = "#000"

createHeroScene(root, {
    modelUrl,
    videoUrls: videos,
    artDirection: artDirectionFromSearchParams(params),
})
