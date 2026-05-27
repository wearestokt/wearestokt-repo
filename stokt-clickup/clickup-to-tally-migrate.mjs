#!/usr/bin/env node
/**
 * ClickUp Forms → Tally Migration
 * Discovers ClickUp forms in Stokt workspace, extracts structure, recreates in Tally.
 */
import { randomUUID } from "crypto";

const CLICKUP_TOKEN = process.env.CLICKUP_API_KEY;
const TALLY_TOKEN = process.env.TALLY_API_KEY;
const CLICKUP_TEAM_ID = process.env.CLICKUP_TEAM_ID || "9011203786";
const DRY_RUN = process.env.DRY_RUN === "1";
const FROM_SPEC = process.env.FROM_SPEC === "1";

if (!CLICKUP_TOKEN && !FROM_SPEC) {
  console.error("Missing CLICKUP_API_KEY (or set FROM_SPEC=1 to use existing spec)");
  process.exit(1);
}
if (!TALLY_TOKEN && !DRY_RUN) {
  console.error("Missing TALLY_API_KEY (or set DRY_RUN=1 for discovery only)");
  process.exit(1);
}

const CLICKUP_BASE = "https://api.clickup.com/api/v2";
const TALLY_BASE = "https://api.tally.so";

async function clickup(path, method = "GET") {
  const res = await fetch(`${CLICKUP_BASE}${path}`, {
    method,
    headers: { Authorization: CLICKUP_TOKEN },
  });
  if (!res.ok) throw new Error(`ClickUp ${res.status}: ${await res.text()}`);
  return res.json();
}

