import { Command } from "commander";
import { searchNotionPages } from "../lib/api.js";
import { success, error, info } from "../lib/output.js";

export function registerNotionCommands(program: Command): void {
  const notion = program
    .command("notion")
    .description("Search Notion pages");

  notion
    .command("search <query>")
    .description("Search all Notion pages by name")
    .option("--json", "Output as JSON")
    .action(async (query, options) => {
      try {
        const pages = await searchNotionPages(query);

        if (options.json) {
          console.log(JSON.stringify(pages, null, 2));
          return;
        }

        if (pages.length === 0) {
          info(`No Notion pages found matching '${query}'`);
          return;
        }

        success(`Found ${pages.length} Notion page(s) matching '${query}'`);
        console.log();

        for (const page of pages) {
          console.log(`  ${page.title || page.name || "Untitled"}`);
          console.log(`    ID: ${page.id}`);
          if (page.url) {
            console.log(`    URL: ${page.url}`);
          }
          console.log();
        }

        info("Use session commands for session-specific searches with content");
      } catch (err) {
        error(err instanceof Error ? err.message : "Failed to search Notion");
        process.exit(1);
      }
    });
}
