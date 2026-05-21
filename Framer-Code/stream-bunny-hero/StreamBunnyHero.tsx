/**
 * StreamBunnyHero — Interactive 3D bunny head for the Stream Bunny landing page.
 *
 * GLB hierarchy: Group (rotate) → Bunny + Glass-Null → Lens + Frame
 * Video plays on the Lens mesh material (replaces Polarized texture at runtime).
 *
 * Upload STREAM-BUNNY-3D.glb to Bunny CDN (or Framer Assets), then paste the HTTPS URL
 * into the Model URL property — no code change required.
 */

import React, { useEffect, useRef, useState, useCallback } from "react"
import { addPropertyControls, ControlType, RenderTarget } from "framer"
import * as THREE from "three"
import { GLTFLoader } from "three/examples/jsm/loaders/GLTFLoader.js"

const HEAD_PIVOT_NAME = "Group"
const LENS_MESH_NAME = "Lens"

type StreamBunnyHeroProps = {
    /** HTTPS URL to STREAM-BUNNY-3D.glb (Bunny CDN, Framer Assets, etc.) */
    modelUrl?: string
    /** Lens reflection clips (MP4 or WebM recommended). Empty slots are skipped. */
    videoUrl1?: string
    videoUrl2?: string
    videoUrl3?: string
    /** Static image while loading or in Framer canvas preview */
    posterImage?: string
    backgroundColor?: string
    rimLightColor?: string
    maxYaw?: number
    maxPitch?: number
    followSmoothing?: number
    /** Target max dimension after auto-scale (glTF units vary) */
    modelScale?: number
    autoplayVideos?: boolean
    pauseWhenOffScreen?: boolean
    showClickZones?: boolean
    style?: React.CSSProperties
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
        if (Array.isArray(mat)) {
            mat.forEach((m) => m.dispose())
        } else if (mat) {
            mat.dispose()
        }
    })
}

/**
 * @framerDisableUnlink
 * @framerSupportedLayoutWidth any-prefer-fixed
 * @framerSupportedLayoutHeight any-prefer-fixed
 * @framerIntrinsicWidth 800
 * @framerIntrinsicHeight 800
 */
