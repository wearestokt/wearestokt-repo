# Toolcraft Agent Worklog

## Status

Mode: product

Product: Flow Field 3.0 — art-grade pattern engine with probabilistic palettes, stroke size variety,
width-aware packed spacing, snap angles, radial field pattern, and shuffle workflow. PNG/JPG/SVG export.

## Decisions

### Renderer

- Decision: Canvas 2D custom renderer with `field-trace` and `stroke-draw` passes plus shared
  stroke geometry for preview and export parity.
- Reason: Variable-width streamline output scales on CPU; WebGL adds complexity without SVG export
  benefit.
- Evidence: `flow-field-renderer.tsx`, `flow-vector-field.ts`, `flow-streamline-math.ts`,
  `app-performance.ts` rendererPipeline.

### Timeline

- Decision: Do not enable timeline.
- Reason: Still-image product only; no video export or playback transport.
- Evidence: `appSchema.panels.timeline` is omitted; acceptance has no timeline rows.

### Layers

- Decision: Do not enable layers.
- Reason: Streamlines are one procedural foreground; no independent layer objects.
- Evidence: `appSchema.panels.layers` is omitted.

### Controls

- Decision: Sections Flow Paths → Field → Streams → Stroke → Color → Background → Image Export;
  texture presets retune field, spacing, size variety, and stream density via `TexturePresetSync`;
  palette presets sync background via `PalettePresetSync`.
- Reason: Product-entity grouping for art-grade controls; shuffle enables explore-then-refine workflow.
- Evidence: `src/app/app-schema.ts`, `starterControlSectionInventory` in `app-acceptance.ts`.

### Export

- Decision: SVG default with format-gated Export/Copy actions; PNG/JPG via standard Toolcraft helpers.
- Reason: Vector streamlines export cleanly as SVG; raster delivery uses runtime export helpers.
- Evidence: `src/routes/index.tsx`, `flow-field-svg-export.ts`, `output-export-required`.

### Performance

- Decision: Workload targets on density, packed spacing, size variety, field/path/stream sliders,
  stroke width-by-speed, head size, and export resolution; trace pass cached separately from stroke-draw.
- Reason: Packed mode with XL size classes is the new stress path; palette changes repaint only.
- Evidence: `src/app/app-performance.ts`, `e2e/flow-field-performance.spec.ts`.

## Decision Trail

### Iteration 7 — Flow Field 2.0 unified vector field + streamline engine

- Request: Replace parallel-offset ribbons and grid glyphs with unified vector field + RK4
  streamlines, stroke expressiveness, color ramps, and seed control.
- Task type: Architecture rewrite (Tier 4).
- User-visible result: Flow Paths, Field, Streams, Stroke, Stream Color, Background, and export
  controls driving one streamline field with tapered, ramp-colored strokes.
- Source/reference checked: Unified engine plan; NASA Perpetual Ocean / nullschool / Windy technique.
- Reference inputs: Prior Flow Field v1 code and attached 2.0 architecture plan.
- Docs/contracts read: `workflow.md`, `schema-reference.md`, `renderer-technique.md`,
  `acceptance-testing.md`, `performance.md`, `decision-contract.md`.
- Contract rules applied: runtime-shell-required, canvas-no-app-ui, controls-product-coverage,
  output-export-required, renderer-technique-inventory, performance-coverage-levels,
  acceptance-product-observable.
- Decision: `createVectorField()` + `traceStreamlines()` replace dual generators; variable-width
  geometry shared by Canvas 2D and SVG; trace cache keyed on field/paths/streams only.
- Alternatives rejected: Lane offsets + grid accents; WebGL tracing; animation in this pass.
- State/output mapping: `flow.*`, `paths.*`, `streams.*`, `stroke.*`, `color.*` → traced strokes →
  renderer / SVG export.
