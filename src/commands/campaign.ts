import { Command } from "commander";
import {
  listCampaigns,
  getCampaign,
  createCampaign,
  updateCampaign,
  deleteCampaign,
  setCurrentCampaign,
} from "../lib/api.js";
import { getCurrentCampaignId, setCurrentCampaignId } from "../lib/config.js";
import { success, error, info, warn } from "../lib/output.js";
import * as fs from "fs";
import type { Campaign } from "../types/index.js";

export function registerCampaignCommands(program: Command): void {
  const campaign = program
    .command("campaign")
    .description("Manage campaigns");

  // LIST
  campaign
    .command("list")
    .description("List campaigns")
    .option("-n, --limit <number>", "Results per page", "20")
    .option("-p, --page <number>", "Page number", "1")
    .option("--json", "Output as JSON")
    .action(async (options) => {
      try {
        const result = await listCampaigns({
          limit: parseInt(options.limit),
          page: parseInt(options.page),
        });

        if (options.json) {
          console.log(JSON.stringify(result.campaigns, null, 2));
          return;
        }

        const currentId = getCurrentCampaignId() ?? undefined;

        if (result.campaigns.length === 0) {
          info("No campaigns found");
          return;
        }

        console.log(`\nCampaigns (${result.meta.total_count} total):\n`);
        for (const item of result.campaigns) {
          printCampaignSummary(item, currentId);
        }

        if (result.meta.total_pages > 1) {
          console.log(`\nPage ${result.meta.current_page} of ${result.meta.total_pages}`);
        }
      } catch (err) {
        error(err instanceof Error ? err.message : "Failed to list campaigns");
        process.exit(1);
      }
    });

  // SHOW
  campaign
    .command("show [id]")
    .description("Show campaign details (defaults to current campaign)")
    .option("--json", "Output as JSON")
    .action(async (id, options) => {
      try {
        const campaignId = id || getCurrentCampaignId();
        if (!campaignId) {
          error("No campaign ID provided and no current campaign set");
          console.log("\nUsage:");
          console.log("  chiwar campaign show <id>");
          console.log("  chiwar campaign set <id>  # Set current campaign first");
          process.exit(1);
        }

        const item = await getCampaign(campaignId);

        if (options.json) {
          console.log(JSON.stringify(item, null, 2));
          return;
        }

        printCampaignDetails(item);
      } catch (err) {
        error(err instanceof Error ? err.message : "Failed to get campaign");
        process.exit(1);
      }
    });

  // CREATE
  campaign
    .command("create")
    .description("Create a new campaign")
    .argument("[json]", "Inline JSON")
    .option("-f, --file <path>", "Read from JSON file")
    .option("-n, --name <name>", "Campaign name (shorthand)")
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
          console.log("  chiwar campaign create --name \"My Campaign\"");
          console.log("  chiwar campaign create --file campaign.json");
          console.log('  chiwar campaign create \'{"name": "My Campaign"}\'');
          process.exit(1);
        }

        const created = await createCampaign(data);
        success(`Created campaign: ${created.name}`);
        console.log(`  ID: ${created.id}`);

        // Offer to set as current
        console.log(`\nTo set as current campaign:`);
        console.log(`  chiwar campaign set ${created.id}`);
      } catch (err) {
        if (err instanceof SyntaxError) {
          error("Invalid JSON: " + err.message);
        } else {
          error(err instanceof Error ? err.message : "Failed to create campaign");
        }
        process.exit(1);
      }
    });

  // UPDATE
  campaign
    .command("update [id]")
    .description("Update a campaign (defaults to current campaign)")
    .argument("[json]", "Inline JSON")
    .option("-f, --file <path>", "Read from JSON file")
    .option("-n, --name <name>", "Update campaign name")
    .action(async (id, jsonArg, options) => {
      try {
        const campaignId = id || getCurrentCampaignId();
        if (!campaignId) {
          error("No campaign ID provided and no current campaign set");
          process.exit(1);
        }

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

        const updated = await updateCampaign(campaignId, data);
        success(`Updated campaign: ${updated.name}`);
      } catch (err) {
        if (err instanceof SyntaxError) {
          error("Invalid JSON: " + err.message);
        } else {
          error(err instanceof Error ? err.message : "Failed to update campaign");
        }
        process.exit(1);
      }
    });

  // DELETE
  campaign
    .command("delete <id>")
    .description("Delete a campaign")
    .option("-y, --yes", "Skip confirmation")
    .action(async (id, options) => {
      try {
        // Get campaign info for confirmation
        const item = await getCampaign(id);

        if (!options.yes) {
          const inquirer = await import("inquirer");
          const { confirm } = await inquirer.default.prompt([{
            type: "confirm",
            name: "confirm",
            message: `Delete campaign "${item.name}"? This cannot be undone.`,
            default: false,
          }]);
          if (!confirm) {
            info("Cancelled");
            return;
          }
        }

        await deleteCampaign(id);
        success(`Deleted campaign: ${item.name}`);

        // Clear current campaign if it was deleted
        if (getCurrentCampaignId() === id) {
          setCurrentCampaignId(undefined);
          warn("Current campaign cleared (deleted campaign was active)");
        }
      } catch (err) {
        error(err instanceof Error ? err.message : "Failed to delete campaign");
        process.exit(1);
      }
    });

  // SET - Set current campaign (both locally and on server)
  campaign
    .command("set <id>")
    .description("Set current campaign (updates local config and server)")
    .action(async (id) => {
      try {
        // First, set on server
        const updated = await setCurrentCampaign(id);

        // Then, set locally
        setCurrentCampaignId(id);

        success(`Current campaign set to: ${updated.name}`);
        console.log(`  ID: ${updated.id}`);
      } catch (err) {
        error(err instanceof Error ? err.message : "Failed to set current campaign");
        process.exit(1);
      }
    });

  // CURRENT - Show current campaign
  campaign
    .command("current")
    .description("Show current campaign")
    .option("--json", "Output as JSON")
    .action(async (options) => {
      try {
        const currentId = getCurrentCampaignId();
        if (!currentId) {
          info("No current campaign set");
          console.log("\nUse 'chiwar campaign set <id>' to set one");
          return;
        }

        const item = await getCampaign(currentId);

        if (options.json) {
          console.log(JSON.stringify(item, null, 2));
          return;
        }

        console.log("\nCurrent Campaign:");
        printCampaignDetails(item);
      } catch (err) {
        error(err instanceof Error ? err.message : "Failed to get current campaign");
        process.exit(1);
      }
    });
}

function printCampaignSummary(item: Campaign, currentId?: string): void {
  const isCurrent = item.id === currentId;
  const marker = isCurrent ? " *" : "";

  console.log(`  ${item.name}${marker}`);
  console.log(`    ID: ${item.id}`);
  if (item.description) {
    const desc = item.description.length > 60
      ? item.description.substring(0, 60) + "..."
      : item.description;
    console.log(`    ${desc}`);
  }
  console.log("");
}

function printCampaignDetails(item: Campaign): void {
  console.log(`\n${item.name}`);
  console.log("=".repeat(item.name.length));
  console.log(`  ID: ${item.id}`);
  if (item.description) {
    console.log(`  Description: ${item.description}`);
  }
  console.log(`  Active: ${item.active ? "Yes" : "No"}`);
  console.log(`  Gamemaster ID: ${item.gamemaster_id}`);
  if (item.current_fight_id) {
    console.log(`  Current Fight: ${item.current_fight_id}`);
  }
  console.log(`  Created: ${new Date(item.created_at).toLocaleDateString()}`);
  console.log("");
}
