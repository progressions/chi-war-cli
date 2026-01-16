import { Command } from "commander";
import { getCampaign, listFights, searchNotionPages, fetchSessionById, fetchSessionNotes } from "../lib/api.js";
import { getCurrentCampaignId } from "../lib/config.js";
import { success, error, info, heading } from "../lib/output.js";

export function registerDashboardCommands(program: Command): void {
  program
    .command("dashboard")
    .description("Show the campaign dashboard (summary, next adventure, fights)")
    .action(async () => {
      try {
        const campaignId = getCurrentCampaignId();
        if (!campaignId) {
          error("No current campaign set. Use 'chiwar campaign set <id>'");
          return;
        }

        // 1. Fetch Campaign
        const campaign = await getCampaign(campaignId);
        success(`Dashboard for Campaign: ${campaign.name}`);

        // 2. Fetch Latest Report
        try {
          const reportResult = await fetchSessionNotes("Report - Session");
          const reportContent = reportResult.content || "";

          if (reportContent) {
            heading("Current State (Latest Report)");
            // Look for 'Session Summary' section
            let displayContent = reportContent;
            const summaryIndex = reportContent.indexOf("## Session Summary");
            if (summaryIndex !== -1) {
              displayContent = reportContent.substring(summaryIndex);
            }

            const lines = displayContent.split("\n");
            const summary = lines.slice(0, 15).join("\n");
            console.log(summary.trim() + (lines.length > 15 ? "\n..." : ""));

            if (reportResult.page_id) {
              console.log(`\nFull report: https://notion.so/${reportResult.page_id}`);
            }
          } else {
            info("No session reports found.");
          }
        } catch {
          info("No session reports found.");
        }

        // 3. Fetch Next Adventure (Upcoming Session)
        try {
          const sessionResult = await fetchSessionNotes("Session");
          const sessionContent = sessionResult.content || "";

          if (sessionContent) {
            heading("Next Adventure (Upcoming Session)");

            // Try to find the "Session" or "Opening" section
            let displayContent = sessionContent;
            const sessionIndex = sessionContent.indexOf("# Session");
            if (sessionIndex !== -1) {
              displayContent = sessionContent.substring(sessionIndex);
            }

            const lines = displayContent.split("\n");
            const blurb = lines.slice(0, 20).join("\n");

            console.log(blurb.trim() + (displayContent.length > blurb.length ? "\n..." : ""));

            if (sessionResult.page_id) {
              console.log(`\nFull notes: https://notion.so/${sessionResult.page_id}`);
            }
          } else {
            info("No upcoming session notes found.");
          }
        } catch {
          info("No upcoming session notes found.");
        }

        // 4. Fetch Fights (filter out ended fights)
        const fightResult = await listFights({ active: true });
        // Filter out fights that have ended (ended_at is set)
        const activeFights = fightResult.fights.filter(f => !f.ended_at);
        if (activeFights.length > 0) {
          heading("Active/Upcoming Fights");
          for (const fight of activeFights) {
            console.log(`  - ${fight.name} (ID: ${fight.id})`);
            if (fight.description) {
              // Strip HTML tags
              const stripped = fight.description.replace(/<[^>]*>/g, "");
              console.log(`    ${stripped}`);
            }
          }
        } else {
          heading("Upcoming Fights");
          info("No active fights found for this campaign.");
        }

      } catch (err) {
        error(err instanceof Error ? err.message : "Failed to load dashboard");
        process.exit(1);
      }
    });
}
