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

### Iteration 3 — Invert matte for ASCII polarity

- Request: Black-on-white and white-on-black sources produced the same ASCII cutout; need Invert mask toggle.
- Task type: schema + matte behavior (Tier 2).
- User-visible result: App Mode shows Invert mask under Min coverage; toggling flips subject vs empty in the same matte. Source upload lives in Source so App Mode stays within the section control limit.
- Source/reference checked: `container-yard-source-matte.ts` subject mask build; user polarity complaint.
- Reference inputs: User black-on-white and white-on-black ASCII source images.
- Docs/contracts read: `workflow.md`, `schema-reference.md`, `component-rules.md`.
- Contract rules applied: `controls-product-coverage`, `acceptance-product-observable`, `performance-coverage-levels`.
- Decision: Add `yard.matteInvert` switch (default off); invert final subject mask after alpha/auto detection so one matte path serves both polarities.
- Alternatives rejected: Auto-only polarity detection without manual override; separate invert for dither tones only (`ditherInvert` already exists and does not flip placement).
- State/output mapping: `yard.matteInvert` → `SourceMatteSettings.invert` → flipped `subjectMask` → `shouldSkipBlockForMatte`.
- Files changed: schema, matte, math, renderer, layout types, acceptance/perf/e2e, worklog.
- Verification: `pnpm verify:quick` (docs/integrity + 376 unit tests); invert unit coverage for subject/empty flip.
- Skipped checks: Playwright browser acceptance — Chromium binary missing locally (`playwright install` needed); full perf not required for this control-only pass.
- Risks: Invert with matte Off has no effect (expected); users with saved sessions keep Invert false until toggled.

### Iteration 4 — Unstick Export Video

- Request: Export Video always froze while encoding.
- Task type: export bugfix (Tier 3).
- User-visible result: Default MP4 export uses the browser encoder first; stalled ffmpeg/WebCodecs/MediaRecorder/source-seek paths time out and alert instead of hanging.
- Source/reference checked: `container-yard-video-export.ts` MP4 path; `waitForVideoSeek` missing seeked timeout.
- Docs/contracts read: `workflow.md`, `component-rules.md`, `acceptance-testing.md`.
- Contract rules applied: `output-export-required`.
- Decision: Prefer MediaRecorder for MP4 (ffmpeg.wasm last); timeout encoder flush, recorder stop, ffmpeg load/exec, and source video seeks; yield between frames so progress can update.
- Alternatives rejected: Keep ffmpeg-first MP4 (CDN/WASM freeze); leave seeked wait unbounded.
- State/output mapping: Export Video → native MP4 when supported, otherwise timed ffmpeg/WebM fallbacks.
- Files changed: `container-yard-video-export.ts`, `container-yard-source-frame.ts`, acceptance tests, worklog.
- Verification: `pnpm verify:quick`.
- Skipped checks: Full browser perf; Playwright Chromium not required for this encoder-order/timeout pass.
- Risks: Safari/Firefox MP4 MIME support varies; MOV still needs ffmpeg and can fail with a timeout alert if the WASM core is blocked.

### Iteration 5 — Export Video percent and time estimate

- Request: Show where video export is so it does not look frozen.
- Task type: sticky footer progress UI (Tier 1).
- User-visible result: While Export Video runs, the sticky footer shows percent done and remaining time (for example `42% · 1m 10s left`) above the actions, plus the existing accent bar.
- Source/reference checked: sticky footer accent indicator in `panel-surface.tsx`; `reportProgress` 0..1 contract.
- Docs/contracts read: `workflow.md`, `component-rules.md`.
- Contract rules applied: `output-export-required`.
- Decision: Keep determinate `reportProgress`; derive remaining time from elapsed vs percent; never let fallback encoders jump the bar backward.
- Alternatives rejected: Canvas overlay (product canvas cannot host app UI); changing Export Video button label (breaks footer action identity).
- State/output mapping: frame/encode `onProgress` → monotonic `reportProgress` → footer `%` and ETA.
- Files changed: `panel-surface.tsx`, `container-yard-panel-actions.ts`, manifest hash, worklog.
- Verification: integrity hash refresh for the local runtime patch.
- Skipped checks: Full browser perf; progress chrome only.
- Risks: Early ETA is coarse until ~5% progress; fallback encoder switches keep the bar from going backward so remaining time can pause until the next advance.

### Iteration 6 — Timestamped MP4, stable cell color, higher bitrate

