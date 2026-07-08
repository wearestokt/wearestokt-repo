# Container Yard — Renderer Technique

## Renderer Technique Decision Matrix

| Field | Value |
| --- | --- |
| sourceRepresentation | procedural-data + optional uploaded image |
| productRepresentation | vector |
| previewRenderer | canvas-2d |
| exportRenderer | canvas-2d + SVG builder |
| rendererStrategy | canvas-2d |
| rendererWorkload | vector-output + optional image ASCII blocks |

## Renderer Layer Inventory

| Layer | Renderer | Content | Export |
| --- | --- | --- | --- |
| container-rects | canvas-2d | geometry | included |

## Render Pipeline Inventory

| Pass | Cache key inputs | Invalidated by | Runs on |
| --- | --- | --- | --- |
| grid-build | yard grid + layout type + seed | layout/color controls | main |
| radial-layout | layout type radial + ring params | radial layout controls | main |
| image-sample | media source + canvas size + transform | upload/transform/resize | main |
| dither-assign | image sample + block style + palette | dither + color controls | main |
| container-draw | grid-build + dither + shadow + background | shadow/background/render scale | main |

## Rejected alternatives

- DOM/SVG live preview nodes for thousands of rectangles cause layout pressure.
- WebGL/WebGPU deferred until measured CPU dither path fails declared stress fixtures.
- Separate image-derived palette rejected; dither maps into Container Colors palette blend.
