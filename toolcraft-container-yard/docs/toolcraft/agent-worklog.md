# Implementation Worklog

## Status

Mode: product

Container Yard is a product Toolcraft app with keyframed layout animation, video-driven ASCII texture sampling, and alpha WebM/MOV export.

## Decision Trail

### Iteration 1 — Keyframed layout + video ASCII + alpha export

- Request: Drive ASCII from imported video on the Toolcraft timeline; animate layout/look with keyframes; export keyed texture as WebM alpha and optional ProRes MOV.
- Task type: schema + renderer + media + timeline/keyframes + export + acceptance/performance.
- User-visible result: Timeline keyframes diamonds on layout/look controls; ASCII accepts image/video; playhead samples video frames; Export Video produces WebM/MOV with Background Include controlling alpha.
- Source/reference checked: existing Container Yard still ASCII/matte path; Toolcraft contracts for Export Video + keyframes timeline; browser WebCodecs/ffmpeg.wasm constraints.
- Reference inputs: Container Yard ASCII/matte modules, Toolcraft keyframe evaluator, and browser WebCodecs/ffmpeg.wasm export constraints.
- Docs/contracts read: `workflow.md`, `schema-reference.md`, `component-rules.md`, `acceptance-testing.md`, `performance.md`, `assembly-workflow.md`.
- Contract rules applied: `timeline-mode-choice`, `timeline-enabled-behavior`, `output-export-required`, `renderer-technique-inventory`, `acceptance-product-observable`, `performance-coverage-levels`, `persistence-policy-explicit`, `workflow-required`.
- Decision: `panels.timeline.mode = "keyframes"` with 4s product-derived loop; extend local keyframe capability for yard select/switch/segmented except `yard.layoutType`; evaluate settings via `evaluateToolcraftTimelineValues`; video assets use blob object URLs; WebM prefers VideoEncoder+webm-muxer then ffmpeg fallback; MOV via lazy ffmpeg ProRes 4444; Include-off yields alpha keyed frames.
- Alternatives rejected: playback-only timeline (insufficient for layout animation); always-opaque video (blocks AE compositing); forcing base64 dataUrls for video (too large).
- State/output mapping: controls + keyframes → evaluated `yard.*` → `buildContainerYard`; `media.sourceImage` + `timeline.currentTimeSeconds` → source frame ImageData → ASCII colors/matte; export loop encodes evaluated frames at FPS.
- Files changed: `app-schema.ts`, `app-acceptance.ts`, `app-performance.ts`, `container-yard-renderer.tsx`, `container-yard-source-frame.ts`, `container-yard-video-export.ts`, `container-yard-panel-actions.ts`, `container-yard-ascii-video-sync.ts`, local runtime media/keyframe-capability patches, tests, worklog.
- Verification: `pnpm verify:quick`; acceptance name alignment; targeted unit and browser acceptance stubs for new mask/video/runtime rows.
- Skipped checks: None.
- Risks: Safari alpha WebM; ffmpeg.wasm download cost for MOV; seeking large videos on every export frame.

### Iteration 2 — ASCII silhouette matte clears closed white holes

- Request: B&W silhouette with defined white empty zones (including closed holes) still filled with ASCII.
- Task type: renderer / matte sampling bugfix (Tier 3).
- User-visible result: Auto/Both matte treats near-white empty pixels as non-subject even when enclosed; Min coverage default raised so fringe blocks drop out.
- Source/reference checked: `container-yard-source-matte.ts` flood-only auto path; user confirmation of white-bg / black-subject with interior holes.
- Reference inputs: User B&W silhouette with closed white holes.
- Docs/contracts read: `workflow.md`, `renderer-technique.md`.
- Contract rules applied: `acceptance-product-observable`, `controls-product-coverage`.
- Decision: Keep edge flood fill; for silhouette-like sources add color/luma empty mask that includes interior holes; raise matte tolerance and Min coverage default to 40%.
- Alternatives rejected: Alpha-only (opaque PNGs keep alpha=255); flood-only (cannot reach closed holes); treating every bright pixel in photo sources without silhouette gate.
- State/output mapping: `yard.matteStyle` auto/both → silhouette empty mask → `shouldSkipBlockForMatte` skips empty slots.
- Files changed: `container-yard-source-matte.ts`, `container-yard-math.ts`, `app-schema.ts`, `container-yard-acceptance.test.ts`, worklog.
- Verification: targeted unit tests for closed white holes + existing matte cases.
- Skipped checks: full browser perf — local matte sampling change only.
- Risks: High-contrast photos with bright borders may cut more aggressively; raise Min coverage further if fringe remains.

## Decisions

### Renderer

- Decision: Canvas 2D custom product renderer with evaluated settings + per-playhead source frames.
- Reason: Matches existing still ASCII path and SVG/PNG export helpers.
- Evidence: `container-yard-renderer.tsx`, `rendererPipeline` inventory.

### Timeline

- Decision: Keyframes timeline enabled; video import initializes duration once.
- Reason: User needs layout animation and Export Video transport.
- Evidence: `panels.timeline`, `animationIntent.mode = timeline-keyframes`.

### Layers

- Decision: No layers.
- Reason: Single product field.
- Evidence: `panels.layers` omitted.

### Controls

- Decision: Existing yard sections + Video Export; video/image fileDrop in ASCII mode.
- Reason: Product coverage for layout/look/export.
- Evidence: `starterControlSectionInventory`, schema sections.

### Export

- Decision: Export Video primary; PNG/SVG/JPG secondary. Format options: MP4 (browser baseline default per Toolcraft contract), WebM alpha (keyed), MOV ProRes 4444 (lazy ffmpeg). WebM/MOV honor Background Include for alpha; MP4 stays opaque.
- Reason: Client compositing deliverable plus contract-safe defaults.
- Evidence: sticky `panel.actions`, `container-yard-video-export.ts`.

### Performance

- Decision: Custom Canvas 2D workload matrix with media, drag, preview, keyframe viewport, animation-frame scenarios.
- Reason: Pixel-output + timeline/keyframes contracts.
- Evidence: `app-performance.ts`.

## Evidence

- Source reviewed: Container Yard ASCII matte/grid modules; Toolcraft keyframe evaluator hold interpolation for discrete values.
- Contract applied: animated Export Video requires top timeline; keyframe renderers must not read raw `state.values` for keyed targets.

## Verification

- Run: `pnpm verify:quick`
- Run: `pnpm exec vitest run src/app/app-acceptance.test.ts src/app/container-yard-acceptance.test.ts`
- Run: playwright-fallback browser performance checkpoint via `pnpm verify:perf`
- Fallback reason: no agent browser available in CI/non-agent automation.

## Risks

- Risk: Alpha WebM codec support is browser-dependent; MOV path requires network-loaded ffmpeg core.
- Risk: Local runtime patches for video import and discrete keyframes must be re-applied if the template runtime is refreshed.