export function StreamBunnyHero(props: StreamBunnyHeroProps) {
    const {
        modelUrl = "",
        videoUrl1 = "",
        videoUrl2 = "",
        videoUrl3 = "",
        posterImage = "",
        backgroundColor = "#000000",
        rimLightColor = "#FF4A1F",
        maxYaw = 22,
        maxPitch = 12,
        followSmoothing = 0.1,
        modelScale = 2.2,
        autoplayVideos = true,
        pauseWhenOffScreen = true,
        showClickZones = false,
        style,
    } = props

    const containerRef = useRef<HTMLDivElement>(null)
    const canvasRef = useRef<HTMLCanvasElement>(null)
    const headPivotRef = useRef<THREE.Object3D | null>(null)
    const lensMeshRef = useRef<THREE.Mesh | null>(null)
    const rafRef = useRef<number>(0)
    const activeRef = useRef(true)
    const reducedMotionRef = useRef(false)
    const videosRef = useRef<HTMLVideoElement[]>([])

    const [loadState, setLoadState] = useState<"idle" | "loading" | "ready" | "error">("idle")
    const [videoIndex, setVideoIndex] = useState(0)
    const [active, setActive] = useState(true)

    const videoUrls = [videoUrl1, videoUrl2, videoUrl3].filter(
        (u): u is string => typeof u === "string" && u.trim().length > 0
    )

    const isFramerPreview = RenderTarget.current() === RenderTarget.preview
    const showPoster = Boolean(posterImage) && (isFramerPreview || loadState !== "ready")

    const goNext = useCallback(() => {
        if (videoUrls.length === 0) return
        setVideoIndex((i) => (i + 1) % videoUrls.length)
    }, [videoUrls.length])

    const goPrev = useCallback(() => {
        if (videoUrls.length === 0) return
        setVideoIndex((i) => (i - 1 + videoUrls.length) % videoUrls.length)
    }, [videoUrls.length])

    useEffect(() => {
        reducedMotionRef.current =
            typeof window !== "undefined" &&
            window.matchMedia("(prefers-reduced-motion: reduce)").matches
    }, [])

    useEffect(() => {
        if (!pauseWhenOffScreen || !containerRef.current) return
        const el = containerRef.current
        const observer = new IntersectionObserver(
            ([entry]) => {
                const visible = entry.isIntersecting
                activeRef.current = visible
                setActive(visible)
            },
            { threshold: 0.08 }
        )
        observer.observe(el)
        return () => observer.disconnect()
    }, [pauseWhenOffScreen])

    useEffect(() => {
        const container = containerRef.current
        const canvas = canvasRef.current
        const url = modelUrl?.trim()

        if (!container || !canvas || !url || isFramerPreview) {
            setLoadState(url ? (isFramerPreview ? "idle" : "loading") : "idle")
            return
        }

        let disposed = false
        setLoadState("loading")

        const scene = new THREE.Scene()
        scene.background = new THREE.Color(backgroundColor)

        const camera = new THREE.PerspectiveCamera(32, 1, 0.1, 500)
        const renderer = new THREE.WebGLRenderer({
            canvas,
            antialias: true,
            alpha: false,
            powerPreference: "high-performance",
        })
        renderer.outputColorSpace = THREE.SRGBColorSpace
        renderer.toneMapping = THREE.ACESFilmicToneMapping
        renderer.toneMappingExposure = 1.05

        const ambient = new THREE.AmbientLight(0xffffff, 0.12)
        scene.add(ambient)

        const key = new THREE.DirectionalLight(0xffffff, 0.35)
        key.position.set(2, 4, 8)
        scene.add(key)

        const rimLeft = new THREE.PointLight(new THREE.Color(rimLightColor), 2.8, 80)
        rimLeft.position.set(-14, 8, -16)
        scene.add(rimLeft)

        const rimRight = new THREE.PointLight(new THREE.Color(rimLightColor), 2.2, 80)
        rimRight.position.set(14, 6, -14)
        scene.add(rimRight)

        const fill = new THREE.DirectionalLight(0xffaa88, 0.15)
        fill.position.set(0, -2, 6)
        scene.add(fill)

        const targetRot = { x: 0, y: 0 }
        const currentRot = { x: 0, y: 0 }
        const pointer = { x: 0, y: 0 }

        headPivotRef.current = null
        lensMeshRef.current = null

        const loader = new GLTFLoader()
        loader.load(
            url,
            (gltf) => {
                if (disposed) return

                const root = gltf.scene
                scene.add(root)

                headPivotRef.current = root.getObjectByName(HEAD_PIVOT_NAME) ?? root
                lensMeshRef.current = root.getObjectByName(LENS_MESH_NAME) as THREE.Mesh | null

                const box = new THREE.Box3().setFromObject(root)
                const size = new THREE.Vector3()
                const center = new THREE.Vector3()
                box.getSize(size)
                box.getCenter(center)

                const maxDim = Math.max(size.x, size.y, size.z)
                if (maxDim > 0) {
                    const s = modelScale / maxDim
                    root.scale.setScalar(s)
                    box.setFromObject(root)
                    box.getCenter(center)
                    box.getSize(size)
                }

                const fovRad = (camera.fov * Math.PI) / 180
                const fitHeight = size.y * 1.05
                const distance = fitHeight / (2 * Math.tan(fovRad / 2))
                camera.position.set(center.x, center.y + size.y * 0.02, center.z + distance)
                camera.lookAt(center.x, center.y + size.y * 0.08, center.z)
                camera.updateProjectionMatrix()

                setLoadState("ready")
            },
            undefined,
            () => {
                if (!disposed) setLoadState("error")
            }
        )

        const resize = () => {
            const w = container.clientWidth
            const h = container.clientHeight
            if (w === 0 || h === 0) return
            camera.aspect = w / h
            camera.updateProjectionMatrix()
            const dpr = Math.min(window.devicePixelRatio || 1, 2)
            renderer.setPixelRatio(dpr)
            renderer.setSize(w, h, false)
        }

        const resizeObserver = new ResizeObserver(resize)
        resizeObserver.observe(container)
        resize()

        const onPointerMove = (e: PointerEvent) => {
            if (reducedMotionRef.current) return
            const rect = container.getBoundingClientRect()
            const nx = ((e.clientX - rect.left) / rect.width) * 2 - 1
            const ny = ((e.clientY - rect.top) / rect.height) * 2 - 1
            pointer.x = clamp(nx, -1, 1)
            pointer.y = clamp(ny, -1, 1)
            const yawRad = (maxYaw * Math.PI) / 180
            const pitchRad = (maxPitch * Math.PI) / 180
            targetRot.y = pointer.x * yawRad
            targetRot.x = -pointer.y * pitchRad
        }

        const onPointerLeave = () => {
            targetRot.x = 0
            targetRot.y = 0
        }

        container.addEventListener("pointermove", onPointerMove)
        container.addEventListener("pointerleave", onPointerLeave)

        const animate = () => {
            rafRef.current = requestAnimationFrame(animate)
            if (!active) return

            const t = clamp(followSmoothing, 0.02, 1)
            currentRot.x += (targetRot.x - currentRot.x) * t
            currentRot.y += (targetRot.y - currentRot.y) * t

            const pivot = headPivotRef.current
            if (pivot) {
                pivot.rotation.x = currentRot.x
                pivot.rotation.y = currentRot.y
            }

            if (!pauseWhenOffScreen || activeRef.current) {
                renderer.render(scene, camera)
            }
        }
        animate()

        return () => {
            disposed = true
            cancelAnimationFrame(rafRef.current)
            container.removeEventListener("pointermove", onPointerMove)
            container.removeEventListener("pointerleave", onPointerLeave)
            resizeObserver.disconnect()
            headPivotRef.current = null
            lensMeshRef.current = null
            disposeObject3D(scene)
            renderer.dispose()
        }
    }, [
        modelUrl,
        backgroundColor,
        rimLightColor,
        maxYaw,
        maxPitch,
        followSmoothing,
        modelScale,
        isFramerPreview,
        pauseWhenOffScreen,
    ])

    useEffect(() => {
        const lensMesh = lensMeshRef.current
        if (loadState !== "ready" || !lensMesh || videoUrls.length === 0 || isFramerPreview) {
            return
        }

        const videos: HTMLVideoElement[] = []
        const textures: THREE.VideoTexture[] = []

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
            textures.push(tex)
        }
        videosRef.current = videos

        const applyTexture = (index: number) => {
            const mesh = lensMeshRef.current
            if (!mesh) return
            const mat = mesh.material
            const materials = Array.isArray(mat) ? mat : [mat]
            const tex = textures[index]
            if (!tex) return
            for (const m of materials) {
                const std = m as THREE.MeshStandardMaterial
                if (!std || !("map" in std)) continue
                std.map = tex
                std.emissive = new THREE.Color(rimLightColor)
                std.emissiveIntensity = 0.08
                std.emissiveMap = tex
                std.needsUpdate = true
            }
        }

        const playIndex = (index: number) => {
            videos.forEach((v, i) => {
                if (i === index) {
                    if (autoplayVideos && activeRef.current) v.play().catch(() => {})
                } else {
                    v.pause()
                }
            })
        }

        const idx = videoIndex % textures.length
        applyTexture(idx)
        playIndex(idx)

        return () => {
            videos.forEach((v) => {
                v.pause()
                v.removeAttribute("src")
                v.load()
            })
            textures.forEach((t) => t.dispose())
            videosRef.current = []
        }
    }, [
        loadState,
        videoUrls.join("|"),
        videoIndex,
        autoplayVideos,
        rimLightColor,
        isFramerPreview,
    ])

    useEffect(() => {
        if (!autoplayVideos || videoUrls.length === 0) return
        const videos = videosRef.current
        const idx = videoIndex % videos.length
        videos.forEach((v, i) => {
            if (i === idx) {
                if (active) v.play().catch(() => {})
            } else {
                v.pause()
            }
        })
    }, [active, autoplayVideos, videoIndex, videoUrls.length])

    return (
        <div
            ref={containerRef}
            style={{
                position: "relative",
                width: "100%",
                height: "100%",
                minWidth: 320,
                minHeight: 320,
                overflow: "hidden",
                background: backgroundColor,
                touchAction: "none",
                ...style,
            }}
        >
            <canvas
                ref={canvasRef}
                style={{
                    position: "absolute",
                    inset: 0,
                    width: "100%",
                    height: "100%",
                    display: isFramerPreview && posterImage ? "none" : "block",
                }}
            />

            {showPoster && (
                <img
                    src={posterImage}
                    alt=""
                    style={{
                        position: "absolute",
                        inset: 0,
                        width: "100%",
                        height: "100%",
                        objectFit: "cover",
                        pointerEvents: "none",
                    }}
                />
            )}

            {!modelUrl?.trim() && (
                <div
                    style={{
                        position: "absolute",
                        inset: 0,
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                        padding: 24,
                        color: "#A3A3A3",
                        fontSize: 14,
                        textAlign: "center",
                        lineHeight: 1.5,
                        pointerEvents: "none",
                    }}
                >
                    Add your hosted GLB URL in Model URL
                </div>
            )}

            {loadState === "error" && (
                <div
                    style={{
                        position: "absolute",
                        inset: 0,
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                        color: "#EF4444",
                        fontSize: 13,
                        pointerEvents: "none",
                    }}
                >
                    Could not load 3D model
                </div>
            )}

            {loadState === "ready" && videoUrls.length > 1 && (
                <>
                    <button
                        type="button"
                        aria-label="Previous video"
                        onClick={goPrev}
                        style={{
                            position: "absolute",
                            left: 0,
                            top: 0,
                            width: "32%",
                            height: "100%",
                            border: "none",
                            background: showClickZones ? "rgba(255,74,31,0.08)" : "transparent",
                            cursor: "pointer",
                            zIndex: 2,
                        }}
                    />
                    <button
                        type="button"
                        aria-label="Next video"
                        onClick={goNext}
                        style={{
                            position: "absolute",
                            right: 0,
                            top: 0,
                            width: "32%",
                            height: "100%",
                            border: "none",
                            background: showClickZones ? "rgba(255,74,31,0.08)" : "transparent",
                            cursor: "pointer",
                            zIndex: 2,
                        }}
                    />
                </>
            )}
        </div>
    )
}

