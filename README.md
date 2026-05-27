# Stokt Framer Code

Code snippets and overrides for Framer websites.

## Viewport Code Overrides (`withSvh.tsx`)

One file with two Code Override options. **Mobile only**—uses 100dvh on mobile, passthrough on desktop.

### Options

| Override | Mobile | Desktop | Use case |
|----------|--------|---------|----------|
| `withSvh` | 100dvh, scroll allowed | Passthrough | Full-height sections |
| `withSvhNoScroll` | 100dvh, scroll locked | Passthrough | Splash screens, fixed-height |

### Installation

1. In Framer: **Code** → **Create Code Override**
2. Name it `withSvh` (or copy the file into your Framer project)
3. Paste the contents of `withSvh.tsx`
4. Select a layer (Frame, section, Page)
5. **Properties** → **Code Overrides** → add the override you want

---

## Cookie Banner (`framer-code/cookie-banner/`)

Fully customizable cookie consent banner. CookieBanner wrapper + standalone button components (CookieAcceptButton, CookieRejectButton, CookieCustomizeButton, CookieCustomizePanel). Place buttons inside your own stack for full layout control—all show/hide together.

See [framer-code/cookie-banner/README.md](framer-code/cookie-banner/README.md) for installation and usage.

---

## Global Custom Code (`svh-mobile-viewport.html`)

Optional. Alternative approach for site-wide viewport fixes (not used by the override above).
