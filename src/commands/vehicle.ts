import { Command } from "commander";
import {
  listVehicles,
  getVehicle,
  createVehicle,
  updateVehicle,
  deleteVehicle,
} from "../lib/api.js";
import { success, error, info } from "../lib/output.js";
import * as fs from "fs";
import type { Vehicle, VehicleActionValues } from "../types/index.js";

export function registerVehicleCommands(program: Command): void {
  const vehicle = program
    .command("vehicle")
    .description("Manage vehicles (for chase scenes)");

  // LIST
  vehicle
    .command("list")
    .description("List vehicles")
    .option("-n, --limit <number>", "Results per page", "20")
    .option("-p, --page <number>", "Page number", "1")
    .option("-a, --active", "Show only active vehicles")
    .option("--all", "Show all vehicles")
    .option("--json", "Output as JSON")
    .action(async (options) => {
      try {
        const result = await listVehicles({
          limit: parseInt(options.limit),
          page: parseInt(options.page),
          active: options.active ? true : (options.all ? undefined : undefined),
        });

        if (options.json) {
          console.log(JSON.stringify(result.vehicles, null, 2));
          return;
        }

        if (result.vehicles.length === 0) {
          info("No vehicles found");
          return;
        }

        console.log(`\nVehicles (${result.meta.total_count} total):\n`);
        for (const item of result.vehicles) {
          printVehicleSummary(item);
        }

        if (result.meta.total_pages > 1) {
          console.log(`\nPage ${result.meta.current_page} of ${result.meta.total_pages}`);
        }
      } catch (err) {
        error(err instanceof Error ? err.message : "Failed to list vehicles");
        process.exit(1);
      }
    });

  // SHOW
  vehicle
    .command("show <id>")
    .description("Show vehicle details")
    .option("--json", "Output as JSON")
    .action(async (id, options) => {
      try {
        const item = await getVehicle(id);

        if (options.json) {
          console.log(JSON.stringify(item, null, 2));
          return;
        }

        printVehicleDetails(item);
      } catch (err) {
        error(err instanceof Error ? err.message : "Failed to get vehicle");
        process.exit(1);
      }
    });

  // CREATE
  vehicle
    .command("create")
    .description("Create a new vehicle")
    .argument("[json]", "Inline JSON")
    .option("-f, --file <path>", "Read from JSON file")
    .option("-n, --name <name>", "Vehicle name (shorthand)")
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
          console.log("  chiwar vehicle create --name \"Muscle Car\"");
          console.log("  chiwar vehicle create --file vehicle.json");
          console.log('  chiwar vehicle create \'{"name": "Motorcycle", "action_values": {"Acceleration": 8}}\'');
          process.exit(1);
        }

        const created = await createVehicle(data);
        success(`Created vehicle: ${created.name}`);
        console.log(`  ID: ${created.id}`);
      } catch (err) {
        if (err instanceof SyntaxError) {
          error("Invalid JSON: " + err.message);
        } else {
          error(err instanceof Error ? err.message : "Failed to create vehicle");
        }
        process.exit(1);
      }
    });

  // UPDATE
  vehicle
    .command("update <id>")
    .description("Update a vehicle")
    .argument("[json]", "Inline JSON")
    .option("-f, --file <path>", "Read from JSON file")
    .option("-n, --name <name>", "Update vehicle name")
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

        const updated = await updateVehicle(id, data);
        success(`Updated vehicle: ${updated.name}`);
      } catch (err) {
        if (err instanceof SyntaxError) {
          error("Invalid JSON: " + err.message);
        } else {
          error(err instanceof Error ? err.message : "Failed to update vehicle");
        }
        process.exit(1);
      }
    });

  // DELETE
  vehicle
    .command("delete <id>")
    .description("Delete a vehicle")
    .option("-y, --yes", "Skip confirmation")
    .action(async (id, options) => {
      try {
        const item = await getVehicle(id);

        if (!options.yes) {
          const inquirer = await import("inquirer");
          const { confirm } = await inquirer.default.prompt([{
            type: "confirm",
            name: "confirm",
            message: `Delete vehicle "${item.name}"? This cannot be undone.`,
            default: false,
          }]);
          if (!confirm) {
            info("Cancelled");
            return;
          }
        }

        await deleteVehicle(id);
        success(`Deleted vehicle: ${item.name}`);
      } catch (err) {
        error(err instanceof Error ? err.message : "Failed to delete vehicle");
        process.exit(1);
      }
    });
}

function printVehicleSummary(item: Vehicle): void {
  const status = item.active ? "" : " [INACTIVE]";

  console.log(`  ${item.name}${status}`);
  console.log(`    ID: ${item.id}`);
  if (item.action_values) {
    const stats = formatVehicleStats(item.action_values);
    if (stats) console.log(`    Stats: ${stats}`);
  }
  console.log("");
}

function formatVehicleStats(av: VehicleActionValues): string {
  const parts: string[] = [];
  if (av.Acceleration) parts.push(`Accel: ${av.Acceleration}`);
  if (av.Handling) parts.push(`Hand: ${av.Handling}`);
  if (av.Frame) parts.push(`Frame: ${av.Frame}`);
  if (av.Squeal) parts.push(`Squeal: ${av.Squeal}`);
  if (av.Crunch) parts.push(`Crunch: ${av.Crunch}`);
  return parts.join(", ");
}

function printVehicleDetails(item: Vehicle): void {
  console.log(`\n${item.name}`);
  console.log("=".repeat(item.name.length));
  console.log(`  ID: ${item.id}`);
  console.log(`  Status: ${item.active ? "Active" : "Inactive"}`);

  if (item.action_values) {
    const av = item.action_values;
    console.log(`\n  Stats:`);
    if (av.Acceleration !== undefined) console.log(`    Acceleration: ${av.Acceleration}`);
    if (av.Handling !== undefined) console.log(`    Handling: ${av.Handling}`);
    if (av.Frame !== undefined) console.log(`    Frame: ${av.Frame}`);
    if (av.Squeal !== undefined) console.log(`    Squeal: ${av.Squeal}`);
    if (av.Crunch !== undefined) console.log(`    Crunch: ${av.Crunch}`);
    if (av.Condition !== undefined) console.log(`    Condition: ${av.Condition}`);
  }

  if (item.description) {
    console.log(`  Description: ${item.description}`);
  }
  console.log(`  Created: ${new Date(item.created_at).toLocaleDateString()}`);
  console.log("");
}
