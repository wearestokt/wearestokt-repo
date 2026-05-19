# Text on Stroke Ticker

Framer code component that repeats text along an SVG path (stroke), with native Framer font controls, text placement, stroke band styling, auto ticker, and scroll-linked motion.

## Setup in Framer

1. In your Framer project, add a new **Code** file (or paste from `TextOnStrokeTicker.tsx`).
2. Insert the **Text on Stroke Ticker** component on the canvas.
3. Size the frame to match your layout (recommended: fixed width/height).

## Path workflow

1. Draw a path with the Framer **Vector** tool (stroke only is fine).
2. Select the vector layer → **Copy as SVG**.
3. Open the component’s **Path data** control and paste either:
   - The full `<path d="...">` snippet, or
   - Only the `d` attribute value (e.g. `M 10 20 C ...`).
4. Adjust **Path fit** (Contain / Cover / Stretch) so the path fills the component frame.

The component cannot read path geometry from a linked canvas vector at runtime; pasted path data is the source of truth.

## Controls

| Control | Description |
|--------|-------------|
| **Path data** | SVG path `d` (or pasted SVG snippet) |
| **Show stroke** | Draw the colored stroke band along the path |
| **Stroke color** | Color of the stroke band **and** the component background |
| **Stroke width** | Thickness of the stroke band (px) |
| **Placement** | Text position relative to the path: **Up**, **Centered**, or **Below** |
| **Text** | String repeated along the path |
| **Text style** | Native Framer font control (family, size, weight, spacing, color) |
| **Repeat gap** | Extra space between repeats (px) |
| **Separator** | Characters between repeats (default ` · `) |
| **Padding** | Inset around the SVG |
| **Path fit** | How the path scales inside the frame |
| **Motion** | Auto ticker, or scroll (page / section / element) |
| **Loop duration** | Seconds for one full loop (Auto mode) |
| **Direction** | Forward or reverse along the path (auto and scroll modes) |
| **Play** | Pause Auto ticker |
| **Scroll range** | When scroll progress starts/ends (scroll modes) |
| **Scroll multiplier** | How far text travels per scroll distance |
| **Scroll selector** | CSS selector for a scroll container (Scroll element mode) |

## Stroke color and background

**Stroke color** drives both the visible path stroke and the component’s background fill. There is no separate background control — use **Stroke color** for the band color and **Stroke width** for how thick that band appears.

## Text placement

**Placement** offsets text perpendicular to the path:

- **Up** — text sits above the stroke centerline
- **Centered** — text follows the path centerline
- **Below** — text sits below the stroke centerline

Offset scales with font size and stroke width.

## Direction

A single **Direction** control (Forward / Reverse) sets motion along the path for both the auto ticker and scroll-linked modes. The old separate “Reverse” toggle has been removed.

## Motion modes

### Auto

Text moves continuously along the path. Pauses when off-screen and respects `prefers-reduced-motion`.

### Scroll page / section / element

Progress follows window scroll, a parent section, or a scrollable container. **Direction** still applies to how text moves along the path as you scroll.

## Files

- `TextOnStrokeTicker.tsx` — component and property controls
