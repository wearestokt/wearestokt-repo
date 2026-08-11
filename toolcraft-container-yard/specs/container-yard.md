# Container Yard — Renderer Technique

## Renderer Technique Decision Matrix

| Field | Value |
| --- | --- |
| sourceRepresentation | image-media + procedural grid data |
| productRepresentation | pixel |
| previewRenderer | canvas-2d |
| exportRenderer | canvas-2d |
| rendererStrategy | canvas-2d |
| rendererWorkload | pixel-output |
| whyNotAlternativeStrategies | DOM/SVG live nodes for thousands of rectangles cause layout pressure; WebGL/WebGPU adds atlas complexity without improving SVG export/copy product-quality; text-output and vector-output strategies cannot represent ASCII block sampling. |
| fidelityRisks | Video seeking during export may soft-seek; alpha WebM varies by browser. |
| performanceRisks | Dense grids and per-playhead source decode are main-thread Canvas 2D workloads mitigated by cached layout/draw passes. |

## Renderer Layer Inventory

| Layer | kind | Renderer | Content | Export |
| --- | --- | --- | --- | --- |
| backgroundLayer | background | canvas-2d | composite | excluded when Include is off |
| productForegroundLayer | product-foreground | canvas-2d | geometry + dense-pattern | included in exportComposite |

## Render Pipeline Inventory

| Pass | cacheKey | Invalidated by | interaction |
| --- | --- | --- | --- |
| source-frame decode | media.sourceImage, canvas.size, timeline.currentTimeSeconds | media-import, control-change | media-import |
| yard-layout vector-build | yard layout targets, source-frame | control-change, control-drag, timeline-scrub, timeline-playback | control-drag |
| yard-draw rasterize preview | yard-layout, appearance.background, canvas.renderScale | control-change, control-drag | control-drag |
| yard-export | yard-layout, export.video.resolution | export | export |

Viewport zoom and viewport drag must not invalidate source-frame or yard-layout; animation-frame and timeline-playback invalidate yard-layout only.

## Rejected alternatives

- whyNotAlternativeStrategies: DOM/SVG preview nodes were rejected for workload on dense yards; WebGL/WebGPU deferred after measuredAlternativeEvidence showed Canvas 2D met preview-render stress under pixel-output workload while preserving exportRenderer canvas-2d export/copy product-quality.
- text-output and vector-output rendererWorkload alternatives cannot represent sampled ASCII blocks.
- export/copy and PNG/SVG export stay on canvas-2d for product-quality parity with preview.
