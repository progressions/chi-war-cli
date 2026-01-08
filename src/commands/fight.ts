import { Command } from "commander";
import {
  listFights,
  getFight,
  createFight,
  updateFight,
  deleteFight,
  endFight,
  resetFight,
} from "../lib/api.js";
import { success, error, info, warn } from "../lib/output.js";
import * as fs from "fs";
import type { Fight, Shot } from "../types/index.js";

export function registerFightCommands(program: Command): void {
  const fight = program
    .command("fight")
    .description("Manage fights");

  // LIST
  fight
    .command("list")
    .description("List fights")
    .option("-n, --limit <number>", "Results per page", "20")
    .option("-p, --page <number>", "Page number", "1")
    .option("-a, --active", "Show only active fights")
    .option("--all", "Show all fights (including ended)")
    .option("--json", "Output as JSON")
    .action(async (options) => {
      try {
        const result = await listFights({
          limit: parseInt(options.limit),
          page: parseInt(options.page),
          active: options.active ? true : (options.all ? undefined : undefined),
        });

        if (options.json) {
          console.log(JSON.stringify(result.fights, null, 2));
          return;
        }

        if (result.fights.length === 0) {
          info("No fights found");
          return;
        }

        console.log(`\nFights (${result.meta.total_count} total):\n`);
        for (const item of result.fights) {
          printFightSummary(item);
        }

        if (result.meta.total_pages > 1) {
          console.log(`\nPage ${result.meta.current_page} of ${result.meta.total_pages}`);
        }
      } catch (err) {
        error(err instanceof Error ? err.message : "Failed to list fights");
        process.exit(1);
      }
    });

  // SHOW
  fight
    .command("show <id>")
    .description("Show fight details")
    .option("--json", "Output as JSON")
    .action(async (id, options) => {
      try {
        const item = await getFight(id);

        if (options.json) {
          console.log(JSON.stringify(item, null, 2));
          return;
        }

        printFightDetails(item);
      } catch (err) {
        error(err instanceof Error ? err.message : "Failed to get fight");
        process.exit(1);
      }
    });

  // CREATE
  fight
    .command("create")
    .description("Create a new fight")
    .argument("[json]", "Inline JSON")
    .option("-f, --file <path>", "Read from JSON file")
    .option("-n, --name <name>", "Fight name (shorthand)")
    .action(async (jsonArg, options) => {
      try {
        let data: Record<string, unknown>;

        if (options.file) {
          data = JSON.parse(fs.readFileSync(options.file, "utf-8"));
        } else if (jsonArg) {
          data = JSON.parse(jsonArg);
        } else if (options.name) {
          data = { name: options.name };
        } else {
          error("Provide JSON as argument, use --file, or use --name");
          console.log("\nUsage:");
          console.log("  chiwar fight create --name \"Warehouse Showdown\"");
          console.log("  chiwar fight create --file fight.json");
          console.log('  chiwar fight create \'{"name": "Final Battle"}\'');
          process.exit(1);
        }

        const created = await createFight(data);
        success(`Created fight: ${created.name}`);
        console.log(`  ID: ${created.id}`);
        console.log(`  Sequence: ${created.sequence}`);
      } catch (err) {
        if (err instanceof SyntaxError) {
          error("Invalid JSON: " + err.message);
        } else {
          error(err instanceof Error ? err.message : "Failed to create fight");
        }
        process.exit(1);
      }
    });

  // UPDATE
  fight
    .command("update <id>")
    .description("Update a fight")
    .argument("[json]", "Inline JSON")
    .option("-f, --file <path>", "Read from JSON file")
    .option("-n, --name <name>", "Update fight name")
    .action(async (id, jsonArg, options) => {
      try {
        let data: Record<string, unknown>;

        if (options.file) {
          data = JSON.parse(fs.readFileSync(options.file, "utf-8"));
        } else if (jsonArg) {
          data = JSON.parse(jsonArg);
        } else if (options.name) {
          data = { name: options.name };
        } else {
          error("Provide JSON as argument, use --file, or use --name");
          process.exit(1);
        }

        const updated = await updateFight(id, data);
        success(`Updated fight: ${updated.name}`);
      } catch (err) {
        if (err instanceof SyntaxError) {
          error("Invalid JSON: " + err.message);
        } else {
          error(err instanceof Error ? err.message : "Failed to update fight");
        }
        process.exit(1);
      }
    });

  // DELETE
  fight
    .command("delete <id>")
    .description("Delete a fight")
    .option("-y, --yes", "Skip confirmation")
    .action(async (id, options) => {
      try {
        const item = await getFight(id);

        if (!options.yes) {
          const inquirer = await import("inquirer");
          const { confirm } = await inquirer.default.prompt([{
            type: "confirm",
            name: "confirm",
            message: `Delete fight "${item.name}"? This cannot be undone.`,
            default: false,
          }]);
          if (!confirm) {
            info("Cancelled");
            return;
          }
        }

        await deleteFight(id);
        success(`Deleted fight: ${item.name}`);
      } catch (err) {
        error(err instanceof Error ? err.message : "Failed to delete fight");
        process.exit(1);
      }
    });

  // END
  fight
    .command("end <id>")
    .description("End an active fight")
    .action(async (id) => {
      try {
        const updated = await endFight(id);
        success(`Ended fight: ${updated.name}`);
        console.log(`  The fight has concluded.`);
      } catch (err) {
        error(err instanceof Error ? err.message : "Failed to end fight");
        process.exit(1);
      }
    });

  // RESET
  fight
    .command("reset <id>")
    .description("Reset a fight (clear all shots and start fresh)")
    .option("-y, --yes", "Skip confirmation")
    .action(async (id, options) => {
      try {
        const item = await getFight(id);

        if (!options.yes) {
          const inquirer = await import("inquirer");
          const { confirm } = await inquirer.default.prompt([{
            type: "confirm",
            name: "confirm",
            message: `Reset fight "${item.name}"? This will clear all combatants.`,
            default: false,
          }]);
          if (!confirm) {
            info("Cancelled");
            return;
          }
        }

        const updated = await resetFight(id);
        success(`Reset fight: ${updated.name}`);
        console.log(`  Sequence reset to ${updated.sequence}`);
      } catch (err) {
        error(err instanceof Error ? err.message : "Failed to reset fight");
        process.exit(1);
      }
    });
}

