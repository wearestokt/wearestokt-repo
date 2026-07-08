# Flow Field — App Spec

Expressive flow texture generator for brand graphics. Produces still PNG/JPG/SVG
output of parallel curved arrow and line strokes along editable paths, with a
subtle procedural accent layer outside path reach. Path-driven ribbons are the
hero layer; the procedural field is accent only.

- Output: still image (PNG/JPG/SVG) + clipboard copy. No animation, timeline, or layers.
- Canvas sizing: `editable-output`, default 1920×1080, with runtime Resolution scale.
- Source: procedural + user-drawn paths; no upload.

## Control Selection Inventory

Every product control maps to a built-in Toolcraft control. No custom controls.

| Section | Control | Target | Type | Built-in fit |
| --- | --- | --- | --- | --- |
| Flow Paths | Edit paths | `paths.editMode` | switch | boolean |
| Flow Paths | Reach | `paths.reach` | slider | continuous scalar |
| Flow Paths | Thickness | `paths.thickness` | slider (px) | continuous size |
| Flow Paths | Length contrast | `paths.lengthContrast` | slider | continuous scalar |
| Flow Paths | Smoothness | `paths.smoothness` | slider | continuous scalar |
| Flow Paths | Add path | `paths.addPath` | actions | path CRUD |
| Flow Paths | Delete path | `paths.deletePath` | actions | path CRUD |
| Texture Accent | Preset | `flow.texturePreset` | select | off / calm / ripple |
| Texture Accent | Accent | `flow.textureAccent` | slider | sparse procedural weight |
| Texture Accent | Pattern | `flow.pattern` | select | finite mode choice |
| Texture Accent | Direction | `flow.direction` | slider (°) | continuous angle |
| Texture Accent | Frequency | `flow.frequency` | slider | continuous scalar |
| Texture Accent | Swirl | `flow.swirl` | slider | bipolar scalar |
| Texture Accent | Turbulence | `flow.turbulence` | slider | continuous scalar |
| Field Grid | Density | `field.density` | slider | continuous count (workload) |
| Field Grid | Jitter | `field.jitter` | slider | continuous scalar |
| Marker Style | Style | `marker.style` | select | arrow / line only |
| Marker Style | Length min | `marker.lengthMin` | slider (px) | continuous size |
| Marker Style | Length max | `marker.lengthMax` | slider (px) | continuous size |
| Marker Style | Thickness | `marker.thickness` | slider (px) | accent glyph weight |
| Marker Style | Color | `marker.color` | colorOpacity | color + alpha |
| Background | Include | `export.includeBackground` | switch | boolean |
| Background | (color) | `appearance.background` | color | single product color |
| Image Export | Format | `export.image.format` | select | png/jpg/svg |
| Image Export | Resolution | `export.image.resolution` | select | finite choice (workload) |

## Renderer Technique Decision Matrix

| Field | Decision |
| --- | --- |
| sourceRepresentation | `procedural-data` + user paths — stream ribbons from splines; sparse accent from noise field. |
| productRepresentation | `vector` — curved polylines with round caps and tangent-aligned arrowheads. |
| previewRenderer | `canvas-2d` — stroke polylines + accent glyph stamps. |
| exportRenderer | `canvas-2d` + SVG polylines — same geometry for preview/export parity. |
| rendererStrategy | `canvas-2d`. |
| rendererWorkload | `vector-output` — many short curved strokes along ribbons plus sparse accent markers. |
| whyNotAlternativeStrategies | Rotated grid stamps read as scientific charts; WebGL adds complexity without export benefit for static vector strokes. |
| fidelityRisks | Long strokes need sufficient arc subdivision (`paths.smoothness`); mitigated by Catmull-Rom sampling up to 128 points per segment. |
| performanceRisks | Stroke count scales with path length, smoothness, and parallel ribbon count; accent density bounded by `field.density` and `flow.textureAccent`. |

## Renderer Layer Inventory

Mirrors `app-performance.ts` `rendererTechnique.layers`.

- `flow-strokes` (product-foreground): path-driven curved ribbons and sparse accent glyphs. `kind: product-foreground`, canvas-2d, included in export, selector `[data-toolcraft-flow-canvas]`.

## Render Pipeline Inventory

`rendererPipeline` declares two passes and explicit interaction invalidation.

- Pass `stream-sample` (vector-build): subdivides paths, emits parallel ribbon strokes with length contrast, and sparse accent glyphs outside reach. cacheKey = paths + marker length range + field density + texture accent + canvas size.
- Pass `stroke-draw` (rasterize): draws strokes and accent glyphs with style/color/thickness. cacheKey adds marker style/color + render scale.

Interaction invalidation:

- `control-change` and `control-drag` rebuild `stream-sample` and/or `stroke-draw`.
- `viewport-zoom` and `viewport-drag` must NOT invalidate either pass — pan/zoom are CSS transforms on the canvas shell.
- `export` re-runs `stroke-draw` at export resolution; SVG uses `buildFlowFieldSvg` with the same stroke list.

## Flow Paths

- Multiple Catmull-Rom spline paths edited on-canvas in **Edit paths** mode.
- **Reach** sets how far path influence extends (up to 150%).
- **Thickness** sets ribbon stroke weight.
- **Length contrast** mixes super-short and super-long strokes along paths (tight curvature → shorter).
- **Smoothness** drives spline subdivision density for smooth curved ribbons.
- Path strokes are preview/edit overlays only (`FlowPathOverlay`); excluded from PNG/JPG/SVG export.

## Texture Accent

- **Preset** (`off`, `calm drift`, `soft ripple`) retunes frequency/swirl/turbulence for background variation.
- **Accent** scales sparse procedural markers outside path reach.
- When no paths exist, accent glyphs fill the canvas at reduced density.

## SVG Export

- `export.image.format: svg` routes export/copy through `buildFlowFieldSvg`.
- Ribbons export as `<polyline>` with round caps; arrowheads as terminal `<polygon>`.
- Accent glyphs export as transformed line/arrow groups.
- Resolution presets set SVG `viewBox` dimensions.

## Persistence Policy

Explicit: `persistence: { storage: "none" }`. Cross-session transfer via runtime Setup Export/Import Settings. Path data lives in `paths.data` for the session.

## Acceptance & Performance

Every visible control has an acceptance row and a performance scenario. Workload
coverage: `field.density`, `paths.smoothness`, `paths.lengthContrast`, and
`export.image.resolution`, each paired with a large-canvas workload baseline.
