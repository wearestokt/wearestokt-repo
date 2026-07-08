# Word Tide — Typographic Texture Generator (Brand System #2)

## Product

Word Tide builds brand textures where every texture unit is a whole, readable word from a
user-supplied word list or dataset. It serves brand system #2 (naval / sea / port / dock,
tones of blue, paper background, typewriter typography) the way the Container Yard generator
serves brand system #1.

Reference inputs (user-provided screenshots):

1. Number-field dither (`21 / 42 / 49`) — tokens in a grid with tone-driven ink levels.
2. `BRIDGE CALIFORNIA IMAGERY THOUGHTS` word grid forming an image, with yellow marker
   highlights on selected words.
3. Golden Gate photo where sky/bridge regions are re-rendered as word texture.
4. Split ship painting — words fill semantic regions (CLOUDS sky, BOAT hull, OCEAN sea).
5. Maritime word cloud forming sailboat silhouettes (shape-masked words).
6. Heron brand system frames (brand system #1 context only).

## Modes

One tool, one mode switch (`mode.render`):

- **Dither** — monospace-style word grid over the canvas. An uploaded source image is
  sampled per word slot; luminance maps to ink (opacity, variable font weight, and skip
  probability). Without an image the grid renders at uniform ink (pure typographic texture).
- **Flow** — words repeat along traced streamlines of a procedural vector field
  (currents/waves/vortex/radial/turbulent) bent by user-drawn attractor paths. Words are
  placed as rigid readable units with a curvature limit; reuses the proven flow-field
  engine (`flow-vector-field.ts`, `flow-path-math.ts`, `flow-path-overlay.tsx`).

**Tone zones** extend Dither mode: luminance bands (2 or 3) each draw from their own word
list (light = CLOUDS, mid = BOAT, dark = OCEAN in the ship reference).

**Shape mask** applies to both modes: a second upload (SVG or PNG with alpha) constrains
where words may exist. Words are placed only when the whole word fits inside the mask.
Invert and feather controls included. Mask rasterizes cover/crop at canvas size.

**Highlights**: chosen words get a marker-style rect behind them (reference 2), with
coverage percent and accent color.

## Readability contract

Every placed word is whole and legible. Edge slots and mask-edge slots are skipped, not
clipped. Flow words are placed only on segments whose curvature stays below a per-font-size
limit. Ink mapping changes opacity/weight, never glyph integrity.

## Typography

Single `fontPicker` control owns font family, weight, size, case, letter spacing, line
height, ink color, and opacity. The grid derives row height from `fontSize * lineHeight`
and in-row gaps from letter spacing plus `grid.gap`. The tone→weight ramp
(`ink.weightRange`) maps ink to the available weights at or below the picked weight — an
ink-mapping behavior, not a sibling typography control.

Brand font: project fonts dropped in `public/fonts/` are registered as catalog-external
brand faces and become the default font. TTF/OTF preferred so outline SVG export works.

## Canvas / runtime

- `editable-output` sizing, default 1920x1080, `canvas.renderScale: true`.
- Uploads: `media.sourceImage` (dither source) and `media.shapeMask` (mask) as `fileDrop`
  controls; both render cover/crop inside current canvas bounds.
- No timeline (still product). No layers (single procedural foreground).
- Persistence: none (session tool; settings transfer covers presets).

## Renderer

Canvas 2D custom renderer, passes:

1. `source-sample` — decode + cover/crop source image to canvas-size ImageData (cached by
   asset/canvas/transform).
2. `mask-raster` — decode SVG/alpha-PNG mask to a canvas-size alpha map with feather and
   invert baked in (cached by asset/canvas/feather/invert).
3. `word-layout` — mode-specific placement producing `PlacedWord[]` (text, x, y, angle,
   ink, weight, opacity, highlight). Cached by tokens/grid/field/mask/typography inputs.
4. `word-draw` — batched `fillText` grouped by font weight; highlight rects underneath;
   `globalAlpha` per word.

Zoom/pan/drag never invalidate passes 1–3.

## Export

- PNG/JPG via `createToolcraftPngExportCanvas` with `Image Export` format + resolution
  (2K/4K/8K) selects; background include/color respected; format-gated footer actions.
- SVG export emits one placed `<text transform="translate(x y) rotate(a)">` element per
  word (no `<textPath>` — cross-renderer text-on-path layout is unreliable). Same layout
  data as the canvas preview, so export matches preview exactly.
- Outline toggle (`export.svg.text`: editable | outlines) converts words to `<path>`
  outlines with `text-shaper` when the font binary (brand font in `public/fonts/`) is
  available; otherwise falls back to editable text with a notice.

## Controls plan (sections)

1. Texture Mode — mode segmented (Dither/Flow), seed, Randomize action.
2. Words — word/data list (`code` multiline), word order (sequential/random).
3. Source Image — fileDrop, contrast, invert (dither ink inputs).
4. Ink Mapping — fade (opacity ramp) switch, weight range, sparsity (dither mode).
5. Tone Zones — enable switch, bands (2/3), band split rangeSlider, per-band word lists.
6. Word Grid (dither) — gap, jitter.
7. Flow Field (flow) — pattern, direction, scale, swirl, turbulence.
8. Flow Paths (flow) — edit switch, add/delete path actions, reach, strength.
9. Flow Words (flow) — density, word gap.
10. Typography — fontPicker.
11. Highlights — words text, coverage, marker color.
12. Shape Mask — fileDrop, invert, feather.
13. Background — Include + color (required row).
14. Image Export — format + resolution.
15. Export — sticky footer actions (format-gated Export/Copy).

Slider classification: seed/contrast/sparsity/weight range/gap/jitter/direction/scale/
swirl/turbulence/reach/strength/density/word gap/coverage/feather are stepped continuous
(no discrete markers). Bands (2/3) uses a `select`.

## Performance plan

- Workload targets: density (flow), grid gap (dither, lowers word count when raised —
  min value is the stress), sparsity, canvas size, export resolution, media import
  (1920x1080+ fixture), mask import, seed/pattern changes.
- Heavy baseline (`workloadFixture`): 3840x2160 canvas and/or 1920x1080 source media,
  long word list.
- Renderer strategy: Canvas 2D with measured evidence; text output preserves native
  fidelity (no low-res upscale). WebGL rejected: output is text glyphs (vector-output
  workload), per-pixel work is only slot sampling of a decoded ImageData.

## Defaults

- Mode: Flow. Seed 21.
- Words: maritime demo set from the user's brand direction (OCEAN TIDE CURRENT HARBOR
  DOCK CARGO SWELL NORTH...).
- Ink color: deep blue `#16324F` at 100% (brand system #2 ink-on-paper; deliberate
  deviation from the fontPicker `#FFFFFF` default, recorded in the worklog).
- Background: paper `#F5F2EC`, include on.
- Highlight color: marker yellow `#FFE14D` (reference 2), coverage 0 by default.
- Font: brand font when present in `public/fonts/`, otherwise IBM Plex Mono 400 at 14px,
  line height 1.4.
