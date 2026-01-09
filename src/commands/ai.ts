import { Command } from "commander";
import {
  generateEntityImage,
  attachEntityImage,
  aiCreateCharacter,
  aiExtendCharacter,
} from "../lib/api.js";
import { success, error, info } from "../lib/output.js";
import type { EntityClass } from "../types/index.js";

const VALID_ENTITY_TYPES = [
  "character",
  "vehicle",
  "party",
  "faction",
  "site",
  "weapon",
  "schtick",
  "fight",
  "campaign",
] as const;

function normalizeEntityClass(input: string): EntityClass | null {
  const lower = input.toLowerCase();
  const mapping: Record<string, EntityClass> = {
    character: "Character",
    vehicle: "Vehicle",
    party: "Party",
    faction: "Faction",
    site: "Site",
    weapon: "Weapon",
    schtick: "Schtick",
    fight: "Fight",
    campaign: "Campaign",
  };
  return mapping[lower] || null;
}

export function registerAiCommands(program: Command): void {
  const ai = program
    .command("ai")
    .description("AI image generation and character creation");

  // IMAGE - Generate images for an entity
  ai
    .command("image <entity-type> <entity-id>")
    .description("Generate AI images for an entity")
    .action(async (entityType, entityId) => {
      try {
        const entityClass = normalizeEntityClass(entityType);
        if (!entityClass) {
          error(`Invalid entity type: ${entityType}`);
          console.log(`\nValid types: ${VALID_ENTITY_TYPES.join(", ")}`);
          process.exit(1);
        }

        info(`Queuing image generation for ${entityClass} ${entityId}...`);
        const result = await generateEntityImage(entityClass, entityId);
        success(result.message);
        console.log("\nImages will be generated in the background.");
        console.log("Check the web app or websocket for completion notification.");
      } catch (err) {
        error(err instanceof Error ? err.message : "Failed to generate image");
        process.exit(1);
      }
    });

  // ATTACH - Attach an image URL to an entity
  ai
    .command("attach <entity-type> <entity-id> <image-url>")
    .description("Attach an image from URL to an entity (GM only)")
    .action(async (entityType, entityId, imageUrl) => {
      try {
        const entityClass = normalizeEntityClass(entityType);
        if (!entityClass) {
          error(`Invalid entity type: ${entityType}`);
          console.log(`\nValid types: ${VALID_ENTITY_TYPES.join(", ")}`);
          process.exit(1);
        }

        info(`Attaching image to ${entityClass} ${entityId}...`);
        const result = await attachEntityImage(entityClass, entityId, imageUrl);
        success(`Image attached to ${entityClass}`);
        if (result.entity && typeof result.entity === "object" && "name" in result.entity) {
          console.log(`  Name: ${result.entity.name}`);
        }
      } catch (err) {
        error(err instanceof Error ? err.message : "Failed to attach image");
        process.exit(1);
      }
    });

  // CREATE - Create a character from AI description
  ai
    .command("create <description>")
    .description("Create a character using AI from a text description")
    .action(async (description) => {
      try {
        if (!description || description.trim().length === 0) {
          error("Description is required");
          process.exit(1);
        }

        info(`Creating character from description: "${description.substring(0, 50)}${description.length > 50 ? "..." : ""}"...`);
        const result = await aiCreateCharacter(description);
        success(result.message);
        console.log("\nCharacter will be created in the background.");
        console.log("Check the web app or websocket for completion notification.");
      } catch (err) {
        error(err instanceof Error ? err.message : "Failed to create character with AI");
        process.exit(1);
      }
    });

  // EXTEND - Extend an existing character with AI
  ai
    .command("extend <character-id>")
    .description("Extend an existing character with AI-generated content")
    .action(async (characterId) => {
      try {
        info(`Extending character ${characterId} with AI...`);
        const result = await aiExtendCharacter(characterId);
        success(result.message);
        console.log("\nCharacter will be extended in the background.");
        console.log("Check the web app or websocket for completion notification.");
      } catch (err) {
        error(err instanceof Error ? err.message : "Failed to extend character");
        process.exit(1);
      }
    });

  // TYPES - List valid entity types for image generation
  ai
    .command("types")
    .description("List valid entity types for AI image generation")
    .action(() => {
      console.log("\nValid entity types for AI image generation:\n");
      for (const type of VALID_ENTITY_TYPES) {
        console.log(`  ${type}`);
      }
      console.log("\nExample: chiwar ai image character abc-123-def");
    });
}
