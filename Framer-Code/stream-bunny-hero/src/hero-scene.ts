import * as THREE from "three"
import { GLTFLoader } from "three/examples/jsm/loaders/GLTFLoader.js"
import {
    type ArtDirection,
    DEFAULT_ART,
    mergeArtDirection,
} from "./art-direction"

const HEAD_PIVOT_NAME = "Group"
const LENS_MESH_NAME = "Lens"

export type HeroSceneOptions = {
    modelUrl: string
    videoUrls?: string[]
    artDirection?: Partial<ArtDirection>
    maxYaw?: number
    maxPitch?: number
    followSmoothing?: number
    modelScale?: number
    autoplayVideos?: boolean
    pauseWhenOffScreen?: boolean
    onReady?: () => void
    onError?: (message: string) => void
}

export type HeroScene = {
    dispose: () => void
    nextVideo: () => void
    prevVideo: () => void
    setVideoIndex: (index: number) => void
    getVideoIndex: () => number
    /** Live-tune art direction (dev panel / future Framer props) */
    updateArtDirection: (partial: Partial<ArtDirection>) => void
    getArtDirection: () => ArtDirection
}

function clamp(value: number, min: number, max: number) {
    return Math.min(max, Math.max(min, value))
}

function disposeObject3D(root: THREE.Object3D) {
    root.traverse((obj) => {
        const mesh = obj as THREE.Mesh
        if (!mesh.isMesh) return
        mesh.geometry?.dispose()
        const mat = mesh.material
        if (Array.isArray(mat)) mat.forEach((m) => m.dispose())
        else mat?.dispose()
    })
}

