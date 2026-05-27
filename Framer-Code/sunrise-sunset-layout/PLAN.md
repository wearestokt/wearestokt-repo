# Sunrise/Sunset Layout — Implementation Plan (Option B)

## Chosen Approach: Timezone + Representative City

- **No geolocation** — no permission prompt
- **Timezone** from `Intl.DateTimeFormat().resolvedOptions().timeZone`
- **Coordinates** from a mapping of timezone → representative city (e.g. `America/New_York` → NYC)
- **SunCalc** for real sunrise/sunset times for that location and date

## Architecture

```
User loads page
    → Override runs
    → getTimezone() → e.g. "America/New_York"
    → getCoordinatesForTimezone() → [40.71, -74.01]
    → getTimes(now, lat, lng) → { sunrise, sunset }
    → now >= sunrise && now < sunset ? Light : Dark
    → Component renders with variant={Light|Dark}
```

## Component Variants (Not Separate Pages)

- Single component with two variants: `Light` and `Dark`
- Override sets `variant` prop based on condition
- One URL, no redirect, better SEO

## Files

| File | Role |
|------|------|
| `SunriseSunsetOverride.tsx` | Code Override — applies to layout component |
| `timezoneCoordinates.ts` | Timezone → [lat, lng] mapping |
| `README.md` | Setup and usage |
| `PLAN.md` | This plan |

## Fallback

If SunCalc fails (CDN/network): use 6:00–18:00 local time heuristic.
