import { Command } from "commander";
import { listParties, getParty, createParty, updateParty, deleteParty, searchFaction, listPartyTemplates, applyPartyTemplate, assignCharacterToSlot, clearSlot } from "../lib/api.js";
import { getCurrentCampaignId } from "../lib/config.js";
import { success, error, info } from "../lib/output.js";
import * as fs from "fs";
import type { Party } from "../types/index.js";

export function registerPartyCommands(program: Command): void {
  const party = program
    .command("party")
    .description("Manage parties");

  party
    .command("list")
    .description("List parties in the current campaign")
    .option("-n, --limit <number>", "Number of parties to show", "10")
    .option("-p, --page <number>", "Page number", "1")
    .option("--json", "Output as JSON")
    .action(async (options) => {
      try {
        const campaignId = getCurrentCampaignId();
        if (!campaignId) {
          error("No campaign selected. Run 'chiwar config set campaign <id>'");
          process.exit(1);
        }

        const result = await listParties({
          limit: parseInt(options.limit),
          page: parseInt(options.page),
        });

        if (options.json) {
          console.log(JSON.stringify(result.parties, null, 2));
          return;
        }

        if (result.parties.length === 0) {
          info("No parties found");
          return;
        }

        console.log(`\nParties (${result.meta.total_count} total):\n`);
        for (const p of result.parties) {
          printPartySummary(p);
        }

        if (result.meta.total_pages > 1) {
          console.log(`\nPage ${result.meta.current_page} of ${result.meta.total_pages}`);
        }
      } catch (err) {
        error(err instanceof Error ? err.message : "Failed to list parties");
        process.exit(1);
      }
    });

  party
    .command("show")
    .description("Show details of a specific party")
    .argument("<id>", "Party ID")
    .option("--json", "Output as JSON")
    .action(async (id, options) => {
      try {
        const p = await getParty(id);

        if (options.json) {
          console.log(JSON.stringify(p, null, 2));
          return;
        }

        printPartyDetails(p);
      } catch (err) {
        error(err instanceof Error ? err.message : "Failed to get party");
        process.exit(1);
      }
    });

  party
    .command("create")
    .description("Create a new party")
    .argument("[json]", "Inline JSON or Name")
    .option("-n, --name <name>", "Party name")
    .option("-d, --description <text>", "Party description")
    .option("--faction <name>", "Assign to faction (by name, fuzzy match)")
    .option("-f, --file <path>", "Read party JSON from file (overrides other options)")
    .option("--json", "Output as JSON")
    .action(async (jsonArg, options) => {
      try {
        const campaignId = getCurrentCampaignId();
        if (!campaignId) {
          error("No campaign selected. Run 'chiwar config set campaign <id>'");
          process.exit(1);
        }

        let partyData: Record<string, unknown>;

        if (options.file) {
          // Read from file
          const fileContent = fs.readFileSync(options.file, "utf-8");
          partyData = JSON.parse(fileContent);
        } else if (jsonArg) {
          // Try parsing as JSON, fallback to treating as name
          try {
            partyData = JSON.parse(jsonArg);
          } catch {
            partyData = { name: jsonArg };
          }
        } else if (options.name) {
          partyData = { name: options.name };
        } else {
          error("Provide party JSON, name, or file");
          process.exit(1);
        }

        if (options.description) partyData.description = options.description;

        // ... rest of logic


        // Handle faction lookup if specified
        if (options.faction) {
          const faction = await searchFaction(options.faction);
          if (!faction) {
            error(`No faction found matching "${options.faction}"`);
            console.log("\nUse 'chiwar faction list' to see all factions");
            process.exit(1);
          }
          partyData.faction_id = faction.id;
          info(`Faction: ${faction.name}`);
        }

        const created = await createParty(partyData);

        if (options.json) {
          console.log(JSON.stringify(created, null, 2));
          return;
        }

        success(`Created party: ${created.name}`);
        console.log(`  ID: ${created.id}`);
        if (created.description) console.log(`  Description: ${created.description}`);
        if (created.faction) console.log(`  Faction: ${created.faction.name}`);
      } catch (err) {
        if (err instanceof SyntaxError) {
          error("Invalid JSON: " + err.message);
        } else {
          error(err instanceof Error ? err.message : "Failed to create party");
        }
        process.exit(1);
      }
    });

  party
    .command("update")
    .description("Update an existing party")
    .argument("<id>", "Party ID to update")
    .argument("[json]", "Inline JSON")
    .option("-n, --name <name>", "New party name")
    .option("-d, --description <text>", "New description")
    .option("--faction <name>", "Assign to faction (by name, fuzzy match)")
    .option("-f, --file <path>", "Read party JSON from file (overrides other options)")
    .option("--json", "Output as JSON")
    .action(async (id, jsonArg, options) => {
      try {
        let partyData: Record<string, unknown>;

        if (options.file) {
          // Read from file
          const fileContent = fs.readFileSync(options.file, "utf-8");
          partyData = JSON.parse(fileContent);
        } else if (jsonArg) {
          partyData = JSON.parse(jsonArg);
        } else {
          partyData = {};
        }

        if (options.name) partyData.name = options.name;
        if (options.description) partyData.description = options.description;

        // Handle faction lookup if specified
        if (options.faction) {
          const faction = await searchFaction(options.faction);
          if (!faction) {
            error(`No faction found matching "${options.faction}"`);
            console.log("\nUse 'chiwar faction list' to see all factions");
            process.exit(1);
          }
          partyData.faction_id = faction.id;
          info(`Faction: ${faction.name}`);
        }

        if (Object.keys(partyData).length === 0) {
          error("No updates specified. Use --name, --description, --faction, or --file");
          process.exit(1);
        }

        const updated = await updateParty(id, partyData);

        if (options.json) {
          console.log(JSON.stringify(updated, null, 2));
          return;
        }

        success(`Updated party: ${updated.name}`);
        console.log(`  ID: ${updated.id}`);
        if (updated.description) console.log(`  Description: ${updated.description}`);
        if (updated.faction) console.log(`  Faction: ${updated.faction.name}`);
      } catch (err) {
        if (err instanceof SyntaxError) {
          error("Invalid JSON: " + err.message);
        } else {
          error(err instanceof Error ? err.message : "Failed to update party");
        }
        process.exit(1);
      }
    });

  party
    .command("delete")
    .description("Delete a party")
    .argument("<id>", "Party ID to delete")
    .option("-y, --yes", "Skip confirmation")
    .action(async (id, options) => {
      try {
        // First fetch the party to show what will be deleted
        const p = await getParty(id);

        if (!options.yes) {
          console.log(`\nAbout to delete party: ${p.name}`);
          console.log(`  ID: ${id}`);
          if (p.characters && p.characters.length > 0) {
            console.log(`  Members: ${p.characters.length} characters`);
          }
          console.log("\nUse --yes to confirm deletion");
          process.exit(0);
        }

        await deleteParty(id);
        success(`Deleted party: ${p.name}`);
      } catch (err) {
        error(err instanceof Error ? err.message : "Failed to delete party");
        process.exit(1);
      }
    });

  party
    .command("templates")
    .description("List available party templates")
    .option("--json", "Output as JSON")
    .action(async (options) => {
      try {
        const templates = await listPartyTemplates();

        if (options.json) {
          console.log(JSON.stringify(templates, null, 2));
          return;
        }

        console.log("\nAvailable Party Templates:\n");
        for (const t of templates) {
          console.log(`  ${t.key}`);
          console.log(`    Name: ${t.name}`);
          console.log(`    ${t.description}`);
          console.log(`    Slots:`);
          for (const slot of t.slots) {
            const mooks = slot.default_mook_count ? ` (${slot.default_mook_count} mooks)` : "";
            console.log(`      - ${slot.label}: ${slot.role}${mooks}`);
          }
          console.log("");
        }
      } catch (err) {
        error(err instanceof Error ? err.message : "Failed to list templates");
        process.exit(1);
      }
    });

  party
    .command("apply-template")
    .description("Apply a template to a party")
    .argument("<party-id>", "Party ID")
    .argument("<template-key>", "Template key (e.g., boss_fight, ambush)")
    .option("--json", "Output as JSON")
    .action(async (partyId, templateKey, options) => {
      try {
        const updated = await applyPartyTemplate(partyId, templateKey);

        if (options.json) {
          console.log(JSON.stringify(updated, null, 2));
          return;
        }

        success(`Applied template "${templateKey}" to party: ${updated.name}`);
        console.log(`\n  Composition Slots (${updated.slots?.length || 0}):`);
        if (updated.slots) {
          for (const slot of updated.slots) {
            const char = slot.character ? slot.character.name : "(empty)";
            const mooks = slot.default_mook_count ? ` x${slot.default_mook_count}` : "";
            console.log(`    - ${slot.role}: ${char}${mooks}`);
          }
        }
        console.log("");
      } catch (err) {
        error(err instanceof Error ? err.message : "Failed to apply template");
        process.exit(1);
      }
    });

  party
    .command("assign-slot")
    .description("Assign a character to a party slot")
    .argument("<party-id>", "Party ID")
    .argument("<slot-id>", "Slot ID")
    .argument("<character-id>", "Character ID to assign")
    .option("--json", "Output as JSON")
    .action(async (partyId, slotId, characterId, options) => {
      try {
        const updated = await assignCharacterToSlot(partyId, slotId, characterId);

        if (options.json) {
          console.log(JSON.stringify(updated, null, 2));
          return;
        }

        success(`Assigned character to slot in party: ${updated.name}`);
        console.log(`\n  Composition Slots (${updated.slots?.length || 0}):`);
        if (updated.slots) {
          for (const slot of updated.slots) {
            const char = slot.character ? slot.character.name : "(empty)";
            const mooks = slot.default_mook_count ? ` x${slot.default_mook_count}` : "";
            console.log(`    - ${slot.role}: ${char}${mooks}`);
          }
        }
        console.log("");
      } catch (err) {
        error(err instanceof Error ? err.message : "Failed to assign character to slot");
        process.exit(1);
      }
    });

  party
    .command("clear-slot")
    .description("Clear a character from a party slot")
    .argument("<party-id>", "Party ID")
    .argument("<slot-id>", "Slot ID to clear")
    .option("--json", "Output as JSON")
    .action(async (partyId, slotId, options) => {
      try {
        const updated = await clearSlot(partyId, slotId);

        if (options.json) {
          console.log(JSON.stringify(updated, null, 2));
          return;
        }

        success(`Cleared slot in party: ${updated.name}`);
        console.log(`\n  Composition Slots (${updated.slots?.length || 0}):`);
        if (updated.slots) {
          for (const slot of updated.slots) {
            const char = slot.character ? slot.character.name : "(empty)";
            const mooks = slot.default_mook_count ? ` x${slot.default_mook_count}` : "";
            console.log(`    - ${slot.role}: ${char}${mooks}`);
          }
        }
        console.log("");
      } catch (err) {
        error(err instanceof Error ? err.message : "Failed to clear slot");
        process.exit(1);
      }
    });
}

