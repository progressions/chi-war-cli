import { Command } from "commander";
import { fetchAdventure, fetchAdventureById, getEntityNotionPage, listAdventures, getAdventure, syncToNotion, syncFromNotion, getEntitySyncLogs, searchAdventures, updateAdventureNotionLink } from "../lib/api.js";
import { success, error, info } from "../lib/output.js";
import type { Adventure } from "../types/index.js";
import { linkEntityToNotion } from "../lib/notionLinker.js";

export function registerAdventureCommands(program: Command): void {
  const adventure = program
    .command("adventure")
    .description("Manage adventures");

  // LIST - list adventures from Chi War database
  adventure
    .command("list")
    .description("List adventures in the current campaign")
    .option("-n, --limit <number>", "Results per page", "20")
    .option("-p, --page <number>", "Page number", "1")
    .option("--json", "Output as JSON")
    .action(async (options) => {
      try {
        const result = await listAdventures({
          limit: parseInt(options.limit),
          page: parseInt(options.page),
        });

        if (options.json) {
          console.log(JSON.stringify(result.adventures, null, 2));
          return;
        }

        if (result.adventures.length === 0) {
          info("No adventures found");
          return;
        }

        console.log(`\nAdventures (${result.meta.total_count} total):\n`);
        for (const adv of result.adventures) {
          printAdventureSummary(adv);
        }

        if (result.meta.total_pages > 1) {
          console.log(`\nPage ${result.meta.current_page} of ${result.meta.total_pages}`);
        }
      } catch (err) {
        error(err instanceof Error ? err.message : "Failed to list adventures");
        process.exit(1);
      }
    });

  // SHOW - show adventure details from Chi War database
  adventure
    .command("show")
    .description("Show adventure details")
    .argument("<id>", "Adventure ID")
    .option("--json", "Output as JSON")
    .action(async (id, options) => {
      try {
        const adv = await getAdventure(id);

        if (options.json) {
          console.log(JSON.stringify(adv, null, 2));
          return;
        }

        printAdventureDetails(adv);
      } catch (err) {
        error(err instanceof Error ? err.message : "Failed to get adventure");
        process.exit(1);
      }
    });

  // FETCH - fetch adventure content from Notion
  adventure
    .command("fetch")
    .description("Fetch adventure by search query (e.g., 'Chicago On Fire', 'Tesla')")
    .argument("<query>", "Adventure name or search query")
    .option("--id", "Treat query as a Notion page ID instead of search")
    .option("--list", "Only show matching pages, don't fetch content")
    .action(async (query, options) => {
      try {
        let result;

        if (options.id) {
          // Fetch by page ID
          result = await fetchAdventureById(query);
        } else {
          // Search by query
          result = await fetchAdventure(query);
        }

        if (options.list && result.pages) {
          // Only show matching pages
          console.log(`\nFound ${result.pages.length} matching pages:\n`);
          for (const page of result.pages) {
            console.log(`  ${page.title}`);
            console.log(`    ID: ${page.id}`);
            console.log();
          }
          info("Use 'adventure fetch <query>' without --list to see content");
          info("Use 'adventure fetch <id> --id' to fetch a specific page");
          return;
        }

        // Display full adventure content
        success(`${result.title}`);
        console.log(`Page ID: ${result.page_id}\n`);
        console.log("─".repeat(60));
        console.log(result.content);
        console.log("─".repeat(60));

        // Show other matching pages if available
        if (result.pages && result.pages.length > 1) {
          console.log(`\nOther matching pages (${result.pages.length - 1}):`);
          for (const page of result.pages.slice(1, 5)) {
            console.log(`  - ${page.title} (${page.id})`);
          }
          if (result.pages.length > 5) {
            console.log(`  ... and ${result.pages.length - 5} more`);
          }
        }
      } catch (err) {
        error(err instanceof Error ? err.message : "Failed to fetch adventure");
        process.exit(1);
      }
    });

  adventure
    .command("search")
    .description("Search for adventures without fetching content")
    .argument("<query>", "Adventure name or search query")
    .action(async (query) => {
      try {
        const result = await fetchAdventure(query);

        if (result.pages && result.pages.length > 0) {
          console.log(`\nFound ${result.pages.length} matching pages:\n`);
          for (const page of result.pages) {
            console.log(`  ${page.title}`);
            console.log(`    ID: ${page.id}`);
            console.log();
          }
          info("Use 'adventure fetch <query>' to see content of first match");
          info("Use 'adventure fetch <id> --id' to fetch a specific page");
        } else {
          info(`No adventure pages found matching '${query}'`);
        }
      } catch (err) {
        error(err instanceof Error ? err.message : "Failed to search adventures");
        process.exit(1);
      }
    });

  adventure
    .command("notion-page")
    .description("Fetch raw Notion page JSON for an adventure (for debugging)")
    .argument("<id>", "Adventure ID")
    .action(async (id) => {
      try {
        const result = await getEntityNotionPage("adventures", id);
        console.log(JSON.stringify(result, null, 2));
      } catch (err) {
        error(err instanceof Error ? err.message : "Failed to fetch Notion page");
        process.exit(1);
      }
    });

  // LINK NOTION - Attach a Notion page by adventure name/ID and Notion page name
  adventure
    .command("link-notion <nameOrId>")
    .description("Link an adventure to a Notion page by adventure name/ID and Notion page name")
    .option("--notion <pageName>", "Notion page name to search (defaults to adventure name)")
    .action(async (nameOrId, options) => {
      try {
        const result = await linkEntityToNotion<Adventure>({
          target: nameOrId,
          notionName: options.notion,
          entityLabel: "adventure",
          findById: getAdventure,
          searchByName: async (name) => {
            const list = await searchAdventures({ search: name, limit: 10, page: 1 });
            return list.adventures || list;
          },
          updateEntity: async (id, notionPageId) => updateAdventureNotionLink(id, notionPageId),
          getId: (a) => (a as any).id,
          getName: (a) => (a as any).name,
          getNotionId: (a) => (a as any).notion_page_id,
        });

        if (result.updated) {
          success(`Linked adventure \"${result.entity.name}\" to Notion page ${result.notionPage.id}`);
        } else {
          info(`Adventure \"${result.entity.name}\" is already linked to ${result.notionPage.id}`);
        }
      } catch (err) {
        if (err instanceof Error && err.message === "Linking cancelled") {
          info("Linking cancelled");
          return;
        }
        error(err instanceof Error ? err.message : "Failed to link adventure to Notion");
        process.exit(1);
      }
    });

  // SYNC TO NOTION - Push adventure data to Notion
  adventure
    .command("sync-to-notion")
    .description("Sync adventure data TO Notion (creates or updates Notion page)")
    .argument("<id>", "Adventure ID")
    .action(async (id) => {
      try {
        const adv = await getAdventure(id);
        info(`Syncing "${adv.name}" to Notion...`);

        const result = await syncToNotion("adventures", id);
        success(result.message);
        console.log(`  Status: ${result.status}`);
        console.log(`  Adventure: ${adv.name}`);
      } catch (err) {
        error(err instanceof Error ? err.message : "Failed to sync to Notion");
        process.exit(1);
      }
    });

  // SYNC FROM NOTION - Pull adventure data from Notion
  adventure
    .command("sync-from-notion")
    .description("Sync adventure data FROM Notion (updates adventure with Notion page content)")
    .argument("<id>", "Adventure ID")
    .option("--json", "Output updated adventure as JSON")
    .action(async (id, options) => {
      try {
        const adv = await getAdventure(id);
        info(`Syncing "${adv.name}" from Notion...`);

        const updated = await syncFromNotion<Adventure>("adventures", id);

        if (options.json) {
          console.log(JSON.stringify(updated, null, 2));
          return;
        }

        success(`Adventure "${updated.name}" synced from Notion`);
        printAdventureDetails(updated);
      } catch (err) {
        error(err instanceof Error ? err.message : "Failed to sync from Notion");
        process.exit(1);
      }
    });

  // SYNC LOGS - Fetch Notion sync logs for debugging
  adventure
    .command("sync-logs")
    .description("Fetch Notion sync logs for an adventure (for debugging)")
    .argument("<id>", "Adventure ID")
    .option("-n, --limit <number>", "Number of logs to show", "10")
    .option("-p, --page <number>", "Page number", "1")
    .option("--json", "Output as JSON")
    .action(async (id, options) => {
      try {
        const result = await getEntitySyncLogs("adventures", id, {
          limit: parseInt(options.limit),
          page: parseInt(options.page),
        });

        if (options.json) {
          console.log(JSON.stringify(result, null, 2));
          return;
        }

        if (result.notion_sync_logs.length === 0) {
          info("No sync logs found for this adventure");
          return;
        }

        console.log(`\nNotion Sync Logs (${result.meta.total_count} total):\n`);
        for (const log of result.notion_sync_logs) {
          console.log(`  ${log.created_at}`);
          console.log(`    Status: ${log.status}`);
          if (log.error_message) {
            console.log(`    Error: ${log.error_message}`);
          }
          console.log("");
        }

        if (result.meta.total_pages > 1) {
          console.log(`Page ${result.meta.current_page} of ${result.meta.total_pages}`);
        }
      } catch (err) {
        error(err instanceof Error ? err.message : "Failed to fetch sync logs");
        process.exit(1);
      }
    });
}

function printAdventureSummary(adv: Adventure): void {
  const status = adv.active ? "" : " [INACTIVE]";
  const notion = adv.notion_page_id ? " [Notion]" : "";

  console.log(`  ${adv.name}${status}${notion}`);
  console.log(`    ID: ${adv.id}`);
  if (adv.description) {
    const desc = adv.description.length > 60
      ? adv.description.substring(0, 60) + "..."
      : adv.description;
    console.log(`    ${desc}`);
  }
  console.log("");
}

function printAdventureDetails(adv: Adventure): void {
  console.log(`\n${adv.name}`);
  console.log("=".repeat(adv.name.length));
  console.log(`  ID: ${adv.id}`);
  console.log(`  Status: ${adv.active ? "Active" : "Inactive"}`);
  if (adv.notion_page_id) {
    console.log(`  Notion Page ID: ${adv.notion_page_id}`);
  }
  if (adv.description) {
    console.log(`  Description: ${adv.description}`);
  }
  if (adv.at_a_glance !== undefined) {
    console.log(`  At a Glance: ${adv.at_a_glance ? "Yes" : "No"}`);
  }
  console.log(`  Created: ${new Date(adv.created_at).toLocaleDateString()}`);
  console.log("");
}
