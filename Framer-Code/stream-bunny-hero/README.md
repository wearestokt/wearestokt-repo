# Stream Bunny Hero (3D)

Interactive bunny head for the Stream Bunny landing page — cursor rotation (neck pivot), lens video reflection, left/right click to change clips.

## Files

| File | Purpose |
|------|---------|
| `StreamBunnyHero.tsx` | Framer code component |
| `assets/STREAM-BUNNY-3D.glb` | Source model (reference copy; host on CDN for production) |

## GLB structure (do not rename in export)

```text
Group          ← rotation pivot (neck)
├── Bunny
└── Glass-Null
    ├── Lens   ← video texture
    └── Frame
```

## Setup in Framer

1. **Assets → Upload** `STREAM-BUNNY-3D.glb` to Framer, or upload to **Bunny Storage** and copy the public HTTPS URL.
2. **Code →** create component from `StreamBunnyHero.tsx` (Framer will bundle `three` when you `import` it).
3. Drop on canvas (recommended **800×800** or full-width hero with fixed height).
4. In the property panel:
   - **Model URL** — defaults to `https://stokt.b-cdn.net/STREAM-BUNNY-3D.glb` (override if you move the file)
   - **Video 1–3** — MP4/WebM URLs for lens playback (must allow CORS if cross-origin)
   - **Poster** — PNG for Framer canvas preview and loading state
5. Publish.

You **do not** need to send the CDN link to anyone else — paste it only into **Model URL** in Framer.

## Bunny CDN example

After upload to a Bunny Storage zone:

```text
https://{pull-zone-hostname}/STREAM-BUNNY-3D.glb
```

Enable **CORS** on the storage zone if the lens videos are on a different hostname.

## Interaction

- **Pointer move** — head rotates on `Group` (neck pivot), clamped by Max Yaw / Max Pitch.
- **Click left 32% / right 32%** — previous / next video (when 2+ videos are set).
- **Pause off screen** — stops rendering and video when scrolled away.
- **`prefers-reduced-motion`** — head stays centered.

## Tuning

| Property | When to adjust |
|----------|----------------|
| Model Scale | Head too large/small in frame |
| Max Yaw / Pitch | Rotation feels too strong (neck pivot amplifies motion) |
| Follow Smooth | Snappier vs. floatier tracking |
| Rim Light | Match brand orange `#FF4A1F` |

## Local reference

The GLB in `assets/` is for version control and inspection. Framer and the published site load the **Model URL** you set in the panel, not this repo path.
