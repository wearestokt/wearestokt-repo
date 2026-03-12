# One-Click Task Seeding Setup

This guide configures the Notion button → Vercel webhook → GitHub Actions flow so anyone can seed project tasks with a single click.

## Architecture

1. **Notion**: Button on project template opens a URL
2. **Vercel**: Webhook validates token and triggers GitHub Actions
3. **GitHub Actions**: Runs the seeding script with `NOTION_TOKEN`

## Prerequisites

- Repo pushed to GitHub (e.g. `wearestokt/wearestokt-repo`)
- Vercel account
- Notion internal integration

---

## Step 1: GitHub secrets

1. In GitHub: **Settings** → **Secrets and variables** → **Actions**
2. Add secret: `NOTION_TOKEN` = your Notion integration token

---

## Step 2: Vercel deployment

1. Go to [vercel.com](https://vercel.com) and import this repo
2. Deploy (no build command needed for `/api` functions)
3. In **Settings** → **Environment Variables**, add:

   | Name            | Value                          |
   |-----------------|--------------------------------|
   | `WEBHOOK_SECRET`| Random string (e.g. from `openssl rand -hex 24`) |
   | `GITHUB_TOKEN`  | GitHub PAT with `repo` scope   |
   | `GITHUB_REPO`   | `owner/repo` (e.g. `wearestokt/wearestokt-repo`) |

4. Redeploy after adding env vars

---

## Step 3: Notion button

1. Open your **Project Template** page (or the template used for new projects)
2. Add a **Button** block
3. Set the button label to **Seed tasks**
4. Set **Open URL** to:

   ```
   https://YOUR_VERCEL_URL.vercel.app/api/seed-tasks?token=YOUR_WEBHOOK_SECRET
   ```

   Replace `YOUR_VERCEL_URL` and `YOUR_WEBHOOK_SECRET` with your values.

5. Save

---

## Usage

1. Create a new project (from template or manually)
2. Open the project page
3. Click **Seed tasks**
4. Tasks appear in the Tasks database within ~30–60 seconds

---

## Troubleshooting

- **401 Invalid token**: Check `WEBHOOK_SECRET` matches the `token` in the URL
- **500 GitHub API error**: Check `GITHUB_TOKEN` has `repo` scope and `GITHUB_REPO` is correct
- **Workflow not running**: Ensure the workflow file is on your default branch. If you use `master` instead of `main`, edit `api/seed-tasks.js` and change `ref: "main"` to `ref: "master"`.
