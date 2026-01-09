import { Command } from "commander";
import {
  listSchticks,
  getSchtick,
  createSchtick,
  updateSchtick,
  deleteSchtick,
} from "../lib/api.js";
import { success, error, info } from "../lib/output.js";
import * as fs from "fs";
import type { Schtick } from "../types/index.js";

export function registerSchtickCommands(program: Command): void {
  const schtick = program
    .command("schtick")
    .description("Manage schticks (character abilities)");

  // LIST
  schtick
    .command("list")
    .description("List schticks")
    .option("-n, --limit <number>", "Results per page", "20")
    .option("-p, --page <number>", "Page number", "1")
    .option("-a, --active", "Show only active schticks")
    .option("--category <category>", "Filter by category (e.g., Guns, Martial Arts)")
    .option("--path <path>", "Filter by path (e.g., Core, Path of the Warrior)")
    .option("--all", "Show all schticks")
    .option("--json", "Output as JSON")
    .action(async (options) => {
      try {
        const result = await listSchticks({
          limit: parseInt(options.limit),
          page: parseInt(options.page),
          active: options.active ? true : (options.all ? undefined : undefined),
          category: options.category,
          path: options.path,
        });

        if (options.json) {
          console.log(JSON.stringify(result.schticks, null, 2));
          return;
        }

        if (result.schticks.length === 0) {
          info("No schticks found");
          return;
        }

        console.log(`\nSchticks (${result.meta.total_count} total):\n`);
        for (const item of result.schticks) {
          printSchtickSummary(item);
        }

        if (result.meta.total_pages > 1) {
          console.log(`\nPage ${result.meta.current_page} of ${result.meta.total_pages}`);
        }

        // Show available categories and paths
        if (result.categories.length > 0) {
          console.log(`\nCategories: ${result.categories.join(", ")}`);
        }
        if (result.paths.length > 0) {
          console.log(`Paths: ${result.paths.join(", ")}`);
        }
      } catch (err) {
        error(err instanceof Error ? err.message : "Failed to list schticks");
        process.exit(1);
      }
    });

  // SHOW
  schtick
    .command("show <id>")
    .description("Show schtick details")
    .option("--json", "Output as JSON")
    .action(async (id, options) => {
      try {
        const item = await getSchtick(id);

        if (options.json) {
          console.log(JSON.stringify(item, null, 2));
          return;
        }

        printSchtickDetails(item);
      } catch (err) {
        error(err instanceof Error ? err.message : "Failed to get schtick");
        process.exit(1);
      }
    });

  // CREATE
  schtick
    .command("create")
    .description("Create a new schtick")
    .argument("[json]", "Inline JSON")
    .option("-f, --file <path>", "Read from JSON file")
    .option("-n, --name <name>", "Schtick name (shorthand)")
    .option("-c, --category <category>", "Category (e.g., Guns, Martial Arts)")
    .option("--path <path>", "Path (e.g., Core, Path of the Warrior)")
    .action(async (jsonArg, options) => {
      try {
        let data: Record<string, unknown>;

        if (options.file) {
          data = JSON.parse(fs.readFileSync(options.file, "utf-8"));
        } else if (jsonArg) {
          data = JSON.parse(jsonArg);
        } else if (options.name) {
          data = { name: options.name };
          if (options.category) data.category = options.category;
          if (options.path) data.path = options.path;
        } else {
          error("Provide JSON as argument, use --file, or use --name");
          console.log("\nUsage:");
          console.log("  chiwar schtick create --name \"Lightning Reload\" --category Guns");
          console.log("  chiwar schtick create --file schtick.json");
          console.log('  chiwar schtick create \'{"name": "Eagle Eye", "category": "Guns", "path": "Core"}\'');
          process.exit(1);
        }

        const created = await createSchtick(data);
        success(`Created schtick: ${created.name}`);
        console.log(`  ID: ${created.id}`);
        if (created.category) {
          console.log(`  Category: ${created.category}`);
        }
        if (created.path) {
          console.log(`  Path: ${created.path}`);
        }
      } catch (err) {
        if (err instanceof SyntaxError) {
          error("Invalid JSON: " + err.message);
        } else {
          error(err instanceof Error ? err.message : "Failed to create schtick");
        }
        process.exit(1);
      }
    });

  // UPDATE
  schtick
    .command("update <id>")
    .description("Update a schtick")
    .argument("[json]", "Inline JSON")
    .option("-f, --file <path>", "Read from JSON file")
    .option("-n, --name <name>", "Update schtick name")
    .option("-c, --category <category>", "Update category")
    .option("--path <path>", "Update path")
    .action(async (id, jsonArg, options) => {
      try {
        let data: Record<string, unknown>;

        if (options.file) {
          data = JSON.parse(fs.readFileSync(options.file, "utf-8"));
        } else if (jsonArg) {
          data = JSON.parse(jsonArg);
        } else if (options.name || options.category || options.path) {
          data = {};
          if (options.name) data.name = options.name;
          if (options.category) data.category = options.category;
          if (options.path) data.path = options.path;
        } else {
          error("Provide JSON as argument, use --file, or use --name/--category/--path");
          process.exit(1);
        }

        const updated = await updateSchtick(id, data);
        success(`Updated schtick: ${updated.name}`);
      } catch (err) {
        if (err instanceof SyntaxError) {
          error("Invalid JSON: " + err.message);
        } else {
          error(err instanceof Error ? err.message : "Failed to update schtick");
        }
        process.exit(1);
      }
    });

  // DELETE
  schtick
    .command("delete <id>")
    .description("Delete a schtick")
    .option("-y, --yes", "Skip confirmation")
    .action(async (id, options) => {
      try {
        const item = await getSchtick(id);

        if (!options.yes) {
          const inquirer = await import("inquirer");
          const { confirm } = await inquirer.default.prompt([{
            type: "confirm",
            name: "confirm",
            message: `Delete schtick "${item.name}"? This cannot be undone.`,
            default: false,
          }]);
          if (!confirm) {
            info("Cancelled");
            return;
          }
        }

        await deleteSchtick(id);
        success(`Deleted schtick: ${item.name}`);
      } catch (err) {
        error(err instanceof Error ? err.message : "Failed to delete schtick");
        process.exit(1);
      }
    });

  // CATEGORIES - List available categories
  schtick
    .command("categories")
    .description("List available schtick categories")
    .action(async () => {
      try {
        const result = await listSchticks({ limit: 1 });
        if (result.categories.length === 0) {
          info("No categories found");
          return;
        }
        console.log("\nAvailable Categories:\n");
        for (const cat of result.categories) {
          console.log(`  ${cat}`);
        }
      } catch (err) {
        error(err instanceof Error ? err.message : "Failed to list categories");
        process.exit(1);
      }
    });

  // PATHS - List available paths
  schtick
    .command("paths")
    .description("List available schtick paths")
    .action(async () => {
      try {
        const result = await listSchticks({ limit: 1 });
        if (result.paths.length === 0) {
          info("No paths found");
          return;
        }
        console.log("\nAvailable Paths:\n");
        for (const p of result.paths) {
          console.log(`  ${p}`);
        }
      } catch (err) {
        error(err instanceof Error ? err.message : "Failed to list paths");
        process.exit(1);
      }
    });
}

