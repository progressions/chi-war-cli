import { Command } from "commander";
import { fetchAdventure, fetchAdventureById } from "../lib/api.js";
import { success, error, info } from "../lib/output.js";

export function registerAdventureCommands(program: Command): void {
  const adventure = program
    .command("adventure")
    .description("Fetch adventures from Notion");

  adventure
    .command("fetch")
    .description("Fetch adventure by search query (e.g., 'Chicago On Fire', 'Tesla')")
    .argument("<query>", "Adventure name or search query")
    .option("--id", "Treat query as a Notion page ID instead of search")
    .option("--list", "Only show matching pages, don't fetch content")
    .action(async (query, options) => {
      try {
        let result;

        if (options.id) {
          // Fetch by page ID
          result = await fetchAdventureById(query);
        } else {
          // Search by query
          result = await fetchAdventure(query);
        }

        if (options.list && result.pages) {
          // Only show matching pages
          console.log(`\nFound ${result.pages.length} matching pages:\n`);
          for (const page of result.pages) {
            console.log(`  ${page.title}`);
            console.log(`    ID: ${page.id}`);
            console.log();
          }
          info("Use 'adventure fetch <query>' without --list to see content");
          info("Use 'adventure fetch <id> --id' to fetch a specific page");
          return;
        }

        // Display full adventure content
        success(`${result.title}`);
        console.log(`Page ID: ${result.page_id}\n`);
        console.log("─".repeat(60));
        console.log(result.content);
        console.log("─".repeat(60));

        // Show other matching pages if available
        if (result.pages && result.pages.length > 1) {
          console.log(`\nOther matching pages (${result.pages.length - 1}):`);
          for (const page of result.pages.slice(1, 5)) {
            console.log(`  - ${page.title} (${page.id})`);
          }
          if (result.pages.length > 5) {
            console.log(`  ... and ${result.pages.length - 5} more`);
          }
        }
      } catch (err) {
        error(err instanceof Error ? err.message : "Failed to fetch adventure");
        process.exit(1);
      }
    });

  adventure
    .command("search")
    .description("Search for adventures without fetching content")
    .argument("<query>", "Adventure name or search query")
    .action(async (query) => {
      try {
        const result = await fetchAdventure(query);

        if (result.pages && result.pages.length > 0) {
          console.log(`\nFound ${result.pages.length} matching pages:\n`);
          for (const page of result.pages) {
            console.log(`  ${page.title}`);
            console.log(`    ID: ${page.id}`);
            console.log();
          }
          info("Use 'adventure fetch <query>' to see content of first match");
          info("Use 'adventure fetch <id> --id' to fetch a specific page");
        } else {
          info(`No adventure pages found matching '${query}'`);
        }
      } catch (err) {
        error(err instanceof Error ? err.message : "Failed to search adventures");
        process.exit(1);
      }
    });
}