function printFightSummary(item: Fight): void {
  const status = item.ended ? "[ENDED]" : (item.active ? "[ACTIVE]" : "");

  console.log(`  ${item.name} ${status}`);
  console.log(`    ID: ${item.id}`);
  console.log(`    Sequence: ${item.sequence}`);
  if (item.shots && item.shots.length > 0) {
    console.log(`    Combatants: ${item.shots.length}`);
  }
  console.log("");
}

function printFightDetails(item: Fight): void {
  console.log(`\n${item.name}`);
  console.log("=".repeat(item.name.length));
  console.log(`  ID: ${item.id}`);
  console.log(`  Status: ${item.ended ? "Ended" : (item.active ? "Active" : "Inactive")}`);
  console.log(`  Sequence: ${item.sequence}`);
  if (item.site) {
    console.log(`  Site: ${item.site.name}`);
  }
  if (item.description) {
    console.log(`  Description: ${item.description}`);
  }
  console.log(`  Created: ${new Date(item.created_at).toLocaleDateString()}`);

  if (item.shots && item.shots.length > 0) {
    console.log(`\n  Shot Order:`);
    // Group shots by shot number
    const shotGroups = new Map<number, Shot[]>();
    for (const shot of item.shots) {
      const existing = shotGroups.get(shot.shot) || [];
      existing.push(shot);
      shotGroups.set(shot.shot, existing);
    }

    // Print in descending shot order
    const sortedShots = Array.from(shotGroups.entries()).sort((a, b) => b[0] - a[0]);
    for (const [shotNum, shots] of sortedShots) {
      const names = shots.map(s => s.character?.name || s.vehicle?.name || "Unknown").join(", ");
      console.log(`    Shot ${shotNum}: ${names}`);
    }
  }

  console.log("");
}
