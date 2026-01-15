import { Command } from "commander";
import {
  listAdvancements,
  getAdvancement,
  createAdvancement,
  updateAdvancement,
  deleteAdvancement,
  getCharacter,
} from "../lib/api.js";
import { success, error, info } from "../lib/output.js";
import type { Advancement } from "../types/index.js";

export function registerAdvancementCommands(program: Command): void {
  const advancement = program
    .command("advancement")
    .description("Manage character advancements");

  advancement
    .command("list")
    .description("List advancements for a character")
    .argument("<character-id>", "Character ID")
    .option("-n, --limit <number>", "Number of advancements to show", "25")
    .option("-p, --page <number>", "Page number", "1")
    .option("--json", "Output as JSON")
    .action(async (characterId, options) => {
      try {
        // Get character name for display
        const character = await getCharacter(characterId);

        const result = await listAdvancements(characterId, {
          limit: parseInt(options.limit),
          page: parseInt(options.page),
        });

        if (options.json) {
          console.log(JSON.stringify(result.advancements, null, 2));
          return;
        }

        if (result.advancements.length === 0) {
          info(`No advancements found for ${character.name}`);
          return;
        }

        console.log(`\nAdvancements for ${character.name} (${result.meta.total_count} total):\n`);
        for (const adv of result.advancements) {
          printAdvancementSummary(adv);
        }

        if (result.meta.total_pages > 1) {
          console.log(`\nPage ${result.meta.current_page} of ${result.meta.total_pages}`);
        }
      } catch (err) {
        error(err instanceof Error ? err.message : "Failed to list advancements");
        process.exit(1);
      }
    });

  advancement
    .command("show")
    .description("Show details of a specific advancement")
    .argument("<character-id>", "Character ID")
    .argument("<advancement-id>", "Advancement ID")
    .option("--json", "Output as JSON")
    .action(async (characterId, advancementId, options) => {
      try {
        const adv = await getAdvancement(characterId, advancementId);

        if (options.json) {
          console.log(JSON.stringify(adv, null, 2));
          return;
        }

        printAdvancementDetails(adv);
      } catch (err) {
        error(err instanceof Error ? err.message : "Failed to get advancement");
        process.exit(1);
      }
    });

  advancement
    .command("add")
    .description("Add an advancement to a character")
    .argument("<character-id>", "Character ID")
    .argument("[description]", "Advancement description")
    .option("-d, --description <text>", "Advancement description (alternative to argument)")
    .action(async (characterId, descArg, options) => {
      try {
        const description = descArg || options.description;

        // Get character for display
        const character = await getCharacter(characterId);

        const created = await createAdvancement(characterId, { description });

        success(`Added advancement to ${character.name}`);
        console.log(`  ID: ${created.id}`);
        if (created.description) {
          console.log(`  Description: ${created.description}`);
        }
        console.log(`  Created: ${new Date(created.created_at).toLocaleDateString()}`);
      } catch (err) {
        error(err instanceof Error ? err.message : "Failed to create advancement");
        process.exit(1);
      }
    });

  advancement
    .command("update")
    .description("Update an advancement's description")
    .argument("<character-id>", "Character ID")
    .argument("<advancement-id>", "Advancement ID")
    .argument("[description]", "New description")
    .option("-d, --description <text>", "New description (alternative to argument)")
    .action(async (characterId, advancementId, descArg, options) => {
      try {
        const description = descArg || options.description;

        if (!description) {
          error("Provide a description as argument or with --description");
          process.exit(1);
        }

        const updated = await updateAdvancement(characterId, advancementId, { description });

        success("Updated advancement");
        console.log(`  ID: ${updated.id}`);
        console.log(`  Description: ${updated.description || "(none)"}`);
      } catch (err) {
        error(err instanceof Error ? err.message : "Failed to update advancement");
        process.exit(1);
      }
    });

  advancement
    .command("delete")
    .description("Delete an advancement")
    .argument("<character-id>", "Character ID")
    .argument("<advancement-id>", "Advancement ID")
    .action(async (characterId, advancementId) => {
      try {
        // Fetch the advancement first to confirm it exists
        const adv = await getAdvancement(characterId, advancementId);
        await deleteAdvancement(characterId, advancementId);
        success(`Deleted advancement: ${adv.description || adv.id}`);
      } catch (err) {
        error(err instanceof Error ? err.message : "Failed to delete advancement");
        process.exit(1);
      }
    });
}

function printAdvancementSummary(adv: Advancement): void {
  const date = new Date(adv.created_at).toLocaleDateString();
  const desc = adv.description || "(no description)";

  console.log(`  ${desc}`);
  console.log(`    ID: ${adv.id}`);
  console.log(`    Date: ${date}`);
  console.log("");
}

function printAdvancementDetails(adv: Advancement): void {
  console.log(`\nAdvancement`);
  console.log("===========");
  console.log(`  ID: ${adv.id}`);
  console.log(`  Description: ${adv.description || "(none)"}`);
  console.log(`  Character ID: ${adv.character_id}`);
  console.log(`  Created: ${new Date(adv.created_at).toLocaleDateString()}`);
  console.log(`  Updated: ${new Date(adv.updated_at).toLocaleDateString()}`);
  console.log("");
}
