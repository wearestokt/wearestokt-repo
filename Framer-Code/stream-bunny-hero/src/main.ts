import { artDirectionFromSearchParams } from "./art-direction"
import { createHeroScene } from "./hero-scene"
import { mountDevPanel } from "./dev-panel"

const CDN_MODEL = "https://stokt.b-cdn.net/STREAM-BUNNY-3D.glb"
const LOCAL_MODEL = "/STREAM-BUNNY-3D.glb"

const params = new URLSearchParams(window.location.search)
const modelUrl =
    params.get("model") ||
    (import.meta.env.DEV ? LOCAL_MODEL : CDN_MODEL)
const videos = [params.get("v1"), params.get("v2"), params.get("v3")].filter(
    (v): v is string => Boolean(v?.trim())
)

const root = document.getElementById("hero-root")
if (!root) {
    throw new Error("#hero-root not found")
}

const hero = createHeroScene(root, {
    modelUrl,
    videoUrls: videos,
    artDirection: artDirectionFromSearchParams(params),
    onError: (msg) => console.error("[StreamBunnyHero]", msg),
})

if (params.get("debug") === "1") {
    hero.updateArtDirection(artDirectionFromSearchParams(params))
    mountDevPanel(hero)
}
