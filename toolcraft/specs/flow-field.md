# Flow Field — App Spec

Art-directable vector-field graphic generator. Produces a still PNG of directional
markers laid across a procedurally generated flow field. Evokes scientific
ocean-current charts (see reference plates) but is fully art-directed: pattern,
direction, frequency, swirl, turbulence, grid density, marker style, size, color,
and background are all user-controlled.

- Output: still image (PNG/JPG/SVG) + clipboard copy. No animation, timeline, or layers.
- Canvas sizing: `editable-output`, default 1920×1080, with runtime Resolution scale.
- Source: procedural; no upload.

## Control Selection Inventory

Every product control maps to a built-in Toolcraft control. No custom controls.

| Section | Control | Target | Type | Built-in fit |
| --- | --- | --- | --- | --- |
| Flow Field | Pattern | `flow.pattern` | select | finite mode choice |
| Flow Field | Direction | `flow.direction` | slider (°) | continuous angle |
| Flow Field | Frequency | `flow.frequency` | slider | continuous scalar |
| Flow Field | Swirl | `flow.swirl` | slider | bipolar scalar |
| Flow Field | Turbulence | `flow.turbulence` | slider | continuous scalar |
| Flow Guides | Edit guides | `guides.editMode` | switch | boolean |
| Flow Guides | Linear only | `guides.maskUninfluenced` | switch | boolean |
| Flow Guides | Influence | `guides.influence` | slider | continuous scalar |
| Flow Guides | Reach | `guides.reach` | slider | continuous scalar |
| Flow Guides | Add path | `guides.addPath` | actions | path CRUD |
| Flow Guides | Delete path | `guides.deletePath` | actions | path CRUD |
| Field Grid | Density | `field.density` | slider | continuous count (workload) |
| Field Grid | Jitter | `field.jitter` | slider | continuous scalar |
| Marker Style | Style | `marker.style` | select | finite mode choice |
| Marker Style | Length | `marker.length` | slider (px) | continuous size |
| Marker Style | Thickness | `marker.thickness` | slider (px) | continuous size |
| Marker Style | Color | `marker.color` | colorOpacity | color + alpha for one entity |
| Background | Include | `export.includeBackground` | switch | boolean |
| Background | (color) | `appearance.background` | color | single product color |
| Image Export | Format | `export.image.format` | select | png/jpg/svg |
| Image Export | Resolution | `export.image.resolution` | select | finite choice (workload) |

## Renderer Technique Decision Matrix

| Field | Decision |
| --- | --- |
| sourceRepresentation | `procedural-data` — flow field sampled from noise/analytic equations; no imported media. |
| productRepresentation | `vector` — discrete directional glyphs (triangles, arrows, lines) at grid points. |
| previewRenderer | `canvas-2d` — immediate-mode fills/strokes for thousands of glyphs. |
| exportRenderer | `canvas-2d` — same `drawFlowField` pass at export resolution for preview/export parity. |
| rendererStrategy | `canvas-2d`. |
| rendererWorkload | `vector-output` — many small filled/stroked polygons per frame. |
| whyNotAlternativeStrategies | DOM/SVG nodes for thousands of glyphs cause layout/GC pressure and slow export rasterization; WebGL/WebGPU is overkill for static vector-output fills and complicates pixel-accurate PNG export. Canvas 2D gives the best vector-output throughput with identical preview and export/copy product-quality output. |
| fidelityRisks | Thin strokes need device-pixel-ratio × render-scale backing to stay crisp; mitigated by `canvas.renderScale` and a scaled backing store. |
| performanceRisks | Glyph count grows with the square of `field.density` and with canvas area; mitigated by caching the sampled field (field-sample pass) and only re-rasterizing on style changes, plus a density hard limit. Export at 8K rasterizes the most glyphs; measured in the export-copy scenario. |

The export/copy path reuses the same vector-output draw so product-quality output
matches the preview; `exportRenderer` is `canvas-2d`.

## Renderer Layer Inventory

Mirrors `app-performance.ts` `rendererTechnique.layers`.

- `flow-markers` (product-foreground): the directional glyph geometry. `kind: product-foreground`, content geometry, high primitive count, canvas-2d, included in export, selector `[data-toolcraft-flow-canvas]`. There is no dense raster background layer; the optional product background is a single flat fill behind the foreground, so semantic foreground geometry is never rasterized into an opaque background.

## Render Pipeline Inventory

`rendererPipeline` declares two passes and explicit interaction invalidation.

- Pass `field-sample` (vector-build): samples the flow angle + speed for every grid
  cell, blending guide spline tangents by proximity when guides exist. cacheKey =
  flow pattern/direction/frequency/swirl/turbulence + field density/jitter +
  guides.paths/influence/reach/maskUninfluenced + canvas size.
- Pass `glyph-draw` (rasterize): draws the cached glyphs with the current marker
  style/length/thickness/color and background. cacheKey adds marker style/size/color + canvas size + render scale.

Interaction invalidation:

- `control-change` and `control-drag` rebuild `field-sample` and/or `glyph-draw`.
- `viewport-zoom` and `viewport-drag` must NOT invalidate either pass — pan/zoom are
  CSS transforms on the canvas shell, so the rasterized field is reused.
- `export` re-runs `glyph-draw` at export resolution.

- `export` re-runs `glyph-draw` at export resolution; SVG export uses
  `buildFlowFieldSvg` with the same glyph list at the selected resolution.

## Flow Guides

- Multiple Catmull-Rom spline paths edited on-canvas in **Edit guides** mode.
- **Influence** and **Reach** blend guide tangents into the procedural field by proximity.
- **Linear only** culls markers outside guide reach for path-following ribbons.
- Guide strokes are preview/edit overlays only (`FlowGuideOverlay`); excluded from PNG/JPG/SVG export.

## SVG Export

- `export.image.format: svg` routes export/copy through `buildFlowFieldSvg`.
- Each marker is a transformed SVG path/group; optional background `<rect>` when Include is on.
- Resolution presets set SVG `viewBox` dimensions (vector scales cleanly).

Workload targets `field.density` and `export.image.resolution` appear in the
interaction-invalidation references.

## Persistence Policy

Explicit: `persistence: { storage: "none" }`. This is a graphic-generation tool;
each session starts from schema defaults. Cross-session transfer is handled by the
runtime Setup `Export Settings` / `Import Settings`, not localStorage. No reload
restoration test is required.

## Acceptance & Performance

Every visible control has an acceptance row and a performance scenario. Workload
coverage: `field.density` (grid density, control-drag) and
`export.image.resolution` (export size, control-change), each paired with a
large-canvas workload baseline. Renderer scenarios cover preview-render,
viewport-stability, viewport-zoom stress, and export-copy.
