import { Command } from "commander";
import {
  generateEntityImage,
  attachEntityImage,
  aiCreateCharacter,
  aiExtendCharacter,
  getOrphanAiImages,
} from "../lib/api.js";
import { success, error, info, warn } from "../lib/output.js";
import type { EntityClass, MediaLibraryImage } from "../types/index.js";

// Polling configuration
const POLL_INTERVAL_MS = 3000;  // Check every 3 seconds
const POLL_TIMEOUT_MS = 120000; // Timeout after 2 minutes
const EXPECTED_NEW_IMAGES = 3;  // AI generates 3 images

/**
 * Sleep for a given number of milliseconds.
 */
function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Poll the media library for new orphan AI-generated images.
 * Returns the new images when they appear, or null on timeout.
 */
async function pollForNewImages(
  initialImageIds: Set<string>,
  expectedCount: number
): Promise<MediaLibraryImage[] | null> {
  const startTime = Date.now();

  while (Date.now() - startTime < POLL_TIMEOUT_MS) {
    await sleep(POLL_INTERVAL_MS);

    try {
      const currentImages = await getOrphanAiImages();
      const newImages = currentImages.filter((img) => !initialImageIds.has(img.id));

      if (newImages.length >= expectedCount) {
        return newImages;
      }

      // Show progress
      if (newImages.length > 0) {
        process.stdout.write(`\r  Generated ${newImages.length}/${expectedCount} images...`);
      }
    } catch {
      // Continue polling on error
    }
  }

  return null; // Timeout
}

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
    .description("Generate AI images for an entity (polls and auto-attaches first image)")
    .option("--no-attach", "Skip auto-attach, just generate images")
    .action(async (entityType, entityId, options) => {
      try {
        const entityClass = normalizeEntityClass(entityType);
        if (!entityClass) {
          error(`Invalid entity type: ${entityType}`);
          console.log(`\nValid types: ${VALID_ENTITY_TYPES.join(", ")}`);
          process.exit(1);
        }

        // Get current orphan images before generating (to identify new ones)
        let initialImageIds = new Set<string>();
        if (options.attach !== false) {
          try {
            const existingImages = await getOrphanAiImages();
            initialImageIds = new Set(existingImages.map((img) => img.id));
          } catch {
            // Continue without tracking existing images
          }
        }

        info(`Queuing image generation for ${entityClass} ${entityId}...`);
        const result = await generateEntityImage(entityClass, entityId);
        success(result.message);

        // If auto-attach is enabled, poll for new images and attach the first one
        if (options.attach !== false) {
          console.log("\nWaiting for images to be generated...");

          const newImages = await pollForNewImages(initialImageIds, EXPECTED_NEW_IMAGES);

          if (newImages && newImages.length > 0) {
            console.log(""); // Clear the progress line
            success(`Generated ${newImages.length} images`);

            // Attach the first image (most recent, sorted by created_at desc)
            const firstImage = newImages[0];
            info(`Auto-attaching first image to ${entityClass}...`);

            try {
              const attachResult = await attachEntityImage(entityClass, entityId, firstImage.imagekit_url);
              success(`Image attached successfully`);
              if (attachResult.entity && typeof attachResult.entity === "object" && "name" in attachResult.entity) {
                console.log(`  Entity: ${attachResult.entity.name}`);
              }
              console.log(`  Image URL: ${firstImage.imagekit_url}`);
            } catch (attachErr) {
              warn(`Generated images but failed to attach: ${attachErr instanceof Error ? attachErr.message : "Unknown error"}`);
              console.log(`\nImages available in media library. Use 'chiwar ai attach' to attach manually.`);
            }
          } else {
            warn("Timed out waiting for images. They may still be generating.");
            console.log("Check the web app or use 'chiwar ai attach' when images are ready.");
          }
        } else {
          console.log("\nImages will be generated in the background.");
          console.log("Use 'chiwar ai attach' to attach an image when ready.");
        }
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
