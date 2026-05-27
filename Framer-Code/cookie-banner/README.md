# Cookie Banner Framer Code Components

Fully customizable cookie consent banner for Framer. Fixed positioning, localStorage persistence, category toggles. Place button components inside your own stack for full layout control—all show/hide together.

## Installation

**Order matters** – Create `CookieBannerStore` first, then the main component and buttons.

### Code Sync (recommended)

Files are in `CookieBanner/` so they sync into a folder in Framer. **Important:** set Code Sync’s sync root to the **`cookie-banner`** folder (the parent of `CookieBanner`). If you sync from inside `CookieBanner/`, files will upload as flat.

- Sync root: `cookie-banner/` ✓  
- Paths: `CookieBanner/CookieBannerStore`, `CookieBanner/CookieBanner`, etc.

### Manual setup

1. **CookieBannerStore** – Create Code File → name it `CookieBanner/CookieBannerStore`. Paste from `CookieBanner/CookieBannerStore.tsx`. Use import `./CookieBannerStore.tsx` (extension required).

2. **CookieBanner** – Create Code File → name it `CookieBanner/CookieBanner`. Paste from `CookieBanner/CookieBanner.tsx`.

3. **Button components** – Create each with the folder prefix:
   - `CookieBanner/CookieAcceptButton`
   - `CookieBanner/CookieRejectButton`
   - `CookieBanner/CookieCustomizeButton`
   - `CookieBanner/CookieCustomizePanel`

4. **Add to Library** – Right-click each component → **Add to Library**. Components must be in the Library to drag onto the canvas.

5. **Insert on canvas** – From Assets → your Library, drag components onto the canvas. Or use the 3-dots menu → Insert to add them.

## Usage

1. Add **CookieBanner** to the canvas. Configure position, styling, Storage Key, Expiry Days in the Properties panel.

2. Add a **Frame** (stack) as `children` of CookieBanner. Connect it to the Content slot.

3. Inside that stack, add:
   - **Message** – Text or Frame with your cookie policy title and message
   - **CookieRejectButton** – Reject non-essential cookies
   - **CookieAcceptButton** – Accept all cookies
   - **CookieCustomizeButton** – Toggle the customize panel (optional)
   - **CookieCustomizePanel** – Category toggles (Essential, Analytics, Marketing) + Save button (optional)

4. Arrange and style each element. Each button and panel is independently selectable.

5. When consent is given, CookieBanner hides and the entire stack (message + buttons + panel) disappears.

## Components

### CookieBanner (wrapper)

Renders your stack inside a fixed container. When `showBanner` is false (consent given), returns null—everything inside hides.

| Control | Description |
|---------|-------------|
| Position | bottom, top, or corner presets |
| Background, Text Color, Padding | Container styling |
| Storage Key | localStorage key (default `cookie-consent`) |
| Expiry Days | Consent validity in days (0 = session only) |
| Content | Your stack (message + buttons + panel) |

### CookieAcceptButton

Triggers "Accept All" consent. Place inside your stack.

### CookieRejectButton

Triggers "Reject Non-Essential" consent. Place inside your stack.

### CookieCustomizeButton

Toggles the customize panel. Place inside your stack.

### CookieCustomizePanel

Shows when customize is expanded. Category toggles + Save Preferences. Place inside your stack.

## Cookie Categories

- **Essential** – Always on (required)
- **Analytics** – Toggle in Customize panel
- **Marketing** – Toggle in Customize panel

"Accept All" enables all categories. "Reject" keeps only essential. "Customize" expands toggles for analytics and marketing.

## Testing

To reset consent in the browser (e.g. for testing):

1. Open DevTools → Application → Local Storage
2. Remove the key matching your **Storage Key** (default `cookie-consent`)

Or run in console: `localStorage.removeItem("cookie-consent")`
