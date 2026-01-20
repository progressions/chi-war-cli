import { Command } from "commander";
import {
  listJunctures,
  getJuncture,
  createJuncture,
  updateJuncture,
  deleteJuncture,
  getEntityNotionPage,
  syncToNotion,
  syncFromNotion,
  getEntitySyncLogs,
} from "../lib/api.js";
import { success, error, info } from "../lib/output.js";
import * as fs from "fs";
import type { Juncture } from "../types/index.js";

export function registerJunctureCommands(program: Command): void {
  const juncture = program
    .command("juncture")
    .description("Manage junctures (time periods)");

  // LIST
  juncture
    .command("list")
    .description("List junctures")
    .option("-n, --limit <number>", "Results per page", "20")
    .option("-p, --page <number>", "Page number", "1")
    .option("-a, --active", "Show only active junctures")
    .option("--all", "Show all junctures")
    .option("--json", "Output as JSON")
    .action(async (options) => {
      try {
        const result = await listJunctures({
          limit: parseInt(options.limit),
          page: parseInt(options.page),
          active: options.active ? true : (options.all ? undefined : undefined),
        });

        if (options.json) {
          console.log(JSON.stringify(result.junctures, null, 2));
          return;
        }

        if (result.junctures.length === 0) {
          info("No junctures found");
          return;
        }

        console.log(`\nJunctures (${result.meta.total_count} total):\n`);
        for (const item of result.junctures) {
          printJunctureSummary(item);
        }

        if (result.meta.total_pages > 1) {
          console.log(`\nPage ${result.meta.current_page} of ${result.meta.total_pages}`);
        }
      } catch (err) {
        error(err instanceof Error ? err.message : "Failed to list junctures");
        process.exit(1);
      }
    });

  // SHOW
  juncture
    .command("show <id>")
    .description("Show juncture details")
    .option("--json", "Output as JSON")
    .action(async (id, options) => {
      try {
        const item = await getJuncture(id);

        if (options.json) {
          console.log(JSON.stringify(item, null, 2));
          return;
        }

        printJunctureDetails(item);
      } catch (err) {
        error(err instanceof Error ? err.message : "Failed to get juncture");
        process.exit(1);
      }
    });

  // CREATE
  juncture
    .command("create")
    .description("Create a new juncture")
    .argument("[json]", "Inline JSON")
    .option("-f, --file <path>", "Read from JSON file")
    .option("-n, --name <name>", "Juncture name (shorthand)")
    .option("--start <year>", "Start year")
    .option("--end <year>", "End year")
    .action(async (jsonArg, options) => {
      try {
        let data: Record<string, unknown>;

        if (options.file) {
          data = JSON.parse(fs.readFileSync(options.file, "utf-8"));
        } else if (jsonArg) {
          data = JSON.parse(jsonArg);
        } else if (options.name) {
          data = { name: options.name };
          if (options.start) data.start_year = parseInt(options.start);
          if (options.end) data.end_year = parseInt(options.end);
        } else {
          error("Provide JSON as argument, use --file, or use --name");
          console.log("\nUsage:");
          console.log("  chiwar juncture create --name \"Ancient\" --start 690 --end 700");
          console.log("  chiwar juncture create --file juncture.json");
          console.log('  chiwar juncture create \'{"name": "Contemporary", "start_year": 2000}\'');
          process.exit(1);
        }

        const created = await createJuncture(data);
        success(`Created juncture: ${created.name}`);
        console.log(`  ID: ${created.id}`);
        if (created.start_year || created.end_year) {
          const yearRange = formatYearRange(created.start_year, created.end_year);
          if (yearRange) console.log(`  Years: ${yearRange}`);
        }
      } catch (err) {
        if (err instanceof SyntaxError) {
          error("Invalid JSON: " + err.message);
        } else {
          error(err instanceof Error ? err.message : "Failed to create juncture");
        }
        process.exit(1);
      }
    });

  // UPDATE
  juncture
    .command("update <id>")
    .description("Update a juncture")
    .argument("[json]", "Inline JSON")
    .option("-f, --file <path>", "Read from JSON file")
    .option("-n, --name <name>", "Update juncture name")
    .option("--start <year>", "Update start year")
    .option("--end <year>", "Update end year")
    .action(async (id, jsonArg, options) => {
      try {
        let data: Record<string, unknown>;

        if (options.file) {
          data = JSON.parse(fs.readFileSync(options.file, "utf-8"));
        } else if (jsonArg) {
          data = JSON.parse(jsonArg);
        } else if (options.name || options.start || options.end) {
          data = {};
          if (options.name) data.name = options.name;
          if (options.start) data.start_year = parseInt(options.start);
          if (options.end) data.end_year = parseInt(options.end);
        } else {
          error("Provide JSON as argument, use --file, or use --name/--start/--end");
          process.exit(1);
        }

        const updated = await updateJuncture(id, data);
        success(`Updated juncture: ${updated.name}`);
      } catch (err) {
        if (err instanceof SyntaxError) {
          error("Invalid JSON: " + err.message);
        } else {
          error(err instanceof Error ? err.message : "Failed to update juncture");
        }
        process.exit(1);
      }
    });

  // DELETE
  juncture
    .command("delete <id>")
    .description("Delete a juncture")
    .option("-y, --yes", "Skip confirmation")
    .action(async (id, options) => {
      try {
        const item = await getJuncture(id);

        if (!options.yes) {
          const inquirer = await import("inquirer");
          const { confirm } = await inquirer.default.prompt([{
            type: "confirm",
            name: "confirm",
            message: `Delete juncture "${item.name}"? This cannot be undone.`,
            default: false,
          }]);
          if (!confirm) {
            info("Cancelled");
            return;
          }
        }

        await deleteJuncture(id);
        success(`Deleted juncture: ${item.name}`);
      } catch (err) {
        error(err instanceof Error ? err.message : "Failed to delete juncture");
        process.exit(1);
      }
    });

  // NOTION-PAGE
  juncture
    .command("notion-page <id>")
    .description("Fetch raw Notion page JSON for a juncture (for debugging)")
    .action(async (id) => {
      try {
        const result = await getEntityNotionPage("junctures", id);
        console.log(JSON.stringify(result, null, 2));
      } catch (err) {
        error(err instanceof Error ? err.message : "Failed to fetch Notion page");
        process.exit(1);
      }
    });

  // SYNC TO NOTION - Push juncture data to Notion
  juncture
    .command("sync-to-notion <id>")
    .description("Sync juncture data TO Notion (creates or updates Notion page)")
    .action(async (id) => {
      try {
        const item = await getJuncture(id);
        info(`Syncing "${item.name}" to Notion...`);

        const result = await syncToNotion("junctures", id);
        success(result.message);
        console.log(`  Status: ${result.status}`);
        console.log(`  Juncture: ${item.name}`);
      } catch (err) {
        error(err instanceof Error ? err.message : "Failed to sync to Notion");
        process.exit(1);
      }
    });

  // SYNC FROM NOTION - Pull juncture data from Notion
  juncture
    .command("sync-from-notion <id>")
    .description("Sync juncture data FROM Notion (updates juncture with Notion page content)")
    .option("--json", "Output updated juncture as JSON")
    .action(async (id, options) => {
      try {
        const item = await getJuncture(id);
        info(`Syncing "${item.name}" from Notion...`);

        const updated = await syncFromNotion<Juncture>("junctures", id);

        if (options.json) {
          console.log(JSON.stringify(updated, null, 2));
          return;
        }

        success(`Juncture "${updated.name}" synced from Notion`);
        printJunctureDetails(updated);
      } catch (err) {
        error(err instanceof Error ? err.message : "Failed to sync from Notion");
        process.exit(1);
      }
    });

  // SYNC LOGS - Fetch Notion sync logs for debugging
  juncture
    .command("sync-logs <id>")
    .description("Fetch Notion sync logs for a juncture (for debugging)")
    .option("-n, --limit <number>", "Number of logs to show", "10")
    .option("-p, --page <number>", "Page number", "1")
    .option("--json", "Output as JSON")
    .action(async (id, options) => {
      try {
        const result = await getEntitySyncLogs("junctures", id, {
          limit: parseInt(options.limit),
          page: parseInt(options.page),
        });

        if (options.json) {
          console.log(JSON.stringify(result, null, 2));
          return;
        }

        if (result.notion_sync_logs.length === 0) {
          info("No sync logs found for this juncture");
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

function formatYearRange(startYear?: number, endYear?: number): string {
  if (startYear && endYear) {
    return `${startYear} - ${endYear}`;
  } else if (startYear) {
    return `${startYear}+`;
  } else if (endYear) {
    return `until ${endYear}`;
  }
  return "";
}

function printJunctureSummary(item: Juncture): void {
  const yearRange = formatYearRange(item.start_year, item.end_year);
  const yearDisplay = yearRange ? ` (${yearRange})` : "";
  const status = item.active ? "" : " [INACTIVE]";

  console.log(`  ${item.name}${yearDisplay}${status}`);
  console.log(`    ID: ${item.id}`);
  console.log("");
}

function printJunctureDetails(item: Juncture): void {
  console.log(`\n${item.name}`);
  console.log("=".repeat(item.name.length));
  console.log(`  ID: ${item.id}`);
  console.log(`  Status: ${item.active ? "Active" : "Inactive"}`);

  const yearRange = formatYearRange(item.start_year, item.end_year);
  if (yearRange) {
    console.log(`  Years: ${yearRange}`);
  }

  if (item.description) {
    console.log(`  Description: ${item.description}`);
  }
  console.log(`  Created: ${new Date(item.created_at).toLocaleDateString()}`);
  console.log("");
}
