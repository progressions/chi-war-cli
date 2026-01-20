import { Command } from "commander";
import {
  listFactions,
  searchFaction,
  getFaction,
  createFaction,
  updateFaction,
  deleteFaction,
  getEntityNotionPage,
  syncToNotion,
  syncFromNotion,
  type Faction
} from "../lib/api.js";
import { success, error, info } from "../lib/output.js";
import * as fs from "fs";

export function registerFactionCommands(program: Command): void {
  const faction = program
    .command("faction")
    .description("Manage factions");

  // LIST
  faction
    .command("list")
    .description("List all factions in the current campaign")
    .option("--json", "Output as JSON")
    .action(async (options) => {
      try {
        const factions = await listFactions();

        if (options.json) {
          console.log(JSON.stringify(factions, null, 2));
          return;
        }

        if (factions.length === 0) {
          info("No factions found in current campaign");
          return;
        }

        console.log(`\nFactions (${factions.length}):\n`);
        for (const f of factions) {
          printFactionSummary(f);
        }
      } catch (err) {
        error(err instanceof Error ? err.message : "Failed to list factions");
        process.exit(1);
      }
    });

  // SEARCH
  faction
    .command("search")
    .description("Search for a faction by name")
    .argument("<query>", "Faction name to search for")
    .option("--json", "Output as JSON")
    .action(async (query, options) => {
      try {
        const match = await searchFaction(query);

        if (!match) {
          error(`No faction found matching "${query}"`);
          console.log("\nUse 'chiwar faction list' to see all factions");
          process.exit(1);
        }

        if (options.json) {
          console.log(JSON.stringify(match, null, 2));
          return;
        }

        success(`Found: ${match.name}`);
        printFactionDetails(match);
      } catch (err) {
        error(err instanceof Error ? err.message : "Failed to search factions");
        process.exit(1);
      }
    });

  // SHOW
  faction
    .command("show <id>")
    .description("Show faction details")
    .option("--json", "Output as JSON")
    .action(async (id, options) => {
      try {
        const item = await getFaction(id);

        if (options.json) {
          console.log(JSON.stringify(item, null, 2));
          return;
        }

        printFactionDetails(item);
      } catch (err) {
        error(err instanceof Error ? err.message : "Failed to get faction");
        process.exit(1);
      }
    });

  // CREATE
  faction
    .command("create")
    .description("Create a new faction")
    .argument("[json]", "Inline JSON")
    .option("-f, --file <path>", "Read from JSON file")
    .option("-n, --name <name>", "Faction name (shorthand)")
    .option("-d, --description <desc>", "Faction description (wraps in <p>)")
    .option("--description-html <html>", "Faction description (raw HTML)")
    .action(async (jsonArg, options) => {
      try {
        let data: Record<string, unknown>;

        if (options.file) {
          data = JSON.parse(fs.readFileSync(options.file, "utf-8"));
        } else if (jsonArg) {
          data = JSON.parse(jsonArg);
        } else if (options.name) {
          data = { name: options.name };
          if (options.description) {
            data.description = `<p>${options.description}</p>`;
          }
          if (options.descriptionHtml) {
            data.description = options.descriptionHtml;
          }
        } else {
          error("Provide JSON as argument, use --file, or use --name");
          console.log("\nUsage:");
          console.log('  chiwar faction create --name "The Syndicate"');
          console.log(
            '  chiwar faction create --name "The Syndicate" --description "A criminal organization"'
          );
          console.log("  chiwar faction create --file faction.json");
          console.log(
            '  chiwar faction create \'{"name": "Ascended", "description": "<p>Immortal leaders</p>"}\''
          );
          process.exit(1);
        }

        const created = await createFaction(data);
        success(`Created faction: ${created.name}`);
        console.log(`  ID: ${created.id}`);
        if (created.description) console.log(`  Description: ${created.description}`);
      } catch (err) {
        if (err instanceof SyntaxError) {
          error("Invalid JSON: " + err.message);
        } else {
          error(err instanceof Error ? err.message : "Failed to create faction");
        }
        process.exit(1);
      }
    });

  // UPDATE
  faction
    .command("update <id>")
    .description("Update a faction")
    .argument("[json]", "Inline JSON")
    .option("-f, --file <path>", "Read from JSON file")
    .option("-n, --name <name>", "Update faction name")
    .option("-d, --description <desc>", "Update description (wraps in <p>)")
    .option("--description-html <html>", "Update description (raw HTML)")
    .action(async (id, jsonArg, options) => {
      try {
        let data: Record<string, unknown>;

        if (options.file) {
          data = JSON.parse(fs.readFileSync(options.file, "utf-8"));
        } else if (jsonArg) {
          data = JSON.parse(jsonArg);
        } else if (options.name || options.description || options.descriptionHtml) {
          data = {};
          if (options.name) data.name = options.name;
          if (options.description) {
            data.description = `<p>${options.description}</p>`;
          }
          if (options.descriptionHtml) {
            data.description = options.descriptionHtml;
          }
        } else {
          error("Provide JSON as argument, use --file, or use --name/--description");
          process.exit(1);
        }

        const updated = await updateFaction(id, data);
        success(`Updated faction: ${updated.name}`);
      } catch (err) {
        if (err instanceof SyntaxError) {
          error("Invalid JSON: " + err.message);
        } else {
          error(err instanceof Error ? err.message : "Failed to update faction");
        }
        process.exit(1);
      }
    });

  // DELETE
  faction
    .command("delete <id>")
    .description("Delete a faction")
    .option("-y, --yes", "Skip confirmation")
    .action(async (id, options) => {
      try {
        const item = await getFaction(id);

        if (!options.yes) {
          const inquirer = await import("inquirer");
          const { confirm } = await inquirer.default.prompt([{
            type: "confirm",
            name: "confirm",
            message: `Delete faction "${item.name}"? This cannot be undone.`,
            default: false,
          }]);
          if (!confirm) {
            info("Cancelled");
            return;
          }
        }

        await deleteFaction(id);
        success(`Deleted faction: ${item.name}`);
      } catch (err) {
        error(err instanceof Error ? err.message : "Failed to delete faction");
        process.exit(1);
      }
    });

  // NOTION-PAGE
  faction
    .command("notion-page <id>")
    .description("Fetch raw Notion page JSON for a faction (for debugging)")
    .action(async (id) => {
      try {
        const result = await getEntityNotionPage("factions", id);
        console.log(JSON.stringify(result, null, 2));
      } catch (err) {
        error(err instanceof Error ? err.message : "Failed to fetch Notion page");
        process.exit(1);
      }
    });

  // SYNC TO NOTION - Push faction data to Notion
  faction
    .command("sync-to-notion <id>")
    .description("Sync faction data TO Notion (creates or updates Notion page)")
    .action(async (id) => {
      try {
        const item = await getFaction(id);
        info(`Syncing "${item.name}" to Notion...`);

        const result = await syncToNotion("factions", id);
        success(result.message);
        console.log(`  Status: ${result.status}`);
        console.log(`  Faction: ${item.name}`);
      } catch (err) {
        error(err instanceof Error ? err.message : "Failed to sync to Notion");
        process.exit(1);
      }
    });

  // SYNC FROM NOTION - Pull faction data from Notion
  faction
    .command("sync-from-notion <id>")
    .description("Sync faction data FROM Notion (updates faction with Notion page content)")
    .option("--json", "Output updated faction as JSON")
    .action(async (id, options) => {
      try {
        const item = await getFaction(id);
        info(`Syncing "${item.name}" from Notion...`);

        const updated = await syncFromNotion<Faction>("factions", id);

        if (options.json) {
          console.log(JSON.stringify(updated, null, 2));
          return;
        }

        success(`Faction "${updated.name}" synced from Notion`);
        printFactionDetails(updated);
      } catch (err) {
        error(err instanceof Error ? err.message : "Failed to sync from Notion");
        process.exit(1);
      }
    });
}

function printFactionSummary(item: Faction): void {
  console.log(`  ${item.name}`);
  console.log(`    ID: ${item.id}`);
  if (item.description) {
    console.log(`    ${item.description}`);
  }
  console.log("");
}

function printFactionDetails(item: Faction): void {
  console.log(`\n${item.name}`);
  console.log("=".repeat(item.name.length));
  console.log(`  ID: ${item.id}`);
  if (item.description) {
    console.log(`  Description: ${item.description}`);
  }
  if (item.at_a_glance !== undefined) {
    console.log(`  At a Glance: ${item.at_a_glance ? "Yes" : "No"}`);
  }
  console.log("");
}
