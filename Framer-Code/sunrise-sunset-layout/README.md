# Sunrise/Sunset Layout Override for Framer

Switches between Light and Dark component variants based on real sunrise/sunset times for the user's timezone. **No geolocation permission required** — uses `Intl.DateTimeFormat().resolvedOptions().timeZone` plus a representative city for that timezone.

## How It Works

1. Gets the user's timezone (e.g. `America/New_York`)
2. Maps it to representative coordinates (e.g. New York City)
3. Uses [SunCalc](https://github.com/mourner/suncalc) to compute today's sunrise/sunset for that location
4. Compares current time → sets `variant="Light"` when sun is up, `variant="Dark"` when sun is down

## Installation

### Manual setup (required)

**Do not use Code Sync** — it uploads to Code Components. Overrides must be created in the Properties panel:

1. Select any layer on the canvas.
2. In the **Properties panel** (right), scroll to **Overrides**.
3. Under **File**, open the dropdown and choose **"New File..."**.
4. Name it `SunriseSunsetOverride`.
5. Replace the default code with the full contents of `SunriseSunsetOverride.tsx`.
6. Save. The file will appear in the File dropdown.


## Usage

1. **Create a component** with two variants:
   - `Loading-Day` — shown when the sun is up
   - `Loading-Night` — shown when the sun is down

2. **Apply the override** to that component:
   - Select the component on the canvas
   - In the Properties panel → **Code Overrides**
   - Add `withSunriseSunset` from `SunriseSunsetOverride`

3. **Custom variant names?** Edit the constants at the top of `SunriseSunsetOverride.tsx`:

   ```ts
   const lightVariant = "YourLightVariantName"
   const darkVariant = "YourDarkVariantName"
   ```

## Files

| File | Purpose |
|------|---------|
| `SunriseSunsetOverride.tsx` | Main override — self-contained, applies to your layout component |
| `timezoneCoordinates.ts` | Optional reference — coordinates are inlined in the override |
| `README.md` | This file |

## Fallback

If the sun calculation fails, the override falls back to a simple heuristic: **Light** from 6:00–18:00 local time, **Dark** otherwise.

## Override not showing in the panel?

If the file was added via Code Sync or the left Code panel, it is in the wrong place. Framer treats those as Components. Override files must be created via **Properties panel, Overrides, File, New File**. Follow the Manual setup steps above.

## Timezone Coverage

The mapping includes major cities in Americas, Europe, Asia, Australia, Pacific, and Africa. Unmapped timezones use region-based defaults (e.g. `America/*` → US center).
