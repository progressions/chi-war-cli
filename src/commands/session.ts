import { Command } from "commander";
import { fetchSessionNotes, fetchSessionById } from "../lib/api.js";
import { success, error, info } from "../lib/output.js";

export function registerSessionCommands(program: Command): void {
  const session = program
    .command("session")
    .description("Fetch session notes from Notion");

  session
    .command("fetch")
    .description("Fetch session notes by search query (e.g., '5-10', 'session 5-11')")
    .argument("<query>", "Session number or search query")
    .option("--id", "Treat query as a Notion page ID instead of search")
    .option("--list", "Only show matching pages, don't fetch content")
    .action(async (query, options) => {
      try {
        let result;

        if (options.id) {
          // Fetch by page ID
          result = await fetchSessionById(query);
        } else {
          // Search by query
          result = await fetchSessionNotes(query);
        }

        if (options.list && result.pages) {
          // Only show matching pages
          console.log(`\nFound ${result.pages.length} matching pages:\n`);
          for (const page of result.pages) {
            console.log(`  ${page.title}`);
            console.log(`    ID: ${page.id}`);
            console.log();
          }
          info("Use 'session fetch <query>' without --list to see content");
          info("Use 'session fetch <id> --id' to fetch a specific page");
          return;
        }

        // Display full session content
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
        error(err instanceof Error ? err.message : "Failed to fetch session notes");
        process.exit(1);
      }
    });

  session
    .command("search")
    .description("Search for session notes without fetching content")
    .argument("<query>", "Session number or search query")
    .action(async (query) => {
      try {
        const result = await fetchSessionNotes(query);

        if (result.pages && result.pages.length > 0) {
          console.log(`\nFound ${result.pages.length} matching pages:\n`);
          for (const page of result.pages) {
            console.log(`  ${page.title}`);
            console.log(`    ID: ${page.id}`);
            console.log();
          }
          info("Use 'session fetch <query>' to see content of first match");
          info("Use 'session fetch <id> --id' to fetch a specific page");
        } else {
          info(`No session pages found matching '${query}'`);
        }
      } catch (err) {
        error(err instanceof Error ? err.message : "Failed to search sessions");
        process.exit(1);
      }
    });
}
