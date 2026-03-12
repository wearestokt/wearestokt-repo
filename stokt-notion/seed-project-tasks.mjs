import { Client } from "@notionhq/client";

const config = {
  notionToken: process.env.NOTION_TOKEN,
  projectsDatabaseId:
    process.env.NOTION_PROJECTS_DATABASE_ID || "31dec98f96b9811faa37cc4ae620a858",
  taskTemplatesDatabaseId:
    process.env.NOTION_TASK_TEMPLATES_DATABASE_ID || "31dec98f96b98142ba7dd53b20e6104f",
  tasksDatabaseId:
    process.env.NOTION_TASKS_DATABASE_ID || "47e26f193e3342b2b306a6bd4be42fba",
  dryRun: process.env.DRY_RUN === "1",
};

if (!config.notionToken) {
  console.error(
    "Missing NOTION_TOKEN. Create an internal integration and set NOTION_TOKEN before running."
  );
  process.exit(1);
}

const notion = new Client({ auth: config.notionToken });

function getTitleValue(page, propertyName = "Name") {
  const property = page.properties?.[propertyName];
  if (!property || property.type !== "title" || !property.title?.length) return "";
  return property.title.map((t) => t.plain_text).join("").trim();
}

function getCheckboxValue(page, propertyName) {
  const property = page.properties?.[propertyName];
  if (!property || property.type !== "checkbox") return false;
  return Boolean(property.checkbox);
}

function getRelationIds(page, propertyName) {
  const property = page.properties?.[propertyName];
  if (!property || property.type !== "relation") return [];
  return property.relation.map((r) => r.id);
}

function getSelectName(page, propertyName) {
  const property = page.properties?.[propertyName];
  if (!property || property.type !== "select" || !property.select) return null;
  return property.select.name || null;
}

function getNumber(page, propertyName) {
  const property = page.properties?.[propertyName];
  if (!property || property.type !== "number") return null;
  return property.number;
}

function toTitleRichText(value) {
  return [
    {
      type: "text",
      text: { content: value },
    },
  ];
}

async function fetchAllDatabaseRows(databaseId, filter, sorts) {
  const results = [];
  let cursor = undefined;
  while (true) {
    const response = await notion.databases.query({
      database_id: databaseId,
      filter,
      sorts,
      start_cursor: cursor,
      page_size: 100,
    });
    results.push(...response.results);
    if (!response.has_more) break;
    cursor = response.next_cursor;
  }
  return results;
}

async function getClientNameFromProject(projectPage) {
  const clientIds = getRelationIds(projectPage, "Client");
  if (!clientIds.length) return getTitleValue(projectPage, "Name");
  const clientPage = await notion.pages.retrieve({ page_id: clientIds[0] });
  const fromName = getTitleValue(clientPage, "Name");
  return fromName || getTitleValue(projectPage, "Name");
}

async function createTaskFromTemplate(templatePage, projectPageId, clientName) {
  const templateTaskName = getTitleValue(templatePage, "Name");
  const taskTitle = `${clientName} - ${templateTaskName}`;
  const phase = getSelectName(templatePage, "Phase");
  const order = getNumber(templatePage, "Order");
  const status = getSelectName(templatePage, "Status") || "Not started";

  const properties = {
    Name: { title: toTitleRichText(taskTitle) },
    Project: { relation: [{ id: projectPageId }] },
    "From Template": { checkbox: true },
    "Template Task": { rich_text: toTitleRichText(templateTaskName) },
  };

  if (phase) properties.Phase = { select: { name: phase } };
  if (typeof order === "number") properties.Order = { number: order };
  if (status) properties.Status = { status: { name: status } };

  if (config.dryRun) {
    return { dryRun: true, title: taskTitle };
  }

  return notion.pages.create({
    parent: { database_id: config.tasksDatabaseId },
    properties,
  });
}

async function markProjectSeeded(projectPageId) {
  if (config.dryRun) return;
  await notion.pages.update({
    page_id: projectPageId,
    properties: {
      "Tasks Seeded": { checkbox: true },
    },
  });
}

async function main() {
  console.log("Loading template tasks...");
  const templateTasks = await fetchAllDatabaseRows(
    config.taskTemplatesDatabaseId,
    undefined,
    [
      { property: "Phase", direction: "ascending" },
      { property: "Order", direction: "ascending" },
      { timestamp: "created_time", direction: "ascending" },
    ]
  );

  if (!templateTasks.length) {
    console.log("No task templates found. Exiting.");
    return;
  }

  console.log("Loading unseeded projects...");
  const projects = await fetchAllDatabaseRows(
    config.projectsDatabaseId,
    {
      and: [
        {
          property: "Tasks Seeded",
          checkbox: { equals: false },
        },
      ],
    },
    [{ property: "Name", direction: "ascending" }]
  );

  const actionableProjects = projects.filter((project) => {
    const name = getTitleValue(project, "Name");
    return name && name !== "Project Template";
  });

  if (!actionableProjects.length) {
    console.log("No new projects to seed.");
    return;
  }

  for (const project of actionableProjects) {
    const projectId = project.id;
    const projectName = getTitleValue(project, "Name");
    const seeded = getCheckboxValue(project, "Tasks Seeded");
    if (seeded) continue;

    const clientName = await getClientNameFromProject(project);
    console.log(
      `Seeding ${templateTasks.length} tasks for project "${projectName}" using client "${clientName}"...`
    );

    for (const template of templateTasks) {
      await createTaskFromTemplate(template, projectId, clientName);
    }

    await markProjectSeeded(projectId);
    console.log(`Completed: ${projectName}`);
  }

  console.log(config.dryRun ? "Dry run complete." : "All done.");
}

main().catch((error) => {
  console.error("Task seeding failed:", error?.body || error);
  process.exit(1);
});