- Files changed: `flow-vector-field.ts`, `flow-streamline-math.ts`, `flow-stroke-geometry.ts`,
  `flow-color-ramp.ts`, `flow-field-renderer.tsx`, `flow-field-svg-export.ts`, `app-schema.ts`,
  tests and e2e specs.
- Verification: `pnpm test`, `pnpm build`, `pnpm test:browser`.
- Skipped checks: None for unit/build; full browser performance checkpoint not required for this
  post-first-working architecture rewrite.
- Risks: Streamline count scales with density² and canvas area at max workload fixtures.

### Iteration 8 — Flow Field 3.0 art-grade pattern engine

- Request: Upgrade to Fidenza/QQL-style palettes, size variety, packed collision spacing, snap
  angles, radial pattern, rectangle/hatch styles, and shuffle workflow.
- Task type: Product feature expansion (Tier 4).
- User-visible result: Palette presets with assignment modes, Spacing mode/Gap/Margin, Size variety,
  Snap angles, Radial pattern, Rectangle/Hatch styles, Shuffle action, Color section replacing ramps.
- Source/reference checked: Flow Field 3.0 plan; Fidenza/QQL/fieldplay technique research.
- Docs/contracts read: `workflow.md`, `schema-reference.md`, `renderer-technique.md`,
  `acceptance-testing.md`, `performance.md`.
- Contract rules applied: controls-product-coverage, output-export-required,
  renderer-technique-inventory, performance-coverage-levels, acceptance-product-observable.
- Decision: New `flow-palette.ts` with weighted presets; packed occupancy uses half-widths + gap;
  per-stroke size classes shorten XL/thick strokes; shuffle randomizes curated art parameters.
- Alternatives rejected: Keeping flat/ramp color model; centerline-only packed spacing without width.
- State/output mapping: `color.*`, `streams.spacingMode/gap/margin`, `stroke.sizeVariety`,
  `flow.snapAngles`, `flow.shuffle` → traced strokes with assigned colors and class widths → renderer.
- Files changed: `flow-palette.ts`, `flow-shuffle.ts`, `flow-streamline-math.ts`,
  `flow-vector-field.ts`, `flow-stroke-geometry.ts`, `flow-field-renderer.tsx`, `app-schema.ts`,
  tests, e2e, worklog.
- Verification: `pnpm build` passed; flow unit tests passed (`flow-palette`, `flow-field-acceptance`,
  `flow-field-performance`, `app-schema`, `app-performance`); `pnpm test:browser` flow-field acceptance
  41/41 passed; Palette section trimmed to 8 controls (equal custom weights) for section validator.
  Shuffle applies seed immediately and defers packed spacing/size variety via `FlowShuffleTailSync`.
  Canvas preview uses `useDeferredValue` + `useMemo` for heavy retraces.
- Skipped checks: Full `pnpm test` suite OOM on full `vitest run src` in agent environment; full browser
  performance checkpoint not required for post-first-working feature expansion.
- Risks: Packed + max density + XL variety is the heaviest trace path; measured via perf scenario.

## Evidence

- Source reviewed: `flow-vector-field.ts`, `flow-streamline-math.ts`, unified engine plan.
- Contract applied: renderer-technique-inventory, performance-coverage-levels,
  acceptance-product-observable.

## Verification

- Run: `pnpm build` — passed
- Run: targeted vitest — `flow-palette`, `flow-field-acceptance`, `flow-field-performance`,
  `app-schema`, `app-performance` passed
- Run: `pnpm test:browser` — `e2e/flow-field-acceptance.spec.ts` 41 passed
- Skipped: full `pnpm test` / `pnpm verify:final` (OOM on monolithic vitest in agent run); full perf
  checkpoint not required for post-first-working iteration

## Risks

- Risk: Max density + max smoothness on 4K canvas can spike trace time; mitigated by hard limits
  and trace cache.
- Risk: Path-dependent browser tests rely on `window.__toolcraftSeedFlowPath` dev API.
