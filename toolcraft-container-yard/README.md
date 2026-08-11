# Container Yard

Standalone Toolcraft app for the Container Yard pattern generator.

## Run

```bash
pnpm install
pnpm dev
```

Dev server picks the next free port from 3002 and saves it in `.toolcraft/server-port.json`.

## Deploy (Vercel)

1. Import this repo in [Vercel](https://vercel.com/new)
2. Framework: Vite · Install: `pnpm install` · Build: `pnpm build` · Output: `dist`
3. Deploy and share the production URL

`vercel.json` is included so those settings apply automatically.

## Verify

```bash
pnpm typecheck
pnpm build
pnpm verify:quick
pnpm test:browser
```
