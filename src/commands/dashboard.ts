import { Command } from "commander";
import { getCampaign, listFights, searchNotionPages, fetchSessionById } from "../lib/api.js";
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
        const reports = await searchNotionPages("Report - Session");
        const latestReport = reports
          .filter(p => {
            const title = p.title || "";
            return title.startsWith("Report - Session") && !title.includes("5-xx");
          })
          .sort((a, b) => (b.title || "").localeCompare(a.title || ""))[0];

        if (latestReport) {
          heading("Current State (Latest Report)");
          const content = await fetchSessionById(latestReport.id);
          // Just show the first few paragraphs or a summary
          // Look for 'Session Summary' or just take the first few lines
          let displayContent = content.content;
          const summaryIndex = content.content.indexOf("## Session Summary");
          if (summaryIndex !== -1) {
             displayContent = content.content.substring(summaryIndex);
          }
          
          const lines = displayContent.split("\n");
          const summary = lines.slice(0, 15).join("\n");
          console.log(summary.trim() + (lines.length > 15 ? "\n..." : ""));
          console.log(`\nFull report: ${latestReport.url}`);
        } else {
          info("No session reports found.");
        }

        // 3. Fetch Next Adventure
        const sessions = await searchNotionPages("Session");
        // Filter out reports and template pages
        const latestSession = sessions
          .filter(p => {
            const title = p.title || "";
            return title.startsWith("Session") && !title.startsWith("Report") && !title.includes("5-xx");
          })
          .sort((a, b) => (b.title || "").localeCompare(a.title || ""))[0];

        if (latestSession) {
          heading("Next Adventure (Upcoming Session)");
          const content = await fetchSessionById(latestSession.id);
          
          // Try to find the "Session" or "Opening" section
          let displayContent = content.content;
          const sessionIndex = content.content.indexOf("# Session");
          if (sessionIndex !== -1) {
            displayContent = content.content.substring(sessionIndex);
          }
          
          const lines = displayContent.split("\n");
          const blurb = lines.slice(0, 20).join("\n");
          
          console.log(blurb.trim() + (displayContent.length > blurb.length ? "\n..." : ""));
          console.log(`\nFull notes: ${latestSession.url}`);
        } else {
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