async function tally(path, body, method = "POST") {
  const res = await fetch(`${TALLY_BASE}${path}`, {
    method,
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${TALLY_TOKEN}`,
    },
    body: body ? JSON.stringify(body) : undefined,
  });
  if (!res.ok) throw new Error(`Tally ${res.status}: ${await res.text()}`);
  return res.json();
}

function uuid() {
  return randomUUID();
}

async function getSpaces() {
  const data = await clickup(`/team/${CLICKUP_TEAM_ID}/space`);
  return data.spaces || [];
}

async function getFolders(spaceId) {
  const data = await clickup(`/space/${spaceId}/folder`);
  return data.folders || [];
}

async function getFolderLists(folderId) {
  const data = await clickup(`/folder/${folderId}/list`);
  return data.lists || [];
}

async function getFolderlessLists(spaceId) {
  const data = await clickup(`/space/${spaceId}/list`);
  return data.lists || [];
}

async function getListViews(listId) {
  try {
    const data = await clickup(`/list/${listId}/view`);
    return data.views || [];
  } catch {
    return [];
  }
}

async function getTeamViews() {
  try {
    const data = await clickup(`/team/${CLICKUP_TEAM_ID}/view`);
    return data.views || [];
  } catch {
    return [];
  }
}

async function getView(viewId) {
  return clickup(`/view/${viewId}`);
}

async function getListCustomFields(listId) {
  try {
    const data = await clickup(`/list/${listId}/field`);
    return data.fields || [];
  } catch {
    return [];
  }
}

async function getList(listId) {
  return clickup(`/list/${listId}`);
}

/** Extract numeric prefix (e.g. "1.4", "2.2") from field name for ordering. Returns [section, sub] or [999, 999] if none. */
function getQuestionOrder(name) {
  const m = String(name || "").match(/^(\d+)\.(\d+)\s/);
  if (m) return [parseInt(m[1], 10), parseInt(m[2], 10)];
  const m2 = String(name || "").match(/^(\d+)\.\s/);
  if (m2) return [parseInt(m2[1], 10), 0];
  return [999, 999]; // unnumbered fields at end
}

function sortFieldsByQuestionOrder(fields) {
  return [...fields].sort((a, b) => {
    const [a1, a2] = getQuestionOrder(a.name);
    const [b1, b2] = getQuestionOrder(b.name);
    if (a1 !== b1) return a1 - b1;
    if (a2 !== b2) return a2 - b2;
    return (a.name || "").localeCompare(b.name || "");
  });
}

// --- Field type mapping ClickUp → Tally ---
const CLICKUP_TO_TALLY = {
  short_text: "INPUT_TEXT",
  text: "INPUT_TEXT",
  long_text: "TEXTAREA",
  number: "INPUT_NUMBER",
  currency: "INPUT_NUMBER",
  checkbox: "CHECKBOXES",
  drop_down: "DROPDOWN",
  labels: "MULTIPLE_CHOICE",
  date: "INPUT_DATE",
  email: "INPUT_EMAIL",
  phone: "INPUT_PHONE_NUMBER",
  url: "INPUT_LINK",
  emoji: "RATING",
  users: "MULTIPLE_CHOICE",
  files: "FILE_UPLOAD",
  attachment: "FILE_UPLOAD",
};

function mapFieldToTallyBlocks(cf, idx) {
  const tallyType = CLICKUP_TO_TALLY[cf.type] || "INPUT_TEXT";
  const label = cf.name || `Field ${idx + 1}`;
  const groupUuid = uuid();

  const titleBlock = {
    uuid: uuid(),
    type: "TITLE",
    groupUuid,
    groupType: "QUESTION",
    payload: { html: label },
  };

  const inputGroupType = tallyType.replace("INPUT_", "").replace("_", "_") || "INPUT_TEXT";
  const payload = { isRequired: Boolean(cf.required) };
  if (!["FILE_UPLOAD", "CHECKBOXES", "RATING"].includes(tallyType)) {
    payload.placeholder = "";
  }
  const inputBlock = {
    uuid: uuid(),
    type: tallyType,
    groupUuid,
    groupType: tallyType,
    payload,
  };

  if (tallyType === "DROPDOWN" || tallyType === "MULTIPLE_CHOICE") {
    const optType = tallyType === "DROPDOWN" ? "DROPDOWN_OPTION" : "MULTIPLE_CHOICE_OPTION";
    const options = (cf.type_config?.options || []).map((o) => ({
      uuid: uuid(),
      type: optType,
      groupUuid,
      groupType: tallyType,
      payload: { label: o.name || o.label || String(o) },
    }));
    inputBlock.payload.options = options;
  }

  if (tallyType === "CHECKBOXES") {
    inputBlock.payload.options = [{ uuid: uuid(), payload: { label } }];
  }

  return [titleBlock, inputBlock];
}

function buildTallyBlocks(formSpec) {
  const blocks = [];
  const fields = sortFieldsByQuestionOrder(formSpec.fields || []);

  blocks.push({
    uuid: uuid(),
    type: "FORM_TITLE",
    groupUuid: uuid(),
    groupType: "FORM_TITLE",
    payload: {
      html: formSpec.name,
    },
  });

  for (let i = 0; i < fields.length; i++) {
    const fieldBlocks = mapFieldToTallyBlocks(fields[i], i);
    blocks.push(...fieldBlocks);
  }

  return blocks;
}

async function discoverForms() {
  console.log("Discovering ClickUp forms...\n");

  const forms = [];
  const teamViews = await getTeamViews();
  for (const v of teamViews) {
    if (v.type === "form") {
      forms.push({ view: v, parentType: "team", parentId: CLICKUP_TEAM_ID });
    }
  }

  const spaces = await getSpaces();
  for (const space of spaces) {
    const folders = await getFolders(space.id);
    for (const folder of folders) {
      const lists = await getFolderLists(folder.id);
      for (const list of lists) {
        const views = await getListViews(list.id);
        for (const v of views) {
          if (v.type === "form") {
            forms.push({ view: v, parentType: "list", parentId: list.id, list, folder, space });
          }
        }
      }
    }
    const folderlessLists = await getFolderlessLists(space.id);
    for (const list of folderlessLists) {
      const views = await getListViews(list.id);
      for (const v of views) {
        if (v.type === "form") {
          forms.push({ view: v, parentType: "list", parentId: list.id, list, folder: null, space });
        }
      }
    }
  }

  const specs = [];
  for (const { view, parentId, list } of forms) {
    const listId = view.parent?.id || parentId;
    const customFields = await getListCustomFields(listId);
    const listInfo = list ? { name: list.name } : await getList(listId).then((l) => ({ name: l.name }));

    const fields = customFields.map((cf) => ({
      name: cf.name,
      type: cf.type,
      type_config: cf.type_config,
      required: cf.required,
    }));

    if (fields.length === 0) {
      fields.push({ name: "Task Name", type: "short_text", required: false });
      fields.push({ name: "Description", type: "long_text", required: false });
    }

    const sortedFields = sortFieldsByQuestionOrder(fields);

    specs.push({
      clickupViewId: view.id,
      clickupViewName: view.name,
      clickupPublicUrl: view.public_url || null,
      listName: listInfo.name,
      name: view.name,
      description: `Migrated from ClickUp list: ${listInfo.name}`,
      fields: sortedFields,
    });
  }

  return specs;
}

async function createTallyForm(spec) {
  const blocks = buildTallyBlocks(spec);
  const body = {
    blocks,
    status: "DRAFT",
  };
  return tally("/forms", body);
}

async function main() {
  const { dirname } = await import("path");
  const { fileURLToPath } = await import("url");
  const fs = await import("fs");
  const __dirname = dirname(fileURLToPath(import.meta.url));
  const outputPath = `${__dirname}/clickup-forms-spec.json`;

  let specs;
  if (FROM_SPEC) {
    if (!fs.existsSync(outputPath)) {
      console.error(`Spec file not found: ${outputPath}. Run without FROM_SPEC=1 to discover forms first.`);
      process.exit(1);
    }
    specs = JSON.parse(fs.readFileSync(outputPath, "utf8"));
    console.log(`Loaded ${specs.length} form(s) from ${outputPath}\n`);
  } else {
    specs = await discoverForms();
    if (specs.length === 0) {
      console.log("No ClickUp forms found in the Stokt workspace.");
      return;
    }
    fs.writeFileSync(outputPath, JSON.stringify(specs, null, 2));
    console.log(`\nSpec saved to ${outputPath}`);
  }

  for (const s of specs) {
    console.log(`  - ${s.name} (${s.fields.length} fields)`);
    if (s.clickupPublicUrl) console.log(`    ClickUp: ${s.clickupPublicUrl}`);
  }

  if (DRY_RUN) {
    console.log("\nDRY_RUN=1: Skipping Tally creation.");
    return;
  }

  console.log("\nCreating forms in Tally...");
  for (const spec of specs) {
    try {
      const form = await createTallyForm(spec);
      console.log(`  Created: ${spec.name} -> ${form.id} (${form.status})`);
    } catch (err) {
      console.error(`  Failed ${spec.name}:`, err.message);
    }
  }
  console.log("\nDone.");
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
