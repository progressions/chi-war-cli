import { Command } from "commander";
import { getCampaign, listFights, fetchSessionById, fetchSessionNotes } from "../lib/api.js";
import { getCurrentCampaignId } from "../lib/config.js";
import { success, error, info, heading } from "../lib/output.js";

// Parse date from page date property or fall back to title
function parseDate(page: { date?: string | null; title: string }): Date | null {
  // Prefer the actual Date property from Notion
  if (page.date) {
    return new Date(page.date);
  }
  // Fall back to parsing from title like "Session 5-11 - 2026-01-24"
  const dateMatch = page.title.match(/(\d{4}-\d{2}-\d{2})/);
  if (dateMatch) {
    return new Date(dateMatch[1]);
  }
  return null;
}

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

        // 2. Fetch Latest Report - use fetchSessionNotes which returns pages array
        try {
          const reportResult = await fetchSessionNotes("Report - Session");
          const allPages = reportResult.pages || [];

          // Filter to only actual session reports: "Report - Session X-XX - YYYY-MM-DD"
          const reportPattern = /^Report\s*-\s*Session\s+\d+-\d+\s*-\s*\d{4}-\d{2}-\d{2}/i;
          const reports = allPages
            .filter(p => reportPattern.test(p.title))
            .map(p => ({
              ...p,
              date: parseDate(p),
            }))
            .filter(p => p.date !== null)
            .sort((a, b) => {
              // Sort by date descending (most recent first)
              if (a.date && b.date) {
                return b.date.getTime() - a.date.getTime();
              }
              return 0;
            });

          if (reports.length > 0) {
            const latestReport = reports[0];
            const fetchedReport = await fetchSessionById(latestReport.id);
            const reportContent = fetchedReport.content || "";

            heading(`Latest Session Report: ${latestReport.title}`);
            // Look for 'Session Summary' section
            let displayContent = reportContent;
            const summaryIndex = reportContent.indexOf("## Session Summary");
            if (summaryIndex !== -1) {
              displayContent = reportContent.substring(summaryIndex);
            }

            const lines = displayContent.split("\n");
            const summary = lines.slice(0, 15).join("\n");
            console.log(summary.trim() + (lines.length > 15 ? "\n..." : ""));

            console.log(`\nFull report: https://notion.so/${latestReport.id}`);
          } else {
            info("No session reports found.");
          }
        } catch {
          info("No session reports found.");
        }

        // 3. Fetch Next Adventure (Upcoming Session) - use fetchSessionNotes which returns pages array
        try {
          const sessionResult = await fetchSessionNotes("Session");
          const allPages = sessionResult.pages || [];

          // Filter to session notes: "Session X-XX - YYYY-MM-DD" but NOT reports or transcriptions
          const sessionPattern = /^Session\s+\d+-\d+\s*-\s*\d{4}-\d{2}-\d{2}$/i;
          const today = new Date();
          today.setHours(0, 0, 0, 0);

          const sessions = allPages
            .filter(p => sessionPattern.test(p.title.trim()))
            .map(p => ({
              ...p,
              date: parseDate(p),
            }))
            .filter(p => p.date !== null)
            .sort((a, b) => {
              // Sort by date descending (most recent/upcoming first)
              if (a.date && b.date) {
                return b.date.getTime() - a.date.getTime();
              }
              return 0;
            });

          // Find the next upcoming session (today or future), or fall back to most recent
          let nextSession = sessions.find(s => s.date && s.date >= today);
          if (!nextSession && sessions.length > 0) {
            // No future sessions, use the most recent one
            nextSession = sessions[0];
          }

          if (nextSession) {
            const fetchedSession = await fetchSessionById(nextSession.id);
            const sessionContent = fetchedSession.content || "";

            heading(`Next Session: ${nextSession.title}`);

            // Try to find the "Session" or "Opening" section
            let displayContent = sessionContent;
            const sessionIndex = sessionContent.indexOf("# Session");
            if (sessionIndex !== -1) {
              displayContent = sessionContent.substring(sessionIndex);
            }

            const lines = displayContent.split("\n");
            const blurb = lines.slice(0, 20).join("\n");

            console.log(blurb.trim() + (displayContent.length > blurb.length ? "\n..." : ""));

            console.log(`\nFull notes: https://notion.so/${nextSession.id}`);
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
