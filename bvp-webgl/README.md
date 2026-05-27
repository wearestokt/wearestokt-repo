# BVP WebGL — Fog Reveal

Cursor-driven fog dispersion effect. The **drawing** (line art) is the fog layer; the **color city** image is revealed underneath as you move the cursor.

## Test in browser

From the `bvp-webgl` folder:

```bash
npm run dev
```

Or use Python:

```bash
cd bvp-webgl && python3 -m http.server 3333
```

Then open **http://localhost:3333** in your browser.

## Demo assets

The `demo/` folder contains:
- `drawing.png` — fog layer (black line-art skyline)
- `color-city.png` — revealed layer (full-color cityscape)

These load automatically. You can also use the file inputs to pick your own images.

## Controls

- **Reveal radius** — size of the cursor reveal circle
- **Dispersion** — how much the fog spreads (blur)
- **Decay** — how quickly the fog returns (0.98 = slow, 0.99 = slower)

## Files

- `fog-reveal.js` — WebGL 2 shader logic (vanilla, no deps)
- `index.html` — test page
- `demo/` — test images
