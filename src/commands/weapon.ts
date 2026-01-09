import { Command } from "commander";
import {
  listWeapons,
  getWeapon,
  createWeapon,
  updateWeapon,
  deleteWeapon,
} from "../lib/api.js";
import { success, error, info } from "../lib/output.js";
import * as fs from "fs";
import type { Weapon } from "../types/index.js";

export function registerWeaponCommands(program: Command): void {
  const weapon = program
    .command("weapon")
    .description("Manage weapons");

  // LIST
  weapon
    .command("list")
    .description("List weapons")
    .option("-n, --limit <number>", "Results per page", "20")
    .option("-p, --page <number>", "Page number", "1")
    .option("-a, --active", "Show only active weapons")
    .option("--character <id>", "Filter by character ID")
    .option("--all", "Show all weapons")
    .option("--json", "Output as JSON")
    .action(async (options) => {
      try {
        const result = await listWeapons({
          limit: parseInt(options.limit),
          page: parseInt(options.page),
          active: options.active ? true : (options.all ? undefined : undefined),
          characterId: options.character,
        });

        if (options.json) {
          console.log(JSON.stringify(result.weapons, null, 2));
          return;
        }

        if (result.weapons.length === 0) {
          info("No weapons found");
          return;
        }

        console.log(`\nWeapons (${result.meta.total_count} total):\n`);
        for (const item of result.weapons) {
          printWeaponSummary(item);
        }

        if (result.meta.total_pages > 1) {
          console.log(`\nPage ${result.meta.current_page} of ${result.meta.total_pages}`);
        }
      } catch (err) {
        error(err instanceof Error ? err.message : "Failed to list weapons");
        process.exit(1);
      }
    });

  // SHOW
  weapon
    .command("show <id>")
    .description("Show weapon details")
    .option("--json", "Output as JSON")
    .action(async (id, options) => {
      try {
        const item = await getWeapon(id);

        if (options.json) {
          console.log(JSON.stringify(item, null, 2));
          return;
        }

        printWeaponDetails(item);
      } catch (err) {
        error(err instanceof Error ? err.message : "Failed to get weapon");
        process.exit(1);
      }
    });

  // CREATE
  weapon
    .command("create")
    .description("Create a new weapon")
    .argument("[json]", "Inline JSON")
    .option("-f, --file <path>", "Read from JSON file")
    .option("-n, --name <name>", "Weapon name (shorthand)")
    .option("-d, --damage <value>", "Damage value")
    .action(async (jsonArg, options) => {
      try {
        let data: Record<string, unknown>;

        if (options.file) {
          data = JSON.parse(fs.readFileSync(options.file, "utf-8"));
        } else if (jsonArg) {
          data = JSON.parse(jsonArg);
        } else if (options.name) {
          data = { name: options.name };
          if (options.damage) data.damage = parseInt(options.damage);
        } else {
          error("Provide JSON as argument, use --file, or use --name");
          console.log("\nUsage:");
          console.log("  chiwar weapon create --name \"Colt .45\" --damage 10");
          console.log("  chiwar weapon create --file weapon.json");
          console.log('  chiwar weapon create \'{"name": "Sword", "damage": 9}\'');
          process.exit(1);
        }

        const created = await createWeapon(data);
        success(`Created weapon: ${created.name}`);
        console.log(`  ID: ${created.id}`);
        if (created.damage) {
          console.log(`  Damage: ${created.damage}`);
        }
      } catch (err) {
        if (err instanceof SyntaxError) {
          error("Invalid JSON: " + err.message);
        } else {
          error(err instanceof Error ? err.message : "Failed to create weapon");
        }
        process.exit(1);
      }
    });

  // UPDATE
  weapon
    .command("update <id>")
    .description("Update a weapon")
    .argument("[json]", "Inline JSON")
    .option("-f, --file <path>", "Read from JSON file")
    .option("-n, --name <name>", "Update weapon name")
    .option("-d, --damage <value>", "Update damage value")
    .action(async (id, jsonArg, options) => {
      try {
        let data: Record<string, unknown>;

        if (options.file) {
          data = JSON.parse(fs.readFileSync(options.file, "utf-8"));
        } else if (jsonArg) {
          data = JSON.parse(jsonArg);
        } else if (options.name || options.damage) {
          data = {};
          if (options.name) data.name = options.name;
          if (options.damage) data.damage = parseInt(options.damage);
        } else {
          error("Provide JSON as argument, use --file, or use --name/--damage");
          process.exit(1);
        }

        const updated = await updateWeapon(id, data);
        success(`Updated weapon: ${updated.name}`);
      } catch (err) {
        if (err instanceof SyntaxError) {
          error("Invalid JSON: " + err.message);
        } else {
          error(err instanceof Error ? err.message : "Failed to update weapon");
        }
        process.exit(1);
      }
    });

  // DELETE
  weapon
    .command("delete <id>")
    .description("Delete a weapon")
    .option("-y, --yes", "Skip confirmation")
    .action(async (id, options) => {
      try {
        const item = await getWeapon(id);

        if (!options.yes) {
          const inquirer = await import("inquirer");
          const { confirm } = await inquirer.default.prompt([{
            type: "confirm",
            name: "confirm",
            message: `Delete weapon "${item.name}"? This cannot be undone.`,
            default: false,
          }]);
          if (!confirm) {
            info("Cancelled");
            return;
          }
        }

        await deleteWeapon(id);
        success(`Deleted weapon: ${item.name}`);
      } catch (err) {
        error(err instanceof Error ? err.message : "Failed to delete weapon");
        process.exit(1);
      }
    });
}

function printWeaponSummary(item: Weapon): void {
  const status = item.active ? "" : " [INACTIVE]";
  const damageStr = item.damage ? ` (Damage: ${item.damage})` : "";

  console.log(`  ${item.name}${damageStr}${status}`);
  console.log(`    ID: ${item.id}`);
  if (item.character) {
    console.log(`    Owner: ${item.character.name}`);
  }
  if (item.category) {
    console.log(`    Category: ${item.category}`);
  }
  console.log("");
}

function printWeaponDetails(item: Weapon): void {
  console.log(`\n${item.name}`);
  console.log("=".repeat(item.name.length));
  console.log(`  ID: ${item.id}`);
  console.log(`  Status: ${item.active ? "Active" : "Inactive"}`);

  if (item.damage !== undefined) {
    console.log(`  Damage: ${item.damage}`);
  }
  if (item.concealment !== undefined) {
    console.log(`  Concealment: ${item.concealment}`);
  }
  if (item.reload !== undefined) {
    console.log(`  Reload: ${item.reload}`);
  }
  if (item.category) {
    console.log(`  Category: ${item.category}`);
  }
  if (item.character) {
    console.log(`  Owner: ${item.character.name}`);
  }
  if (item.juncture) {
    console.log(`  Juncture: ${item.juncture.name}`);
  }
  if (item.description) {
    console.log(`  Description: ${item.description}`);
  }
  console.log(`  Created: ${new Date(item.created_at).toLocaleDateString()}`);
  console.log("");
}
