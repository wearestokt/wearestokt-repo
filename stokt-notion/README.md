# Stokt Notion Automation

This folder contains automation scripts for your Notion workspace.

## One-click setup (recommended)

See [ONE-CLICK-SETUP.md](ONE-CLICK-SETUP.md) for the full Notion button → Vercel → GitHub Actions flow.

## What this currently does

`seed-project-tasks.mjs` scans `Projects` for rows where:

- `Tasks Seeded` is unchecked
- `Name` is not `Project Template`

For each matching project, it:

1. Loads every row from `Task Templates`
2. Creates rows in `Tasks`
3. Names each task as: `Client Name - Template Task Name`
4. Links each task to the project
5. Sets `Projects -> Tasks Seeded = true`

## One-time setup

1. Create a Notion internal integration and copy its token.
2. Share these databases with the integration:
   - `Projects`
   - `Task Templates`
   - `Tasks`

## Run

```bash
cd stokt-notion
npm install
NOTION_TOKEN="secret_xxx" npm run seed-project-tasks
```

## Optional environment overrides

Defaults are prefilled to your current database IDs. You can override if needed:

- `NOTION_PROJECTS_DATABASE_ID`
- `NOTION_TASK_TEMPLATES_DATABASE_ID`
- `NOTION_TASKS_DATABASE_ID`

## Dry run

```bash
DRY_RUN=1 NOTION_TOKEN="secret_xxx" npm run seed-project-tasks
```