function printPartySummary(party: Party): void {
  const memberCount = (party.characters?.length || 0) + (party.vehicles?.length || 0);
  const slotCount = party.slots?.length || 0;

  console.log(`  ${party.name}`);
  console.log(`    ID: ${party.id}`);

  const details: string[] = [];
  if (memberCount > 0) details.push(`${memberCount} members`);
  if (slotCount > 0) details.push(`${slotCount} slots`);
  if (party.faction) details.push(party.faction.name);

  if (details.length > 0) {
    console.log(`    ${details.join(" | ")}`);
  }
  console.log("");
}

function printPartyDetails(party: Party): void {
  console.log(`\n${party.name}`);
  console.log("=".repeat(party.name.length));
  console.log(`  ID: ${party.id}`);

  if (party.description) console.log(`  Description: ${party.description}`);
  if (party.faction) console.log(`  Faction: ${party.faction.name}`);
  if (party.juncture) console.log(`  Juncture: ${party.juncture.name}`);

  if (party.characters && party.characters.length > 0) {
    console.log(`\n  Characters (${party.characters.length}):`);
    for (const char of party.characters) {
      console.log(`    - ${char.name}`);
    }
  }

  if (party.vehicles && party.vehicles.length > 0) {
    console.log(`\n  Vehicles (${party.vehicles.length}):`);
    for (const v of party.vehicles) {
      console.log(`    - ${v.name}`);
    }
  }

  if (party.slots && party.slots.length > 0) {
    console.log(`\n  Composition Slots (${party.slots.length}):`);
    for (const slot of party.slots) {
      const char = slot.character ? slot.character.name : "(empty)";
      const mooks = slot.default_mook_count ? ` x${slot.default_mook_count}` : "";
      console.log(`    - ${slot.role}: ${char}${mooks}`);
    }
  }

  console.log(`\n  Created: ${new Date(party.created_at).toLocaleDateString()}`);
  console.log("");
}
