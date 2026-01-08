import { Command } from "commander";
import { listParties, getParty, createParty, updateParty, deleteParty, searchFaction } from "../lib/api.js";
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
    .argument("<name>", "Party name")
    .option("-d, --description <text>", "Party description")
    .option("--faction <name>", "Assign to faction (by name, fuzzy match)")
    .option("-f, --file <path>", "Read party JSON from file (overrides other options)")
    .option("--json", "Output as JSON")
    .action(async (name, options) => {
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
        } else {
          // Build from arguments
          partyData = { name };
          if (options.description) partyData.description = options.description;
        }

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
    .option("-n, --name <name>", "New party name")
    .option("-d, --description <text>", "New description")
    .option("--faction <name>", "Assign to faction (by name, fuzzy match)")
    .option("-f, --file <path>", "Read party JSON from file (overrides other options)")
    .option("--json", "Output as JSON")
    .action(async (id, options) => {
      try {
        let partyData: Record<string, unknown>;

        if (options.file) {
          // Read from file
          const fileContent = fs.readFileSync(options.file, "utf-8");
          partyData = JSON.parse(fileContent);
        } else {
          // Build from arguments
          partyData = {};
          if (options.name) partyData.name = options.name;
          if (options.description) partyData.description = options.description;
        }

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