- Request: 15s export became 6 minutes; container colors flickered every frame; export looked very low quality.
- Task type: export + color assignment bugfix (Tier 3).
- User-visible result: MP4 uses WebCodecs timestamps so timeline duration is preserved; Random/Palette colors stay locked to grid cells and sampled pixels; encode bitrate raised.
- Source/reference checked: MediaRecorder wall-clock pacing; `resolveContainerColor` sequential rng; luminance palette bins.
- Docs/contracts read: `workflow.md`, `component-rules.md`.
- Contract rules applied: `output-export-required`.
- Decision: MP4 prefers VideoEncoder + mp4-muxer; Random hashes by col/row; Palette nearest-RGB then seed shuffle; bitrate at least 16 Mbps.
- Alternatives rejected: Realtime MediaRecorder (ASCII cannot render 24fps, so duration stretches); keep luminance bins (flicker on moving samples).
- State/output mapping: timeline duration → frame timestamps; slot col/row + sampled RGB → stable color; bitrate helper → encoder config.
- Files changed: `container-yard-video-export.ts`, `container-yard-math.ts`, `container-yard-dither.ts`, tests, worklog, `mp4-muxer` dependency.
- Verification: targeted acceptance for spatial color lock; typecheck when available.
- Skipped checks: Full browser perf; encode-path correctness over budget suite.
- Risks: Some browsers lack AVC WebCodecs and fall back to ffmpeg or MediaRecorder; last-resort MediaRecorder can still stretch duration.

### Iteration 7 — Grid-locked cell colors on video

- Request: Exported heron clip looks like color noise; each container cell should keep one color for the whole video.
- Task type: ASCII color assignment (Tier 2).
- User-visible result: Imported video only cuts the silhouette. Cell fill comes from the Color Pattern grid (row/col + seed) and does not resample the moving footage.
- Source/reference checked: user export `container-yard (3).mp4` (15s, 3840x2160, 24fps); frames show four-color mosaic reshuffling on the heron.
- Docs/contracts read: `workflow.md`.
- Contract rules applied: `acceptance-product-observable`.
- Decision: `lockCellColorsToGrid` when the source is video; Image Mix still samples still photos.
- Alternatives rejected: Keep per-frame palette sampling (that is the noise); hide Image Mix (still photos still need it).
- State/output mapping: video frame → matte only; `slot.row`/`slot.col` + seed → cell color for every frame.
- Files changed: layout types, math, renderer, schema Image Mix description, acceptance test, worklog.
- Verification: unit test that different interior fills keep the same cell colors when locked.
- Skipped checks: Full browser perf.
- Risks: Video exports ignore Image Mix by design; still-image ASCII can still sample photos.

### Iteration 8 — Stop silhouette video from resampling fill

- Request: `container-yard (4).mp4` still has mosaic colors swapping at fixed canvas cells.
- Task type: ASCII color assignment (Tier 2).
- User-visible result: Silhouette and video ASCII keep Color Pattern fills. Image Mix samples still photos only when Subject matte is Off.
- Source/reference checked: user export `container-yard (4).mp4`; prior lock flag still allowed sampling when video detection missed or Image Mix was on.
- Docs/contracts read: `workflow.md`.
- Contract rules applied: `acceptance-product-observable`, `workflow-required`.
- Decision: Opt-in `sampleImageColors`; default fill is spatial grid hash in unscaled canvas cells; Random Gaps on ASCII uses cell hash instead of sequential RNG; `patternNoise` includes row.
- Alternatives rejected: Keep video-detect lock only (false negatives still sampled each frame).
- State/output mapping: matte on or video source → fill from grid col/row + seed; Image Mix + matte Off + still image → sampled fill.
- Files changed: math, layout types, ascii layout, renderer, schema Image Mix copy, acceptance test, worklog.
- Verification: targeted `container-yard-acceptance.test.ts`.
- Skipped checks: Full browser perf; not a first-working or perf complaint pass.
- Risks: Photo-texture ASCII now requires Subject matte Off; existing sessions with matte Both and Image Mix > 0 will stop sampling until matte is Off.

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

- Decision: Existing yard sections + Source (ASCII upload) + Video Export; Invert mask under App Mode matte controls.
- Reason: Product coverage for layout/look/export; invert polarity without auto-detecting source ink.
- Evidence: `starterControlSectionInventory`, schema sections.

### Export

- Decision: Export Video primary; PNG/SVG/JPG secondary. Format options: MP4 (WebCodecs + mp4-muxer timestamps, ffmpeg then MediaRecorder fallback), WebM alpha (WebCodecs then MediaRecorder), MOV ProRes 4444 (lazy ffmpeg with timeouts). High bitrate (~16 Mbps+). WebM/MOV honor Background Include for alpha; MP4 stays opaque.
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
