import { Command } from "commander";
import {
  listSites,
  getSite,
  createSite,
  updateSite,
  deleteSite,
  getEntityNotionPage,
  syncToNotion,
  syncFromNotion,
} from "../lib/api.js";
import { success, error, info } from "../lib/output.js";
import * as fs from "fs";
import type { Site, SiteAttunement } from "../types/index.js";

export function registerSiteCommands(program: Command): void {
  const site = program
    .command("site")
    .description("Manage sites (feng shui locations)");

  // LIST
  site
    .command("list")
    .description("List sites")
    .option("-n, --limit <number>", "Results per page", "20")
    .option("-p, --page <number>", "Page number", "1")
    .option("-a, --active", "Show only active sites")
    .option("--all", "Show all sites")
    .option("--json", "Output as JSON")
    .action(async (options) => {
      try {
        const result = await listSites({
          limit: parseInt(options.limit),
          page: parseInt(options.page),
          active: options.active ? true : (options.all ? undefined : undefined),
        });

        if (options.json) {
          console.log(JSON.stringify(result.sites, null, 2));
          return;
        }

        if (result.sites.length === 0) {
          info("No sites found");
          return;
        }

        console.log(`\nSites (${result.meta.total_count} total):\n`);
        for (const item of result.sites) {
          printSiteSummary(item);
        }

        if (result.meta.total_pages > 1) {
          console.log(`\nPage ${result.meta.current_page} of ${result.meta.total_pages}`);
        }
      } catch (err) {
        error(err instanceof Error ? err.message : "Failed to list sites");
        process.exit(1);
      }
    });

  // SHOW
  site
    .command("show <id>")
    .description("Show site details")
    .option("--json", "Output as JSON")
    .action(async (id, options) => {
      try {
        const item = await getSite(id);

        if (options.json) {
          console.log(JSON.stringify(item, null, 2));
          return;
        }

        printSiteDetails(item);
      } catch (err) {
        error(err instanceof Error ? err.message : "Failed to get site");
        process.exit(1);
      }
    });

  // CREATE
  site
    .command("create")
    .description("Create a new site")
    .argument("[json]", "Inline JSON")
    .option("-f, --file <path>", "Read from JSON file")
    .option("-n, --name <name>", "Site name (shorthand)")
    .option("--fsv <value>", "Feng shui value")
    .action(async (jsonArg, options) => {
      try {
        let data: Record<string, unknown>;

        if (options.file) {
          data = JSON.parse(fs.readFileSync(options.file, "utf-8"));
        } else if (jsonArg) {
          data = JSON.parse(jsonArg);
        } else if (options.name) {
          data = { name: options.name };
          if (options.fsv) {
            data.feng_shui_value = parseInt(options.fsv);
          }
        } else {
          error("Provide JSON as argument, use --file, or use --name");
          console.log("\nUsage:");
          console.log("  chiwar site create --name \"Dragon Temple\" --fsv 5");
          console.log("  chiwar site create --file site.json");
          console.log('  chiwar site create \'{"name": "Secret Lair", "feng_shui_value": 3}\'');
          process.exit(1);
        }

        const created = await createSite(data);
        success(`Created site: ${created.name}`);
        console.log(`  ID: ${created.id}`);
        if (created.feng_shui_value) {
          console.log(`  Feng Shui Value: ${created.feng_shui_value}`);
        }
      } catch (err) {
        if (err instanceof SyntaxError) {
          error("Invalid JSON: " + err.message);
        } else {
          error(err instanceof Error ? err.message : "Failed to create site");
        }
        process.exit(1);
      }
    });

  // UPDATE
  site
    .command("update <id>")
    .description("Update a site")
    .argument("[json]", "Inline JSON")
    .option("-f, --file <path>", "Read from JSON file")
    .option("-n, --name <name>", "Update site name")
    .option("--fsv <value>", "Update feng shui value")
    .action(async (id, jsonArg, options) => {
      try {
        let data: Record<string, unknown>;

        if (options.file) {
          data = JSON.parse(fs.readFileSync(options.file, "utf-8"));
        } else if (jsonArg) {
          data = JSON.parse(jsonArg);
        } else if (options.name || options.fsv) {
          data = {};
          if (options.name) data.name = options.name;
          if (options.fsv) data.feng_shui_value = parseInt(options.fsv);
        } else {
          error("Provide JSON as argument, use --file, or use --name/--fsv");
          process.exit(1);
        }

        const updated = await updateSite(id, data);
        success(`Updated site: ${updated.name}`);
      } catch (err) {
        if (err instanceof SyntaxError) {
          error("Invalid JSON: " + err.message);
        } else {
          error(err instanceof Error ? err.message : "Failed to update site");
        }
        process.exit(1);
      }
    });

  // DELETE
  site
    .command("delete <id>")
    .description("Delete a site")
    .option("-y, --yes", "Skip confirmation")
    .action(async (id, options) => {
      try {
        const item = await getSite(id);

        if (!options.yes) {
          const inquirer = await import("inquirer");
          const { confirm } = await inquirer.default.prompt([{
            type: "confirm",
            name: "confirm",
            message: `Delete site "${item.name}"? This cannot be undone.`,
            default: false,
          }]);
          if (!confirm) {
            info("Cancelled");
            return;
          }
        }

        await deleteSite(id);
        success(`Deleted site: ${item.name}`);
      } catch (err) {
        error(err instanceof Error ? err.message : "Failed to delete site");
        process.exit(1);
      }
    });

  // NOTION-PAGE
  site
    .command("notion-page <id>")
    .description("Fetch raw Notion page JSON for a site (for debugging)")
    .action(async (id) => {
      try {
        const result = await getEntityNotionPage("sites", id);
        console.log(JSON.stringify(result, null, 2));
      } catch (err) {
        error(err instanceof Error ? err.message : "Failed to fetch Notion page");
        process.exit(1);
      }
    });

  // SYNC TO NOTION - Push site data to Notion
  site
    .command("sync-to-notion <id>")
    .description("Sync site data TO Notion (creates or updates Notion page)")
    .action(async (id) => {
      try {
        const item = await getSite(id);
        info(`Syncing "${item.name}" to Notion...`);

        const result = await syncToNotion("sites", id);
        success(result.message);
        console.log(`  Status: ${result.status}`);
        console.log(`  Site: ${item.name}`);
      } catch (err) {
        error(err instanceof Error ? err.message : "Failed to sync to Notion");
        process.exit(1);
      }
    });

  // SYNC FROM NOTION - Pull site data from Notion
  site
    .command("sync-from-notion <id>")
    .description("Sync site data FROM Notion (updates site with Notion page content)")
    .option("--json", "Output updated site as JSON")
    .action(async (id, options) => {
      try {
        const item = await getSite(id);
        info(`Syncing "${item.name}" from Notion...`);

        const updated = await syncFromNotion<Site>("sites", id);

        if (options.json) {
          console.log(JSON.stringify(updated, null, 2));
          return;
        }

        success(`Site "${updated.name}" synced from Notion`);
        printSiteDetails(updated);
      } catch (err) {
        error(err instanceof Error ? err.message : "Failed to sync from Notion");
        process.exit(1);
      }
    });
}

