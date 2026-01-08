import { Command } from "commander";
import { listFactions, searchFaction } from "../lib/api.js";
import { success, error, info } from "../lib/output.js";

export function registerFactionCommands(program: Command): void {
  const faction = program
    .command("faction")
    .description("Manage factions");

  faction
    .command("list")
    .description("List all factions in the current campaign")
    .action(async () => {
      try {
        const factions = await listFactions();

        if (factions.length === 0) {
          info("No factions found in current campaign");
          return;
        }

        console.log(`\nFactions (${factions.length}):\n`);
        for (const f of factions) {
          console.log(`  ${f.name}`);
          console.log(`    ID: ${f.id}`);
          if (f.description) {
            console.log(`    ${f.description}`);
          }
          console.log();
        }
      } catch (err) {
        error(err instanceof Error ? err.message : "Failed to list factions");
        process.exit(1);
      }
    });

  faction
    .command("search")
    .description("Search for a faction by name")
    .argument("<query>", "Faction name to search for")
    .action(async (query) => {
      try {
        const match = await searchFaction(query);

        if (!match) {
          error(`No faction found matching "${query}"`);
          console.log("\nUse 'chiwar faction list' to see all factions");
          process.exit(1);
        }

        success(`Found: ${match.name}`);
        console.log(`  ID: ${match.id}`);
        if (match.description) {
          console.log(`  Description: ${match.description}`);
        }
      } catch (err) {
        error(err instanceof Error ? err.message : "Failed to search factions");
        process.exit(1);
      }
    });
}
