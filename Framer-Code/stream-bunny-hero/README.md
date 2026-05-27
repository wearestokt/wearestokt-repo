# Stream Bunny Hero (Three.js)

Interactive 3D bunny head: cursor rotation (neck pivot), lens videos, left/right click to swap clips.

**Workflow:** build and test in the browser → upload `dist/` to Bunny CDN → embed in Framer via iframe.

## Quick start (browser)

```bash
cd Framer-Code/stream-bunny-hero
npm install
npm run dev
```

Open [http://localhost:5174](http://localhost:5174) — you should see the bunny from `https://stokt.b-cdn.net/STREAM-BUNNY-3D.glb`.

Optional query params:

```text
http://localhost:5174/?v1=https://…/a.mp4&v2=https://…/b.mp4
http://localhost:5174/embed.html?model=https://stokt.b-cdn.net/STREAM-BUNNY-3D.glb
```

## Build for CDN

```bash
npm run build
```

Upload the **entire** **`dist/`** folder to Bunny Storage (keep `embed.html` and `assets/` together), e.g.:

```text
https://stokt.b-cdn.net/stream-bunny-hero/embed.html
https://stokt.b-cdn.net/stream-bunny-hero/assets/…
```

The GLB stays at `https://stokt.b-cdn.net/STREAM-BUNNY-3D.glb` (passed via `model` query param from Framer, or default in embed).

Enable **CORS** on the pull zone if Framer’s domain loads the iframe from another host.

## Framer

1. Add **`StreamBunnyEmbed.tsx`** as a code component (not `StreamBunnyHero.tsx` unless you want the alias).
2. Set **Embed URL** to your hosted `embed.html`.
3. Set **Video 1–3** (MP4/WebM, CORS-enabled).
4. Resize frame (800×800 or full-width hero).

`StreamBunnyHero.tsx` re-exports `StreamBunnyEmbed` for backwards compatibility.

## GLB structure

```text
Group          ← neck pivot; base rotation preserved, look offset applied via quaternion
├── Bunny
└── Glass-Null
    ├── Lens   ← VideoTexture
    └── Frame
```

## Source layout

| Path | Role |
|------|------|
| `src/hero-scene.ts` | Three.js scene (shared by dev + embed) |
| `src/main.ts` | Dev page entry |
| `src/embed.ts` | Minimal iframe entry |
| `index.html` | Dev UI |
| `embed.html` | Production iframe page |
| `StreamBunnyEmbed.tsx` | Framer iframe wrapper |

## Art direction (lighting, texture, camera)

### 1. Defaults in code

Edit **`src/art-direction.ts`** → `DEFAULT_ART` (camera, exposure, rim, head material, lens emissive).

Set **`cameraFlip: true`** so the head faces the camera (C4D/glTF export points the mesh the wrong way for a default Three camera).

### 2. Live dev panel

```bash
npm run dev
```

Open **http://localhost:5174/?debug=1** — sliders update the scene and copy values into the URL.

### 3. URL params (embed / Framer iframe)

| Param | Example | Effect |
|-------|---------|--------|
| `flip` | `1` | Face the camera |
| `exposure` | `1.28` | Brightness |
| `fov` | `30` | Camera FOV |
| `dist` | `1.02` | Zoom |
| `rim` | `FF4A1F` | Rim color (hex, no `#`) |
| `head` | `0c0c0c` | Head color |
| `rimL` / `rimR` / `rimT` | `5.5` | Rim light strength |
| `glbMat` | `1` | Use C4D-exported materials only |

**Framer** (`StreamBunnyEmbed`): Background, Rim Light, Exposure, Face Camera.

### 4. C4D vs runtime

| In C4D / GLB | In Three.js (`art-direction.ts`) |
|--------------|----------------------------------|
| Shape, UVs, lens mesh | — |
| Plastic color/roughness (optional) | `headColor`, `headRoughness`, or `glbMat=1` |
| — | All lights, exposure, camera framing |

## Why iframe (not Three.js inside Framer)

Framer’s code bundler often breaks `three` + `GLTFLoader` (size, `self`, duplicate instances). A static Vite build on your CDN is reliable and easy to debug in a normal browser tab.
