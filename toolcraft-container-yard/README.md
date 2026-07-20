# Container Yard

Standalone Toolcraft app for the Container Yard pattern generator.

## Run

```bash
pnpm install
pnpm dev
```

Dev server picks the next free port from 3002 and saves it in `.toolcraft/server-port.json`.

## Verify

```bash
pnpm typecheck
pnpm build
pnpm verify:quick
pnpm test:browser
```
