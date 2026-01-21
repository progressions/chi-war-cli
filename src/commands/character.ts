import { Command } from "commander";
import { createCharacterRaw, updateCharacterRaw, listCampaigns, searchFaction, listCharacters, getCharacter, deleteCharacter, getEntityNotionPage, syncToNotion, syncFromNotion, getEntitySyncLogs, searchCharacters } from "../lib/api.js";
import { getCurrentCampaignId, setCurrentCampaignId } from "../lib/config.js";
import { success, error, info } from "../lib/output.js";
import inquirer from "inquirer";
import * as fs from "fs";
import type { Character } from "../types/index.js";
import { linkEntityToNotion } from "../lib/notionLinker.js";

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
    .option("-i, --image <path>", "Attach image file to character")
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
          console.log("  chiwar character create --file character.json --image ./avatar.png");
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
          const result = await listCampaigns();
          const campaigns = result.campaigns;

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

        // Create the character with optional image
        const created = await createCharacterRaw(characterJson, {
          campaignId,
          imagePath: options.image,
        });

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
        if (options.image) {
          console.log(`  Image: uploaded`);
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
    .option("-i, --image <path>", "Attach or replace image file")
    .action(async (id, jsonArg, options) => {
      try {
        // Get JSON from argument, file, or use empty object for image-only updates
        let characterJson: Record<string, unknown>;

        if (options.file) {
          // Read from file
          const fileContent = fs.readFileSync(options.file, "utf-8");
          characterJson = JSON.parse(fileContent);
        } else if (jsonArg) {
          // Parse inline JSON
          characterJson = JSON.parse(jsonArg);
        } else if (options.image) {
          // Allow image-only updates with no JSON
          characterJson = {};
        } else {
          error("Provide character JSON as argument, use --file, or use --image");
          console.log("\nUsage:");
          console.log('  chiwar character update <id> \'{"name": "...", "action_values": {...}}\'');
          console.log("  chiwar character update <id> --file character.json");
          console.log("  chiwar character update <id> --image ./new-avatar.png");
          console.log("  chiwar character update <id> --file character.json --image ./avatar.png");
          process.exit(1);
        }

        // Update the character with optional image
        const updated = await updateCharacterRaw(id, characterJson, {
          imagePath: options.image,
        });

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
        if (options.image) {
          console.log(`  Image: uploaded`);
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

  character
    .command("list")
    .description("List characters in the current campaign")
    .option("-n, --limit <number>", "Number of characters to show", "10")
    .option("-p, --page <number>", "Page number", "1")
    .option("-t, --type <type>", "Filter by type (Mook, Featured Foe, Boss, etc.)")
    .option("--json", "Output as JSON")
    .action(async (options) => {
      try {
        const campaignId = getCurrentCampaignId();
        if (!campaignId) {
          error("No campaign selected. Run 'chiwar config set campaign <id>'");
          process.exit(1);
        }

        const result = await listCharacters({
          campaignId,
          limit: parseInt(options.limit),
          page: parseInt(options.page),
          sort: "created_at",
          direction: "desc",
        });

        let characters = result.characters;

        // Filter by type if specified
        if (options.type) {
          const typeFilter = options.type.toLowerCase();
          characters = characters.filter((c) => {
            const charType = c.action_values?.Type?.toLowerCase() || "";
            return charType.includes(typeFilter);
          });
        }

        if (options.json) {
          console.log(JSON.stringify(characters, null, 2));
          return;
        }

        if (characters.length === 0) {
          info("No characters found");
          return;
        }

        console.log(`\nCharacters (${result.meta.total_count} total):\n`);
        for (const char of characters) {
          printCharacterSummary(char);
        }

        if (result.meta.total_pages > 1) {
          console.log(`\nPage ${result.meta.current_page} of ${result.meta.total_pages}`);
        }
      } catch (err) {
        error(err instanceof Error ? err.message : "Failed to list characters");
        process.exit(1);
      }
    });

  character
    .command("show")
    .description("Show details of a specific character")
    .argument("<id>", "Character ID")
    .option("--json", "Output as JSON")
    .action(async (id, options) => {
      try {
        const char = await getCharacter(id);

        if (options.json) {
          console.log(JSON.stringify(char, null, 2));
          return;
        }

        printCharacterDetails(char);
      } catch (err) {
        error(err instanceof Error ? err.message : "Failed to get character");
        process.exit(1);
      }
    });

  character
    .command("delete")
    .description("Delete a character")
    .argument("<id>", "Character ID to delete")
    .action(async (id) => {
      try {
        // Fetch the character first to display name
        const char = await getCharacter(id);
        await deleteCharacter(id);
        success(`Deleted character: ${char.name}`);
      } catch (err) {
        error(err instanceof Error ? err.message : "Failed to delete character");
        process.exit(1);
      }
    });

  character
    .command("notion-page")
    .description("Fetch raw Notion page JSON for a character (for debugging)")
    .argument("<id>", "Character ID")
    .action(async (id) => {
      try {
        const result = await getEntityNotionPage("characters", id);
        console.log(JSON.stringify(result, null, 2));
      } catch (err) {
        error(err instanceof Error ? err.message : "Failed to fetch Notion page");
        process.exit(1);
      }
    });

  // LINK NOTION - Attach a Notion page by name (fuzzy) or page query
  character
    .command("link-notion <nameOrId>")
    .description("Link a character to a Notion page by character name/ID and Notion page name")
    .option("--notion <pageName>", "Notion page name to search (defaults to character name)")
    .action(async (nameOrId, options) => {
      try {
        const result = await linkEntityToNotion<Character>({
          target: nameOrId,
          notionName: options.notion,
          entityLabel: "character",
          findById: getCharacter,
          searchByName: async (name) => {
            const list = await searchCharacters(name);
            return list.characters || list;
          },
          updateEntity: async (id, notionPageId) => {
            const updated = await updateCharacterRaw(id, { notion_page_id: notionPageId });
            return updated;
          },
          getId: (c) => (c as any).id,
          getName: (c) => (c as any).name,
          getNotionId: (c) => (c as any).notion_page_id,
        });

        if (result.updated) {
          success(`Linked character "${result.entity.name}" to Notion page ${result.notionPage.id}`);
        } else {
          info(`Character "${result.entity.name}" is already linked to ${result.notionPage.id}`);
        }
      } catch (err) {
        if (err instanceof Error && err.message === "Linking cancelled") {
          info("Linking cancelled");
          return;
        }
        error(err instanceof Error ? err.message : "Failed to link character to Notion");
        process.exit(1);
      }
    });

  // SYNC TO NOTION - Push character data to Notion
  character
    .command("sync-to-notion")
    .description("Sync character data TO Notion (creates or updates Notion page)")
    .argument("<id>", "Character ID")
    .action(async (id) => {
      try {
        const char = await getCharacter(id);
        info(`Syncing "${char.name}" to Notion...`);

        const result = await syncToNotion("characters", id);
        success(result.message);
        console.log(`  Status: ${result.status}`);
        console.log(`  Character: ${char.name}`);
      } catch (err) {
        error(err instanceof Error ? err.message : "Failed to sync to Notion");
        process.exit(1);
      }
    });

  // SYNC FROM NOTION - Pull character data from Notion
  character
    .command("sync-from-notion")
    .description("Sync character data FROM Notion (updates character with Notion page content)")
    .argument("<id>", "Character ID")
    .option("--json", "Output updated character as JSON")
    .action(async (id, options) => {
      try {
        const char = await getCharacter(id);
        info(`Syncing "${char.name}" from Notion...`);

        const updated = await syncFromNotion<Character>("characters", id);

        if (options.json) {
          console.log(JSON.stringify(updated, null, 2));
          return;
        }

        success(`Character "${updated.name}" synced from Notion`);
        printCharacterDetails(updated);
      } catch (err) {
        error(err instanceof Error ? err.message : "Failed to sync from Notion");
        process.exit(1);
      }
    });

  // SYNC LOGS - Fetch Notion sync logs for debugging
  character
    .command("sync-logs")
    .description("Fetch Notion sync logs for a character (for debugging)")
    .argument("<id>", "Character ID")
    .option("-n, --limit <number>", "Number of logs to show", "10")
    .option("-p, --page <number>", "Page number", "1")
    .option("--json", "Output as JSON")
    .action(async (id, options) => {
      try {
        const result = await getEntitySyncLogs("characters", id, {
          limit: parseInt(options.limit),
          page: parseInt(options.page),
        });

        if (options.json) {
          console.log(JSON.stringify(result, null, 2));
          return;
        }

        if (result.notion_sync_logs.length === 0) {
          info("No sync logs found for this character");
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

function printCharacterSummary(char: Character): void {
  const av = char.action_values || {};
  const type = av.Type || "PC";
  const mainAttack = av.MainAttack;
  const attackValue = mainAttack ? av[mainAttack] : null;

  let stats = "";
  if (attackValue) stats += `${mainAttack} ${attackValue}`;
  if (av.Defense) stats += stats ? `, Def ${av.Defense}` : `Def ${av.Defense}`;

  console.log(`  ${char.name}`);
  console.log(`    ID: ${char.id}`);
  console.log(`    Type: ${type}${stats ? ` | ${stats}` : ""}`);
  console.log("");
}

function printCharacterDetails(char: Character): void {
  const av = char.action_values || {};

  console.log(`\n${char.name}`);
  console.log("=".repeat(char.name.length));
  console.log(`  ID: ${char.id}`);
  console.log(`  Type: ${av.Type || "PC"}`);

  if (av.MainAttack) {
    const mainVal = av[av.MainAttack];
    console.log(`  Main Attack: ${av.MainAttack} ${mainVal || 0}`);
  }

  if (av.Defense) console.log(`  Defense: ${av.Defense}`);
  if (av.Toughness) console.log(`  Toughness: ${av.Toughness}`);
  if (av.Speed) console.log(`  Speed: ${av.Speed}`);
  if (av.Fortune) console.log(`  Fortune: ${av.Fortune}`);
  if (av.Wounds) console.log(`  Wounds: ${av.Wounds}`);

  if (char.faction_id) console.log(`  Faction ID: ${char.faction_id}`);

  console.log(`  Created: ${new Date(char.created_at).toLocaleDateString()}`);
  console.log("");
}
