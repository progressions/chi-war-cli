import { Command } from "commander";
import { createCharacter, listCampaigns } from "../lib/api.js";
import { getCurrentCampaignId, setCurrentCampaignId } from "../lib/config.js";
import { success, error, info, table } from "../lib/output.js";
import type { CharacterType } from "../types/index.js";
import inquirer from "inquirer";

const VALID_TYPES: CharacterType[] = [
  "pc",
  "npc",
  "featured_foe",
  "boss",
  "uber_boss",
  "mook",
  "ally",
];

// Default wounds by character type
const DEFAULT_WOUNDS: Record<CharacterType, number> = {
  pc: 0,
  npc: 0,
  featured_foe: 0,
  boss: 0,
  uber_boss: 0,
  mook: 0,
  ally: 0,
};

export function registerCharacterCommands(program: Command): void {
  const character = program
    .command("character")
    .description("Manage characters");

  character
    .command("create")
    .description("Create a new character")
    .requiredOption("-n, --name <name>", "Character name")
    .requiredOption(
      "-t, --type <type>",
      `Character type (${VALID_TYPES.join("|")})`
    )
    .option("-w, --wounds <number>", "Starting wounds", parseInt)
    .option("-d, --defense <number>", "Defense value", parseInt)
    .option("-s, --speed <number>", "Speed value", parseInt)
    .option("--toughness <number>", "Toughness value", parseInt)
    .option("-f, --fortune <number>", "Fortune points", parseInt)
    .option("--description <text>", "Character description")
    .option("-c, --campaign <id>", "Campaign ID (uses current if not specified)")
    .action(async (options) => {
      try {
        // Validate type
        if (!VALID_TYPES.includes(options.type as CharacterType)) {
          error(`Invalid type "${options.type}". Must be one of: ${VALID_TYPES.join(", ")}`);
          process.exit(1);
        }

        // Determine campaign ID
        let campaignId = options.campaign || getCurrentCampaignId();

        if (!campaignId) {
          // Need to select a campaign
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

        const characterType = options.type as CharacterType;

        const character = await createCharacter(
          {
            name: options.name,
            character_type: characterType,
            wounds: options.wounds ?? DEFAULT_WOUNDS[characterType],
            defense: options.defense,
            speed: options.speed,
            toughness: options.toughness,
            fortune: options.fortune,
            description: options.description,
          },
          campaignId
        );

        success(`Created character: ${character.name}`);
        table({
          ID: character.id,
          Type: character.character_type,
          Defense: character.defense,
          Speed: character.speed,
          Toughness: character.toughness,
        });
      } catch (err) {
        error(err instanceof Error ? err.message : "Failed to create character");
        process.exit(1);
      }
    });
}
