/**
 * Vercel serverless function: webhook for Notion "Seed tasks" button.
 * Validates token, then triggers GitHub Actions workflow to run task seeding.
 * Supports GET (for Notion button URL) and POST.
 */
function jsonResponse(body, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

export default {
  async fetch(request) {
  const url = new URL(request.url);
  const token = url.searchParams.get("token") || request.headers.get("x-webhook-token");
  const secret = process.env.WEBHOOK_SECRET;
  const ghToken = process.env.GITHUB_TOKEN;
  const ghRepo = process.env.GITHUB_REPO;

  if (!secret) {
    return jsonResponse({ error: "WEBHOOK_SECRET not configured" }, 500);
  }
  if (token !== secret) {
    return jsonResponse({ error: "Invalid or missing token" }, 401);
  }
  if (!ghToken || !ghRepo) {
    return jsonResponse({ error: "GITHUB_TOKEN or GITHUB_REPO not configured" }, 500);
  }

  const [owner, repo] = ghRepo.split("/");
  if (!owner || !repo) {
    return jsonResponse({ error: "GITHUB_REPO must be owner/repo" }, 500);
  }

  try {
    const response = await fetch(
      `https://api.github.com/repos/${owner}/${repo}/actions/workflows/seed-tasks.yml/dispatches`,
      {
        method: "POST",
        headers: {
          Accept: "application/vnd.github.v3+json",
          Authorization: `Bearer ${ghToken}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ ref: "main" }),
      }
    );

    if (!response.ok) {
      const text = await response.text();
      return jsonResponse({ error: "GitHub API error", detail: text }, response.status);
    }

    return jsonResponse({ ok: true, message: "Task seeding triggered" });
  } catch (err) {
    return jsonResponse({ error: err.message || "Failed to trigger workflow" }, 500);
  }
  },
};