StreamBunnyHero.defaultProps = {
    modelUrl: "https://stokt.b-cdn.net/STREAM-BUNNY-3D.glb",
    videoUrl1: "",
    videoUrl2: "",
    videoUrl3: "",
    posterImage: "",
    backgroundColor: "#000000",
    rimLightColor: "#FF4A1F",
    maxYaw: 22,
    maxPitch: 12,
    followSmoothing: 0.1,
    modelScale: 2.2,
    autoplayVideos: true,
    pauseWhenOffScreen: true,
    showClickZones: false,
}

addPropertyControls(StreamBunnyHero, {
    modelUrl: {
        type: ControlType.String,
        title: "Model URL",
        placeholder: "https://…/STREAM-BUNNY-3D.glb",
    },
    videoUrl1: {
        type: ControlType.String,
        title: "Video 1",
        placeholder: "https://…/clip.mp4",
    },
    videoUrl2: {
        type: ControlType.String,
        title: "Video 2",
    },
    videoUrl3: {
        type: ControlType.String,
        title: "Video 3",
    },
    posterImage: {
        type: ControlType.Image,
        title: "Poster",
    },
    backgroundColor: {
        type: ControlType.Color,
        title: "Background",
        defaultValue: "#000000",
    },
    rimLightColor: {
        type: ControlType.Color,
        title: "Rim Light",
        defaultValue: "#FF4A1F",
    },
    maxYaw: {
        type: ControlType.Number,
        title: "Max Yaw °",
        min: 0,
        max: 45,
        step: 1,
        defaultValue: 22,
    },
    maxPitch: {
        type: ControlType.Number,
        title: "Max Pitch °",
        min: 0,
        max: 30,
        step: 1,
        defaultValue: 12,
    },
    followSmoothing: {
        type: ControlType.Number,
        title: "Follow Smooth",
        min: 0.02,
        max: 0.5,
        step: 0.01,
        defaultValue: 0.1,
    },
    modelScale: {
        type: ControlType.Number,
        title: "Model Scale",
        min: 0.5,
        max: 6,
        step: 0.1,
        defaultValue: 2.2,
    },
    autoplayVideos: {
        type: ControlType.Boolean,
        title: "Autoplay Videos",
        defaultValue: true,
    },
    pauseWhenOffScreen: {
        type: ControlType.Boolean,
        title: "Pause Off Screen",
        defaultValue: true,
    },
    showClickZones: {
        type: ControlType.Boolean,
        title: "Show Zones",
        defaultValue: false,
        enabledTitle: "Debug",
        disabledTitle: "Hide",
    },
})
