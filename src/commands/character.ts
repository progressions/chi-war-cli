import { Command } from "commander";
import { createCharacterRaw, updateCharacterRaw, listCampaigns, searchFaction } from "../lib/api.js";
import { getCurrentCampaignId, setCurrentCampaignId } from "../lib/config.js";
import { success, error, info } from "../lib/output.js";
import inquirer from "inquirer";
import * as fs from "fs";

export function registerCharacterCommands(program: Command): void {
  const character = program
    .command("character")
    .description("Manage characters");

  character
    .command("create")
    .description("Create a new character from JSON")
    .argument("[json]", "Character JSON (inline)")
    .option("-f, --file <path>", "Read character JSON from file")
    .option("-c, --campaign <id>", "Campaign ID (uses current if not specified)")
    .option("--faction <name>", "Assign to faction (by name, fuzzy match)")
    .action(async (jsonArg, options) => {
      try {
        // Get JSON from argument or file
        let characterJson: Record<string, unknown>;

        if (options.file) {
          // Read from file
          const fileContent = fs.readFileSync(options.file, "utf-8");
          characterJson = JSON.parse(fileContent);
        } else if (jsonArg) {
          // Parse inline JSON
          characterJson = JSON.parse(jsonArg);
        } else {
          error("Provide character JSON as argument or use --file");
          console.log("\nUsage:");
          console.log('  chiwar character create \'{"name": "...", "action_values": {...}}\'');
          console.log("  chiwar character create --file character.json");
          console.log("\nExample:");
          console.log(`  chiwar character create '${JSON.stringify({
            name: "Triad Thug",
            action_values: { Type: "Mook", Guns: 8, MainAttack: "Guns" }
          })}'`);
          process.exit(1);
        }

        // Ensure campaign is set
        let campaignId = options.campaign || getCurrentCampaignId();

        if (!campaignId) {
          info("No campaign selected. Fetching your campaigns...");
          const campaigns = await listCampaigns();

          if (campaigns.length === 0) {
            error("No campaigns found. Create a campaign first at chiwar.net");
            process.exit(1);
          }

          if (campaigns.length === 1) {
            campaignId = campaigns[0].id;
            setCurrentCampaignId(campaignId);
            info(`Using campaign: ${campaigns[0].name}`);
          } else {
            const { selectedCampaign } = await inquirer.prompt([
              {
                type: "list",
                name: "selectedCampaign",
                message: "Select a campaign:",
                choices: campaigns.map((c) => ({
                  name: c.name,
                  value: c.id,
                })),
              },
            ]);
            campaignId = selectedCampaign;
            setCurrentCampaignId(campaignId);
          }
        }

        // Handle faction lookup if specified
        if (options.faction) {
          const faction = await searchFaction(options.faction);
          if (!faction) {
            error(`No faction found matching "${options.faction}"`);
            console.log("\nUse 'chiwar faction list' to see all factions");
            process.exit(1);
          }
          characterJson.faction_id = faction.id;
          info(`Faction: ${faction.name}`);
        }

        // Create the character
        const created = await createCharacterRaw(characterJson, campaignId);

        success(`Created character: ${created.name}`);
        console.log(`  ID: ${created.id}`);
        console.log(`  Type: ${created.action_values?.Type || "PC"}`);

        if (created.action_values) {
          const av = created.action_values;
          if (av.MainAttack) console.log(`  Attack: ${av.MainAttack} ${av[av.MainAttack] || 0}`);
          if (av.Defense) console.log(`  Defense: ${av.Defense}`);
          if (av.Toughness) console.log(`  Toughness: ${av.Toughness}`);
          if (av.Speed) console.log(`  Speed: ${av.Speed}`);
        }
      } catch (err) {
        if (err instanceof SyntaxError) {
          error("Invalid JSON: " + err.message);
        } else {
          error(err instanceof Error ? err.message : "Failed to create character");
        }
        process.exit(1);
      }
    });

  character
    .command("update")
    .description("Update an existing character from JSON")
    .argument("<id>", "Character ID to update")
    .argument("[json]", "Character JSON (inline)")
    .option("-f, --file <path>", "Read character JSON from file")
    .action(async (id, jsonArg, options) => {
      try {
        // Get JSON from argument or file
        let characterJson: Record<string, unknown>;

        if (options.file) {
          // Read from file
          const fileContent = fs.readFileSync(options.file, "utf-8");
          characterJson = JSON.parse(fileContent);
        } else if (jsonArg) {
          // Parse inline JSON
          characterJson = JSON.parse(jsonArg);
        } else {
          error("Provide character JSON as argument or use --file");
          console.log("\nUsage:");
          console.log('  chiwar character update <id> \'{"name": "...", "action_values": {...}}\'');
          console.log("  chiwar character update <id> --file character.json");
          process.exit(1);
        }

        // Update the character
        const updated = await updateCharacterRaw(id, characterJson);

        success(`Updated character: ${updated.name}`);
        console.log(`  ID: ${updated.id}`);
        console.log(`  Type: ${updated.action_values?.Type || "PC"}`);

        if (updated.action_values) {
          const av = updated.action_values;
          if (av.MainAttack) console.log(`  Attack: ${av.MainAttack} ${av[av.MainAttack] || 0}`);
          if (av.Defense) console.log(`  Defense: ${av.Defense}`);
          if (av.Toughness) console.log(`  Toughness: ${av.Toughness}`);
          if (av.Speed) console.log(`  Speed: ${av.Speed}`);
        }
      } catch (err) {
        if (err instanceof SyntaxError) {
          error("Invalid JSON: " + err.message);
        } else {
          error(err instanceof Error ? err.message : "Failed to update character");
        }
        process.exit(1);
      }
    });
}