function printSchtickSummary(item: Schtick): void {
  const status = item.active ? "" : " [INACTIVE]";
  const categoryStr = item.category ? ` [${item.category}]` : "";
  const pathStr = item.path ? ` - ${item.path}` : "";

  console.log(`  ${item.name}${categoryStr}${pathStr}${status}`);
  console.log(`    ID: ${item.id}`);
  if (item.bonus) {
    console.log(`    Bonus: Yes`);
  }
  console.log("");
}

function printSchtickDetails(item: Schtick): void {
  console.log(`\n${item.name}`);
  console.log("=".repeat(item.name.length));
  console.log(`  ID: ${item.id}`);
  console.log(`  Status: ${item.active ? "Active" : "Inactive"}`);

  if (item.category) {
    console.log(`  Category: ${item.category}`);
  }
  if (item.path) {
    console.log(`  Path: ${item.path}`);
  }
  if (item.bonus !== undefined) {
    console.log(`  Bonus: ${item.bonus ? "Yes" : "No"}`);
  }
  if (item.archetypes && item.archetypes.length > 0) {
    console.log(`  Archetypes: ${item.archetypes.join(", ")}`);
  }
  if (item.prerequisite) {
    console.log(`  Prerequisite: ${item.prerequisite.name}`);
  }
  if (item.description) {
    console.log(`  Description: ${item.description}`);
  }
  console.log(`  Created: ${new Date(item.created_at).toLocaleDateString()}`);
  console.log("");
}
