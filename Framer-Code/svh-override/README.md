# SVH Mobile Height Override for Framer

On viewport ≤810px, sets a fixed-height container using the most accurate viewport calculation per browser. Content fits the visible area with no scroll. Works on Chrome, Safari, Firefox, and other mobile browsers.

## How It Works

1. **Viewport detection**: Uses `matchMedia("(max-width: 810px)")` — only applies on mobile.
2. **Height**: Uses `visualViewport.height` (primary), `window.innerHeight` (fallback), `100svh` (CSS fallback), and `-webkit-fill-available` (Safari).
3. **Updates on** (resize, orientationchange, visualViewport resize/scroll). **Scroll blocking**: Sets `overflow: hidden` on `body` so the page doesn’t scroll.

## Installation

### Manual setup (required)

**Do not use Code Sync** — overrides must be created in the Properties panel:

1. Select any layer on the canvas.
2. In the **Properties panel** (right), scroll to **Overrides**.
3. Under **File**, open the dropdown and choose **"New File..."**.
4. Name it `SvhOverride`.
5. Replace the default code with the full contents of `SvhOverride.tsx`.
6. Save. The file will appear in the File dropdown.

## Usage

1. Select the component on the canvas.
2. In the Properties panel → **Code Overrides**
3. Add `withSvh` from `SvhOverride`

## Browser Support

- **Chrome** (mobile): `visualViewport` API
- **Safari** (iOS): `visualViewport` + `-webkit-fill-available`
- **Firefox** (mobile): `visualViewport` API
- **Older browsers**: Falls back to `window.innerHeight` and `100svh`

## Breakpoint

Uses `max-width: 810px`. Edit `MOBILE_BREAKPOINT` in `SvhOverride.tsx` to change.
