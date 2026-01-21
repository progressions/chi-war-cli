import inquirer from "inquirer";
import { searchNotionPages, type NotionPage } from "./api.js";

interface LinkEntityOptions<T> {
  target: string;
  notionName?: string;
  entityLabel: string;
  findById: (id: string) => Promise<T>;
  searchByName: (name: string) => Promise<T[]>;
  updateEntity: (id: string, notionPageId: string) => Promise<T>;
  getId: (entity: T) => string;
  getName: (entity: T) => string;
  getNotionId?: (entity: T) => string | null | undefined;
}

interface LinkResult<T> {
  entity: T;
  notionPage: NotionPage;
  updated: boolean;
}

async function resolveEntity<T>(options: LinkEntityOptions<T>): Promise<T> {
  // Try direct ID lookup first
  try {
    const entity = await options.findById(options.target);
    if (entity) return entity;
  } catch (err) {
    // Ignore not-found errors and fall through to search
  }

  const matches = await options.searchByName(options.target);

  if (matches.length === 0) {
    throw new Error(`No ${options.entityLabel} found matching "${options.target}"`);
  }

  if (matches.length === 1) {
    return matches[0];
  }

  const { entityId } = await inquirer.prompt([
    {
      type: "list",
      name: "entityId",
      message: `Multiple ${options.entityLabel}s found. Select one:`,
      choices: matches.map((entity) => ({
        name: `${options.getName(entity)} (${options.getId(entity)})`,
        value: options.getId(entity),
      })),
    },
  ]);

  const selected = matches.find((entity) => options.getId(entity) === entityId);
  if (!selected) {
    throw new Error(`Selection failed for ${options.entityLabel}`);
  }

  return selected;
}

async function resolveNotionPage(query: string): Promise<NotionPage> {
  const pages = await searchNotionPages(query);

  if (pages.length === 0) {
    throw new Error(`No Notion pages found matching "${query}"`);
  }

  if (pages.length === 1) {
    return pages[0];
  }

  const { pageId } = await inquirer.prompt([
    {
      type: "list",
      name: "pageId",
      message: "Multiple Notion pages found. Select one:",
      choices: pages.map((page) => ({
        name: `${page.title || page.name || "Untitled"} (${page.id})${page.url ? ` – ${page.url}` : ""}`,
        value: page.id,
      })),
    },
  ]);

  const selected = pages.find((page) => page.id === pageId);
  if (!selected) {
    throw new Error("Notion page selection failed");
  }

  return selected;
}

export async function linkEntityToNotion<T>(options: LinkEntityOptions<T>): Promise<LinkResult<T>> {
  const entity = await resolveEntity(options);

  const notionQuery = options.notionName || options.getName(entity);
  const page = await resolveNotionPage(notionQuery);

  const currentNotionId = options.getNotionId ? options.getNotionId(entity) : (entity as any).notion_page_id;

  if (currentNotionId === page.id) {
    return { entity, notionPage: page, updated: false };
  }

  if (currentNotionId) {
    const { confirm } = await inquirer.prompt([
      {
        type: "confirm",
        name: "confirm",
        message: `${options.entityLabel} is already linked to Notion page ${currentNotionId}. Replace it with ${page.id}?`,
        default: false,
      },
    ]);

    if (!confirm) {
      throw new Error("Linking cancelled");
    }
  }

  const updatedEntity = await options.updateEntity(options.getId(entity), page.id);
  return { entity: updatedEntity, notionPage: page, updated: true };
}