export function createHeroScene(
    container: HTMLElement,
    options: HeroSceneOptions
): HeroScene {
    const {
        modelUrl,
        videoUrls = [],
        artDirection: artPartial,
        maxYaw = 22,
        maxPitch = 12,
        followSmoothing = 0.1,
        modelScale = 2.2,
        autoplayVideos = true,
        pauseWhenOffScreen = true,
        onReady,
        onError,
    } = options

    let art = mergeArtDirection(artPartial)
    let disposed = false
    let videoIndex = 0
    let visible = true
    let reducedMotion = false

    let modelMount: THREE.Group | null = null
    let modelRoot: THREE.Object3D | null = null
    let headPivot: THREE.Object3D | null = null
    let baseQuaternion = new THREE.Quaternion()
    let lensMesh: THREE.Mesh | null = null
    let modelSize = new THREE.Vector3()
    let modelCenter = new THREE.Vector3()

    const canvas = document.createElement("canvas")
    canvas.style.cssText = "display:block;width:100%;height:100%;touch-action:none;"
    container.appendChild(canvas)

    const statusEl = document.createElement("div")
    statusEl.setAttribute("data-hero-status", "loading")
    statusEl.style.cssText =
        "position:absolute;inset:0;display:flex;align-items:center;justify-content:center;color:#A3A3A3;font:14px/1.5 system-ui,sans-serif;pointer-events:none;"
    statusEl.textContent = "Loading…"
    if (getComputedStyle(container).position === "static") {
        container.style.position = "relative"
    }
    container.appendChild(statusEl)

    const scene = new THREE.Scene()
    const camera = new THREE.PerspectiveCamera(art.cameraFov, 1, 0.1, 800)
    const renderer = new THREE.WebGLRenderer({
        canvas,
        antialias: true,
        alpha: false,
        powerPreference: "high-performance",
    })
    renderer.outputColorSpace = THREE.SRGBColorSpace
    renderer.toneMapping = THREE.ACESFilmicToneMapping

    const hemi = new THREE.HemisphereLight(
        art.hemisphereSky,
        art.hemisphereGround,
        art.hemisphereIntensity
    )
    scene.add(hemi)

    const ambient = new THREE.AmbientLight(0xffffff, art.ambientIntensity)
    scene.add(ambient)

    const key = new THREE.DirectionalLight(art.keyColor, art.keyIntensity)
    key.position.set(1, 6, 10)
    scene.add(key)

    const rimColor = new THREE.Color(art.rimColor)
    const rimL = new THREE.PointLight(rimColor, art.rimLeftIntensity, 200)
    scene.add(rimL)

    const rimR = new THREE.PointLight(rimColor, art.rimRightIntensity, 200)
    scene.add(rimR)

    const rimTop = new THREE.PointLight(rimColor, art.rimTopIntensity, 160)
    scene.add(rimTop)

    const fill = new THREE.DirectionalLight(art.fillColor, art.fillIntensity)
    fill.position.set(0, -4, 8)
    scene.add(fill)

    const targetRot = { x: 0, y: 0 }
    const currentRot = { x: 0, y: 0 }
    const lookEuler = new THREE.Euler(0, 0, 0, "YXZ")
    const lookQuat = new THREE.Quaternion()

    const videos: HTMLVideoElement[] = []
    const videoTextures: THREE.VideoTexture[] = []

    const applyRendererAndScene = () => {
        scene.background = new THREE.Color(art.backgroundColor)
        renderer.toneMappingExposure = art.exposure
        camera.fov = art.cameraFov
        camera.updateProjectionMatrix()
    }

    const applyLights = () => {
        rimColor.set(art.rimColor)
        hemi.color.set(art.hemisphereSky)
        hemi.groundColor.set(art.hemisphereGround)
        hemi.intensity = art.hemisphereIntensity
        ambient.intensity = art.ambientIntensity
        key.color.set(art.keyColor)
        key.intensity = art.keyIntensity
        fill.color.set(art.fillColor)
        fill.intensity = art.fillIntensity
        rimL.color.copy(rimColor)
        rimL.intensity = art.rimLeftIntensity
        rimR.color.copy(rimColor)
        rimR.intensity = art.rimRightIntensity
        rimTop.color.copy(rimColor)
        rimTop.intensity = art.rimTopIntensity
        placeRimLights()
    }

    const applyMaterials = () => {
        if (!modelRoot || !art.overrideMaterials) return
        modelRoot.traverse((obj) => {
            const mesh = obj as THREE.Mesh
            if (!mesh.isMesh || mesh.name === LENS_MESH_NAME) return
            const mats = Array.isArray(mesh.material) ? mesh.material : [mesh.material]
            for (const m of mats) {
                const std = m as THREE.MeshStandardMaterial
                if (!std?.isMeshStandardMaterial) continue
                std.color.set(art.headColor)
                std.roughness = art.headRoughness
                std.metalness = art.headMetalness
            }
        })
    }

    const placeRimLights = () => {
        const c = modelCenter
        const s = modelSize
        if (s.lengthSq() < 1e-6) return
        rimL.position.set(
            c.x - s.x * art.rimSideMult,
            c.y + s.y * art.rimTopMult * 0.55,
            c.z - s.z * art.rimBackMult
        )
        rimR.position.set(
            c.x + s.x * art.rimSideMult,
            c.y + s.y * art.rimTopMult * 0.4,
            c.z - s.z * art.rimBackMult
        )
        rimTop.position.set(c.x, c.y + s.y * art.rimTopMult, c.z - s.z * art.rimBackMult * 0.65)
    }

    const fitCamera = () => {
        const frameRoot = modelMount ?? modelRoot
        if (!frameRoot || !headPivot) return
        frameRoot.updateMatrixWorld(true)
        const box = new THREE.Box3().setFromObject(frameRoot)
        box.getCenter(modelCenter)
        box.getSize(modelSize)

        const fovRad = (camera.fov * Math.PI) / 180
        const fitHeight = modelSize.y * 1.1
        const distance =
            (fitHeight / (2 * Math.tan(fovRad / 2))) * art.cameraDistanceMult

        const sign = art.cameraFlip ? 1 : -1
        const camPos = new THREE.Vector3(
            modelCenter.x,
            modelCenter.y + modelSize.y * art.cameraLookAtY,
            modelCenter.z
        )
        switch (art.cameraAxis) {
            case "-Z":
                camPos.z -= distance * sign
                break
            case "-X":
                camPos.x -= distance * sign
                break
            case "+Z":
                camPos.z += distance * sign
                break
            default:
                camPos.x += distance * sign
        }
        camera.position.copy(camPos)
        camera.lookAt(
            modelCenter.x,
            modelCenter.y + modelSize.y * 0.08,
            modelCenter.z
        )
        camera.updateProjectionMatrix()
        placeRimLights()
    }

    const applyVideoIndex = (index: number) => {
        if (!lensMesh || videoTextures.length === 0) return
        const tex = videoTextures[index % videoTextures.length]
        const mats = Array.isArray(lensMesh.material) ? lensMesh.material : [lensMesh.material]
        for (const m of mats) {
            const std = m as THREE.MeshStandardMaterial
            if (!std?.isMeshStandardMaterial) continue
            std.map = tex
            std.emissive = rimColor.clone()
            std.emissiveIntensity = art.lensEmissiveIntensity
            std.emissiveMap = tex
            std.needsUpdate = true
        }
        videos.forEach((v, i) => {
            if (i === index) {
                if (autoplayVideos && visible) void v.play().catch(() => {})
            } else {
                v.pause()
            }
        })
    }

    const setupVideos = () => {
        videos.forEach((v) => {
            v.pause()
            v.removeAttribute("src")
            v.load()
        })
        videoTextures.forEach((t) => t.dispose())
        videos.length = 0
        videoTextures.length = 0

        for (const src of videoUrls) {
            const video = document.createElement("video")
            video.src = src
            video.crossOrigin = "anonymous"
            video.muted = true
            video.loop = true
            video.playsInline = true
            video.setAttribute("playsinline", "")
            video.preload = "auto"
            videos.push(video)

            const tex = new THREE.VideoTexture(video)
            tex.colorSpace = THREE.SRGBColorSpace
            tex.minFilter = THREE.LinearFilter
            tex.magFilter = THREE.LinearFilter
            videoTextures.push(tex)
        }

        if (videoTextures.length > 0) applyVideoIndex(videoIndex)
    }

    applyRendererAndScene()
    applyLights()

    const loader = new GLTFLoader()
    loader.load(
        modelUrl,
        (gltf) => {
            if (disposed) return
            modelRoot = gltf.scene
            modelMount = new THREE.Group()
            modelMount.add(modelRoot)
            scene.add(modelMount)

            headPivot = modelRoot.getObjectByName(HEAD_PIVOT_NAME) ?? modelRoot
            baseQuaternion.copy(headPivot.quaternion)
            lensMesh = modelRoot.getObjectByName(LENS_MESH_NAME) as THREE.Mesh | null

            const box = new THREE.Box3().setFromObject(modelRoot)
            const maxDim = Math.max(...box.getSize(new THREE.Vector3()).toArray())
            if (maxDim > 0) modelRoot.scale.setScalar(modelScale / maxDim)

            applyModelYaw()
            modelMount.updateMatrixWorld(true)

            applyMaterials()
            fitCamera()
            setupVideos()

            statusEl.style.display = "none"
            onReady?.()
        },
        undefined,
        (err) => {
            if (disposed) return
            statusEl.textContent = "Could not load 3D model"
            statusEl.style.color = "#EF4444"
            onError?.(err instanceof Error ? err.message : "load failed")
        }
    )

    const resize = () => {
        const w = container.clientWidth
        const h = container.clientHeight
        if (w === 0 || h === 0) return
        camera.aspect = w / h
        camera.updateProjectionMatrix()
        renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2))
        renderer.setSize(w, h, false)
    }

    const resizeObserver = new ResizeObserver(resize)
    resizeObserver.observe(container)
    resize()

    const motionMq = window.matchMedia("(prefers-reduced-motion: reduce)")
    reducedMotion = motionMq.matches
    const onMotionChange = () => {
        reducedMotion = motionMq.matches
    }
    motionMq.addEventListener("change", onMotionChange)

    const onPointerMove = (e: PointerEvent) => {
        if (reducedMotion) return
        const rect = container.getBoundingClientRect()
        const nx = ((e.clientX - rect.left) / rect.width) * 2 - 1
        const ny = ((e.clientY - rect.top) / rect.height) * 2 - 1
        const yawRad = (maxYaw * Math.PI) / 180
        const pitchRad = (maxPitch * Math.PI) / 180
        targetRot.y = clamp(nx, -1, 1) * yawRad
        targetRot.x = -clamp(ny, -1, 1) * pitchRad
    }

    const onPointerLeave = () => {
        targetRot.x = 0
        targetRot.y = 0
    }

    container.addEventListener("pointermove", onPointerMove)
    container.addEventListener("pointerleave", onPointerLeave)

    let raf = 0
    const animate = () => {
        raf = requestAnimationFrame(animate)
        if (!visible && pauseWhenOffScreen) return

        const t = clamp(followSmoothing, 0.02, 1)
        currentRot.x += (targetRot.x - currentRot.x) * t
        currentRot.y += (targetRot.y - currentRot.y) * t

        if (headPivot) {
            lookEuler.set(currentRot.x, currentRot.y, 0, "YXZ")
            lookQuat.setFromEuler(lookEuler)
            headPivot.quaternion.copy(baseQuaternion).multiply(lookQuat)
        }

        for (const tex of videoTextures) {
            if (tex.image && "readyState" in tex.image && tex.image.readyState >= 2) {
                tex.needsUpdate = true
            }
        }

        renderer.render(scene, camera)
    }
    animate()

    let observer: IntersectionObserver | null = null
    if (pauseWhenOffScreen) {
        observer = new IntersectionObserver(
            ([entry]) => {
                visible = entry.isIntersecting
                if (!visible) {
                    videos.forEach((v) => v.pause())
                } else if (autoplayVideos && videoTextures.length > 0) {
                    applyVideoIndex(videoIndex)
                }
            },
            { threshold: 0.06 }
        )
        observer.observe(container)
    }

    const zoneStyle =
        "position:absolute;top:0;height:100%;width:32%;border:none;background:transparent;cursor:pointer;z-index:2;padding:0;"
    const prevZone = document.createElement("button")
    prevZone.type = "button"
    prevZone.setAttribute("aria-label", "Previous video")
    prevZone.style.cssText = zoneStyle + "left:0;"
    prevZone.addEventListener("click", () => {
        if (videoUrls.length < 2) return
        videoIndex = (videoIndex - 1 + videoUrls.length) % videoUrls.length
        applyVideoIndex(videoIndex)
    })

    const nextZone = document.createElement("button")
    nextZone.type = "button"
    nextZone.setAttribute("aria-label", "Next video")
    nextZone.style.cssText = zoneStyle + "right:0;"
    nextZone.addEventListener("click", () => {
        if (videoUrls.length < 2) return
        videoIndex = (videoIndex + 1) % videoUrls.length
        applyVideoIndex(videoIndex)
    })

    if (videoUrls.length > 1) {
        container.appendChild(prevZone)
        container.appendChild(nextZone)
    }

    const applyModelYaw = () => {
        if (!modelMount) return
        modelMount.rotation.y = (art.modelYawOffsetDeg * Math.PI) / 180
        modelMount.updateMatrixWorld(true)
    }

    const updateArtDirection = (partial: Partial<ArtDirection>) => {
        art = mergeArtDirection({ ...art, ...partial })
        applyRendererAndScene()
        applyLights()
        applyMaterials()
        applyModelYaw()
        fitCamera()
        if (videoTextures.length > 0) applyVideoIndex(videoIndex)
    }

    return {
        dispose() {
            disposed = true
            cancelAnimationFrame(raf)
            container.removeEventListener("pointermove", onPointerMove)
            container.removeEventListener("pointerleave", onPointerLeave)
            motionMq.removeEventListener("change", onMotionChange)
            resizeObserver.disconnect()
            observer?.disconnect()
            prevZone.remove()
            nextZone.remove()
            canvas.remove()
            statusEl.remove()
            setupVideos()
            if (modelMount) {
                scene.remove(modelMount)
                disposeObject3D(modelMount)
            }
            renderer.dispose()
        },
        nextVideo() {
            if (videoUrls.length < 2) return
            videoIndex = (videoIndex + 1) % videoUrls.length
            applyVideoIndex(videoIndex)
        },
        prevVideo() {
            if (videoUrls.length < 2) return
            videoIndex = (videoIndex - 1 + videoUrls.length) % videoUrls.length
            applyVideoIndex(videoIndex)
        },
        setVideoIndex(i: number) {
            if (videoUrls.length === 0) return
            videoIndex = ((i % videoUrls.length) + videoUrls.length) % videoUrls.length
            applyVideoIndex(videoIndex)
        },
        getVideoIndex: () => videoIndex,
        updateArtDirection,
        getArtDirection: () => ({ ...art }),
    }
}
