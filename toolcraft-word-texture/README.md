# Toolcraft Starter Template

This folder is the **neutral Toolcraft starter template** — canvas upload plus toolbar, no product controls, renderer, timeline, or export behavior.

**Do not wire product apps here.** Implement products in sibling folders (`toolcraft-flow-field/`, `toolcraft-container-yard/`, etc.).

## Product Apps

Each Toolcraft product lives in its own standalone folder at the repo root:

| Folder | Product | Status |
| --- | --- | --- |
| [`toolcraft-flow-field/`](../toolcraft-flow-field/) | Flow Field 3.0 | Wired product app |
| [`toolcraft-container-yard/`](../toolcraft-container-yard/) | Container Yard | Fully wired product app |

## Run a Product App

```bash
cd toolcraft-flow-field   # or toolcraft-container-yard
pnpm install
pnpm dev
```

Each app picks its own port (default starting at 3002) and saves it in `.toolcraft/server-port.json`.

## Generate a New App

Copy this starter folder to a new sibling directory, rename the package in `package.json`, and implement the product in `src/app/`.
