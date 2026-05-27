# Notion Project Template — Per-Project Task Database

## What Was Created

**Project Template** page in your Notion workspace:
- **URL**: https://www.notion.so/31dec98f96b981d7a683cd54d2c9bd2c
- **Location**: Under your Database page (same parent as Active Projects, Tasks, Clients, Deals)
- **Embedded Tasks database**: 28 tasks with Name, Service, Phase, Assigned To, Due Date, Status, Excluded

## Template Structure

| Section | Purpose |
|---------|---------|
| Overview | Status, Client/Stakeholder, one-liner |
| Goals | Bulleted success criteria |
| Timeline | Key dates |
| Tasks | Embedded database (duplicated with template) |
| Risks & Blockers | What could derail |
| Resources | Links, docs |
| Notes | Ad-hoc updates |

## Per-Project Task Database

Each project has its **own** Tasks database, embedded inside the project page. When you duplicate the Project Template, the Tasks database is duplicated too — including all 28 tasks.

### Schema

- **Name**, **Service**, **Phase**, **Assigned To**, **Due Date**, **Status**, **Excluded**

### Service Filter Logic

- **Keep task** when `task.Service` is in `project.Services`
- **Exclude task** when `task.Service` is not in `project.Services` (marked via Excluded checkbox)

Example: Project has Services = [Web Design, Web Dev]. Task with Service = "Web Design" → keep. Task with Service = "Branding" → exclude.

### Service Values

Must match Active Projects **Services** multi_select: `Branding`, `Web Design`, `Web Dev`, `Motion Design`.

- **Project Master** tasks are excluded (handled in a later Onboarding process)
- **QA (UserBack)** is excluded for now

## How to Use

### 1. Duplicate the Project Template

- Duplicate the Project Template page (or use it as an Active Projects template)
- Rename it for your project
- Set the project's **Services** (Branding, Web Design, Web Dev, Motion Design)

### 2. Run Clean Up

Run: **"Clean up project tasks for [project name]"**

The `clean-up-project-tasks` skill will mark tasks that don't match the project's Services as **Excluded**.

### 3. Add View Filter (Manual)

Add a filter to the Tasks view: **Excluded** **is not checked** — so only relevant tasks are visible.

## How to Use (Options)

### Option A: As a Database Template (Recommended)

1. Open **Active Projects**
2. Click the **▼** next to "New" → **New template**
3. Copy the content from Project Template into this new template (or duplicate the Project Template page and move its content)
4. When creating new projects, choose this template from the dropdown
5. Set Services, then run "Clean up project tasks for [project]"

### Option B: Duplicate for Standalone Projects

1. Duplicate the Project Template page
2. Rename it for your project
3. Set Services
4. Run "Clean up project tasks for [project]"
5. Add filter "Excluded is not checked" to the Tasks view

### Option C: Apply to Existing Project Pages

When you have a new project in Active Projects with a blank page:

```
"Apply the Project Template to [project page URL]"
```

The AI can use `notion-update-page` with `apply_template` and the template page ID.

## Verified

- **Project Template** has embedded Tasks database with 28 tasks
- **Task Library** has been deleted (moved to trash)
- **Active Projects** has Name, Client, Deal, Services, Status, Budget, Tasks
- **Central Tasks database** (collection://31dec98f-96b9-8158-8172-000b86dcccc5) remains for backward compatibility; new projects use the embedded model

## Next: Phase 2

When ready, add linked views for Clients, Specs, Meetings, or other databases. See the plan at `.cursor/plans/notion_project_page_template_*.plan.md`.
