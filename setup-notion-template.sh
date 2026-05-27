#!/usr/bin/env bash
# Setup Notion Project Template — opens page and copies task table to clipboard

set -e
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_TEMPLATE_URL="https://www.notion.so/31dec98f96b981d7a683cd54d2c9bd2c"
TSV_FILE="${SCRIPT_DIR}/notion-tasks-paste.tsv"

echo "Project Template URL: ${PROJECT_TEMPLATE_URL}"
echo "(Open this in your browser if not already)"

if [[ -f "$TSV_FILE" ]]; then
  echo "Copying task table to clipboard..."
  cat "$TSV_FILE" | pbcopy
  echo ""
  echo "✓ Task table copied to clipboard (28 rows)"
  echo ""
  echo "Next steps:"
  echo "  1. Log in to Notion if prompted"
  echo "  2. On the Project Template page, add a new line and type: /table"
  echo "  3. Create a full-width table"
  echo "  4. Add 6 columns: Task Name, Service, Phase, Assigned To, Due Date, Status"
  echo "  5. Click the first data cell and paste (Cmd+V)"
  echo "  6. In the Tasks section, type /linked → Create linked database → select Tasks"
  echo "  7. Filter the linked database: Project contains [this page]"
else
  echo "TSV file not found: $TSV_FILE"
  exit 1
fi