function printSiteSummary(item: Site): void {
  const fsvDisplay = item.feng_shui_value ? ` (FSV: ${item.feng_shui_value})` : "";
  const status = item.active ? "" : " [INACTIVE]";

  console.log(`  ${item.name}${fsvDisplay}${status}`);
  console.log(`    ID: ${item.id}`);
  if (item.juncture) {
    console.log(`    Juncture: ${item.juncture.name}`);
  }
  if (item.faction) {
    console.log(`    Faction: ${item.faction.name}`);
  }
  console.log("");
}

function printSiteDetails(item: Site): void {
  console.log(`\n${item.name}`);
  console.log("=".repeat(item.name.length));
  console.log(`  ID: ${item.id}`);
  console.log(`  Status: ${item.active ? "Active" : "Inactive"}`);
  if (item.feng_shui_value) {
    console.log(`  Feng Shui Value: ${item.feng_shui_value}`);
  }
  if (item.juncture) {
    console.log(`  Juncture: ${item.juncture.name}`);
  }
  if (item.faction) {
    console.log(`  Faction: ${item.faction.name}`);
  }
  if (item.description) {
    console.log(`  Description: ${item.description}`);
  }
  console.log(`  Created: ${new Date(item.created_at).toLocaleDateString()}`);

  if (item.attunements && item.attunements.length > 0) {
    console.log(`\n  Attunements:`);
    for (const attunement of item.attunements) {
      const charName = attunement.character?.name || "Unknown";
      console.log(`    - ${charName}`);
    }
  }

  console.log("");
}
